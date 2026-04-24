import AddCatForm from '@/components/AddCatForm'

export default function AddPage() {
  return (
    <main>
      <div className="bg-[#ff6b35] px-4 py-3">
        <h1 className="text-white font-extrabold text-base">Add a Cat</h1>
      </div>
      <AddCatForm />
    </main>
  )
}
