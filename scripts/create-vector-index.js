require('dotenv').config({ path: '.env.local' })
const { MongoClient } = require('mongodb')

const MONGODB_URI = process.env.MONGODB_URI
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large'

function dimsForModel(model) {
  if (model === 'text-embedding-3-large') return 3072
  if (model === 'text-embedding-3-small') return 1536
  return 1536
}

async function main() {
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db('math1000a_tutors')
  const embeddings = db.collection('embeddings')
  const chatMemory = db.collection('chat_memory')
  const dims = dimsForModel(EMBED_MODEL)

  const defn = { fields: [{ type: 'vector', path: 'embedding', numDimensions: dims, similarity: 'cosine' }] }

  // embeddings index
  const embName = 'embedding_index'
  const embExisting = await embeddings.listSearchIndexes(embName).toArray()
  if (embExisting.length > 0) {
    await embeddings.updateSearchIndex(embName, defn)
    console.log('embedding_index update requested')
  } else {
    const created = await embeddings.createSearchIndex({ name: embName, type: 'vectorSearch', definition: defn })
    console.log('embedding_index creation started:', created)
  }

  // chat memory index
  const memName = 'chat_memory_index'
  const memExisting = await chatMemory.listSearchIndexes(memName).toArray()
  if (memExisting.length > 0) {
    await chatMemory.updateSearchIndex(memName, defn)
    console.log('chat_memory_index update requested')
  } else {
    const createdMem = await chatMemory.createSearchIndex({ name: memName, type: 'vectorSearch', definition: defn })
    console.log('chat_memory_index creation started:', createdMem)
  }

  await client.close()
  console.log('Done. Atlas will build indexes in background.')
}

main().catch((e) => { console.error(e); process.exit(1) })



