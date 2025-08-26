import OpenAI from 'openai'
import { findRelevantContent, generateEmbedding } from '@/lib/ai/embedding'
import { getCollections } from '@/lib/db/mongodb'

export const maxDuration = 30
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function POST(req: Request) {
  try {
    const input: { messages: Array<{ role: 'user'|'assistant'; content: string }> } = await req.json()
    const last = input.messages[input.messages.length - 1]
    const userQuery = last?.content || ''

    const { threads, chatMemory } = await getCollections()

    // Simple ephemeral session for now
    const sessionId = 'session-' + Date.now()
    await threads.updateOne(
      { sessionId, chapter: 'math1000a' },
      { $setOnInsert: { createdAt: new Date() }, $set: { updatedAt: new Date() }, $push: { messages: { role: 'user', content: userQuery, timestamp: new Date() } } },
      { upsert: true }
    )

    const searchResults = await findRelevantContent(userQuery, 5)
    const contextText = searchResults.map(r => r.name).join('\n\n')

    const systemPrompt = `You are a helpful Math 1000A tutor. Prefer concise, structured explanations. Use provided context passages verbatim for definitions and problem statements when possible. Math inline: $...$, display: $$...$$.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt + (contextText ? `\n\nContext:\n${contextText}` : '') },
        { role: 'user', content: userQuery }
      ],
      temperature: 0.3,
      max_tokens: 600
    })

    const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    // store minimal memory vectors
    try {
      const items = [
        { role: 'user' as const, content: userQuery },
        { role: 'assistant' as const, content: aiResponse }
      ]
      const docs = [] as any[]
      for (let i = 0; i < items.length; i++) {
        const emb = await generateEmbedding(items[i].content)
        docs.push({ threadId: sessionId, role: items[i].role, turn: i + 1, content: items[i].content, embedding: emb, createdAt: new Date() })
      }
      await chatMemory.insertMany(docs)
    } catch (_) {}

    return Response.json({ content: aiResponse })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: 'Failed', details: msg }, { status: 500 })
  }
}



