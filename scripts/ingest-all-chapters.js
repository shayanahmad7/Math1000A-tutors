const path = require('path')
const fs = require('fs')
const { MongoClient } = require('mongodb')
const OpenAI = require('openai')
const pdf = require('pdf-parse')

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
if (!process.env.MONGODB_URI) {
  const parentEnv = path.join(process.cwd(), '..', '.env.local')
  if (fs.existsSync(parentEnv)) {
    require('dotenv').config({ path: parentEnv })
  }
}

const MONGODB_URI = process.env.MONGODB_URI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large'

if (!MONGODB_URI || !OPENAI_API_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
const client = new MongoClient(MONGODB_URI)

// Chapter configurations with intelligent topics
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

// File mapping for ingestion
const FILE_MAPPING = {
  '1_Real_Numbers_Notes': '1_Real Numbers_ Notes.pdf',
  '1_Real_Numbers_Exercises': '1_Real Numbers_Exercises.pdf',
  '2_Exponents_Notes': '2_Exponents_Notes.pdf',
  '2_Exponents_Exercises': '2_Exponents_Exercises.pdf',
  '3_Radicals_Notes': '3_Radicals_Notes.pdf',
  '3_Radicals_Exercises': '3_Radicals_Exercises.pdf',
  '4_Algebraic_Expressions_Notes': '4_Algebraic_Expressions_Notes.pdf',
  '4_Algebraic_Expressions_Exercises': '4_Algebraic_Expressions_Exercises.pdf',
  '5_Factoring_Notes': '5_Factoring_Notes.pdf',
  '5_Factoring_Exercises': '5_Factoring_Exercises.pdf',
  '6_Quadratic_Trinomial_Expressions_Notes': '6_Quadratic_Trinomial_Expressions_Notes.pdf',
  '6_Quadratic_Trinomial_Expressions_Exercises': '6_Quadratic_Trinomial_Expressions_Exercises.pdf',
  '7_Rational_Expressions_Notes': '7_Rational_Expressions_Notes.pdf',
  '7_Rational_Expressions_Exercises': '7_Rational_Expressions_Exercises.pdf',
  '8_Compound_Fractions_Notes': '8_Compound_Fractions_Notes.pdf',
  '8_Compound_Fractions_Exercises': '8_Compound_Fractions_Exercises.pdf',
  '9_Avoiding_Common_Errors_Notes': '9_Avoiding_Common_Errors_Notes.pdf',
  '9_Avoiding_Common_Errors_Exercises': '9_Avoiding_Common_Errors_Exercises.pdf',
  '10_Linear_Quadratic_and_Absolute_Value_Equations_Notes': '10_Linear_Quadratic_and_Absolute_Value_Equations_Notes.pdf',
  '10_Linear_Quadratic_and_Absolute_Value_Equations_Exercises': '10_Linear_Quadratic_and_Absolute_Value_Equations_Exercises.pdf',
  '11_Other_Equations_Notes': '11_Other_Equations_Notes.pdf',
  '11_Other_Equations_Exercises': '11_Other_Equations_Exercises.pdf',
  '12_Inequalities_Notes': '12_Inequalities_Notes.pdf',
  '12_Inequalities_Exercises': '12_Inequalities_Exercises.pdf',
  '13_Coordinate_Plane_Graphs_Intercepts_Notes': '13_Coordinate_Plane_Graphs_Intercepts_Notes.pdf',
  '13_Coordinate_Plane_Graphs_Intercepts_Exercises': '13_Coordinate_Plane_Graphs_Intercepts_Exercises.pdf',
  '14_Circles_Notes': '14_Circles_Notes.pdf',
  '14_Circles_Exercises': '14_Circles_Exercises.pdf',
  '15_Functions_Domain_Range_Notes': '15_Functions_Domain_Range_Notes.pdf',
  '15_Functions_Domain_Range_Exercises': '15_Functions_Domain_Range_Exercises.pdf',
  '16_Graphs_of_Functions_Notes': '16_Graphs_of_Functions_Notes.pdf',
  '16_Graphs_of_Functons_Exercises': '16_Graphs_of_Functons_Exercises.pdf',
  '17_Lines_Notes': '17_Lines_Notes.pdf',
  '17_Lines_Exercises': '17_Lines_Exercises.pdf',
  '18_Solving_Equations_and_Inequalities_with_Graphs_Notes': '18_Solving_Equations_and_Inequalities_with_Graphs_Notes.pdf',
  '18_Solving_Equations_and_Inequalities_with_Graphs_Exercises': '18_Solving_Equations_and_Inequalities_with_Graphs_Exercises.pdf',
  '19_Piecewise_Functions_Notes': '19_Piecewise_Functions_Notes.pdf',
  '19_Piecewise_Functions_Exercises': '19_Piecewise_Functions_Exercises.pdf',
  '20_Net_Change_Notes': '20_Net_Change_Notes.pdf',
  '20_Net_Change_Exercises': '20_Net_Change_Exercises.pdf',
  '21_Transformations_of_Functions_Notes': '21_Transformations_of_Functions_Notes.pdf',
  '21_Transformations_of_Functions_Exercises': '21_Transformations_of_Functions_Exercises.pdf',
  '22_Quadratic_Functions_Notes': '22_Quadratic_Functions_Notes.pdf',
  '22_Quadratic_Functions_Exercises': '22_Quadratic_Functions_Exercises.pdf',
  '23_Polynomial_Functions_Notes': '23_Polynomial_Functions_Notes.pdf',
  '23_Polynomial_Functions_Exercises': '23_Polynomial_Functions_Exercises.pdf',
  '24_Combining_Functions_Notes': '24_Combining_Functions_Notes.pdf',
  '24_Combining_Functions_Exercises': '24_Combining_Functions_Exercises.pdf',
  '25_Composition_of_Functions_Notes': '25_Composition_of_Functions_Notes.pdf',
  '25_Composition_of_Functions_Exercises': '25_Composition_of_Functions_Exercises.pdf',
  '26A_Exponential_Functions_with_Base_a_Notes': '26A_Exponential_Functions_with_Base_a_Notes.pdf',
  '26B_Exponential_Functions_with_Base_e_Notes': '26B_Exponential_Functions_with_Base_e_Notes.pdf',
  '26C_Transformations_of_Exponential_Functions_Notes': '26C_Transformations_of_Exponential_Functions_Notes.pdf',
  '26_Exponential_Functions_Exercises': '26_Exponential_Functions_Exercises.pdf',
  '27_Inverse_Functions_Notes': '27_Inverse_Functions_Notes.pdf',
  '27_Inverse_Functions_Exercises': '27_Inverse_Functions_Exercises.pdf',
  '28_Logarithmic_Functions_and_their_Graphs_Notes': '28_Logarithmic_Functions_and_their_Graphs_Notes.pdf',
  '28_Logarithmic_Functions_and_their_Graphs_Exercises': '28_Logarithmic_Functions_and_their_Graphs_Exercises.pdf',
  '29_Exponential_and_Logarithmic_Equations_and_Inequalities_Notes': '29_Exponential_and_Logarithmic_Equations_and_Inequalities_Notes.pdf',
  '29_Exponential_and_Logarithmic_Equations_and_Inequalities_Exercises': '29_Exponential_and_Logarithmic_Equations_and_Inequalities_Exercises.pdf',
  '30_Binomial_Theorem_Notes': '30_Binomial_Theorem_Notes.pdf',
  '30_Binomial_Theorem_Exercises': '30_Binomial_Theorem_Exercises.pdf',
  '31_Average_Rate_of_Change_Notes': '31_Average_Rate_of_Change_Notes.pdf',
  '31_Average_Rate_of_Change_Exercises': '31_Average_Rate_of_Change_Exercises.pdf'
}

async function generateEmbedding(text) {
  const input = text.replace(/\n/g, ' ')
  const response = await openai.embeddings.create({
    model: EMBED_MODEL,
    input
  })
  return response.data[0].embedding
}

async function processPDF(filePath, source) {
  console.log(`Processing ${source}...`)
  
  try {
    // Read and parse PDF
    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdf(dataBuffer)
    const content = data.text
    
    // Clean up the content
    const cleanedContent = content
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim()
    
    // Split into chunks (aim for ~500-1000 characters per chunk)
    const chunkSize = 800
    const chunks = []
    let currentChunk = ''
    
    const sentences = cleanedContent.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (trimmedSentence.length === 0) continue
      
      if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = trimmedSentence
      } else {
        currentChunk += (currentChunk.length > 0 ? '. ' : '') + trimmedSentence
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }
    
    // If no chunks were created, use the whole content
    if (chunks.length === 0) {
      chunks.push(cleanedContent)
    }
    
    const embeddings = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (chunk.trim().length > 0) {
        const embedding = await generateEmbedding(chunk)
        embeddings.push({
          content: chunk,
          source: source,
          chunkIndex: i,
          embedding: embedding
        })
      }
    }
    
    return embeddings
  } catch (error) {
    console.error(`Error processing ${source}:`, error)
    return []
  }
}

