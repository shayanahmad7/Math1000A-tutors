import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// POST request handler for speech-to-text using OpenAI Whisper
export async function POST(req: Request) {
  try {
    // Get the audio blob from the request
    const audioBlob = await req.blob()

    // Create a File object from the blob for OpenAI API
    const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })

    // Call OpenAI's Whisper API
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    })

    // Return the transcribed text
    return NextResponse.json({
      text: response.text,
      success: true
    })

  } catch (error) {
    console.error('Error in speech-to-text:', error)
    return NextResponse.json({
      error: 'Failed to transcribe audio',
      success: false
    }, { status: 500 })
  }
}

