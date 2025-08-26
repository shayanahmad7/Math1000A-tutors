import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Define valid voice options as a TypeScript union type
type VoiceOption = 'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer'

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// POST request handler for the API route
export async function POST(req: Request) {
  try {
    // Parse the request body and destructure parameters
    const { model = 'tts-1', voice = 'alloy', input }: { model: string; voice: VoiceOption; input: string } = await req.json()

    // Validate the voice parameter
    const validVoices: VoiceOption[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']
    if (!validVoices.includes(voice)) {
      return NextResponse.json({ error: 'Invalid voice option' }, { status: 400 })
    }

    // Validate the input text
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Invalid input text' }, { status: 400 })
    }

    // Call OpenAI's TTS API to generate speech
    const response = await openai.audio.speech.create({
      model,
      voice,
      input,
    })

    // Check if response.body is null or undefined
    if (!response.body) {
      return NextResponse.json({ error: 'No response body received from TTS API' }, { status: 500 })
    }

    // Convert the response body to an ArrayBuffer for direct streaming
    const arrayBuffer = await response.arrayBuffer()

    // Return the audio directly without file system operations
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })

  } catch (error) {
    console.error('Error generating TTS:', error)
    return NextResponse.json({ error: 'Failed to generate text-to-speech audio' }, { status: 500 })
  }
}