async function main() {
  try {
    await client.connect()
    console.log('Connected to MongoDB')
    
    const db = client.db('math1000a_tutors')
    const resources = db.collection('resources')
    const embeddings = db.collection('embeddings')
    
    // Clear existing data for all chapters
    const allSources = Object.values(CHAPTER_CONFIGS).flatMap(config => config.sources)
    console.log('Clearing existing data for all chapters...')
    await resources.deleteMany({ source: { $in: allSources } })
    await embeddings.deleteMany({ source: { $in: allSources } })
    console.log('Cleared existing data')
    
    const contentDir = path.join(process.cwd(), 'public', 'Content')
    
    // Process each chapter
    for (const [chapterId, config] of Object.entries(CHAPTER_CONFIGS)) {
      console.log(`\n=== Processing ${config.name} ===`)
      
      for (const source of config.sources) {
        const fileName = FILE_MAPPING[source]
        if (!fileName) {
          console.log(`Warning: No file mapping found for ${source}`)
          continue
        }
        
        const filePath = path.join(contentDir, fileName)
        if (!fs.existsSync(filePath)) {
          console.log(`Warning: File not found: ${fileName}`)
          continue
        }
        
        const chunks = await processPDF(filePath, source)
        
        if (chunks.length > 0) {
          // Insert resources
          const resourceDocs = chunks.map(chunk => ({
            content: chunk.content,
            source: chunk.source,
            chunkIndex: chunk.chunkIndex,
            createdAt: new Date()
          }))
          await resources.insertMany(resourceDocs)
          
          // Insert embeddings
          const embeddingDocs = chunks.map(chunk => ({
            content: chunk.content,
            source: chunk.source,
            chunkIndex: chunk.chunkIndex,
            embedding: chunk.embedding,
            createdAt: new Date()
          }))
          await embeddings.insertMany(embeddingDocs)
          
          console.log(`✓ Processed ${source}: ${chunks.length} chunks`)
        }
      }
    }
    
    console.log('\n=== Ingestion Complete ===')
    console.log('All 31 chapters have been processed and embedded!')
    
  } catch (error) {
    console.error('Error during ingestion:', error)
  } finally {
    await client.close()
    console.log('Disconnected from MongoDB')
  }
}

main().catch(console.error)
