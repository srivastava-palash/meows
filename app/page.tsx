import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 'calc(100vh - 44px)' }} className="bg-[#e8ead8] flex items-center justify-center">
      <p className="text-[#888] text-sm">Loading map…</p>
    </div>
  ),
})

export default function HomePage() {
  return <Map />
}
