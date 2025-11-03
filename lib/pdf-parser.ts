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
    // pdf-parse tries to access './test/data/05-versions-space.pdf' during initialization
    // This is relative to process.cwd(), so we need to create it there
    // On Vercel, process.cwd() is read-only, so we change cwd to /tmp temporarily
    
    const isVercel = process.env.VERCEL === '1'
    const originalCwd = process.cwd()
    let cwdChanged = false
    
    try {
      if (isVercel) {
        // On Vercel, change to /tmp where we can write
        process.chdir('/tmp')
        cwdChanged = true
        console.log('[PDF-PARSER] Changed working directory to /tmp for Vercel')
      }
      
      // Create the test directory structure where pdf-parse expects it (relative to cwd)
      const testDir = path.join(process.cwd(), 'test', 'data')
      
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true })
      }
      
      // Create the placeholder file that pdf-parse expects
      const placeholderFile = path.join(testDir, '05-versions-space.pdf')
      if (!fs.existsSync(placeholderFile)) {
        fs.writeFileSync(placeholderFile, Buffer.from([]))
      }
      
      console.log(`[PDF-PARSER] Created test directory at: ${testDir}`)
      
      // Now require pdf-parse - it should find the test file we created
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pdfParse = require('pdf-parse')
      console.log('[PDF-PARSER] pdf-parse module loaded successfully')
      
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any
      
      // If it's a test file error, try to proceed anyway
      if (err?.code === 'ENOENT' && err?.path?.includes('test')) {
        console.warn('[PDF-PARSER] Test file error during require, attempting to use module anyway:', err.path)
        
        // Try to get the module from cache (sometimes it loads despite the error)
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const cached = require.cache[require.resolve('pdf-parse')]
          if (cached && cached.exports) {
            pdfParse = cached.exports
            console.log('[PDF-PARSER] Using cached pdf-parse module')
          } else {
            // Force require - sometimes it works on second try
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            pdfParse = require('pdf-parse')
            console.log('[PDF-PARSER] Successfully required pdf-parse on retry')
          }
        } catch (retryError) {
          console.error('[PDF-PARSER] Failed to load pdf-parse even after retry:', retryError)
          throw new Error(`Failed to initialize PDF parser: ${err.message}`)
        }
      } else {
        console.error('[PDF-PARSER] Failed to load pdf-parse:', error)
        throw error
      }
    } finally {
      // Restore original working directory
      if (cwdChanged) {
        try {
          process.chdir(originalCwd)
          console.log('[PDF-PARSER] Restored working directory to:', originalCwd)
        } catch (chdirError) {
          console.warn('[PDF-PARSER] Could not restore working directory:', chdirError)
        }
      }
    }
  }
  
  // Use the loaded module
  const pdf = pdfParse.default || pdfParse
  if (!pdf) {
    throw new Error('PDF parser module is not properly initialized')
  }
  
  return await pdf(buffer)
}

