/**
 * PDF parser wrapper to handle pdf-parse initialization issues in Next.js
 * Creates missing test directory to satisfy pdf-parse's initialization requirements
 */

import * as fs from 'fs'
import * as path from 'path'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfParse: any = null

export async function parsePDF(buffer: Buffer): Promise<{ text: string }> {
  if (!pdfParse) {
    // pdf-parse tries to access test files during initialization
    // Create the test directory structure if it doesn't exist to avoid ENOENT errors
    const testDir = path.join(process.cwd(), 'test', 'data')
    try {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true })
        // Create an empty placeholder file
        const placeholderFile = path.join(testDir, '05-versions-space.pdf')
        if (!fs.existsSync(placeholderFile)) {
          fs.writeFileSync(placeholderFile, Buffer.from([]))
        }
      }
    } catch (dirError) {
      // Ignore directory creation errors - they shouldn't block PDF parsing
      console.warn('[PDF-PARSER] Could not create test directory:', dirError)
    }
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pdfParse = require('pdf-parse')
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any
      // If it's a test file error, the module might still be usable
      // Try to use it anyway if the error is just about test files
      if (err?.code === 'ENOENT' && err?.path?.includes('test')) {
        // Try to get the module from cache
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cached = require.cache[require.resolve('pdf-parse')]
        if (cached && cached.exports) {
          pdfParse = cached.exports
        } else {
          // Last resort: try requiring again (sometimes it works on second try)
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          pdfParse = require('pdf-parse')
        }
      } else {
        throw error
      }
    }
  }
  
  const pdf = pdfParse.default || pdfParse
  return await pdf(buffer)
}

