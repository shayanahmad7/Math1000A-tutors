import RAGChat from './components/RAGChat'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Chapter 1: Real Numbers</h1>
          <p className="text-gray-600 mt-1">Your specialized tutor for mastering real numbers in precalculus</p>
        </div>
        <RAGChat />
      </div>
    </main>
  )
}
