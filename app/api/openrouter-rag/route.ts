import { NextResponse } from 'next/server'
import { findRelevantContent, generateEmbedding } from '@/lib/ai/embedding'
import { getCollections } from '@/lib/db/mongodb'

// Next.js API route configuration
export const maxDuration = 30
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Latest models on OpenRouter (expanded with newest models)
const AVAILABLE_MODELS = {
  openai: [
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
    { id: 'openai/gpt-4o-2024-08-06', name: 'GPT-4o (Aug 2024)', provider: 'OpenAI' },
    { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' }
  ],
  anthropic: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
    { id: 'anthropic/claude-2.1', name: 'Claude 2.1', provider: 'Anthropic' }
  ],
  google: [
    { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'Google' },
    { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
    { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
    { id: 'google/gemini-1.5-pro-002', name: 'Gemini 1.5 Pro (Latest)', provider: 'Google' },
    { id: 'google/gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'Google' }
  ],
  meta: [
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', provider: 'Meta' }
  ],
  mistral: [
    { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'Mistral' },
    { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', provider: 'Mistral' },
    { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'Mistral' },
    { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', provider: 'Mistral' },
    { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', provider: 'Mistral' }
  ],
  microsoft: [
    { id: 'microsoft/phi-4-multimodal-instruct', name: 'Phi-4 Multimodal Instruct', provider: 'Microsoft' },
    { id: 'microsoft/phi-4-mini-instruct', name: 'Phi-4 Mini', provider: 'Microsoft' },
    { id: 'microsoft/phi-4-mini-vision-instruct', name: 'Phi-4 Mini Vision', provider: 'Microsoft' },
    { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium', provider: 'Microsoft' },
    { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini', provider: 'Microsoft' },
    { id: 'microsoft/phi-3.5-mini-instruct', name: 'Phi-3.5 Mini', provider: 'Microsoft' }
  ],
  gemma: [
    { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'Google' },
    { id: 'google/gemma-3-9b-it', name: 'Gemma 3 9B', provider: 'Google' },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'Google' },
    { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', provider: 'Google' },
    { id: 'google/gemma-2-2b-it', name: 'Gemma 2 2B', provider: 'Google' }
  ],
  deepseek: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
    { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek' },
    { id: 'deepseek/deepseek-math', name: 'DeepSeek Math', provider: 'DeepSeek' }
  ],
  cohere: [
    { id: 'cohere/command-r-plus', name: 'Command R+', provider: 'Cohere' },
    { id: 'cohere/command-r', name: 'Command R', provider: 'Cohere' },
    { id: 'cohere/command-light', name: 'Command Light', provider: 'Cohere' }
  ],
  qwen: [
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-32b-instruct', name: 'Qwen 2.5 32B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-14b-instruct', name: 'Qwen 2.5 14B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-7b-instruct', name: 'Qwen 2.5 7B', provider: 'Qwen' }
  ]
}

// Chapter configurations
const CHAPTER_CONFIGS = {
  'real-numbers': {
    name: 'Real Numbers (Chapter 1)',
    sources: ['1_Real_Numbers_Notes', '1_Real_Numbers_Exercises'],
    topics: [
      'Classification of real numbers (natural, integers, rational, irrational, real)',
      'Properties of real numbers (commutative, associative, distributive, identities, inverses)',
      'Properties of negatives',
      'Fractions and operations (including LCD and prime factorization)',
      'Real number line and interval notation',
      'Absolute value and distance on the real line'
    ]
  },
  'exponents': {
    name: 'Exponents (Chapter 2)',
    sources: ['2_Exponents_Notes', '2_Exponents_Exercises'],
    topics: [
      'Exponent rules and properties',
      'Zero and negative exponents',
      'Scientific notation',
      'Exponential expressions and simplification',
      'Power of a power, product, and quotient rules',
      'Rational exponents and radical expressions'
    ]
  },
  'radicals': {
    name: 'Radicals (Chapter 3)',
    sources: ['3_Radicals_Notes', '3_Radicals_Exercises'],
    topics: [
      'Square roots and nth roots',
      'Simplifying radical expressions',
      'Rationalizing denominators',
      'Operations with radicals (addition, subtraction, multiplication, division)',
      'Radical equations and solving techniques',
      'Rational exponents and radical notation'
    ]
  },
  'algebraic-expressions': {
    name: 'Algebraic Expressions (Chapter 4)',
    sources: ['4_Algebraic_Expressions_Notes', '4_Algebraic_Expressions_Exercises'],
    topics: [
      'Variables and constants',
      'Algebraic terms and coefficients',
      'Like and unlike terms',
      'Simplifying algebraic expressions',
      'Evaluating expressions for given values',
      'Algebraic operations and properties'
    ]
  },
  'factoring': {
    name: 'Factoring (Chapter 5)',
    sources: ['5_Factoring_Notes', '5_Factoring_Exercises'],
    topics: [
      'Greatest common factor (GCF)',
      'Factoring by grouping',
      'Difference of squares',
      'Perfect square trinomials',
      'Factoring quadratic trinomials',
      'Factoring by substitution and special cases'
    ]
  },
  'quadratic-trinomial-expressions': {
    name: 'Quadratic Trinomial Expressions (Chapter 6)',
    sources: ['6_Quadratic_Trinomial_Expressions_Notes', '6_Quadratic_Trinomial_Expressions_Exercises'],
    topics: [
      'Quadratic trinomial forms',
      'Factoring quadratic trinomials',
      'AC method for factoring',
      'Trial and error method',
      'Special quadratic patterns',
      'Applications of quadratic factoring'
    ]
  },
  'rational-expressions': {
    name: 'Rational Expressions (Chapter 7)',
    sources: ['7_Rational_Expressions_Notes', '7_Rational_Expressions_Exercises'],
    topics: [
      'Rational expressions and restrictions',
      'Simplifying rational expressions',
      'Multiplying and dividing rational expressions',
      'Adding and subtracting rational expressions',
      'Complex rational expressions',
      'Rational expression equations'
    ]
  },
  'compound-fractions': {
    name: 'Compound Fractions (Chapter 8)',
    sources: ['8_Compound_Fractions_Notes', '8_Compound_Fractions_Exercises'],
    topics: [
      'Complex fractions and compound fractions',
      'Simplifying compound fractions',
      'Methods for simplifying complex fractions',
      'Rationalizing compound fractions',
      'Applications of compound fractions',
      'Converting between forms'
    ]
  },
  'avoiding-common-errors': {
    name: 'Avoiding Common Errors (Chapter 9)',
    sources: ['9_Avoiding_Common_Errors_Notes', '9_Avoiding_Common_Errors_Exercises'],
    topics: [
      'Common algebraic mistakes',
      'Order of operations errors',
      'Sign errors and distribution',
      'Fraction operation errors',
      'Exponent and radical mistakes',
      'Problem-solving strategies'
    ]
  },
  'linear-quadratic-absolute-value-equations': {
    name: 'Linear, Quadratic, and Absolute Value Equations (Chapter 10)',
    sources: ['10_Linear_Quadratic_and_Absolute_Value_Equations_Notes', '10_Linear_Quadratic_and_Absolute_Value_Equations_Exercises'],
    topics: [
      'Linear equations and solving techniques',
      'Quadratic equations and factoring',
      'Quadratic formula and discriminant',
      'Absolute value equations',
      'Graphical solutions',
      'Applications and word problems'
    ]
  },
  'other-equations': {
    name: 'Other Equations (Chapter 11)',
    sources: ['11_Other_Equations_Notes', '11_Other_Equations_Exercises'],
    topics: [
      'Rational equations',
      'Radical equations',
      'Equations with fractional exponents',
      'Equations with absolute values',
      'Higher degree equations',
      'Systems of equations'
    ]
  },
  'inequalities': {
    name: 'Inequalities (Chapter 12)',
    sources: ['12_Inequalities_Notes', '12_Inequalities_Exercises'],
    topics: [
      'Linear inequalities',
      'Quadratic inequalities',
      'Rational inequalities',
      'Absolute value inequalities',
      'Compound inequalities',
      'Inequality notation and graphing'
    ]
  },
  'coordinate-plane-graphs-intercepts': {
    name: 'Coordinate Plane, Graphs, and Intercepts (Chapter 13)',
    sources: ['13_Coordinate_Plane_Graphs_Intercepts_Notes', '13_Coordinate_Plane_Graphs_Intercepts_Exercises'],
    topics: [
      'Cartesian coordinate system',
      'Plotting points and ordered pairs',
      'Distance and midpoint formulas',
      'Graphs of equations',
      'X and y intercepts',
      'Symmetry and transformations'
    ]
  },
  'circles': {
    name: 'Circles (Chapter 14)',
    sources: ['14_Circles_Notes', '14_Circles_Exercises'],
    topics: [
      'Circle equations and standard form',
      'Center and radius of circles',
      'Graphing circles',
      'Circle properties and theorems',
      'Tangents and secants',
      'Applications of circles'
    ]
  },
  'functions-domain-range': {
    name: 'Functions, Domain, and Range (Chapter 15)',
    sources: ['15_Functions_Domain_Range_Notes', '15_Functions_Domain_Range_Exercises'],
    topics: [
      'Definition of functions',
      'Function notation and evaluation',
      'Domain and range',
      'Vertical line test',
      'Function operations',
      'Composition of functions'
    ]
  },
  'graphs-of-functions': {
    name: 'Graphs of Functions (Chapter 16)',
    sources: ['16_Graphs_of_Functions_Notes', '16_Graphs_of_Functons_Exercises'],
    topics: [
      'Graphing basic functions',
      'Linear and quadratic functions',
      'Polynomial functions',
      'Rational functions',
      'Piecewise functions',
      'Function transformations'
    ]
  },
  'lines': {
    name: 'Lines (Chapter 17)',
    sources: ['17_Lines_Notes', '17_Lines_Exercises'],
    topics: [
      'Slope of a line',
      'Point-slope form',
      'Slope-intercept form',
      'Standard form of lines',
      'Parallel and perpendicular lines',
      'Distance from point to line'
    ]
  },
  'solving-equations-inequalities-with-graphs': {
    name: 'Solving Equations and Inequalities with Graphs (Chapter 18)',
    sources: ['18_Solving_Equations_and_Inequalities_with_Graphs_Notes', '18_Solving_Equations_and_Inequalities_with_Graphs_Exercises'],
    topics: [
      'Graphical solutions to equations',
      'Intersection points',
      'Graphical solutions to inequalities',
      'Systems of equations graphically',
      'Graphical interpretation',
      'Technology and graphing'
    ]
  },
  'piecewise-functions': {
    name: 'Piecewise Functions (Chapter 19)',
    sources: ['19_Piecewise_Functions_Notes', '19_Piecewise_Functions_Exercises'],
    topics: [
      'Definition of piecewise functions',
      'Evaluating piecewise functions',
      'Graphing piecewise functions',
      'Domain and range of piecewise functions',
      'Continuity and discontinuities',
      'Applications of piecewise functions'
    ]
  },
  'net-change': {
    name: 'Net Change (Chapter 20)',
    sources: ['20_Net_Change_Notes', '20_Net_Change_Exercises'],
    topics: [
      'Net change concept',
      'Average rate of change',
      'Instantaneous rate of change',
      'Applications to real-world problems',
      'Graphical interpretation of change',
      'Calculus connections'
    ]
  },
  'transformations-of-functions': {
    name: 'Transformations of Functions (Chapter 21)',
    sources: ['21_Transformations_of_Functions_Notes', '21_Transformations_of_Functions_Exercises'],
    topics: [
      'Vertical and horizontal shifts',
      'Reflections across axes',
      'Vertical and horizontal stretching/compressing',
      'Combining transformations',
      'Graphing transformed functions',
      'Function families and patterns'
    ]
  },
  'quadratic-functions': {
    name: 'Quadratic Functions (Chapter 22)',
    sources: ['22_Quadratic_Functions_Notes', '22_Quadratic_Functions_Exercises'],
    topics: [
      'Standard form of quadratic functions',
      'Vertex form and vertex',
      'Axis of symmetry',
      'Maximum and minimum values',
      'Graphing quadratic functions',
      'Applications of quadratic functions'
    ]
  },
  'polynomial-functions': {
    name: 'Polynomial Functions (Chapter 23)',
    sources: ['23_Polynomial_Functions_Notes', '23_Polynomial_Functions_Exercises'],
    topics: [
      'Polynomial functions and degrees',
      'End behavior of polynomials',
      'Zeros and roots of polynomials',
      'Factoring polynomials',
      'Graphing polynomial functions',
      'Polynomial division and synthetic division'
    ]
  },
  'combining-functions': {
    name: 'Combining Functions (Chapter 24)',
    sources: ['24_Combining_Functions_Notes', '24_Combining_Functions_Exercises'],
    topics: [
      'Arithmetic operations on functions',
      'Addition, subtraction, multiplication, division',
      'Function composition',
      'Domain restrictions',
      'Graphing combined functions',
      'Applications of function operations'
    ]
  },
  'composition-of-functions': {
    name: 'Composition of Functions (Chapter 25)',
    sources: ['25_Composition_of_Functions_Notes', '25_Composition_of_Functions_Exercises'],
    topics: [
      'Function composition notation',
      'Evaluating composite functions',
      'Domain of composite functions',
      'Decomposing functions',
      'Graphing composite functions',
      'Applications of function composition'
    ]
  },
  'exponential-functions': {
    name: 'Exponential Functions (Chapter 26)',
    sources: ['26A_Exponential_Functions_with_Base_a_Notes', '26B_Exponential_Functions_with_Base_e_Notes', '26C_Transformations_of_Exponential_Functions_Notes', '26_Exponential_Functions_Exercises'],
    topics: [
      'Exponential functions with base a',
      'Natural exponential functions (base e)',
      'Transformations of exponential functions',
      'Graphing exponential functions',
      'Exponential growth and decay',
      'Applications of exponential functions'
    ]
  },
  'inverse-functions': {
    name: 'Inverse Functions (Chapter 27)',
    sources: ['27_Inverse_Functions_Notes', '27_Inverse_Functions_Exercises'],
    topics: [
      'Definition of inverse functions',
      'One-to-one functions',
      'Finding inverse functions',
      'Graphing inverse functions',
      'Composition of functions and inverses',
      'Applications of inverse functions'
    ]
  },
  'logarithmic-functions-and-their-graphs': {
    name: 'Logarithmic Functions and their Graphs (Chapter 28)',
    sources: ['28_Logarithmic_Functions_and_their_Graphs_Notes', '28_Logarithmic_Functions_and_their_Graphs_Exercises'],
    topics: [
      'Definition of logarithmic functions',
      'Common and natural logarithms',
      'Properties of logarithms',
      'Graphing logarithmic functions',
      'Logarithmic scales',
      'Applications of logarithmic functions'
    ]
  },
  'exponential-logarithmic-equations-inequalities': {
    name: 'Exponential and Logarithmic Equations and Inequalities (Chapter 29)',
    sources: ['29_Exponential_and_Logarithmic_Equations_and_Inequalities_Notes', '29_Exponential_and_Logarithmic_Equations_and_Inequalities_Exercises'],
    topics: [
      'Solving exponential equations',
      'Solving logarithmic equations',
      'Exponential inequalities',
      'Logarithmic inequalities',
      'Change of base formula',
      'Applications and word problems'
    ]
  },
  'binomial-theorem': {
    name: 'Binomial Theorem (Chapter 30)',
    sources: ['30_Binomial_Theorem_Notes', '30_Binomial_Theorem_Exercises'],
    topics: [
      'Pascal\'s triangle',
      'Binomial coefficients',
      'Binomial theorem formula',
      'Expanding binomial expressions',
      'Finding specific terms',
      'Applications of binomial theorem'
    ]
  },
  'average-rate-of-change': {
    name: 'Average Rate of Change (Chapter 31)',
    sources: ['31_Average_Rate_of_Change_Notes', '31_Average_Rate_of_Change_Exercises'],
    topics: [
      'Average rate of change formula',
      'Secant lines and slopes',
      'Interpretation of rate of change',
      'Applications to real-world problems',
      'Graphical interpretation',
      'Connection to calculus concepts'
    ]
  }
}

/**
 * OpenRouter RAG chat completion endpoint
 * 
 * This endpoint:
 * 1. Receives user messages with model and chapter selection
 * 2. Performs RAG search on selected chapter content
 * 3. Sends requests to OpenRouter API with context
 * 4. Returns AI responses with streaming support
 */
export async function POST(req: Request) {
  try {
    console.log('[OPENROUTER-RAG] ===== Starting Request Processing =====');
    
    // Parse incoming message data
    const input: { 
      messages: Array<{ role: 'user'|'assistant'; content: string }>; 
      selectedModel: string;
      selectedChapter: string;
      threadId?: string;
      files?: Array<{ name: string; data: string; type: string; size: number }>;
      images?: Array<{ name: string; data: string; type: string; size: number }>;
    } = await req.json();
    
    const selectedModel = input.selectedModel || 'openai/gpt-4o';
    const selectedChapter = input.selectedChapter || 'real-numbers';
    const threadId = input.threadId || 'session-' + Date.now();
    const lastMessage = input.messages[input.messages.length - 1];
    const userQuery = lastMessage?.content || '';
    
    console.log(`[OPENROUTER-RAG] Request Details:`);
    console.log(`  - Model: ${selectedModel}`);
    console.log(`  - Chapter: ${selectedChapter}`);
    console.log(`  - Thread ID: ${threadId}`);
    console.log(`  - User Query: "${userQuery}"`);
    console.log(`  - Messages Count: ${input.messages.length}`);
    console.log(`  - Files: ${input.files?.length || 0}, Images: ${input.images?.length || 0}`);
    console.log(`  - API Key Present: ${!!process.env.OPENROUTER_API_KEY}`);
    
    // Check if API key is present
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[OPENROUTER-RAG] Missing OPENROUTER_API_KEY environment variable');
      return NextResponse.json({ 
        error: 'OpenRouter API key not configured',
        details: 'Please set OPENROUTER_API_KEY in your environment variables'
      }, { status: 500 });
    }

    // Validate model selection
    const allModels = Object.values(AVAILABLE_MODELS).flat();
    const isValidModel = allModels.some(model => model.id === selectedModel);
    if (!isValidModel) {
      console.error(`[OPENROUTER-RAG] Invalid model selection: ${selectedModel}`);
      return NextResponse.json({ 
        error: 'Invalid model selection' 
      }, { status: 400 });
    }

    // Validate chapter selection
    const chapterConfig = CHAPTER_CONFIGS[selectedChapter as keyof typeof CHAPTER_CONFIGS];
    if (!chapterConfig) {
      console.error(`[OPENROUTER-RAG] Invalid chapter selection: ${selectedChapter}`);
      return NextResponse.json({ 
        error: 'Invalid chapter selection' 
      }, { status: 400 });
    }

    console.log(`[OPENROUTER-RAG] Chapter Config:`);
    console.log(`  - Name: ${chapterConfig.name}`);
    console.log(`  - Sources: ${chapterConfig.sources.join(', ')}`);
    console.log(`  - Topics Count: ${chapterConfig.topics.length}`);

    // Load thread history and persist the new user message
    console.log('[OPENROUTER-RAG] Loading thread history...');
    const { threads, chatMemory, threadSummaries } = await getCollections();
    await threads.updateOne(
      { sessionId: threadId, chapter: selectedChapter },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { updatedAt: new Date() },
        $push: { messages: { role: 'user', content: userQuery, timestamp: new Date() } }
      },
      { upsert: true }
    );

    const threadDoc = await threads.findOne({ sessionId: threadId, chapter: selectedChapter });
    const turnIndex = (threadDoc?.messages?.length || 0) + 1;
    const history = (threadDoc?.messages || []).slice(-12); // keep recent turns for chronology
    console.log(`[OPENROUTER-RAG] Thread loaded - Turn: ${turnIndex}, History length: ${history.length}`);

    // Retrieve long-term memory: top N prior exchanges semantically related to this query
    console.log('[OPENROUTER-RAG] Retrieving long-term memory...');
    let memoryContext = '';
    try {
      const priorCount = await chatMemory.countDocuments({ threadId });
      console.log(`[OPENROUTER-RAG] Prior memory entries: ${priorCount}`);
      
      if (priorCount > 0) {
        const queryVec = await generateEmbedding(userQuery);
        console.log(`[OPENROUTER-RAG] Generated query embedding, dimension: ${queryVec.length}`);
        
        const memoryHits = await chatMemory.aggregate<{
          content: string;
          role: 'user'|'assistant';
          score: number;
        }>([
          {
            $vectorSearch: {
              queryVector: queryVec,
              path: 'embedding',
              numCandidates: 100,
              limit: 6,
              index: 'chat_memory_index',
              filter: { threadId }
            }
          },
          { $project: { _id: 0, content: 1, role: 1, score: { $meta: 'vectorSearchScore' } } }
        ]).toArray();
        
        console.log(`[OPENROUTER-RAG] Memory search results: ${memoryHits.length} hits`);
        memoryHits.forEach((hit, idx) => {
          console.log(`  ${idx + 1}. [${hit.role}] Score: ${hit.score.toFixed(3)} - "${hit.content.substring(0, 100)}..."`);
        });
        
        if (memoryHits.length > 0) {
          memoryContext = memoryHits.map(h => `[${h.role}] ${h.content}`).join('\n');
          console.log(`[OPENROUTER-RAG] Memory context length: ${memoryContext.length} characters`);
        }
      }
    } catch (e) {
      console.log('[OPENROUTER-RAG] Memory retrieval error:', e);
    }

    // Search for relevant content from PDFs (filter by chapter sources)
    console.log('[OPENROUTER-RAG] Starting hybrid search for relevant content...');
    console.log(`[OPENROUTER-RAG] Searching in sources: ${chapterConfig.sources.join(', ')}`);
    
    const searchResults = await findRelevantContent(userQuery, 4, chapterConfig.sources);
    console.log(`[OPENROUTER-RAG] Search Results:`);
    console.log(`  - Found ${searchResults.length} relevant chunks`);
    
    searchResults.forEach((result, idx) => {
      console.log(`  ${idx + 1}. Source: ${result.source || 'Unknown'}`);
      console.log(`     Similarity: ${result.similarity?.toFixed(3) || 'N/A'}`);
      console.log(`     Content: "${result.name.substring(0, 150)}..."`);
      console.log(`     Resource ID: ${result.resourceId || 'N/A'}`);
    });

    // Prepare context from search results
    let contextText = '';
    if (searchResults.length > 0) {
      contextText = searchResults.map(r => `${r.source ? `[${r.source}]` : ''}\n${r.name}`).join('\n\n');
      console.log(`[OPENROUTER-RAG] Context text length: ${contextText.length} characters`);
    } else {
      console.log('[OPENROUTER-RAG] No relevant content found - will use general knowledge');
    }

    // Create system prompt based on chapter (exactly like original RAG)
    const systemPrompt = `You are a specialized AI math tutor for ${chapterConfig.name} of a precalculus course at NYU Abu Dhabi. Your only role is to teach and help students master the content of this chapter using the provided course materials. You must not reference or use any other source of information, examples, or methods. You must not mention file names or professors' names.

Your job is to:  
Teach only the following topics from this chapter:  
${chapterConfig.topics.map(topic => `- ${topic}`).join('\n')}

Always engage the student by:  
- Starting with a friendly greeting and listing these topics if they say something general like "hi" or "hello," or if they seem unsure.  
- Asking which topic they want to work on first, or if they'd like you to guide them step by step.  
- If they pick a topic, teach that topic only using the course notes and give them practice questions from the exercises document to work on.  
- Never give final answers directly for exercises—only provide hints and guiding questions to help them think through each problem.  
- Check for understanding frequently and break down explanations into small, clear steps.  
- If they want to switch topics or if the conversation is becoming too broad, politely suggest creating a new chat to stay organized.

When displaying math expressions, format them using LaTeX-style notation so that they render clearly for the student.

If a student asks to draw a graph, please write code to draw the graph, and then always ask them to click on the run button to see it, and remind them it may take about 15 seconds to run it. this is an interface thing, please just tell them to click on the run button.

Use Markdown or LaTeX for math (e.g. x^2, x^{2}, $x^2$).

Never answer questions outside of this chapter, no matter what the student asks. Politely tell them that's beyond this tutor's role and suggest opening a new chat for that topic.

Never provide information about topics not covered in this chapter, even if the student insists or seems to want more. Only stick to the content of this chapter.

Your mission is to ensure the student arrives in class fully prepared on this chapter and has truly mastered the concepts and exercises in the course materials.

${contextText ? `Context extracted from course materials:

${contextText}

Use this context as authoritative for wording and definitions.` : 'No specific course passages were found for this query. Answer using only the ' + chapterConfig.name + ' knowledge.'}`;

    console.log(`[OPENROUTER-RAG] System prompt length: ${systemPrompt.length} characters`);

    // Get conversation summary and memory context
    const summaryDoc = await threadSummaries.findOne({ threadId, chapter: selectedChapter });
    const summaryBlock = summaryDoc?.summary ? `\n\nConversation summary (so far):\n${summaryDoc.summary}` : '';
    const memoryBlock = memoryContext
      ? `\n\nRelevant prior conversation excerpts:\n${memoryContext}`
      : '';

    console.log(`[OPENROUTER-RAG] Summary block length: ${summaryBlock.length}`);
    console.log(`[OPENROUTER-RAG] Memory block length: ${memoryBlock.length}`);

    // Prepare messages for OpenRouter
    const openrouterMessages = [
      { role: 'system', content: systemPrompt + summaryBlock + memoryBlock },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userQuery }
    ];

    console.log(`[OPENROUTER-RAG] Prepared ${openrouterMessages.length} messages for OpenRouter`);
    console.log(`[OPENROUTER-RAG] Calling OpenRouter API...`);

    // Call OpenRouter API with streaming
    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Math1000A OpenRouter RAG Tutor'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: openrouterMessages,
        temperature: 0.3,
        max_tokens: 2000,
        stream: true
      })
    });

    console.log(`[OPENROUTER-RAG] OpenRouter response status: ${openrouterResponse.status}`);

    if (!openrouterResponse.ok) {
      const errorData = await openrouterResponse.json().catch(() => ({ error: 'Failed to parse error response' }));
      console.error('[OPENROUTER-RAG] OpenRouter API Error:', {
        status: openrouterResponse.status,
        statusText: openrouterResponse.statusText,
        error: errorData
      });
      return NextResponse.json({ 
        error: 'OpenRouter API error',
        details: errorData.error?.message || errorData.details || `HTTP ${openrouterResponse.status}: ${openrouterResponse.statusText}`
      }, { status: openrouterResponse.status });
    }

    console.log('[OPENROUTER-RAG] Starting streaming response...');

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openrouterResponse.body?.getReader();
        if (!reader) {
          console.error('[OPENROUTER-RAG] No response body reader available');
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';
        let chunkCount = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`[OPENROUTER-RAG] Streaming completed after ${chunkCount} chunks`);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  console.log('[OPENROUTER-RAG] Received [DONE] signal, saving conversation...');
                  
                  // Save assistant message to thread
                  try {
                    await threads.updateOne(
                      { sessionId: threadId, chapter: selectedChapter },
                      {
                        $set: { updatedAt: new Date() },
                        $push: { messages: { role: 'assistant', content: fullResponse, timestamp: new Date() } }
                      }
                    );
                    console.log('[OPENROUTER-RAG] Assistant message saved to thread');
                  } catch (e) {
                    console.log('[OPENROUTER-RAG] Thread update or memory storage error:', e);
                  }
                  
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    chunkCount++;
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('[OPENROUTER-RAG] Streaming error:', error);
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      }
    });

    // Store memory after streaming completes
    // We need to handle this properly since streaming is async
    const memoryStoragePromise = (async () => {
      try {
        // Wait a bit for streaming to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get the final thread state
        const finalThreadDoc = await threads.findOne({ sessionId: threadId, chapter: selectedChapter });
        const finalMessages = finalThreadDoc?.messages || [];
        const lastAssistantMessage = finalMessages[finalMessages.length - 1];
        
        if (lastAssistantMessage && lastAssistantMessage.role === 'assistant') {
          const aiResponse = lastAssistantMessage.content;
          
          // Store memory embeddings exactly like the original RAG
          const items = [
            { role: 'user' as const, content: userQuery },
            { role: 'assistant' as const, content: aiResponse }
          ];
          const embeddings = await Promise.all(items.map(async (it) => ({
            role: it.role,
            content: it.content,
            embedding: await generateEmbedding(it.content)
          })));
          const docs = embeddings.map((e, idx) => ({
            threadId,
            role: e.role,
            turn: turnIndex + idx,
            content: e.content,
            embedding: e.embedding,
            createdAt: new Date()
          }));
          await chatMemory.insertMany(docs);
          console.log('[OPENROUTER-RAG] Memory embeddings stored successfully');
          
          // Update thread summary if needed (every 10 turns)
          if (turnIndex % 10 === 0) {
            try {
              const summaryPrompt = `Summarize the key points from this tutoring conversation in 2-3 sentences:\n\n${history.map(m => `[${m.role}] ${m.content}`).join('\n')}`;
              
              // Use OpenRouter to generate summary
              const summaryResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                  'X-Title': 'Math1000A OpenRouter RAG Tutor'
                },
                body: JSON.stringify({
                  model: selectedModel,
                  messages: [{ role: 'user', content: summaryPrompt }],
                  temperature: 0.3,
                  max_tokens: 200
                })
              });
              
              if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                const summary = summaryData.choices?.[0]?.message?.content || '';
                
                if (summary) {
                  await threadSummaries.updateOne(
                    { threadId, chapter: selectedChapter },
                    { $set: { summary, updatedAt: new Date() } },
                    { upsert: true }
                  );
                  console.log('[OPENROUTER-RAG] Thread summary updated');
                }
              }
            } catch (e) {
              console.log('[OPENROUTER-RAG] Summary generation error:', e);
            }
          }
        }
      } catch (e) {
        console.log('[OPENROUTER-RAG] Memory storage error:', e);
      }
    })();
    
    // Don't await this, let it run in background
    memoryStoragePromise.catch(e => console.log('[OPENROUTER-RAG] Memory storage failed:', e));

    console.log('[OPENROUTER-RAG] ===== Request Processing Complete =====');
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Thread-ID': threadId,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[OPENROUTER-RAG] ===== ERROR =====');
    console.error('[OPENROUTER-RAG] Error:', error);
    console.error('[OPENROUTER-RAG] ================');
    return NextResponse.json({ 
      error: 'Failed to process request', 
      details: message 
    }, { status: 500 });
  }
}

// Fetch available models
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const threadId = searchParams.get('threadId');
  
  if (type === 'models') {
    return NextResponse.json({ models: AVAILABLE_MODELS });
  }
  
  if (type === 'chapters') {
    return NextResponse.json({ 
      chapters: Object.entries(CHAPTER_CONFIGS).map(([key, config]) => ({
        id: key,
        name: config.name,
        sources: config.sources,
        topics: config.topics
      }))
    });
  }
  
  // Fetch a thread's messages (like original RAG)
  if (threadId) {
    const { threads } = await getCollections();
    const thread = await threads.findOne({ sessionId: threadId });
    return NextResponse.json({ messages: thread?.messages || [] });
  }
  
  return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
}
