import { NextResponse } from 'next/server'
import { getCollections } from '@/lib/db/mongodb'
import { generateEmbedding } from '@/lib/ai/embedding'
import { parsePDF } from '@/lib/pdf-parser'

// Configuration for chunking
const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200
const MIN_CHUNK_SIZE = 100
const MAX_CHUNK_SIZE = 2000

export const maxDuration = 300 // 5 minutes for document processing
export const runtime = 'nodejs'

/**
 * Clean PDF text
 */
function cleanPdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/-\n/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ChunkMetadata {
  problemLabel?: string
  chunkType: string
}

/**
 * Chunk content intelligently
 */
function chunkContentIntelligently(content: string): Array<{ content: string; metadata: ChunkMetadata }> {
  const chunks: Array<{ content: string; metadata: ChunkMetadata }> = []
  
  // Detect problem labels for exercises
  const problemLabelRegex = /([A-Z]\d+)[\s\.:]*(?=\s|$)/g
  const problemLabels: Array<{ label: string; position: number }> = []
  let match
  
  while ((match = problemLabelRegex.exec(content)) !== null) {
    problemLabels.push({
      label: match[1],
      position: match.index
    })
  }
  
  // Split by paragraphs
  const paragraphs = content.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  
  // If we have problem labels, chunk around them
  if (problemLabels.length > 2) {
    return chunkByProblemLabels(content, problemLabels)
  }
  
  // If we have multiple paragraphs, use paragraph-based chunking
  if (paragraphs.length > 1) {
    return chunkByParagraphs(paragraphs)
  }
  
  // Fallback: sentence-based chunking
  return chunkBySentences(content)
}

function chunkByProblemLabels(content: string, labels: Array<{ label: string; position: number }>): Array<{ content: string; metadata: ChunkMetadata }> {
  const chunks: Array<{ content: string; metadata: ChunkMetadata }> = []
  let currentPos = 0
  
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]
    const nextLabel = labels[i + 1]
    const problemEnd = nextLabel ? nextLabel.position : content.length
    
    let problemSection = content.substring(currentPos, problemEnd).trim()
    
    if (!problemSection.includes(label.label)) {
      problemSection = content.substring(Math.max(0, label.position - 50), problemEnd).trim()
    }
    
    if (problemSection.length > 0) {
      if (problemSection.length > MAX_CHUNK_SIZE) {
        const subChunks = splitLargeChunk(problemSection, label.label)
        chunks.push(...subChunks)
      } else if (problemSection.length >= MIN_CHUNK_SIZE) {
        chunks.push({
          content: problemSection,
          metadata: { problemLabel: label.label, chunkType: 'problem' }
        })
      }
    }
    
    currentPos = problemEnd
  }
  
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

function chunkByParagraphs(paragraphs: string[]): Array<{ content: string; metadata: ChunkMetadata }> {
  const chunks: Array<{ content: string; metadata: ChunkMetadata }> = []
  let currentChunk = ''
  let currentSize = 0
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    const paraSize = para.length
    
    if (currentSize + paraSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkType: 'paragraph' }
      })
      
      const overlapText = currentChunk.slice(-CHUNK_OVERLAP)
      currentChunk = overlapText + '\n\n' + para
      currentSize = overlapText.length + paraSize
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + para
      currentSize += paraSize
    }
    
    if (currentSize >= CHUNK_SIZE) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkType: 'paragraph' }
      })
      currentChunk = ''
      currentSize = 0
    }
  }
  
  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { chunkType: 'paragraph' }
    })
  }
  
  return chunks
}

