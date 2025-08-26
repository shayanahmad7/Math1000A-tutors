require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const pdf = require('pdf-parse')
const { MongoClient } = require('mongodb')
const OpenAI = require('openai')

const MONGODB_URI = process.env.MONGODB_URI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large'

if (!MONGODB_URI || !OPENAI_API_KEY) {
  console.error('Missing MONGODB_URI or OPENAI_API_KEY')
  process.exit(1)
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

function cleanPdfText(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\f/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').replace(/-\n/g, '').trim()
}

function splitIntoParagraphs(text) { return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean) }

async function embed(text) {
  const resp = await openai.embeddings.create({ model: EMBED_MODEL, input: text.replace(/\n/g, ' ') })
  return resp.data[0].embedding
}

async function main() {
  const pdfPath = path.join(process.cwd(), 'public', 'bookchapters', 'chapter.pdf')
  if (!fs.existsSync(pdfPath)) { console.error('PDF not found at', pdfPath); process.exit(1) }

  const data = await pdf(fs.readFileSync(pdfPath))
  const paragraphs = splitIntoParagraphs(cleanPdfText(data.text))
  console.log('Paragraphs:', paragraphs.length)

  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db('math1000a_tutors')
  const resources = db.collection('resources')
  const embeddings = db.collection('embeddings')

  await resources.deleteMany({})
  await embeddings.deleteMany({})

  for (let i = 0; i < paragraphs.length; i++) {
    const content = paragraphs[i]
    const id = `${i}-${Date.now()}`
    const emb = await embed(content)
    await resources.insertOne({ id, content, createdAt: new Date() })
    await embeddings.insertOne({ id: `${id}-emb`, resourceId: id, content, embedding: emb, createdAt: new Date() })
    if (i % 25 === 0) console.log(`Ingested ${i}/${paragraphs.length}`)
  }

  await client.close()
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })


