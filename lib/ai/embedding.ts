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

  if (numEmbeddings > 0) {
    const qv = await generateEmbedding(userQuery)
    const vectorResults = await embeddings.aggregate<{ content: string; resourceId?: string; source?: string; score: number }>([
      { 
        $vectorSearch: { 
          queryVector: qv, 
          path: 'embedding', 
          numCandidates: 200, 
          limit: Math.max(limit * 3, 24), // Get more results to filter from
          index: 'embedding_index'
        } 
      },
      { $project: { _id: 0, content: 1, resourceId: 1, source: 1, score: { $meta: 'vectorSearchScore' } } }
    ]).toArray()
    if (vectorResults.length > 0) {
      // Filter by sources after vector search if specified
      const results = sources 
        ? vectorResults.filter(result => result.source && sources.includes(result.source))
        : vectorResults
      
      return results.slice(0, limit).map(v => ({ name: v.content, similarity: v.score, resourceId: v.resourceId, source: v.source }))
    }
  }

  // Fallback lexical
  const regex = userQuery.split(/\s+/).filter(t => t.length > 2).join('|')
  const filter = sources ? { content: { $regex: regex, $options: 'i' }, source: { $in: sources } } : { content: { $regex: regex, $options: 'i' } }
  const text = await resources.find(filter).limit(limit).toArray()
  return text.map(r => ({ 
    name: (r as { content: string }).content, 
    similarity: 0.6, 
    resourceId: (r as { id?: string; _id?: { toString(): string } }).id || (r as { _id?: { toString(): string } })._id?.toString?.(), 
    source: (r as { source?: string }).source 
  }))
}



