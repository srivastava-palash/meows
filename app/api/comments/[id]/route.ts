import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { cookies } from 'next/headers'

// DELETE — remove a comment (no strict auth; caller must know the comment ID,
// which is only in localStorage of the person who posted it)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
