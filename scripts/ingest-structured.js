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
  // Support both public/content and public/Content (case-insensitive on Windows, but explicit for Git)
  const contentDirLower = path.join(process.cwd(), 'public', 'content')
  const contentDirUpper = path.join(process.cwd(), 'public', 'Content')
  const contentDir = fs.existsSync(contentDirLower) ? contentDirLower : contentDirUpper

  if (!fs.existsSync(contentDir)) {
    console.error('Content folder not found. Expected one of:', contentDirLower, 'or', contentDirUpper)
    process.exit(1)
  }

  const files = fs.readdirSync(contentDir).filter(f => f.toLowerCase().endsWith('.pdf'))
  if (files.length === 0) {
    console.error('No PDF files found in', contentDir)
    process.exit(1)
  }

  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db('math1000a_tutors')
  const resources = db.collection('resources')
  const embeddings = db.collection('embeddings')

  await resources.deleteMany({})
  await embeddings.deleteMany({})

  let totalParagraphs = 0
  for (const filename of files) {
    const pdfPath = path.join(contentDir, filename)
    const data = await pdf(fs.readFileSync(pdfPath))
    const paragraphs = splitIntoParagraphs(cleanPdfText(data.text))
    totalParagraphs += paragraphs.length
    console.log(`Processing ${filename}: ${paragraphs.length} paragraphs`)

    for (let i = 0; i < paragraphs.length; i++) {
      const content = paragraphs[i]
      const id = `${path.parse(filename).name}-${i}-${Date.now()}`
      const emb = await embed(content)
      await resources.insertOne({ id, content, createdAt: new Date() })
      await embeddings.insertOne({ id: `${id}-emb`, resourceId: id, content, embedding: emb, createdAt: new Date() })
      if (i % 25 === 0) console.log(`Ingested ${i}/${paragraphs.length} from ${filename}`)
    }
  }

  await client.close()
  console.log('Done. Total paragraphs ingested:', totalParagraphs)
}

main().catch(e => { console.error(e); process.exit(1) })



