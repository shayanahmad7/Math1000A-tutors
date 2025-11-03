import { NextResponse } from 'next/server'
import { getCollections } from '@/lib/db/mongodb'
import { findRelevantContent, generateEmbedding } from '@/lib/ai/embedding'

export const maxDuration = 30
export const runtime = 'nodejs'

// Import AVAILABLE_MODELS from openrouter-rag route
const AVAILABLE_MODELS = {
  'OpenAI': [
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ],
  'Anthropic': [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
    { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' }
  ],
  'Google': [
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
    { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5' }
  ],
  'Meta': [
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
    { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' }
  ]
}

/**
 * Chat with custom tutor endpoint
 */
export async function POST(req: Request) {
  try {
    console.log('[CUSTOM-TUTOR-CHAT] ===== Starting Request Processing =====')
    
    const input: {
      messages: Array<{ role: 'user'|'assistant'; content: string }>
      selectedModel: string
      tutorId: string
      threadId?: string
      files?: Array<{ name: string; data: string; type: string; size: number }>
      images?: Array<{ name: string; data: string; type: string; size: number }>
    } = await req.json()
    
    const selectedModel = input.selectedModel || 'openai/gpt-4o-mini'
    const tutorId = input.tutorId
    const threadId = input.threadId || `custom-${tutorId}-${Date.now()}`
    const lastMessage = input.messages[input.messages.length - 1]
    const userQuery = lastMessage?.content || ''
    
    console.log(`[CUSTOM-TUTOR-CHAT] Request Details:`)
    console.log(`  - Model: ${selectedModel}`)
    console.log(`  - Tutor ID: ${tutorId}`)
    console.log(`  - Thread ID: ${threadId}`)
    console.log(`  - User Query: "${userQuery}"`)
    
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({
        error: 'OpenRouter API key not configured'
      }, { status: 500 })
    }
    
    // Validate model
    const allModels = Object.values(AVAILABLE_MODELS).flat()
    const isValidModel = allModels.some(model => model.id === selectedModel)
    if (!isValidModel) {
      return NextResponse.json({
        error: 'Invalid model selection'
      }, { status: 400 })
    }
    
    // Get tutor config
    const { customTutors, threads, chatMemory, threadSummaries } = await getCollections()
    const tutor = await customTutors.findOne({ tutorId })
    
    if (!tutor) {
      return NextResponse.json({
        error: 'Tutor not found'
      }, { status: 404 })
    }
    
    console.log(`[CUSTOM-TUTOR-CHAT] Tutor: ${tutor.name}`)
    console.log(`[CUSTOM-TUTOR-CHAT] Sources: ${tutor.sources.join(', ')}`)
    
    // Load thread history (use tutorId as chapter identifier)
    await threads.updateOne(
      { sessionId: threadId, chapter: tutorId },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { updatedAt: new Date() },
        $push: { messages: { role: 'user', content: userQuery, timestamp: new Date() } }
      },
      { upsert: true }
    )
    
    const threadDoc = await threads.findOne({ sessionId: threadId, chapter: tutorId })
    const turnIndex = (threadDoc?.messages?.length || 0) + 1
    const history = (threadDoc?.messages || []).slice(-12)
    console.log(`[CUSTOM-TUTOR-CHAT] Thread loaded - Turn: ${turnIndex}, History length: ${history.length}`)
    
    // Retrieve long-term memory
    let memoryContext = ''
    try {
      const priorCount = await chatMemory.countDocuments({ threadId })
      console.log(`[CUSTOM-TUTOR-CHAT] Prior memory entries: ${priorCount}`)
      
      if (priorCount > 0) {
        const queryVec = await generateEmbedding(userQuery)
        const memoryHits = await chatMemory.aggregate<{
          content: string
          role: 'user'|'assistant'
          score: number
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
        
        console.log(`[CUSTOM-TUTOR-CHAT] Memory search results: ${memoryHits.length} hits`)
        if (memoryHits.length > 0) {
          memoryContext = memoryHits.map(h => `[${h.role}] ${h.content}`).join('\n')
        }
      }
    } catch (e) {
      console.log('[CUSTOM-TUTOR-CHAT] Memory retrieval error:', e)
    }
    
    // Search for relevant content
    console.log(`[CUSTOM-TUTOR-CHAT] Searching in sources: ${tutor.sources.join(', ')}`)
    const searchResults = await findRelevantContent(userQuery, 4, tutor.sources)
    console.log(`[CUSTOM-TUTOR-CHAT] Found ${searchResults.length} relevant chunks`)
    
    // Prepare context
    let contextText = ''
    if (searchResults.length > 0) {
      contextText = searchResults.map(r => `${r.source ? `[${r.source}]` : ''}\n${r.name}`).join('\n\n')
    }
    
    // Create system prompt
    const sourceList = tutor.sources.map(s => s.replace(/custom_\w+_\d+_/g, '').replace(/_/g, ' ')).join(' and ')
    const systemPrompt = `${tutor.systemPrompt}

IMPORTANT: The information you receive is extracted from ${tutor.sources.length} uploaded document(s): ${sourceList}. All retrieved context comes from these ${tutor.sources.length} document(s) only.

${contextText ? `Context extracted from the ${tutor.sources.length} document(s) (${sourceList}):

${contextText}

Use this context as authoritative for wording and definitions. All information comes from these ${tutor.sources.length} document(s).` : `No specific passages were found for this query. Answer using only the knowledge from the ${tutor.sources.length} uploaded document(s) (${sourceList}).`}`
    
    // Get conversation summary
    const summaryDoc = await threadSummaries.findOne({ threadId, chapter: tutorId })
    const summaryBlock = summaryDoc?.summary ? `\n\nConversation summary (so far):\n${summaryDoc.summary}` : ''
    const memoryBlock = memoryContext ? `\n\nRelevant prior conversation excerpts:\n${memoryContext}` : ''
    
    // Prepare messages
    const openrouterMessages = [
      { role: 'system', content: systemPrompt + summaryBlock + memoryBlock },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userQuery }
    ]
    
    console.log(`[CUSTOM-TUTOR-CHAT] Calling OpenRouter API...`)
    
    // Call OpenRouter API with streaming
    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Custom Tutor Chat'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: openrouterMessages,
        temperature: 0.3,
        max_tokens: 2000,
        stream: true
      })
    })
    
    if (!openrouterResponse.ok) {
      const errorText = await openrouterResponse.text()
      console.error(`[CUSTOM-TUTOR-CHAT] OpenRouter error: ${errorText}`)
      return NextResponse.json({
        error: 'OpenRouter API error',
        details: errorText
      }, { status: openrouterResponse.status })
    }
    
    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openrouterResponse.body?.getReader()
        const decoder = new TextDecoder()
        let assistantMessage = ''
        
        if (!reader) {
          controller.close()
          return
        }
        
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value)
            const lines = chunk.split('\n').filter(line => line.trim() !== '')
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  // Save conversation
                  if (assistantMessage.trim()) {
                    await threads.updateOne(
                      { sessionId: threadId, chapter: tutorId },
                      { $push: { messages: { role: 'assistant', content: assistantMessage, timestamp: new Date() } } }
                    )
                    
                    // Store memory embeddings
                    try {
                      const userEmbedding = await generateEmbedding(userQuery)
                      const assistantEmbedding = await generateEmbedding(assistantMessage)
                      
                      await chatMemory.insertMany([
                        { threadId, role: 'user', turn: turnIndex, content: userQuery, embedding: userEmbedding, createdAt: new Date() },
                        { threadId, role: 'assistant', turn: turnIndex + 1, content: assistantMessage, embedding: assistantEmbedding, createdAt: new Date() }
                      ])
                    } catch (e) {
                      console.log('[CUSTOM-TUTOR-CHAT] Memory storage error:', e)
                    }
                  }
                  
                  controller.close()
                  return
                }
                
                try {
                  const json = JSON.parse(data)
                  const content = json.choices?.[0]?.delta?.content || ''
                  if (content) {
                    assistantMessage += content
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`))
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('[CUSTOM-TUTOR-CHAT] Stream error:', error)
          controller.error(error)
        } finally {
          reader.releaseLock()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
    
  } catch (error) {
    console.error('[CUSTOM-TUTOR-CHAT] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: 'Failed to process chat',
      details: errorMessage
    }, { status: 500 })
  }
}

