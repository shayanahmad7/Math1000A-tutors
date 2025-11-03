/**
 * Professional RAG Ingestion Script for Math1000A Chapters
 * 
 * Best Practices Implemented:
 * - Intelligent chunking that preserves problem labels and boundaries
 * - Overlapping chunks for better context preservation
 * - Proper metadata tagging with source information
 * - Error handling with retry logic
 * - Progress tracking and detailed logging
 * - Batch processing for efficiency
 * 
 * Usage: node scripts/ingest-chapter.js <chapterId>
 * Example: node scripts/ingest-chapter.js radicals
 */

const { MongoClient } = require('mongodb')
const OpenAI = require('openai')
const fs = require('fs')
const path = require('path')
const pdf = require('pdf-parse')

require('dotenv').config({ path: '.env.local' })

const MONGODB_URI = process.env.MONGODB_URI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large'

if (!MONGODB_URI || !OPENAI_API_KEY) {
  console.error('❌ Missing required environment variables')
  console.error('   Required: MONGODB_URI, OPENAI_API_KEY')
  process.exit(1)
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
const client = new MongoClient(MONGODB_URI)

// Chapter configuration mapping
const CHAPTER_CONFIGS = {
  'real-numbers': {
    name: 'Real Numbers (Chapter 1)',
    sources: {
      '1_Real_Numbers_Notes': '1_Real Numbers_ Notes.pdf',
      '1_Real_Numbers_Exercises': '1_Real Numbers_Exercises.pdf'
    }
  },
  'exponents': {
    name: 'Exponents (Chapter 2)',
    sources: {
      '2_Exponents_Notes': '2_Exponents_Notes.pdf',
      '2_Exponents_Exercises': '2_Exponents_Exercises.pdf'
    }
  },
  'radicals': {
    name: 'Radicals (Chapter 3)',
    sources: {
      '3_Radicals_Notes': '3_Radicals_Notes.pdf',
      '3_Radicals_Exercises': '3_Radicals_Exercises.pdf'
    }
  }
}

// Configuration
const CHUNK_SIZE = 1000 // Target chunk size in characters
const CHUNK_OVERLAP = 200 // Overlap between chunks for context preservation
const MIN_CHUNK_SIZE = 100 // Minimum chunk size to avoid tiny fragments
const MAX_CHUNK_SIZE = 2000 // Maximum chunk size to avoid oversized chunks

/**
 * Clean PDF text for better processing
 */
function cleanPdfText(raw) {
  return raw
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\f/g, '\n')             // Replace form feeds
    .replace(/[ \t]+$/gm, '')         // Remove trailing whitespace
    .replace(/\n{3,}/g, '\n\n')       // Normalize multiple newlines
    .replace(/-\n/g, '')              // Join hyphenated words
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim()
}

/**
 * Intelligent chunking that preserves problem labels and structure
 * Uses multiple strategies: problem labels, paragraphs, sentences
 */
function chunkContentIntelligently(content, source) {
  // Strategy 1: Detect problem labels (A1, A2, B6, etc.) for exercises
  const problemLabelRegex = /\b([A-Z]\d+)[\s\.:]*(?=\s|$)/g
  const problemLabels = []
  let match
  
  while ((match = problemLabelRegex.exec(content)) !== null) {
    problemLabels.push({
      label: match[1],
      position: match.index,
      fullMatch: match[0]
    })
  }
  
  // Strategy 2: Split by double newlines (paragraphs)
  const paragraphs = content.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  
  // If we have problem labels, chunk around them (for exercises)
  if (problemLabels.length > 0 && source.includes('Exercises')) {
    console.log(`  📋 Found ${problemLabels.length} problem labels, using problem-aware chunking`)
    return chunkByProblemLabels(content, problemLabels)
  }
  
  // If we have multiple paragraphs, use paragraph-based chunking
  if (paragraphs.length > 1) {
    console.log(`  📄 Using paragraph-based chunking (${paragraphs.length} paragraphs)`)
    return chunkByParagraphs(paragraphs)
  }
  
  // Fallback: sentence-based chunking for single-paragraph documents
  console.log(`  📝 Using sentence-based chunking (single paragraph document)`)
  return chunkBySentences(content)
}

/**
 * Chunk content preserving problem labels with their statements
 */
function chunkByProblemLabels(content, labels) {
  const chunks = []
  let currentPos = 0
  
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]
    const nextLabel = labels[i + 1]
    const problemStart = label.position
    const problemEnd = nextLabel ? nextLabel.position : content.length
    
    // Extract problem section
    let problemSection = content.substring(currentPos, problemEnd).trim()
    
    // Ensure we include the label in the chunk
    if (!problemSection.includes(label.label)) {
      problemSection = content.substring(Math.max(0, problemStart - 50), problemEnd).trim()
    }
    
    if (problemSection.length > 0) {
      // If problem is too large, split it intelligently
      if (problemSection.length > MAX_CHUNK_SIZE) {
        const subChunks = splitLargeChunk(problemSection, label.label)
        chunks.push(...subChunks)
      } else if (problemSection.length >= MIN_CHUNK_SIZE) {
        chunks.push({
          content: problemSection,
          metadata: {
            problemLabel: label.label,
            chunkType: 'problem'
          }
        })
      }
    }
    
    currentPos = problemEnd
  }
  
  // Add any remaining content
  if (currentPos < content.length) {
    const remaining = content.substring(currentPos).trim()
    if (remaining.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: remaining,
        metadata: { chunkType: 'content' }
      })
    }
  }
  
  return chunks
}

