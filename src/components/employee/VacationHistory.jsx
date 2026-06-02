import { format, differenceInCalendarDays } from 'date-fns'

const STATUS = {
  pending:  { label: 'Pending',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  denied:   { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-200' },
}

function dayAt(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

export default function VacationHistory({ vacations }) {
  // Next upcoming approved leave
  const today = new Date()
  const upcoming = vacations
    .filter(v => v.status === 'approved' && dayAt(v.end_date) >= today)
    .sort((a, b) => dayAt(a.start_date) - dayAt(b.start_date))[0]

  return (
    <div className="space-y-4">
      {upcoming && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide opacity-90">Next time off</p>
          <p className="text-lg font-semibold mt-0.5">
            {format(dayAt(upcoming.start_date), 'MMM d')} – {format(dayAt(upcoming.end_date), 'MMM d, yyyy')}
          </p>
          <p className="text-sm opacity-90 mt-0.5">
            {(() => {
              const d = differenceInCalendarDays(dayAt(upcoming.start_date), today)
              return d <= 0 ? "You're on leave" : d === 1 ? 'Starts tomorrow' : `In ${d} days`
            })()}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">My Requests</h2>
        </div>

        {!vacations.length ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-500">No leave requests yet.</p>
            <p className="text-xs text-gray-400 mt-1">Submit a request above to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {vacations.map(v => {
              const s = STATUS[v.status] || STATUS.pending
              return (
                <div key={v.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800">
                          {format(dayAt(v.start_date), 'MMM d')} – {format(dayAt(v.end_date), 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{v.leave_type}</span>
                      </div>
                      {v.reason && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{v.reason}</p>}
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${s.cls}`}>
                      {s.icon} {s.label}
                    </span>
                  </div>

                  {v.manager_comments && (
                    <div className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-600">Manager: </span>
                      <span className="text-gray-600">{v.manager_comments}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
