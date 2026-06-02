import { useState } from 'react'
import { format } from 'date-fns'

const statusStyles = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  denied:   'bg-red-50 text-red-600 border-red-200',
}

export default function VacationReview({ vacations, onReview }) {
  const [filter, setFilter] = useState('pending') // 'pending' | 'all'

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
          {filter === 'pending' ? 'No pending requests.' : 'No vacation requests found.'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(v => (
            <div key={v.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">
                      {v.profiles?.full_name || v.profiles?.email}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${statusStyles[v.status]}`}>
                      {v.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(new Date(v.start_date + 'T00:00:00'), 'MMM d')}
                    {' – '}
                    {format(new Date(v.end_date + 'T00:00:00'), 'MMM d, yyyy')}
                  </p>
                  {v.reason && (
                    <p className="text-sm text-gray-500 mt-1 italic">"{v.reason}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Submitted {format(new Date(v.created_at), 'MMM d, yyyy')}
                  </p>
                </div>

                {v.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => onReview(v.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReview(v.id, 'denied')}
                      className="bg-white hover:bg-red-50 text-red-600 border border-red-300 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
