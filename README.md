# Chapter 1: Real Numbers - AI Tutor

A specialized AI tutor for the "Real Numbers" unit of precalculus, built with Next.js, MongoDB Atlas Vector Search, and OpenAI GPT-4o-mini. This tutor uses Retrieval-Augmented Generation (RAG) to provide contextual responses based on course materials.

## Features

- **Specialized Teaching**: Focused exclusively on Real Numbers topics (classification, properties, fractions, interval notation, absolute value)
- **RAG-Powered**: Retrieves information from course PDFs to provide accurate, contextual responses
- **Interactive Learning**: Guides students through topics step-by-step with hints rather than direct answers
- **Math Rendering**: Full LaTeX support with KaTeX for proper mathematical notation
- **Conversational Memory**: Maintains context throughout chat sessions

## Quick Start

1. **Environment Setup**: Copy `.env.example` to `.env.local` and add your credentials:

```env
OPENAI_API_KEY=sk-...
MONGODB_URI=mongodb+srv://...
EMBED_MODEL=text-embedding-3-large
```

2. **Install Dependencies**:

```bash
npm install
```

3. **Add Course Materials**: Place your PDF files in `public/content/` (this folder is ignored by Git):

   - `1_Real Numbers_ Notes.pdf`
   - `1_Real Numbers_Exercises.pdf`

4. **Create Vector Search Indexes**:

```bash
npm run rag:create-index
```

5. **Ingest Course Content**:

```bash
npm run rag:ingest
```

6. **Start Development Server**:

```bash
npm run dev
```

Visit http://localhost:3000 to start learning!

## Teaching Approach

The AI tutor is designed to:

- **Engage actively** with topic lists and guided learning paths
- **Provide hints** and guiding questions instead of direct answers
- **Quote directly** from course materials when explaining concepts
- **Stay focused** on Real Numbers topics only
- **Format math properly** using LaTeX notation

## Architecture

- **Database**: MongoDB Atlas (`math1000a_tutors`)
- **Collections**: `resources`, `embeddings`, `chat_threads`, `chat_memory`
- **Vector Search**: Atlas Search with `text-embedding-3-large` (3072 dimensions)
- **API**: `/api/rag` endpoint for chat interactions
- **Frontend**: React with Tailwind CSS and KaTeX for math rendering

## Content Sources

The tutor draws knowledge exclusively from:

1. **1_Real Numbers_Notes.pdf** - Core concepts and definitions
2. **1_Real Numbers_Exercises.pdf** - Practice problems and applications

Each response includes source citations to help students understand where information comes from.

## Development

- **Lint**: `npm run lint`
- **Build**: `npm run build`
- **Index Management**: `npm run rag:create-index`
- **Content Ingestion**: `npm run rag:ingest`

Built for NYU Abu Dhabi's precalculus course.