/**
 * Chunk by paragraphs with overlap for context preservation
 */
function chunkByParagraphs(paragraphs) {
  const chunks = []
  let currentChunk = ''
  let currentSize = 0
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    const paraSize = para.length
    
    // If adding this paragraph would exceed max size, save current chunk
    if (currentSize + paraSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkType: 'paragraph' }
      })
      
      // Start new chunk with overlap (last part of previous chunk)
      const overlapText = currentChunk.slice(-CHUNK_OVERLAP)
      currentChunk = overlapText + '\n\n' + para
      currentSize = overlapText.length + paraSize
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + para
      currentSize += paraSize
    }
    
    // If chunk reaches target size, save it
    if (currentSize >= CHUNK_SIZE) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkType: 'paragraph' }
      })
      currentChunk = ''
      currentSize = 0
    }
  }
  
  // Add remaining chunk
  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { chunkType: 'paragraph' }
    })
  }
  
  return chunks
}

/**
 * Chunk by sentences with overlap (fallback for single-paragraph documents)
 */
function chunkBySentences(content) {
  const chunks = []
  // Split by sentence endings, preserving the punctuation
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  
  if (sentences.length === 0) {
    // If no sentence breaks found, split by periods or line breaks
    const parts = content.split(/[.!?\n]+/).filter(p => p.trim().length > 50)
    if (parts.length > 0) {
      return chunkByParts(parts)
    }
    // Last resort: split by fixed size
    return chunkByFixedSize(content)
  }
  
  let currentChunk = ''
  let currentSize = 0
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim()
    const sentenceSize = sentence.length
    
    if (currentSize + sentenceSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkType: 'sentence' }
      })
      
      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-CHUNK_OVERLAP)
      currentChunk = overlapText + ' ' + sentence
      currentSize = overlapText.length + sentenceSize
    } else {
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence
      currentSize += sentenceSize
    }
    
    if (currentSize >= CHUNK_SIZE) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkType: 'sentence' }
      })
      currentChunk = ''
      currentSize = 0
    }
  }
  
  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { chunkType: 'sentence' }
    })
  }
  
  return chunks
}

/**
 * Split large chunks by sentences
 */
function splitLargeChunk(content, problemLabel) {
  const chunks = []
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  
  let currentChunk = ''
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { problemLabel, chunkType: 'problem-fragment' }
      })
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence
    }
  }
  
  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { problemLabel, chunkType: 'problem-fragment' }
    })
  }
  
  return chunks
}

/**
 * Chunk by parts (fallback when sentences don't work)
 */
function chunkByParts(parts) {
  const chunks = []
  let currentChunk = ''
  
  for (const part of parts) {
    if (currentChunk.length + part.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkType: 'part' }
      })
      currentChunk = part
    } else {
      currentChunk += (currentChunk.length > 0 ? '. ' : '') + part
    }
  }
  
  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { chunkType: 'part' }
    })
  }
  
  return chunks
}

/**
 * Fixed-size chunking (last resort)
 */
function chunkByFixedSize(content) {
  const chunks = []
  let pos = 0
  
  while (pos < content.length) {
    const chunkEnd = Math.min(pos + CHUNK_SIZE, content.length)
    let chunk = content.substring(pos, chunkEnd)
    
    // Try to break at word boundary
    if (chunkEnd < content.length) {
      const lastSpace = chunk.lastIndexOf(' ')
      if (lastSpace > CHUNK_SIZE * 0.7) {
        chunk = chunk.substring(0, lastSpace)
        pos += lastSpace + 1
      } else {
        pos = chunkEnd
      }
    } else {
      pos = chunkEnd
    }
    
    if (chunk.trim().length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: chunk.trim(),
        metadata: { chunkType: 'fixed-size' }
      })
    }
  }
  
  return chunks
}

/**
 * Generate embedding with retry logic
 */
async function generateEmbedding(text, retries = 3) {
  const input = text.replace(/\n/g, ' ').substring(0, 8000) // API limit
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBED_MODEL,
        input
      })
      return response.data[0].embedding
    } catch (error) {
      if (attempt === retries) {
        console.error(`  ❌ Failed to generate embedding after ${retries} attempts:`, error.message)
        throw error
      }
      console.log(`  ⚠️  Embedding attempt ${attempt} failed, retrying...`)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
    }
  }
}

/**
 * Process a single PDF file
 */
