const path = require('path')
const fs = require('fs')
// Load env from local .env.local, then fallback to parent .env.local if needed
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
if (!process.env.MONGODB_URI || !process.env.OPENAI_API_KEY) {
  const parentEnv = path.join(process.cwd(), '..', '.env.local')
  if (fs.existsSync(parentEnv)) {
    require('dotenv').config({ path: parentEnv })
  }
}
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

function splitIntoParagraphs(text) { 
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean) 
}

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

  function canonicalize(name) {
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_.-]+/g, '_')
      .replace(/_+/g, '_')
  }

  // Allow Exponents and Radicals chapters
  const allow = new Set([
    '2_exponents_notes.pdf',
    '2_exponents_exercises.pdf',
    '3_radicals_notes.pdf',
    '3_radicals_exercises.pdf'
  ])

  const files = fs
    .readdirSync(contentDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .filter(f => allow.has(canonicalize(f)))

  if (files.length === 0) {
    console.error('No PDF files found in', contentDir)
    process.exit(1)
  }

  console.log('Found files:', files)

  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db('math1000a_tutors')
  const resources = db.collection('resources')
  const embeddings = db.collection('embeddings')

  // Clean only for our four sources
  const sourcesToClean = ['2_Exponents_Notes', '2_Exponents_Exercises', '3_Radicals_Notes', '3_Radicals_Exercises']
  await resources.deleteMany({ source: { $in: sourcesToClean } })
  await embeddings.deleteMany({ source: { $in: sourcesToClean } })

  let totalParagraphs = 0
  for (const filename of files) {
    const pdfPath = path.join(contentDir, filename)
    const data = await pdf(fs.readFileSync(pdfPath))
    const paragraphs = splitIntoParagraphs(cleanPdfText(data.text))
    totalParagraphs += paragraphs.length
    console.log(`Processing ${filename}: ${paragraphs.length} paragraphs`)

    const baseName = path.parse(filename).name
    const source = baseName
    for (let i = 0; i < paragraphs.length; i++) {
      const content = paragraphs[i]
      const id = `${baseName}-${i}-${Date.now()}`
      const emb = await embed(content)
      await resources.insertOne({ id, source, content, createdAt: new Date() })
      await embeddings.insertOne({ id: `${id}-emb`, resourceId: id, source, content, embedding: emb, createdAt: new Date() })
      if (i % 25 === 0) console.log(`Ingested ${i}/${paragraphs.length} from ${filename}`)
    }
  }

  await client.close()
  console.log('Done. Total paragraphs ingested:', totalParagraphs)
}

main().catch(e => { console.error(e); process.exit(1) })
