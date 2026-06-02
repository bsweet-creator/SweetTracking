import { format } from 'date-fns'

const statusStyles = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  denied:   'bg-red-50 text-red-600 border-red-200',
}

export default function VacationHistory({ vacations }) {
  if (!vacations.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center text-sm text-gray-400">
        No vacation requests yet.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">My Requests</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {vacations.map(v => (
          <div key={v.id} className="px-6 py-3 flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-gray-800">
                {format(new Date(v.start_date + 'T00:00:00'), 'MMM d')}
                {' – '}
                {format(new Date(v.end_date + 'T00:00:00'), 'MMM d, yyyy')}
              </p>
              {v.reason && <p className="text-gray-500 text-xs mt-0.5 truncate max-w-xs">{v.reason}</p>}
            </div>
            <span className={`capitalize text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyles[v.status]}`}>
              {v.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
