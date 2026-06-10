import { useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// Convert an ISO timestamp -> value for <input type="datetime-local"> (local time)
function toLocalInput(iso) {
  if (!iso) return ''
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm")
}

// Convert a datetime-local string -> ISO (UTC) for storage
function toISO(local) {
  if (!local) return null
  return new Date(local).toISOString()
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function PunchEditor({ punch, segments = [], categories = [], onClose, onSave }) {
  const isNew = !punch
  const multiSegment = segments.length > 1
  const [punchIn, setPunchIn] = useState(toLocalInput(punch?.punch_in) || toLocalInput(new Date().toISOString()))
  const [punchOut, setPunchOut] = useState(toLocalInput(punch?.punch_out))
  const [categoryId, setCategoryId] = useState(segments.length === 1 ? (segments[0].category_id || '') : '')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!punchIn) return toast.error('Clock-in time is required')
    if (punchOut && new Date(punchOut) <= new Date(punchIn)) {
      return toast.error('Clock-out must be after clock-in')
    }
    setBusy(true)
    await onSave({
      punch_in: toISO(punchIn),
      punch_out: toISO(punchOut),
      category_id: categoryId || null,
    })
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {isNew ? 'Add Manual Entry' : 'Edit Time Entry'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clock In</label>
            <input
              type="datetime-local"
              value={punchIn}
              onChange={e => setPunchIn(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clock Out <span className="text-gray-400 font-normal">(leave blank if still clocked in)</span>
            </label>
            <input
              type="datetime-local"
              value={punchOut}
              onChange={e => setPunchOut(e.target.value)}
              className={inputClass}
            />
          </div>

          {categories.length > 0 && (
            multiSegment ? (
              <p className="text-xs text-gray-400">
                This entry has multiple activities logged — edit the times here; activity tags are kept as recorded.
              </p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activity (optional)</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Uncategorized</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
