import OpenAI from 'openai'
import { findRelevantContent, generateEmbedding } from '@/lib/ai/embedding'
import { getCollections } from '@/lib/db/mongodb'

export const maxDuration = 30
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function POST(req: Request) {
  try {
    const input: { messages: Array<{ role: 'user'|'assistant'; content: string }>; threadId?: string|null } = await req.json()
    const lastMessage = input.messages[input.messages.length - 1]
    const userQuery = lastMessage?.content || ''
    const threadId = input.threadId || 'session-' + Date.now()
    
    console.log('[MATH-RAG] User query:', userQuery)

    // Load thread history and persist the new user message
    const { threads, chatMemory, threadSummaries } = await getCollections()
    await threads.updateOne(
      { sessionId: threadId, chapter: 'math1000a' },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { updatedAt: new Date() },
        $push: { messages: { role: 'user', content: userQuery, timestamp: new Date() } }
      },
      { upsert: true }
    )

    const threadDoc = await threads.findOne({ sessionId: threadId, chapter: 'math1000a' })
    const turnIndex = (threadDoc?.messages?.length || 0) + 1
    const history = (threadDoc?.messages || []).slice(-12) // keep recent turns for chronology

    // Retrieve long-term memory: top N prior exchanges semantically related to this query
    let memoryContext = ''
    try {
      const priorCount = await chatMemory.countDocuments({ threadId })
      if (priorCount > 0) {
        const queryVec = await generateEmbedding(userQuery)
        const memoryHits = await chatMemory.aggregate<{
          content: string;
          role: 'user'|'assistant';
          score: number;
        }>([
          {
            $vectorSearch: {
              queryVector: queryVec,
              path: 'embedding',
              numCandidates: 100,
              limit: 6,
              index: 'chat_memory_index',
              filter: { threadId }
            }
          },
          { $project: { _id: 0, content: 1, role: 1, score: { $meta: 'vectorSearchScore' } } }
        ]).toArray()
        if (memoryHits.length > 0) {
          memoryContext = memoryHits.map(h => `[${h.role}] ${h.content}`).join('\n')
        }
      }
    } catch (e) {
      console.log('[MATH-RAG] Memory retrieval skipped:', e)
    }

    // Search for relevant content from PDFs
    const searchResults = await findRelevantContent(userQuery, 4)
    console.log('[MATH-RAG] Found', searchResults.length, 'relevant results')

    // Prepare context from search results
    let contextText = ''
    if (searchResults.length > 0) {
      contextText = searchResults.map(r => `${r.source ? `[${r.source}]` : ''}\n${r.name}`).join('\n\n')
    }

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

Your mission is to ensure the student arrives in class fully prepared on this unit and has truly mastered the concepts and exercises in the two PDFs.

${contextText ? `Context extracted from course materials:

${contextText}

Use this context as authoritative for wording and definitions.` : 'No specific course passages were found for this query. Answer using only the Real Numbers unit knowledge.'}`

    const summaryDoc = await threadSummaries.findOne({ threadId, chapter: 'math1000a' })
    const summaryBlock = summaryDoc?.summary ? `\n\nConversation summary (so far):\n${summaryDoc.summary}` : ''
    const memoryBlock = memoryContext
      ? `\n\nRelevant prior conversation excerpts:\n${memoryContext}`
      : ''

    // Get AI response with full context
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt + summaryBlock + memoryBlock },
        ...history.map(m => ({ role: m.role, content: m.content } as { role: 'user'|'assistant'; content: string })),
        { role: 'user', content: userQuery }
      ],
      temperature: 0.3,
      max_tokens: 800
    })

    const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'
    
    console.log('[MATH-RAG] Response generated, length:', aiResponse.length)

    // Save assistant message
    await threads.updateOne(
      { sessionId: threadId, chapter: 'math1000a' },
      {
        $set: { updatedAt: new Date() },
        $push: { messages: { role: 'assistant', content: aiResponse, timestamp: new Date() } }
      }
    )

    // Store chat memory embeddings for long-term retrieval
    try {
      const items = [
        { role: 'user' as const, content: userQuery },
        { role: 'assistant' as const, content: aiResponse }
      ]
      const embeddings = await Promise.all(items.map(async (it) => ({
        role: it.role,
        content: it.content,
        embedding: await generateEmbedding(it.content)
      })))
      const docs = embeddings.map((e, idx) => ({
        threadId,
        role: e.role,
        turn: turnIndex + idx,
        content: e.content,
        embedding: e.embedding,
        createdAt: new Date()
      }))
      await chatMemory.insertMany(docs)
    } catch (e) {
      console.log('[MATH-RAG] Memory write skipped:', e)
    }

    return Response.json({
      content: aiResponse,
      searchResults: searchResults.length,
      hasContext: contextText.length > 0,
      threadId
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[MATH-RAG] Error:', error)
    return Response.json(
      { error: 'Failed to process request', details: message },
      { status: 500 }
    )
  }
}

// Fetch a thread's messages
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const threadId = searchParams.get('threadId')
  if (!threadId) {
    return Response.json({ error: 'threadId is required' }, { status: 400 })
  }
  const { threads } = await getCollections()
  const thread = await threads.findOne({ sessionId: threadId, chapter: 'math1000a' })
  return Response.json({ messages: thread?.messages || [] })
}