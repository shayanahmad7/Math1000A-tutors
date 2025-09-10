import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { findRelevantContent } from "@/lib/ai/embedding";
import { getCollections } from "@/lib/db/mongodb";

// Next.js API route configuration
export const maxDuration = 30; // Allow up to 30 seconds for AI processing
export const runtime = 'nodejs'; // Use Node.js runtime for OpenAI SDK compatibility
export const dynamic = 'force-dynamic'; // Disable static optimization for dynamic responses

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Initialize Google GenAI client
const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Available models for selection (used in frontend component)
// const AVAILABLE_MODELS = {
//   openai: [
//     { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
//     { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
//     { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' }
//   ],
//   gemini: [
//     { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
//     { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
//     { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
//     { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' }
//   ]
// };

/**
 * Multi-model RAG-powered chat endpoint
 * 
 * This endpoint:
 * 1. Receives user messages with model selection
 * 2. Searches MongoDB for relevant content
 * 3. Uses selected LLM (OpenAI or Gemini) to generate responses
 * 4. Returns intelligent tutoring responses
 */
export async function POST(req: Request) {
  try {
    // Parse incoming message data
    const input: { 
      messages: Array<{ role: 'user'|'assistant'; content: string }>; 
      threadId?: string|null;
      selectedModel: string;
      chapter: string;
    } = await req.json();
    
    const lastMessage = input.messages[input.messages.length - 1];
    const userQuery = lastMessage?.content || '';
    const threadId = input.threadId || 'session-' + Date.now();
    const selectedModel = input.selectedModel || 'gpt-4o';
    const chapter = input.chapter || 'math1000a';
    
    console.log(`[RAG-MULTIMODEL] User query: ${userQuery}, Model: ${selectedModel}, Chapter: ${chapter}`);

    // Load thread history and persist the new user message
    const { threads, chatMemory, threadSummaries } = await getCollections();
    await threads.updateOne(
      { sessionId: threadId, chapter },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { updatedAt: new Date(), selectedModel },
        $push: { messages: { role: 'user', content: userQuery, timestamp: new Date() } }
      },
      { upsert: true }
    );

    const threadDoc = await threads.findOne({ sessionId: threadId, chapter });
    const turnIndex = (threadDoc?.messages?.length || 0) + 1;
    const history = (threadDoc?.messages || []).slice(-12); // keep recent turns for chronology

    // Retrieve long-term memory: top N prior exchanges semantically related to this query
    let memoryContext = '';
    try {
      const priorCount = await chatMemory.countDocuments({ threadId });
      if (priorCount > 0) {
        const queryVec = await (await import('@/lib/ai/embedding')).generateEmbedding(userQuery);
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
        ]).toArray();
        if (memoryHits.length > 0) {
          memoryContext = memoryHits.map(h => `[${h.role}] ${h.content}`).join('\n');
        }
      }
    } catch (e) {
      console.log('[RAG-MULTIMODEL] Memory retrieval skipped:', e);
    }

    // Search for relevant content (vector + lexical hybrid)
    const searchResults = await findRelevantContent(userQuery, 4);
    console.log('[RAG-MULTIMODEL] Found', searchResults.length, 'relevant results');

    // Prepare context from search results
    let contextText = '';
    if (searchResults.length > 0) {
      contextText = searchResults.map(r => r.name).join('\n\n');
    }

    // Create focused tutoring system prompt
    const systemPrompt = `You are a specialized AI math tutor for the "Real Numbers" unit of a precalculus course at NYU Abu Dhabi. Your only role is to teach and help students master the content of this unit using the provided course materials ("1_Real Numbers_Notes.pdf" and "1_Real Numbers_Exercises.pdf"). You must not reference or use any other source of information, examples, or methods. You must not mention file names or professors' names.

Your job is to:  
Teach only the following topics from this unit:  
- Classification of real numbers (natural, integers, rational, irrational, real).  
- Properties of real numbers (commutative, associative, distributive, identities, inverses).  
- Properties of negatives.  
- Fractions and operations (including LCD and prime factorization).  
- Real number line and interval notation.  
- Absolute value and distance on the real line.

Always engage the student by:  
- Starting with a friendly greeting and listing these topics if they say something general like "hi" or "hello," or if they seem unsure.  
- Asking which topic they want to work on first, or if they'd like you to guide them step by step.  
- If they pick a topic, teach that topic only using the course notes and give them practice questions from the exercises document to work on.  
- Never give final answers directly for exercises—only provide hints and guiding questions to help them think through each problem.  
- Check for understanding frequently and break down explanations into small, clear steps.  
- If they want to switch topics or if the conversation is becoming too broad, politely suggest creating a new chat to stay organized.

When displaying math expressions, format them using LaTeX-style notation so that they render clearly for the student.

If a student asks to draw a graph, please write code to draw the graph, and then always ask them to click on the run button to see it, and remind them it may take about 15 seconds to run it. this is an interface thing, please just tell them to click on the run button.

Use Markdown or LaTeX for math (e.g. x^2, x^{2}, $x^2$).

Current conversation context:
- Turn: ${turnIndex}
- Recent conversation: ${history.map(m => `[${m.role}] ${m.content}`).join('\n')}
- Long-term memory: ${memoryContext}

Relevant course content:
${contextText}

Respond as a helpful math tutor, using the context above to provide accurate, relevant information.`;

    // Generate response using selected model
    let aiResponse = '';
    
    if (selectedModel.startsWith('gpt-')) {
      // Use OpenAI
      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    } else if (selectedModel.startsWith('gemini-')) {
      // Use Gemini
      const response = await gemini.models.generateContent({
        model: selectedModel,
        contents: systemPrompt + '\n\nUser question: ' + userQuery,
      });
      aiResponse = response.text || 'Sorry, I could not generate a response.';
    } else {
      throw new Error(`Unsupported model: ${selectedModel}`);
    }

    // Persist the AI response
    await threads.updateOne(
      { sessionId: threadId, chapter },
      { $push: { messages: { role: 'assistant', content: aiResponse, timestamp: new Date() } } }
    );

    // Store in long-term memory for future reference
    try {
      const userEmbedding = await (await import('@/lib/ai/embedding')).generateEmbedding(userQuery);
      const assistantEmbedding = await (await import('@/lib/ai/embedding')).generateEmbedding(aiResponse);
      
      await chatMemory.insertMany([
        {
          threadId,
          content: userQuery,
          role: 'user',
          embedding: userEmbedding,
          turn: turnIndex,
          createdAt: new Date()
        },
        {
          threadId,
          content: aiResponse,
          role: 'assistant',
          embedding: assistantEmbedding,
          turn: turnIndex,
          createdAt: new Date()
        }
      ]);
    } catch (e) {
      console.log('[RAG-MULTIMODEL] Memory storage skipped:', e);
    }

    // Update thread summary if needed
    if (turnIndex % 10 === 0) {
      try {
        const summaryPrompt = `Summarize the key points from this tutoring conversation in 2-3 sentences:\n\n${history.map(m => `[${m.role}] ${m.content}`).join('\n')}`;
        
        let summary = '';
        if (selectedModel.startsWith('gpt-')) {
          const summaryCompletion = await openai.chat.completions.create({
            model: selectedModel,
            messages: [{ role: 'user', content: summaryPrompt }],
            temperature: 0.3,
            max_tokens: 200,
          });
          summary = summaryCompletion.choices[0]?.message?.content || '';
        } else if (selectedModel.startsWith('gemini-')) {
          const summaryResponse = await gemini.models.generateContent({
            model: selectedModel,
            contents: summaryPrompt,
          });
          summary = summaryResponse.text || '';
        }
        
        if (summary) {
          await threadSummaries.updateOne(
            { threadId, chapter },
            { $set: { summary, updatedAt: new Date() } },
            { upsert: true }
          );
        }
      } catch (e) {
        console.log('[RAG-MULTIMODEL] Summary generation skipped:', e);
      }
    }

    return new Response(JSON.stringify({
      response: aiResponse,
      threadId,
      selectedModel,
      chapter
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[RAG-MULTIMODEL] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
