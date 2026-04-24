export interface CatPin {
  id: string
  thumbnail_url: string
  lat: number
  lng: number
  name: string | null
  location_name: string | null
  upvote_count: number
}

export interface Cat {
  id: string
  photo_url: string
  thumbnail_url: string
  photo_width: number
  photo_height: number
  lat: number
  lng: number
  location_name: string | null
  name: string | null
  story: string | null
  last_seen_at: string | null
  user_id: string | null
  is_approved: boolean
  is_hidden: boolean
  report_count: number
  upvote_count: number
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  cat_id: string
  text: string
  author_name: string | null
  user_id: string | null
  parent_id: string | null
  is_hidden: boolean
  report_count: number
  created_at: string
  replies?: Comment[]
}

export interface SessionData {
  userId: string
  username: string
}

export interface BoundingBox {
  swLat: number
  swLng: number
  neLat: number
  neLng: number
}

export interface UploadResult {
  photo_url: string
  thumbnail_url: string
  photo_width: number
  photo_height: number
}
