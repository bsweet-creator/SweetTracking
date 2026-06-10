import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const SUGGESTED = [
  'Feature Development',
  'Bug Fixes',
  'Critical / Incident Response',
  'Code Review',
  'Testing / QA',
  'Release / Deployment',
  'Meetings / Planning',
  'Documentation',
]

export default function CategoryManager({ orgId, categories, onChange }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function addCategory(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const nextOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1
    const { error } = await supabase
      .from('activity_categories')
      .insert({ org_id: orgId, name: name.trim(), sort_order: nextOrder })
    setBusy(false)
    if (error) return toast.error(error.message)
    setName('')
    onChange()
  }

  async function addSuggested() {
    const existing = new Set(categories.map(c => c.name.toLowerCase()))
    const toAdd = SUGGESTED.filter(s => !existing.has(s.toLowerCase()))
      .map((n, i) => ({ org_id: orgId, name: n, sort_order: categories.length + i + 1 }))
    if (toAdd.length === 0) return toast('All suggested categories already exist')
    const { error } = await supabase.from('activity_categories').insert(toAdd)
    if (error) return toast.error(error.message)
    toast.success('Added suggested categories')
    onChange()
  }

  async function remove(id) {
    // Archive (keeps historical reporting intact) rather than hard-delete
    const { error } = await supabase.from('activity_categories').update({ archived: true }).eq('id', id)
    if (error) return toast.error(error.message)
    onChange()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Activity categories</h2>
      <p className="text-sm text-gray-500 mb-4">
        What employees tag their on-the-clock time as. Keep the list short (5–8).
      </p>

      <form onSubmit={addCategory} className="flex gap-2 mb-4">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Feature Development"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Add
        </button>
      </form>

      {categories.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 mb-3">No categories yet.</p>
          <button
            onClick={addSuggested}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Add a suggested set
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full pl-3 pr-2 py-1 text-sm text-gray-700"
            >
              {c.name}
              <button
                onClick={() => remove(c.id)}
                aria-label={`Remove ${c.name}`}
                className="text-gray-400 hover:text-red-600 text-base leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
