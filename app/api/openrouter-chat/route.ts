import { NextResponse } from 'next/server'

// Next.js API route configuration
export const maxDuration = 30
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Latest models on OpenRouter (expanded with newest models)
const AVAILABLE_MODELS = {
  openai: [
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
    { id: 'openai/gpt-4o-2024-08-06', name: 'GPT-4o (Aug 2024)', provider: 'OpenAI' },
    { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' }
  ],
  anthropic: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
    { id: 'anthropic/claude-2.1', name: 'Claude 2.1', provider: 'Anthropic' }
  ],
  google: [
    { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'Google' },
    { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
    { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
    { id: 'google/gemini-1.5-pro-002', name: 'Gemini 1.5 Pro (Latest)', provider: 'Google' },
    { id: 'google/gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'Google' }
  ],
  meta: [
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', provider: 'Meta' }
  ],
  mistral: [
    { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'Mistral' },
    { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', provider: 'Mistral' },
    { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'Mistral' },
    { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', provider: 'Mistral' },
    { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', provider: 'Mistral' }
  ],
  microsoft: [
    { id: 'microsoft/phi-4-multimodal-instruct', name: 'Phi-4 Multimodal Instruct', provider: 'Microsoft' },
    { id: 'microsoft/phi-4-mini-instruct', name: 'Phi-4 Mini', provider: 'Microsoft' },
    { id: 'microsoft/phi-4-mini-vision-instruct', name: 'Phi-4 Mini Vision', provider: 'Microsoft' },
    { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium', provider: 'Microsoft' },
    { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini', provider: 'Microsoft' },
    { id: 'microsoft/phi-3.5-mini-instruct', name: 'Phi-3.5 Mini', provider: 'Microsoft' }
  ],
  gemma: [
    { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'Google' },
    { id: 'google/gemma-3-9b-it', name: 'Gemma 3 9B', provider: 'Google' },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'Google' },
    { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', provider: 'Google' },
    { id: 'google/gemma-2-2b-it', name: 'Gemma 2 2B', provider: 'Google' }
  ],
  deepseek: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
    { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek' },
    { id: 'deepseek/deepseek-math', name: 'DeepSeek Math', provider: 'DeepSeek' }
  ],
  cohere: [
    { id: 'cohere/command-r-plus', name: 'Command R+', provider: 'Cohere' },
    { id: 'cohere/command-r', name: 'Command R', provider: 'Cohere' },
    { id: 'cohere/command-light', name: 'Command Light', provider: 'Cohere' }
  ],
  qwen: [
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-32b-instruct', name: 'Qwen 2.5 32B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-14b-instruct', name: 'Qwen 2.5 14B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-7b-instruct', name: 'Qwen 2.5 7B', provider: 'Qwen' }
  ]
}

/**
 * OpenRouter chat completion endpoint
 * 
 * This endpoint:
 * 1. Receives user messages with model selection
 * 2. Sends requests to OpenRouter API
 * 3. Handles file attachments (PDFs)
 * 4. Returns AI responses
 */
export async function POST(req: Request) {
  try {
    // Parse incoming message data
    const input: { 
      messages: Array<{ role: 'user'|'assistant'; content: string | any[] }>; 
      selectedModel: string;
      files?: Array<{ name: string; data: string; type: string }>;
      images?: Array<{ name: string; data: string; type: string }>;
    } = await req.json();
    
    const lastMessage = input.messages[input.messages.length - 1];
    const selectedModel = input.selectedModel || 'openai/gpt-4o';
    const files = input.files || [];
    const images = input.images || [];
    
    console.log(`[OPENROUTER] Model: ${selectedModel}, Files: ${files.length}`);
    console.log(`[OPENROUTER] API Key present: ${!!process.env.OPENROUTER_API_KEY}`);
    console.log(`[OPENROUTER] Messages count: ${input.messages.length}`);
    
    // Check if API key is present
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[OPENROUTER] Missing OPENROUTER_API_KEY environment variable');
      return NextResponse.json({ 
        error: 'OpenRouter API key not configured',
        details: 'Please set OPENROUTER_API_KEY in your environment variables'
      }, { status: 500 });
    }
    
    // Validate model selection
    const allModels = Object.values(AVAILABLE_MODELS).flat();
    const isValidModel = allModels.some(model => model.id === selectedModel);
    
    if (!isValidModel) {
      return NextResponse.json({ 
        error: 'Invalid model selection' 
      }, { status: 400 });
    }

    // Prepare messages for OpenRouter
    let openrouterMessages = [];
    
    // Process each message
    for (const message of input.messages) {
      if (message.role === 'user' && (files.length > 0 || images.length > 0)) {
        // Handle multimodal content with files and images
        const content = [];
        
        // Add text content if present
        if (typeof message.content === 'string' && message.content.trim()) {
          content.push({
            type: 'text',
            text: message.content
          });
        }
        
        // Add file attachments (PDFs)
        for (const file of files) {
          content.push({
            type: 'file',
            file: {
              filename: file.name,
              file_data: file.data // Should be base64 data URL
            }
          });
        }
        
        // Add image attachments
        for (const image of images) {
          content.push({
            type: 'image_url',
            image_url: {
              url: image.data // base64 data URL
            }
          });
        }
        
        openrouterMessages.push({
          role: 'user',
          content: content
        });
      } else {
        // Regular text message
        openrouterMessages.push({
          role: message.role,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
        });
      }
    }

    // Prepare plugins for PDF processing (if files are present)
    const plugins = files.length > 0 ? [
      {
        id: 'file-parser',
        pdf: {
          engine: 'pdf-text' // Free engine for well-structured PDFs
        }
      }
    ] : undefined;

    // Call OpenRouter API with streaming
    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Math1000A OpenRouter Tutor'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: openrouterMessages,
        plugins: plugins,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true
      })
    });

    if (!openrouterResponse.ok) {
      const errorData = await openrouterResponse.json().catch(() => ({ error: 'Failed to parse error response' }));
      console.error('[OPENROUTER] API Error:', {
        status: openrouterResponse.status,
        statusText: openrouterResponse.statusText,
        error: errorData
      });
      return NextResponse.json({ 
        error: 'OpenRouter API error',
        details: errorData.error?.message || errorData.details || `HTTP ${openrouterResponse.status}: ${openrouterResponse.statusText}`
      }, { status: openrouterResponse.status });
    }

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openrouterResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[OPENROUTER] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to fetch available models
export async function GET() {
  return NextResponse.json({
    models: AVAILABLE_MODELS
  });
}
