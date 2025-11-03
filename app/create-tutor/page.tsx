'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function CreateTutorPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ownerId, setOwnerId] = useState('')

  // Get or create owner ID from localStorage
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const pdfFiles = Array.from(e.target.files).filter(file => file.type === 'application/pdf')
      setFiles(pdfFiles)
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!name.trim() || !systemPrompt.trim()) {
      setError('Name and system prompt are required')
      return
    }

    if (files.length === 0) {
      setError('Please upload at least one PDF file')
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('description', description)
      formData.append('systemPrompt', systemPrompt)
      formData.append('ownerId', ownerId)

      files.forEach((file, index) => {
        formData.append(`file${index}`, file)
      })

      const response = await fetch('/api/custom-tutor/create', {
        method: 'POST',
        body: formData
      })

      let data
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        throw new Error(text || 'Failed to create tutor')
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to create tutor')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/my-tutors')
      }, 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tutor'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 relative">
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-800">Creating Your Tutor</h3>
              <p className="text-sm text-gray-600 text-center">
                Please wait while we process your documents and create embeddings. This may take a minute or two.
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Do not close this page or navigate away</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">Create Custom AI Tutor</h1>
            <Link href="/" className="flex items-center space-x-2 text-blue-600 hover:text-blue-800">
              <Home className="h-5 w-5" />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Tutor Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Calculus Tutor, Biology Helper"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief description of what this tutor helps with"
              />
            </div>

            {/* System Prompt */}
            <div>
              <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt *
              </label>
              <textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Define how the AI tutor should behave. Example: You are a helpful math tutor that explains concepts clearly and provides step-by-step solutions..."
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                This prompt defines the AI tutor&apos;s personality, behavior, and teaching style. Be specific about what you want.
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label htmlFor="files" className="block text-sm font-medium text-gray-700 mb-2">
                Upload Documents (PDF) *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="files" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                      <span>Upload PDF files</span>
                      <input
                        id="files"
                        name="files"
                        type="file"
                        multiple
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF up to 10MB each</p>
                </div>
              </div>
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      <FileText className="h-4 w-4" />
                      <span>{file.name}</span>
                      <span className="text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-lg">
                <XCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-4 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span>Tutor created successfully! Redirecting...</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Creating Tutor...</span>
                </>
              ) : (
                <span>Create Tutor</span>
              )}
            </button>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Upload PDF documents containing the content you want the tutor to use</li>
            <li>Define a system prompt that describes how the tutor should behave</li>
            <li>The system will process your documents and create embeddings</li>
            <li>You can then chat with your custom tutor powered by OpenRouter&apos;s 400+ AI models</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

