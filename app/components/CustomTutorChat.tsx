'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Send, Loader2, User, Bot, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
}

interface Model {
  id: string
  name: string
  provider: string
}

interface CustomTutor {
  tutorId: string
  name: string
  description: string
  sources: string[]
  createdAt: Date
  updatedAt: Date
}

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

export default function CustomTutorChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini')
  const [selectedTutorId, setSelectedTutorId] = useState<string>('')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [isTutorDropdownOpen, setIsTutorDropdownOpen] = useState(false)
  const [availableTutors, setAvailableTutors] = useState<CustomTutor[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState('')

  // Get owner ID from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('tutorOwnerId')
      if (!id) {
        id = 'user_' + Date.now()
        localStorage.setItem('tutorOwnerId', id)
      }
      setOwnerId(id)
    }
  }, [])

  // Load tutors
  useEffect(() => {
    if (ownerId) {
      loadTutors()
    }
  }, [ownerId])

  const loadTutors = async () => {
    try {
      const response = await fetch(`/api/custom-tutor/list?ownerId=${ownerId}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableTutors(data.tutors || [])
        if (data.tutors && data.tutors.length > 0 && !selectedTutorId) {
          setSelectedTutorId(data.tutors[0].tutorId)
        }
      }
    } catch (error) {
      console.error('Error loading tutors:', error)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !selectedTutorId || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user'
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Generate thread ID if needed
    const currentThreadId = threadId || `custom-${selectedTutorId}-${Date.now()}`
    if (!threadId) {
      setThreadId(currentThreadId)
    }

    try {
      const response = await fetch('/api/custom-tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          selectedModel,
          tutorId: selectedTutorId,
          threadId: currentThreadId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant'
      }

      setMessages(prev => [...prev, assistantMessage])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const json = JSON.parse(data)
                const content = json.content || ''
                if (content) {
                  assistantContent += content
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMsg = updated[updated.length - 1]
                    if (lastMsg && lastMsg.role === 'assistant') {
                      lastMsg.content = assistantContent
                    }
                    return updated
                  })
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const selectedTutor = availableTutors.find(t => t.tutorId === selectedTutorId)

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Model and Tutor Selection */}
      <div className="flex flex-wrap gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
        {/* Tutor Selection */}
        <div className="relative">
          <button
            onClick={() => setIsTutorDropdownOpen(!isTutorDropdownOpen)}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <span className="text-sm font-medium">
              {selectedTutor ? selectedTutor.name : 'Select Tutor'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {isTutorDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {availableTutors.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-500">
                  No tutors found. <a href="/create-tutor" className="text-blue-600 hover:underline">Create one</a>
                </div>
              ) : (
                availableTutors.map((tutor) => (
                  <button
                    key={tutor.tutorId}
                    onClick={() => {
                      setSelectedTutorId(tutor.tutorId)
                      setIsTutorDropdownOpen(false)
                      setMessages([])
                      setThreadId(null)
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${
                      selectedTutorId === tutor.tutorId ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    <div className="font-medium">{tutor.name}</div>
                    {tutor.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{tutor.description}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className="relative">
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <span className="text-sm font-medium">
              {Object.values(AVAILABLE_MODELS).flat().find(m => m.id === selectedModel)?.name || 'Select Model'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {isModelDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                <div key={provider}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                    {provider}
                  </div>
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id)
                        setIsModelDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            {selectedTutor ? (
              <>
                <p className="text-lg font-medium mb-2">Start chatting with {selectedTutor.name}</p>
                <p className="text-sm">{selectedTutor.description || 'Ask any question about your uploaded documents'}</p>
              </>
            ) : (
              <p>Please select a tutor to start chatting</p>
            )}
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {message.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  className="prose prose-sm max-w-none"
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-lg p-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={selectedTutor ? `Ask ${selectedTutor.name}...` : 'Select a tutor first...'}
            disabled={!selectedTutorId || isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !selectedTutorId || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

