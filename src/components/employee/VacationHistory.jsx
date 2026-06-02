import { format } from 'date-fns'

const statusStyles = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  denied:   'bg-red-50 text-red-600 border-red-200',
}
const statusLabel = { pending: 'Pending', approved: 'Approved', denied: 'Rejected' }

export default function VacationHistory({ vacations }) {
  if (!vacations.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center text-sm text-gray-400">
        No leave requests yet.
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
          <div key={v.id} className="px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-800">
                    {format(new Date(v.start_date + 'T00:00:00'), 'MMM d')}
                    {' – '}
                    {format(new Date(v.end_date + 'T00:00:00'), 'MMM d, yyyy')}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{v.leave_type}</span>
                </div>
                {v.reason && <p className="text-gray-500 text-xs mt-0.5 truncate max-w-md">{v.reason}</p>}
              </div>
              <span className={`shrink-0 capitalize text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyles[v.status]}`}>
                {statusLabel[v.status] || v.status}
              </span>
            </div>

            {v.manager_comments && (
              <div className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-600">Manager: </span>
                <span className="text-gray-600">{v.manager_comments}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
