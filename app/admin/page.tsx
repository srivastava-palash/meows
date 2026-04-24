import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/db'
import AdminControls from './AdminControls'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const adminAuth = cookieStore.get('admin-auth')?.value

  if (adminAuth !== process.env.ADMIN_PASSWORD) {
    redirect('/admin/login')
  }

  const [{ data: flaggedCats }, { data: flaggedComments }] = await Promise.all([
    supabase
      .from('cats')
      .select('id, thumbnail_url, name, location_name, report_count, is_hidden, created_at')
      .gt('report_count', 0)
      .order('report_count', { ascending: false })
      .limit(50),
    supabase
      .from('comments')
      .select('id, text, author_name, report_count, is_hidden, cat_id, created_at')
      .gt('report_count', 0)
      .order('report_count', { ascending: false })
      .limit(50),
  ])

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Admin — Moderation</h1>
      <AdminControls flaggedCats={flaggedCats ?? []} flaggedComments={flaggedComments ?? []} />
    </main>
  )
}
