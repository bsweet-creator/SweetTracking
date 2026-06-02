import { useState } from 'react'
import { format } from 'date-fns'

const statusStyles = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  denied:   'bg-red-50 text-red-600 border-red-200',
}
const statusLabel = { pending: 'Pending', approved: 'Approved', denied: 'Rejected' }

function Field({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-line">{value}</p>
    </div>
  )
}

function RequestCard({ v, onReview }) {
  const [comment, setComment] = useState(v.manager_comments || '')
  const [busy, setBusy] = useState(false)

  async function review(status) {
    setBusy(true)
    await onReview(v.id, status, comment)
    setBusy(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{v.profiles?.full_name || v.profiles?.email}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyles[v.status]}`}>
              {statusLabel[v.status] || v.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{v.profiles?.email}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-gray-700">{v.leave_type}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {format(new Date(v.start_date + 'T00:00:00'), 'MMM d')}
            {' – '}
            {format(new Date(v.end_date + 'T00:00:00'), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-gray-100">
        <Field label="Reason for Leave" value={v.reason} />
        <Field label="Availability" value={v.availability} />
        <Field label="Available Window (BD)" value={v.available_window} />
        <Field label="Preferred Contact" value={v.contact_method} />
        <Field label="Emergency Contact" value={v.emergency_contact} />
        <Field label="Backup Person" value={v.backup_person} />
        <Field label="Informed Backup?" value={v.backup_person ? (v.informed_backup ? 'Yes' : 'No') : ''} />
        <Field label="Tasks Needing Coverage" value={v.coverage_tasks} />
        <Field label="Critical Deadlines" value={v.critical_deadlines} />
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Submitted {format(new Date(v.created_at), 'MMM d, yyyy · h:mm aa')}
      </p>

      {/* Manager comments + actions */}
      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Manager Comments</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            placeholder="Add a note for the employee (optional)"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => review('approved')}
            disabled={busy}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => review('denied')}
            disabled={busy}
            className="bg-white hover:bg-red-50 disabled:opacity-50 text-red-600 border border-red-300 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Reject
          </button>
          {v.status !== 'pending' && (
            <button
              onClick={() => review(v.status)}
              disabled={busy}
              className="ml-auto text-gray-500 hover:text-gray-800 text-sm font-medium px-3 py-1.5 transition-colors"
            >
              Save comment
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VacationReview({ vacations, onReview }) {
  const [filter, setFilter] = useState('pending')

  const displayed = filter === 'pending'
    ? vacations.filter(v => v.status === 'pending')
    : vacations

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['pending', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'pending' ? 'Pending' : 'All Requests'}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-sm text-gray-400">
          {filter === 'pending' ? 'No pending requests.' : 'No leave requests found.'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(v => (
            <RequestCard key={v.id} v={v} onReview={onReview} />
          ))}
        </div>
      )}
    </div>
  )
}
