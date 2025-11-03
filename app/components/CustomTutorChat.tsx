'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Send, Loader2, User, Bot, Mic, MicOff, Volume2, VolumeX, ChevronDown, Paperclip, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import Image from 'next/image'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
}

interface CustomTutor {
  tutorId: string
  name: string
  description: string
  sources: string[]
  createdAt: Date
  updatedAt: Date
}

interface FileAttachment {
  name: string
  data: string // Base64 data URL
  type: string
  size: number
}

interface ImageAttachment {
  name: string
  data: string // Base64 data URL
  type: string
  size: number
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

  // Speech-to-text states
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Text-to-speech states
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentlySpeakingId, setIsCurrentlySpeakingId] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // File attachment states
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([])
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])
  const [isDragOverChat, setIsDragOverChat] = useState(false)

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
    const loadTutors = async () => {
      if (!ownerId) return
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
    loadTutors()
  }, [ownerId, selectedTutorId])

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

  // File handling functions
  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach(file => {
      if (file.type === 'application/pdf') {
        const reader = new FileReader()
        reader.onload = (e) => {
          const data = e.target?.result as string
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            data,
            type: file.type,
            size: file.size
          }])
        }
        reader.readAsDataURL(file)
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const data = e.target?.result as string
          setAttachedImages(prev => [...prev, {
            name: file.name,
            data,
            type: file.type,
            size: file.size
          }])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverChat(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverChat(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverChat(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && (item.type === 'application/pdf' || item.type.startsWith('image/'))) {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      const fileList = new DataTransfer()
      files.forEach(file => fileList.items.add(file))
      handleFileUpload(fileList.files)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !selectedTutorId || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
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

    // Create assistant message for streaming
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: '',
      role: 'assistant',
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/custom-tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          selectedModel,
          tutorId: selectedTutorId,
          threadId: currentThreadId,
          files: attachedFiles,
          images: attachedImages,
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

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
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Clear attachments after sending
      setAttachedFiles([])
      setAttachedImages([])
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

  const getCurrentModelInfo = () => {
    const allModels = Object.values(AVAILABLE_MODELS).flat()
    return allModels.find(model => model.id === selectedModel)
  }

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
  
  const prettify = (content: string) => normalizeLists(normalizeMath(content));

  const renderMessage = (m: Message) => {
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
        {prettify(m.content)}
      </ReactMarkdown>
    )
  }

  return (
    <div 
      className={`flex h-[60vh] flex-col rounded-xl bg-gray-50 shadow-inner transition-colors ${
        isDragOverChat ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {/* Model and Tutor Selection Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 rounded-t-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Currently using: <span className="font-medium">{getCurrentModelInfo()?.name}</span>
            <span className="mx-2">•</span>
            Tutor: <span className="font-medium">{selectedTutor?.name || 'Select Tutor'}</span>
          </div>
          
          <div className="flex gap-2">
            {/* Tutor Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsTutorDropdownOpen(!isTutorDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <span>{selectedTutor?.name || 'Select Tutor'}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {isTutorDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
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
                  {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                    <div key={provider} className="p-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        {provider}
                      </div>
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id)
                            setIsModelDropdownOpen(false)
                          }}
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
        {/* Drag overlay */}
        {isDragOverChat && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 backdrop-blur-sm z-10 rounded-xl">
            <div className="text-center bg-white p-8 rounded-lg shadow-lg border-2 border-dashed border-blue-300">
              <Paperclip className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <p className="text-blue-600 font-semibold text-lg">Drop PDF files or images anywhere to upload</p>
              <p className="text-blue-500 text-sm mt-2">You can also paste files with Ctrl+V</p>
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">{selectedTutor ? selectedTutor.name : 'Custom Tutor'}</h3>
              <p className="text-sm">
                {selectedTutor ? (
                  <>
                    {selectedTutor.description || 'Start asking questions about your uploaded documents!'}<br/>
                    You can drag and drop PDF files or images, or paste them with Ctrl+V.
                  </>
                ) : (
                  'Please select a tutor to start chatting'
                )}
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

      {/* File attachments display */}
      {(attachedFiles.length > 0 || attachedImages.length > 0) && (
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div key={`file-${index}`} className="flex items-center bg-white rounded-lg px-3 py-2 text-sm border">
                <Paperclip className="h-4 w-4 mr-2 text-gray-500" />
                <span className="text-gray-700">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {attachedImages.map((image, index) => (
              <div key={`image-${index}`} className="flex items-center bg-white rounded-lg px-3 py-2 text-sm border">
                <div className="h-6 w-6 mr-2 relative">
                  <Image
                    src={image.data}
                    alt={image.name}
                    fill
                    className="object-cover rounded"
                  />
                </div>
                <span className="text-gray-700">{image.name}</span>
                <button
                  onClick={() => removeImage(index)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4 rounded-b-xl">
        <div className="flex rounded-full bg-gray-100 shadow-inner">
          {/* File upload button */}
          <label className="p-3 rounded-l-full bg-gray-200 hover:bg-gray-300 text-gray-600 cursor-pointer transition-colors">
            <Paperclip className="h-5 w-5" />
            <input
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />
          </label>

          {/* Mic button for speech-to-text */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessingAudio}
            className={`p-3 transition-colors ${
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
            placeholder={selectedTutor ? `Ask ${selectedTutor.name}...` : 'Select a tutor first...'}
            className="flex-1 px-4 py-3 bg-transparent focus:outline-none text-gray-800 placeholder-gray-500"
            disabled={isLoading || !selectedTutorId}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !selectedTutorId}
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
