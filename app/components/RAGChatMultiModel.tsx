'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Send, Loader2, User, Bot, Mic, MicOff, Volume2, VolumeX, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// Available models for selection
const AVAILABLE_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' }
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' }
  ]
};

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
}

interface RAGChatMultiModelProps {
  chapter: string;
  title: string;
  description: string;
}

export default function RAGChatMultiModel({ chapter }: RAGChatMultiModelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Model selection state
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

  // Speech-to-text states
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Text-to-speech states
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentlySpeakingId, setIsCurrentlySpeakingId] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const initialMessages: Message[] = [
      {
        id: 'initial-1',
        content: "Your conversation with this tutor is being recorded. Data collected will not be published but will be analyzed to enhance the user experience in the future.",
        role: 'assistant'
      },
      {
        id: 'initial-2',
        content: "What's on your mind?",
        role: 'assistant'
      }
    ]
    setMessages(initialMessages)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Speech-to-text functionality
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        setIsProcessingAudio(true)
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const formData = new FormData()
          formData.append('audio', audioBlob)
          
          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: audioBlob
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              setInput(data.text)
            }
          }
        } catch (error) {
          console.error('Error processing audio:', error)
        } finally {
          setIsProcessingAudio(false)
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Error starting recording. Please check microphone permissions.')
    }
  }

  const handleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
    } else {
      startRecording()
    }
  }

  // Text-to-speech functionality
  const speakText = async (text: string, messageId: string) => {
    if (isSpeaking) {
      // Stop current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
      }
      setIsSpeaking(false)
      setIsCurrentlySpeakingId(null)
      return
    }

    setIsSpeaking(true)
    setIsCurrentlySpeakingId(messageId)

    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          voice: 'alloy',
          model: 'tts-1',
        }),
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        
        if (currentAudioRef.current) {
          currentAudioRef.current.src = audioUrl
          currentAudioRef.current.play()
          
          currentAudioRef.current.onended = () => {
            setIsSpeaking(false)
            setIsCurrentlySpeakingId(null)
            URL.revokeObjectURL(audioUrl)
          }
        }
      }
    } catch (error) {
      console.error('Error generating speech:', error)
      setIsSpeaking(false)
      setIsCurrentlySpeakingId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/rag-multimodel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          threadId,
          selectedModel,
          chapter,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          role: 'assistant',
        }

        setMessages(prev => [...prev, assistantMessage])
        setThreadId(data.threadId)
      } else {
        throw new Error('Failed to get response')
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
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
    // Clear conversation when switching models
    setMessages([])
    setThreadId(null)
  }

  const getCurrentModelInfo = () => {
    const allModels = [...AVAILABLE_MODELS.openai, ...AVAILABLE_MODELS.gemini]
    return allModels.find(model => model.id === selectedModel) || AVAILABLE_MODELS.openai[0]
  }

  const renderMessage = (content: string) => {
    const normalizeMath = (text: string) => {
      let t = text;
      t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_m, expr) => `$$${expr}$$`);
      t = t.replace(/\\\(([^\)]*?)\\\)/g, (_m, expr) => `$${expr}$`);
      t = t.replace(/(^|\n)\s*\[\s*([^\]]+?)\s*\](?=\s*($|\n))/g, (_m, p1, expr) => `${p1}$$${expr}$$`);
      return t;
    };
    const normalizeLists = (text: string) => {
      const lines = text.split(/\n/);
      const out: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const subpart = /^\s*(?:\(([a-zA-Z0-9]+)\)|([a-zA-Z0-9]+)[\.)])\s+/.exec(line);
        if (subpart) {
          if (!/^\s*[-*+]\s+/.test(line) && !/^\s*\d+\./.test(line)) {
            out.push(line.replace(/^\s*/, '- '));
            continue;
          }
        }
        out.push(line);
      }
      return out.join('\n');
    };
    const prettify = (text: string) => normalizeLists(normalizeMath(text));
    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        className="prose prose-sm dark:prose-invert max-w-none"
        components={{
          h1: ({ ...props }) => (
            <h1 className="text-2xl font-bold my-4 text-center" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-xl font-bold my-3 text-center" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-lg font-bold my-3" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="my-2" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="my-2 space-y-1 list-disc pl-6" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="my-2 space-y-1 list-decimal pl-6" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="leading-normal" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 my-2" {...props} />
          )
        }}
      >
        {prettify(content)}
      </ReactMarkdown>
    )
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl bg-gray-50 shadow-inner">
      {/* Model Selection Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Currently using: <span className="font-medium">{getCurrentModelInfo()?.name}</span>
          </div>
          
          {/* Model Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <span className="font-medium text-gray-700">
                {getCurrentModelInfo()?.name}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            
            {isModelDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-3">
                    OpenAI Models
                  </div>
                  {AVAILABLE_MODELS.openai.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 ${
                        selectedModel === model.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-gray-500">{model.provider}</div>
                    </button>
                  ))}
                  
                  <div className="border-t border-gray-200 my-2"></div>
                  
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-3">
                    Google Models
                  </div>
                  {AVAILABLE_MODELS.gemini.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 ${
                        selectedModel === model.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-gray-500">{model.provider}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[80%] items-start rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 shadow'}`}>
              {m.role === 'user' ? (
                <User className="mr-2 h-5 w-5 shrink-0 mt-1" />
              ) : (
                <Bot className="mr-2 h-5 w-5 shrink-0 mt-1" />
              )}
              <div 
                className={`${m.role === 'user' ? 'prose-invert' : ''} 
                  prose-headings:text-inherit prose-p:text-inherit
                  prose-strong:text-inherit prose-ol:text-inherit prose-ul:text-inherit
                  [&_.katex-display]:my-3 [&_.katex-display]:text-center
                `}
              >
                {m.role === 'user' ? <>{m.content}</> : renderMessage(m.content)}
              </div>
              
              {/* Text-to-speech button for assistant messages */}
              {m.role === 'assistant' && (
                <button
                  onClick={() => speakText(m.content, m.id)}
                  className={`ml-2 p-2 rounded-full transition-colors ${
                    currentlySpeakingId === m.id
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={currentlySpeakingId === m.id ? 'Stop speaking' : 'Listen to this message'}
                >
                  {currentlySpeakingId === m.id ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start items-center mb-4">
            <div className="flex items-center rounded-full bg-white px-4 py-2 text-gray-800 shadow">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4 rounded-b-xl">
        <div className="flex rounded-full bg-gray-100 shadow-inner">
          {/* Mic button for speech-to-text */}
          <button
            type="button"
            onClick={handleRecording}
            title={isRecording ? 'Stop recording' : 'Record your message'}
            className={`p-3 rounded-l-full focus:outline-none transition-colors ${
              isRecording
                ? 'animate-pulse ring-2 ring-red-500 bg-red-100 text-red-600'
                : isProcessingAudio
                ? 'bg-yellow-100 text-yellow-600 cursor-wait'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
            }`}
            disabled={isProcessingAudio || isLoading}
          >
            {isProcessingAudio ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRecording ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </button>

          {/* Text input field */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about real numbers..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-6 py-3 focus:outline-none"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`flex items-center rounded-r-full px-6 py-3 font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 ${
              input.trim() && !isLoading ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="mr-2 h-5 w-5" />
            <span className="sr-only">Send message</span>
            <span aria-hidden="true">Send</span>
          </button>
        </div>
      </form>

      {/* Hidden audio element for TTS */}
      <audio ref={currentAudioRef} style={{ display: 'none' }} />
    </div>
  )
}
