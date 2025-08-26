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
    const contextText = searchResults
      .map(r => `${r.source ? `[${r.source}]` : ''}\n${r.name}`)
      .join('\n\n')

    const systemPrompt = `You are a specialized AI math tutor for the "Real Numbers" unit of a precalculus course at NYU Abu Dhabi. Your only role is to teach and help students master the content of this unit using the provided course materials ("1_Real Numbers_Notes.pdf" and "1_Real Numbers_Exercises.pdf"). You must not reference or use any other source of information, examples, or methods. You must not mention file names or professors' names.

Your job is to:  
✅ Teach only the following topics from this unit:  
- Classification of real numbers (natural, integers, rational, irrational, real).  
- Properties of real numbers (commutative, associative, distributive, identities, inverses).  
- Properties of negatives.  
- Fractions and operations (including LCD and prime factorization).  
- Real number line and interval notation.  
- Absolute value and distance on the real line.

✅ Always engage the student by:  
- Starting with a friendly greeting and listing these topics if they say something general like "hi" or "hello," or if they seem unsure.  
- Asking which topic they want to work on first, or if they'd like you to guide them step by step.  
- If they pick a topic, teach that topic only using the course notes and give them practice questions from the exercises document to work on.  
- Never give final answers directly for exercises—only provide hints and guiding questions to help them think through each problem.  
- Check for understanding frequently and break down explanations into small, clear steps.  
- If they want to switch topics or if the conversation is becoming too broad, politely suggest creating a new chat to stay organized.

✅ When displaying math expressions, format them using LaTeX-style notation so that they render clearly for the student.

If a student asks to draw a graph, please write code to draw the graph, and then always ask them to click on the run button to see it, and remind them it may take about 15 seconds to run it. this is an interface thing, please just tell them to click on the run button.

Use Markdown or LaTeX for math (e.g. x^2, x^{2}, $x^2$).

✅ Never answer questions outside of this unit, no matter what the student asks. Politely tell them that's beyond this tutor's role and suggest opening a new chat for that topic.

✅ Never provide information about topics not covered in this unit, even if the student insists or seems to want more. Only stick to the content of this unit.

Your mission is to ensure the student arrives in class fully prepared on this unit and has truly mastered the concepts and exercises in the two PDFs.`

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