function chunkBySentences(content: string): Array<{ content: string; metadata: ChunkMetadata }> {
  const chunks: Array<{ content: string; metadata: ChunkMetadata }> = []
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  
  if (sentences.length === 0) {
    const parts = content.split(/[.!?\n]+/).filter(p => p.trim().length > 50)
    if (parts.length > 0) {
      return chunkByParts(parts)
    }
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

function chunkByParts(parts: string[]): Array<{ content: string; metadata: ChunkMetadata }> {
  const chunks: Array<{ content: string; metadata: ChunkMetadata }> = []
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

function chunkByFixedSize(content: string): Array<{ content: string; metadata: ChunkMetadata }> {
  const chunks: Array<{ content: string; metadata: ChunkMetadata }> = []
  let pos = 0
  
  while (pos < content.length) {
    const chunkEnd = Math.min(pos + CHUNK_SIZE, content.length)
    let chunk = content.substring(pos, chunkEnd)
    
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

function splitLargeChunk(content: string, problemLabel: string): Array<{ content: string; metadata: ChunkMetadata }> {
  const chunks: Array<{ content: string; metadata: ChunkMetadata }> = []
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
 * Process PDF file and create embeddings
 */
async function processPDF(pdfBuffer: Buffer, source: string): Promise<Array<{ content: string; source: string; chunkIndex: number; embedding: number[]; metadata: ChunkMetadata; id: string; resourceId: string }>> {
  try {
    console.log(`[CUSTOM-TUTOR-CREATE] Parsing PDF buffer (${pdfBuffer.length} bytes)...`)
    const data = await parsePDF(pdfBuffer)
    console.log(`[CUSTOM-TUTOR-CREATE] PDF parsed successfully, text length: ${data.text?.length || 0}`)
    const cleanedContent = cleanPdfText(data.text)
    
    if (!cleanedContent || cleanedContent.trim().length === 0) {
      console.log('[CUSTOM-TUTOR-CREATE] No content extracted from PDF')
      return []
    }
    
    console.log(`[CUSTOM-TUTOR-CREATE] Chunking content (${cleanedContent.length} chars)...`)
    const chunkObjects = chunkContentIntelligently(cleanedContent)
    console.log(`[CUSTOM-TUTOR-CREATE] Created ${chunkObjects.length} chunks`)
    
    const chunks: Array<{ content: string; source: string; chunkIndex: number; embedding: number[]; metadata: ChunkMetadata; id: string; resourceId: string }> = []
    
    for (let i = 0; i < chunkObjects.length; i++) {
      const chunkObj = chunkObjects[i]
      const chunk = chunkObj.content
      
      try {
        const embedding = await generateEmbedding(chunk)
        const id = `${source}_${i}_${Date.now()}`
        chunks.push({
          content: chunk,
          source: source,
          chunkIndex: i,
          embedding: embedding,
          metadata: chunkObj.metadata || { chunkType: 'unknown' },
          id: id,
          resourceId: id // Will be updated after resource insert
        })
      } catch (error) {
        console.error(`[CUSTOM-TUTOR-CREATE] Failed to embed chunk ${i + 1}:`, error)
      }
    }
    
    console.log(`[CUSTOM-TUTOR-CREATE] Successfully processed ${chunks.length} chunks from ${source}`)
    return chunks
  } catch (error) {
    console.error(`[CUSTOM-TUTOR-CREATE] Error processing PDF ${source}:`, error)
    throw error
  }
}

/**
 * Create custom tutor endpoint
 */
export async function POST(req: Request) {
  try {
    console.log('[CUSTOM-TUTOR-CREATE] ===== Starting Tutor Creation =====')
    
    const formData = await req.formData()
    const name = formData.get('name') as string
    const systemPrompt = formData.get('systemPrompt') as string
    const ownerId = formData.get('ownerId') as string || 'anonymous-' + Date.now()
    const description = formData.get('description') as string || ''
    
    if (!name || !systemPrompt) {
      return NextResponse.json({ 
        error: 'Name and system prompt are required' 
      }, { status: 400 })
    }
    
    // Get uploaded files
    const files: Array<{ name: string; buffer: Buffer; source: string }> = []
    let fileIndex = 0
    
    // Process all file fields from FormData
    const fileEntries = Array.from(formData.entries())
    for (const [key, value] of fileEntries) {
      if (key.startsWith('file') && value instanceof File) {
        const file = value
        if (file.type === 'application/pdf') {
          const buffer = Buffer.from(await file.arrayBuffer())
          const source = `custom_${ownerId}_${fileIndex}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`
          files.push({ name: file.name, buffer, source })
          fileIndex++
        }
      }
    }
    
    if (files.length === 0) {
      return NextResponse.json({ 
        error: 'At least one PDF file is required' 
      }, { status: 400 })
    }
    
    console.log(`[CUSTOM-TUTOR-CREATE] Creating tutor: ${name}`)
    console.log(`[CUSTOM-TUTOR-CREATE] Owner: ${ownerId}`)
    console.log(`[CUSTOM-TUTOR-CREATE] Files: ${files.length}`)
    
    const { customTutors, resources, embeddings } = await getCollections()
    
    // Generate unique tutor ID
    const tutorId = `tutor_${ownerId}_${Date.now()}`
    
    // Process all PDFs
    const sources: string[] = []
    let totalChunks = 0
    
    for (const file of files) {
      console.log(`[CUSTOM-TUTOR-CREATE] Processing: ${file.name}`)
      const chunks = await processPDF(file.buffer, file.source)
      
      if (chunks.length > 0) {
        sources.push(file.source)
        
        // Insert resources
        const resourceDocs = chunks.map(chunk => ({
          id: `${chunk.source}_${chunk.chunkIndex}_${Date.now()}`,
          content: chunk.content,
          createdAt: new Date()
        }))
        await resources.insertMany(resourceDocs)
        
        // Insert embeddings
        const embeddingDocs = chunks.map((chunk, idx) => ({
          id: `${chunk.source}_embedding_${chunk.chunkIndex}_${Date.now()}`,
          resourceId: resourceDocs[idx].id,
          content: chunk.content,
          embedding: chunk.embedding,
          source: chunk.source, // Add source field for filtering
          createdAt: new Date()
        }))
        await embeddings.insertMany(embeddingDocs)
        
        // Update chunks with resourceId
        chunks.forEach((chunk, idx) => {
          chunk.resourceId = resourceDocs[idx].id
        })
        
        totalChunks += chunks.length
        console.log(`[CUSTOM-TUTOR-CREATE] Processed ${chunks.length} chunks from ${file.name}`)
      }
    }
    
    // Create tutor record
    const tutorDoc = {
      tutorId,
      name,
      systemPrompt,
      sources,
      ownerId,
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await customTutors.insertOne(tutorDoc)
    
    console.log(`[CUSTOM-TUTOR-CREATE] Tutor created: ${tutorId}`)
    console.log(`[CUSTOM-TUTOR-CREATE] Total chunks: ${totalChunks}`)
    
    return NextResponse.json({
      success: true,
      tutor: {
        tutorId,
        name,
        systemPrompt,
        sources,
        ownerId,
        description,
        chunkCount: totalChunks
      }
    })
    
  } catch (error) {
    console.error('[CUSTOM-TUTOR-CREATE] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Failed to create tutor',
      details: errorMessage 
    }, { status: 500 })
  }
}

