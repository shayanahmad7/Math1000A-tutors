import { MongoClient, Db, Collection } from 'mongodb'

const uri = process.env.MONGODB_URI as string | undefined

let client: MongoClient
let db: Db

export interface Resource { _id?: string; id: string; content: string; createdAt: Date }
export interface Embedding { _id?: string; id: string; resourceId: string; content: string; embedding: number[]; createdAt: Date }
export interface ChatThread { _id?: string; sessionId: string; chapter: string; messages: { role: 'user'|'assistant'; content: string; timestamp: Date }[]; createdAt: Date; updatedAt: Date }
export interface ChatMemory { _id?: string; threadId: string; role: 'user'|'assistant'; turn: number; content: string; embedding: number[]; createdAt: Date }

let resourcesCollection: Collection<Resource>
let embeddingsCollection: Collection<Embedding>
let threadsCollection: Collection<ChatThread>
let chatMemoryCollection: Collection<ChatMemory>

export async function connectToDatabase() {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined')
  }
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
  }
  if (!db) {
    db = client.db('math1000a_tutors')
    resourcesCollection = db.collection<Resource>('resources')
    embeddingsCollection = db.collection<Embedding>('embeddings')
    threadsCollection = db.collection<ChatThread>('chat_threads')
    chatMemoryCollection = db.collection<ChatMemory>('chat_memory')
    await ensureIndexes()
  }
  return { db, resources: resourcesCollection, embeddings: embeddingsCollection, threads: threadsCollection, chatMemory: chatMemoryCollection }
}

async function ensureIndexes() {
  try {
    await resourcesCollection.createIndex({ content: 'text' })
    await threadsCollection.createIndex({ sessionId: 1, chapter: 1 })
    await chatMemoryCollection.createIndex({ threadId: 1, turn: 1 })
  } catch {
    // Silently handle index creation errors
  }
}

export async function getCollections() { await connectToDatabase(); return { resources: resourcesCollection, embeddings: embeddingsCollection, threads: threadsCollection, chatMemory: chatMemoryCollection } }


