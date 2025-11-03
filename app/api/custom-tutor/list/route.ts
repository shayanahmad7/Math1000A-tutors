import { NextResponse } from 'next/server'
import { getCollections } from '@/lib/db/mongodb'

export const runtime = 'nodejs'

/**
 * List custom tutors for a user
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const ownerId = searchParams.get('ownerId') || 'anonymous'
    
    console.log(`[CUSTOM-TUTOR-LIST] Fetching tutors for owner: ${ownerId}`)
    
    const { customTutors } = await getCollections()
    
    const tutors = await customTutors
      .find({ ownerId })
      .sort({ createdAt: -1 })
      .toArray()
    
    console.log(`[CUSTOM-TUTOR-LIST] Found ${tutors.length} tutors`)
    
    return NextResponse.json({
      success: true,
      tutors: tutors.map(tutor => ({
        tutorId: tutor.tutorId,
        name: tutor.name,
        description: tutor.description || '',
        sources: tutor.sources,
        createdAt: tutor.createdAt,
        updatedAt: tutor.updatedAt
      }))
    })
    
  } catch (error: any) {
    console.error('[CUSTOM-TUTOR-LIST] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to list tutors',
      details: error.message 
    }, { status: 500 })
  }
}

