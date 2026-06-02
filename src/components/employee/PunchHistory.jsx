import { format, differenceInMinutes } from 'date-fns'

function formatMins(mins) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function PunchHistory({ punches }) {
  if (!punches.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center text-sm text-gray-400">
        No time entries yet.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Recent Punches</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {punches.map(punch => {
          const mins = punch.punch_out
            ? differenceInMinutes(new Date(punch.punch_out), new Date(punch.punch_in))
            : null
          return (
            <div key={punch.id} className="px-6 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-800">
                  {format(new Date(punch.punch_in), 'EEE, MMM d')}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {format(new Date(punch.punch_in), 'h:mm aa')}
                  {' — '}
                  {punch.punch_out ? format(new Date(punch.punch_out), 'h:mm aa') : (
                    <span className="text-green-600 font-medium">In progress</span>
                  )}
                </p>
              </div>
              <span className={`font-mono text-sm ${mins == null ? 'text-green-600' : 'text-gray-700'}`}>
                {mins == null ? '…' : formatMins(mins)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
