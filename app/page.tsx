import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50" style={{ fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">NYUAD Math 1000A AI Tutors</h1>
            <p className="text-sm text-gray-600">Precalculus Course Experiment</p>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Choose Your AI Tutor
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                        Experimental AI tutoring system for NYUAD&apos;s Math 1000A Precalculus course.
            Access specialized math tutors, multi-model AI chats, and 400+ AI models through OpenRouter.
          </p>
        </div>

        {/* Tutor Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {/* OpenAI RAG Tutor */}
          <Link href="/rag-tutor" className="group">
            <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-200 group-hover:border-blue-300">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">OpenAI RAG Tutor</h3>
              <p className="text-sm text-gray-500 mb-4">Specialized for Chapter 1</p>
              <p className="text-gray-600 mb-4">
                Focused AI tutor for Real Numbers unit with course materials, hints, and step-by-step guidance using OpenAI GPT models.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">OpenAI</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">RAG</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">Course Materials</span>
              </div>
            </div>
          </Link>

          {/* Multi-Model RAG Tutor */}
          <Link href="/multi-model-tutor" className="group">
            <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-200 group-hover:border-green-300">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Multi-Model RAG Tutor</h3>
              <p className="text-sm text-gray-500 mb-4">OpenAI + Google Gemini</p>
              <p className="text-gray-600 mb-4">
                Compare OpenAI and Google Gemini models for math tutoring with course materials and RAG capabilities.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">OpenAI</span>
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Google Gemini</span>
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">RAG</span>
              </div>
            </div>
          </Link>

                      {/* OpenRouter Chat */}
                      <Link href="/openrouter-tutor" className="group">
                        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-200 group-hover:border-purple-300">
                          <h3 className="text-xl font-semibold text-gray-800 mb-2">OpenRouter AI Chat</h3>
                          <p className="text-sm text-gray-500 mb-4">400+ AI Models</p>
                          <p className="text-gray-600 mb-4">
                            Access 400+ AI models from all major providers including OpenAI, Anthropic, Google, Meta, Mistral, and more.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">400+ Models</span>
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">All Providers</span>
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">PDF Upload</span>
                          </div>
                        </div>
                      </Link>

                      {/* OpenRouter RAG Tutor */}
                      <Link href="/openrouter-rag-tutor" className="group">
                        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-200 group-hover:border-indigo-300">
                          <h3 className="text-xl font-semibold text-gray-800 mb-2">OpenRouter RAG Tutor</h3>
                          <p className="text-sm text-gray-500 mb-4">400+ Models + RAG</p>
                          <p className="text-gray-600 mb-4">
                            Combine 400+ AI models with RAG-powered course material assistance. Select any chapter and model for specialized tutoring.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">400+ Models</span>
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">RAG Powered</span>
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">Multi-Chapter</span>
                          </div>
                        </div>
                      </Link>

                      {/* Create Custom Tutor */}
                      <Link href="/create-tutor" className="group">
                        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-200 group-hover:border-orange-300">
                          <h3 className="text-xl font-semibold text-gray-800 mb-2">Create Custom Tutor</h3>
                          <p className="text-sm text-gray-500 mb-4">Build Your Own AI Tutor</p>
                          <p className="text-gray-600 mb-4">
                            Create your own custom AI tutor by uploading documents and defining a system prompt. Perfect for teachers and students.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">Custom</span>
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">Upload Docs</span>
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">RAG Powered</span>
                          </div>
                        </div>
                      </Link>

                      {/* My Custom Tutors */}
                      <Link href="/my-tutors" className="group">
                        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-200 group-hover:border-green-300">
                          <h3 className="text-xl font-semibold text-gray-800 mb-2">My Custom Tutors</h3>
                          <p className="text-sm text-gray-500 mb-4">Your Created Tutors</p>
                          <p className="text-gray-600 mb-4">
                            Access and chat with all your custom AI tutors. Each tutor uses your uploaded documents and custom system prompts.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">My Tutors</span>
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">400+ Models</span>
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">RAG Powered</span>
                          </div>
                        </div>
                      </Link>
        </div>
      </div>
    </main>
  )
}
