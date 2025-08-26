import OpenAI from 'openai'
import { getCollections } from '@/lib/db/mongodb'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
const embeddingModelName = process.env.EMBED_MODEL || 'text-embedding-3-large'

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replace(/\n/g, ' ')
  const resp = await openai.embeddings.create({ model: embeddingModelName, input })
  return resp.data[0].embedding as unknown as number[]
}

export const findRelevantContent = async (userQuery: string, limit: number = 5) => {
  const { embeddings, resources } = await getCollections()
  const numEmbeddings = await embeddings.countDocuments()

  if (numEmbeddings > 0) {
    const qv = await generateEmbedding(userQuery)
    const vectorResults = await embeddings.aggregate<{ content: string; resourceId?: string; score: number }>([
      { $vectorSearch: { queryVector: qv, path: 'embedding', numCandidates: 200, limit: Math.max(limit, 8), index: 'embedding_index' } },
      { $project: { _id: 0, content: 1, resourceId: 1, score: { $meta: 'vectorSearchScore' } } }
    ]).toArray()
    if (vectorResults.length > 0) {
      return vectorResults.slice(0, limit).map(v => ({ name: v.content, similarity: v.score, resourceId: v.resourceId }))
    }
  }

  // Fallback lexical
  const regex = userQuery.split(/\s+/).filter(t => t.length > 2).join('|')
  const text = await resources.find({ content: { $regex: regex, $options: 'i' } }).limit(limit).toArray()
  return text.map(r => ({ name: r.content, similarity: 0.6, resourceId: (r as any).id || (r as any)._id?.toString?.() }))
}



