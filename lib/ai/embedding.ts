import OpenAI from 'openai'
import { getCollections } from '@/lib/db/mongodb'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
const embeddingModelName = process.env.EMBED_MODEL || 'text-embedding-3-large'

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replace(/\n/g, ' ')
  const resp = await openai.embeddings.create({ model: embeddingModelName, input })
  return resp.data[0].embedding as unknown as number[]
}

export const findRelevantContent = async (userQuery: string, limit: number = 5, sources?: string[]) => {
  const { embeddings, resources } = await getCollections()
  const numEmbeddings = await embeddings.countDocuments()

  console.log(`[RAG-SEARCH] Query: "${userQuery.substring(0, 100)}${userQuery.length > 100 ? '...' : ''}"`)
  console.log(`[RAG-SEARCH] Total embeddings in DB: ${numEmbeddings}`)
  console.log(`[RAG-SEARCH] Filtering by sources: ${sources ? sources.join(', ') : 'ALL sources'}`)

  // Check if query contains problem labels (A1, B6, etc.)
  const problemLabelMatch = userQuery.match(/\b([A-Z]\d+)\b/i)
  const hasProblemLabel = !!problemLabelMatch
  if (hasProblemLabel) {
    console.log(`[RAG-SEARCH] Detected problem label: ${problemLabelMatch[1]} - will boost matching chunks`)
  }

  if (numEmbeddings > 0) {
    console.log(`[RAG-SEARCH] Generating embedding for query...`)
    const qv = await generateEmbedding(userQuery)
    console.log(`[RAG-SEARCH] Embedding generated (dimension: ${qv.length})`)
    
    // Increase search limit if problem label detected (to catch more potential matches)
    const searchLimit = hasProblemLabel ? Math.max(limit * 5, 40) : Math.max(limit * 3, 24)
    console.log(`[RAG-SEARCH] Performing vector search with numCandidates: 200, limit: ${searchLimit}...`)
    
    const vectorResults = await embeddings.aggregate<{ content: string; resourceId?: string; source?: string; score: number }>([
      { 
        $vectorSearch: { 
          queryVector: qv, 
          path: 'embedding', 
          numCandidates: 200, 
          limit: searchLimit, // Get more results when searching for specific problems
          index: 'embedding_index'
        } 
      },
      { $project: { _id: 0, content: 1, resourceId: 1, source: 1, score: { $meta: 'vectorSearchScore' } } }
    ]).toArray()
    
    console.log(`[RAG-SEARCH] Vector search returned ${vectorResults.length} results (before source filtering)`)
    
    if (vectorResults.length > 0) {
      // Filter by sources after vector search if specified
      let results = sources 
        ? vectorResults.filter(result => result.source && sources.includes(result.source))
        : vectorResults
      
      console.log(`[RAG-SEARCH] After filtering by sources: ${results.length} results`)
      if (sources && results.length < vectorResults.length) {
        const filteredOut = vectorResults.filter(r => !r.source || !sources.includes(r.source))
        console.log(`[RAG-SEARCH] Filtered out ${filteredOut.length} results from other sources`)
        filteredOut.slice(0, 3).forEach((r, i) => {
          console.log(`[RAG-SEARCH]   Filtered result ${i + 1}: source="${r.source}", score=${r.score?.toFixed(3)}`)
        })
      }
      
      // Boost chunks containing problem labels if detected
      if (hasProblemLabel && problemLabelMatch) {
        const label = problemLabelMatch[1].toUpperCase()
        console.log(`[RAG-SEARCH] Boosting chunks containing "${label}"`)
        
        // Find chunks containing the label
        const labelChunks = results.filter(r => {
          // Check for exact match: "A1" (with word boundaries)
          const labelRegex = new RegExp(`\\b${label}\\b`, 'i')
          return labelRegex.test(r.content)
        })
        
        console.log(`[RAG-SEARCH] Found ${labelChunks.length} chunks with exact "${label}" match`)
        
        // Find label chunks and their positions, then boost accordingly
        const labelChunkIndices: number[] = []
        const labelPositions: Map<number, boolean> = new Map() // index -> labelAtEnd
        
        // First pass: identify label chunks and their positions
        results.forEach((r, idx) => {
          const labelRegex = new RegExp(`\\b${label}\\b`, 'i')
          const match = r.content.match(labelRegex)
          if (match) {
            const labelIndex = match.index || 0
            const labelAtEnd = labelIndex > r.content.length * 0.7 // Label in last 30% of chunk
            labelChunkIndices.push(idx)
            labelPositions.set(idx, labelAtEnd)
          }
        })
        
        // Boost label chunks significantly
        results = results.map((r, idx) => {
          const labelRegex = new RegExp(`\\b${label}\\b`, 'i')
          if (labelRegex.test(r.content)) {
            const match = r.content.match(labelRegex)
            const labelIndex = match?.index || 0
            const labelAtEnd = labelIndex > r.content.length * 0.7
            
            // Higher boost if label is at beginning/middle (problem is in this chunk)
            // Lower boost if label is at end (problem is likely in next chunk)
            const boost = labelAtEnd ? 0.25 : 0.35
            console.log(`[RAG-SEARCH]   Chunk ${idx}: Label "${label}" at position ${labelIndex}/${r.content.length} (${labelAtEnd ? 'END' : 'MIDDLE'}), boosting by ${boost}`)
            return { ...r, score: Math.min(1.0, r.score + boost) }
          }
          return r
        })
        
        // Boost the chunk immediately AFTER each label chunk (problem content continuation)
        labelChunkIndices.forEach((index) => {
          const labelAtEnd = labelPositions.get(index) || false
          if (index + 1 < results.length) {
            const nextChunk = results[index + 1]
            const nextLabel = String.fromCharCode(label.charCodeAt(0)) + String(parseInt(label.slice(1)) + 1)
            const hasNextLabel = new RegExp(`\\b${nextLabel}\\b`, 'i').test(nextChunk.content)
            
            // If label is at end, ALWAYS boost next chunk (problem statement is definitely there)
            // Otherwise, boost if next chunk doesn't immediately start with next problem
            if (labelAtEnd) {
              // Always boost when label is at end - problem statement is in next chunk
              results[index + 1] = { ...nextChunk, score: Math.min(1.0, nextChunk.score + 0.25) }
              console.log(`[RAG-SEARCH] Boosting chunk ${index + 1} after "${label}" (label at end, problem statement in next chunk)`)
            } else if (!hasNextLabel || nextChunk.content.indexOf(nextLabel) > 150) {
              // Boost if next chunk doesn't start with next problem immediately
              results[index + 1] = { ...nextChunk, score: Math.min(1.0, nextChunk.score + 0.2) }
              console.log(`[RAG-SEARCH] Also boosting chunk ${index + 1} after "${label}" (likely contains problem statement)`)
            }
          }
        })
        
        // Re-sort by boosted scores
        results.sort((a, b) => b.score - a.score)
        const boosted = results.filter(r => {
          const labelRegex = new RegExp(`\\b${label}\\b`, 'i')
          return labelRegex.test(r.content)
        })
        console.log(`[RAG-SEARCH] Boosted ${boosted.length} chunks containing "${label}"`)
      }
      
      // When searching for specific problems, ensure we include chunks with the label AND the next chunk
      let finalResults = results.slice(0, limit)
      
      if (hasProblemLabel && problemLabelMatch) {
        const label = problemLabelMatch[1].toUpperCase()
        const labelRegex = new RegExp(`\\b${label}\\b`, 'i')
        
        // Find the label chunk in the sorted results (after boosting)
        const labelChunkIndex = results.findIndex(r => labelRegex.test(r.content))
        
        if (labelChunkIndex >= 0) {
          const labelChunk = results[labelChunkIndex]
          const labelMatch = labelChunk.content.match(labelRegex)
          const labelIndex = labelMatch?.index || 0
          const labelAtEnd = labelIndex > labelChunk.content.length * 0.7
          
          // If label is at end of chunk, problem statement is DEFINITELY in next chunk
          if (labelAtEnd && labelChunkIndex + 1 < results.length) {
            const nextChunk = results[labelChunkIndex + 1]
            
            // Check if next chunk is already in final results by comparing content
            const nextChunkInResults = finalResults.some(r => r.content === nextChunk.content)
            
            // When label is at end, ALWAYS ensure next chunk is included (it contains the problem statement)
            if (!nextChunkInResults) {
              // Replace last result with next chunk to ensure we capture the problem statement
              finalResults = [...finalResults.slice(0, limit - 1), nextChunk]
              console.log(`[RAG-SEARCH] Included next chunk to capture full problem "${label}" statement (label at end of chunk)`)
            } else {
              console.log(`[RAG-SEARCH] Next chunk already in results, problem "${label}" should be captured`)
            }
          }
        }
      }
      
      console.log(`[RAG-SEARCH] Returning top ${finalResults.length} results`)
      finalResults.forEach((r, i) => {
        const labelMatch = hasProblemLabel ? (() => {
          const labelRegex = new RegExp(`\\b${problemLabelMatch![1].toUpperCase()}\\b`, 'i')
          return labelRegex.test(r.content) ? ' [LABEL MATCH]' : ''
        })() : ''
        console.log(`[RAG-SEARCH]   Result ${i + 1}: source="${r.source}", score=${r.score?.toFixed(3)}${labelMatch}, content="${r.content.substring(0, 80)}..."`)
      })
      
      return finalResults.map(v => ({ name: v.content, similarity: v.score, resourceId: v.resourceId, source: v.source }))
    } else {
      console.log(`[RAG-SEARCH] No vector search results found`)
    }
  } else {
    console.log(`[RAG-SEARCH] No embeddings in database, falling back to lexical search`)
  }

  // Fallback lexical
  console.log(`[RAG-SEARCH] Using lexical (regex) fallback search`)
  const regex = userQuery.split(/\s+/).filter(t => t.length > 2).join('|')
  const filter = sources ? { content: { $regex: regex, $options: 'i' }, source: { $in: sources } } : { content: { $regex: regex, $options: 'i' } }
  console.log(`[RAG-SEARCH] Lexical filter: ${JSON.stringify(filter)}`)
  const text = await resources.find(filter).limit(limit).toArray()
  console.log(`[RAG-SEARCH] Lexical search found ${text.length} results`)
  return text.map(r => ({ 
    name: (r as { content: string }).content, 
    similarity: 0.6, 
    resourceId: (r as { id?: string; _id?: { toString(): string } }).id || (r as { _id?: { toString(): string } })._id?.toString?.(), 
    source: (r as { source?: string }).source 
  }))
}



