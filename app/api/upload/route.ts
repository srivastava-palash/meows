import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabase } from '@/lib/db'
import type { UploadResult } from '@/types'

const BUCKET = 'cat-photos'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('photo') as File | null

  if (!file) return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or HEIC' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const meta = await sharp(buffer).metadata()
  const photo_width = meta.width ?? 0
  const photo_height = meta.height ?? 0

  const id = crypto.randomUUID()

  // Full resolution (convert to JPEG for consistency)
  const fullBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer()
  const fullPath = `${id}/full.jpg`
  const { error: fullErr } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, fullBuffer, { contentType: 'image/jpeg' })
  if (fullErr) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  // Thumbnail 120×120 (cover crop)
  const thumbBuffer = await sharp(buffer)
    .resize(120, 120, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer()
  const thumbPath = `${id}/thumb.jpg`
  const { error: thumbErr } = await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg' })
  if (thumbErr) return NextResponse.json({ error: 'Thumbnail upload failed' }, { status: 500 })

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`
  const result: UploadResult = {
    photo_url: `${base}/${fullPath}`,
    thumbnail_url: `${base}/${thumbPath}`,
    photo_width,
    photo_height,
  }

  return NextResponse.json(result, { status: 201 })
}