async function processPDF(filePath, source) {
  console.log(`\n📄 Processing: ${source}`)
  console.log(`   File: ${path.basename(filePath)}`)
  
  try {
    // Read and parse PDF
    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdf(dataBuffer)
    const rawContent = data.text
    
    if (!rawContent || rawContent.trim().length === 0) {
      console.log(`   ⚠️  Empty PDF, skipping`)
      return []
    }
    
    // Clean content
    const cleanedContent = cleanPdfText(rawContent)
    console.log(`   📊 Content length: ${cleanedContent.length} characters`)
    
    // Intelligent chunking
    const chunkObjects = chunkContentIntelligently(cleanedContent, source)
    console.log(`   ✂️  Created ${chunkObjects.length} chunks`)
    
    // Generate embeddings
    const chunks = []
    for (let i = 0; i < chunkObjects.length; i++) {
      const chunkObj = chunkObjects[i]
      const chunk = chunkObj.content
      
      process.stdout.write(`   🔄 Embedding chunk ${i + 1}/${chunkObjects.length}...\r`)
      
      try {
        const embedding = await generateEmbedding(chunk)
        chunks.push({
          content: chunk,
          source: source,
          chunkIndex: i,
          embedding: embedding,
          metadata: chunkObj.metadata || {},
          createdAt: new Date()
        })
      } catch (error) {
        console.error(`\n   ❌ Failed to embed chunk ${i + 1}:`, error.message)
        // Continue with other chunks
      }
    }
    
    console.log(`   ✅ Successfully processed ${chunks.length} chunks`)
    return chunks
    
  } catch (error) {
    console.error(`   ❌ Error processing ${source}:`, error.message)
    return []
  }
}

/**
 * Main ingestion function
 */
async function main() {
  const chapterId = process.argv[2]
  
  if (!chapterId) {
    console.error('❌ Usage: node scripts/ingest-chapter.js <chapterId>')
    console.error('   Available chapters:', Object.keys(CHAPTER_CONFIGS).join(', '))
    process.exit(1)
  }
  
  const chapterConfig = CHAPTER_CONFIGS[chapterId]
  if (!chapterConfig) {
    console.error(`❌ Unknown chapter: ${chapterId}`)
    console.error('   Available chapters:', Object.keys(CHAPTER_CONFIGS).join(', '))
    process.exit(1)
  }
  
  console.log('🚀 Math1000A Chapter Ingestion Script')
  console.log('=====================================')
  console.log(`📚 Chapter: ${chapterConfig.name}`)
  console.log(`📝 Sources: ${Object.keys(chapterConfig.sources).join(', ')}`)
  console.log('')
  
  try {
    // Connect to MongoDB
    await client.connect()
    console.log('✅ Connected to MongoDB\n')
    
    const db = client.db('math1000a_tutors')
    const resources = db.collection('resources')
    const embeddings = db.collection('embeddings')
    
    // Find content directory
    const contentDirLower = path.join(process.cwd(), 'public', 'content')
    const contentDirUpper = path.join(process.cwd(), 'public', 'Content')
    const contentDir = fs.existsSync(contentDirLower) ? contentDirLower : contentDirUpper
    
    if (!fs.existsSync(contentDir)) {
      console.error('❌ Content folder not found!')
      console.error(`   Expected: ${contentDirLower} or ${contentDirUpper}`)
      process.exit(1)
    }
    
    console.log(`📁 Content directory: ${contentDir}\n`)
    
    // Delete existing data for this chapter
    const sourcesToDelete = Object.keys(chapterConfig.sources)
    console.log('🗑️  Deleting existing data...')
    const deleteResources = await resources.deleteMany({ source: { $in: sourcesToDelete } })
    const deleteEmbeddings = await embeddings.deleteMany({ source: { $in: sourcesToDelete } })
    console.log(`   Deleted ${deleteResources.deletedCount} resources`)
    console.log(`   Deleted ${deleteEmbeddings.deletedCount} embeddings\n`)
    
    // Process each source
    let totalChunks = 0
    const startTime = Date.now()
    
    for (const [source, fileName] of Object.entries(chapterConfig.sources)) {
      const filePath = path.join(contentDir, fileName)
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${fileName}`)
        console.log(`   Skipping ${source}\n`)
        continue
      }
      
      const chunks = await processPDF(filePath, source)
      
      if (chunks.length > 0) {
        // Insert resources
        const resourceDocs = chunks.map(chunk => ({
          content: chunk.content,
          source: chunk.source,
          chunkIndex: chunk.chunkIndex,
          metadata: chunk.metadata,
          createdAt: chunk.createdAt
        }))
        await resources.insertMany(resourceDocs)
        
        // Insert embeddings
        const embeddingDocs = chunks.map(chunk => ({
          content: chunk.content,
          source: chunk.source,
          chunkIndex: chunk.chunkIndex,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
          createdAt: chunk.createdAt
        }))
        await embeddings.insertMany(embeddingDocs)
        
        totalChunks += chunks.length
        console.log(`   💾 Saved ${chunks.length} chunks to database\n`)
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log('=====================================')
    console.log('✅ Ingestion Complete!')
    console.log(`📊 Total chunks ingested: ${totalChunks}`)
    console.log(`⏱️  Duration: ${duration}s`)
    console.log(`📚 Chapter: ${chapterConfig.name}`)
    console.log('=====================================\n')
    
  } catch (error) {
    console.error('\n❌ Error during ingestion:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('👋 Disconnected from MongoDB')
  }
}

main().catch(console.error)

