'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Send, Loader2, User, Bot, Mic, MicOff, Volume2, VolumeX, ChevronDown, Paperclip, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import Image from 'next/image'

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
}

interface Model {
  id: string;
  name: string;
  provider: string;
}

interface Chapter {
  id: string;
  name: string;
  sources: string[];
  topics: string[];
}

export default function OpenRouterRAGChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Model and chapter selection state
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o')
  const [selectedChapter, setSelectedChapter] = useState('real-numbers')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false)
  const [availableModels, setAvailableModels] = useState<Record<string, Model[]>>({})
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([])

  // Speech-to-text states
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Text-to-speech states
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentlySpeakingId, setIsCurrentlySpeakingId] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // Load available models and chapters on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [modelsResponse, chaptersResponse] = await Promise.all([
          fetch('/api/openrouter-rag?type=models'),
          fetch('/api/openrouter-rag?type=chapters')
        ])
        
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json()
          setAvailableModels(modelsData.models)
        }
        
        if (chaptersResponse.ok) {
          const chaptersData = await chaptersResponse.json()
          setAvailableChapters(chaptersData.chapters)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }
    
    loadData()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Speech-to-text functionality
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      const audioChunks: Blob[] = []
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        await processAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessingAudio(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setInput(prev => prev + (prev ? ' ' : '') + data.text)
      }
    } catch (error) {
      console.error('Error processing audio:', error)
    } finally {
      setIsProcessingAudio(false)
    }
  }

  // Text-to-speech functionality
  const speakText = async (text: string, messageId: string) => {
    if (isSpeaking && currentlySpeakingId === messageId) {
      // Stop current speech
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      setIsSpeaking(false)
      setIsCurrentlySpeakingId(null)
      return
    }

    // Stop any current speech
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        currentAudioRef.current = audio

        audio.onended = () => {
          setIsSpeaking(false)
          setIsCurrentlySpeakingId(null)
          URL.revokeObjectURL(audioUrl)
        }

        audio.onerror = () => {
          setIsSpeaking(false)
          setIsCurrentlySpeakingId(null)
          URL.revokeObjectURL(audioUrl)
        }

        await audio.play()
        setIsSpeaking(true)
        setIsCurrentlySpeakingId(messageId)
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error)
      setIsSpeaking(false)
      setIsCurrentlySpeakingId(null)
    }
  }

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setIsSpeaking(false)
    setIsCurrentlySpeakingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setIsLoading(true)

    try {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: input.trim(),
        role: 'user',
      }

      setMessages(prev => [...prev, userMessage])
      setInput('')

      // Create assistant message for streaming
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
      }
      setMessages(prev => [...prev, assistantMessage])

      const response = await fetch('/api/openrouter-rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          selectedModel,
          selectedChapter,
        }),
      })

      if (response.ok) {
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.content) {
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: msg.content + data.content }
                        : msg
                    )
                  )
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
        role: 'assistant',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId)
    setIsModelDropdownOpen(false)
  }

  const handleChapterSelect = (chapterId: string) => {
    setSelectedChapter(chapterId)
    setIsChapterDropdownOpen(false)
    // Clear messages when switching chapters
    setMessages([])
  }

  const getCurrentModelInfo = () => {
    const allModels = Object.values(availableModels).flat()
    return allModels.find(model => model.id === selectedModel)
  }

  const getCurrentChapterInfo = () => {
    return availableChapters.find(chapter => chapter.id === selectedChapter)
  }

  const prettify = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '**$1**')
      .replace(/\*(.*?)\*/g, '*$1*')
      .replace(/`(.*?)`/g, '`$1`')
  }

  const renderMessage = (m: Message) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        className="prose prose-sm max-w-none"
      >
        {prettify(m.content)}
      </ReactMarkdown>
    )
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl bg-gray-50 shadow-inner">
      {/* Model and Chapter Selection Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 rounded-t-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Currently using: <span className="font-medium">{getCurrentModelInfo()?.name}</span>
            <span className="mx-2">•</span>
            Chapter: <span className="font-medium">{getCurrentChapterInfo()?.name}</span>
          </div>
          
          <div className="flex gap-2">
            {/* Chapter Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsChapterDropdownOpen(!isChapterDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <span>{getCurrentChapterInfo()?.name || 'Select Chapter'}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {isChapterDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {availableChapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => handleChapterSelect(chapter.id)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${
                        selectedChapter === chapter.id ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <div className="font-medium">{chapter.name}</div>
                      <div className="text-xs text-gray-500">{chapter.topics.length} topics</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <span>{getCurrentModelInfo()?.name || 'Select Model'}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {isModelDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {Object.entries(availableModels).map(([provider, models]) => (
                    <div key={provider} className="p-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        {provider}
                      </div>
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(model.id)}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-100 text-sm rounded ${
                            selectedModel === model.id ? 'bg-blue-50 text-blue-700' : ''
                          }`}
                        >
                          {model.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">OpenRouter RAG Tutor</h3>
              <p className="text-sm">
                Select a chapter and model above, then start asking questions about the course material!
              </p>
            </div>
          </div>
        )}
        
        {messages.map((m) => (
          <div key={m.id} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[80%] items-start rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 shadow'}`}>
              {m.role === 'user' ? (
                <User className="mr-2 h-5 w-5 shrink-0 mt-1" />
              ) : (
                <Bot className="mr-2 h-5 w-5 shrink-0 mt-1" />
              )}
              <div className="flex-1">
                {renderMessage(m)}
                {m.role === 'assistant' && m.content && (
                  <button
                    onClick={() => speakText(m.content, m.id)}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                  >
                    {isSpeaking && currentlySpeakingId === m.id ? (
                      <>
                        <VolumeX className="h-3 w-3" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3" />
                        <span>Speak</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4 rounded-b-xl">
        <div className="flex rounded-full bg-gray-100 shadow-inner">
          {/* Mic button for speech-to-text */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessingAudio}
            className={`p-3 rounded-l-full transition-colors ${
              isRecording 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
            } ${isProcessingAudio ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isProcessingAudio ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the course material..."
            className="flex-1 px-4 py-3 bg-transparent focus:outline-none text-gray-800 placeholder-gray-500"
            disabled={isLoading}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 rounded-r-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
