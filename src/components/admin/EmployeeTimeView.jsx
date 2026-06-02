import { useState } from 'react'
import { format, differenceInMinutes } from 'date-fns'

function formatMins(mins) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function EmployeeTimeView({ employees, punches }) {
  const [selectedId, setSelectedId] = useState('all')

  const filtered = selectedId === 'all'
    ? punches
    : punches.filter(p => p.user_id === selectedId)

  return (
    <div className="space-y-4">
      {/* Employee filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filter by employee:</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All employees</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.full_name || e.email}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">No time entries found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Date', 'Clock In', 'Clock Out', 'Duration'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(punch => {
                const mins = punch.punch_out
                  ? differenceInMinutes(new Date(punch.punch_out), new Date(punch.punch_in))
                  : null
                return (
                  <tr key={punch.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {punch.profiles?.full_name || punch.profiles?.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {format(new Date(punch.punch_in), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {format(new Date(punch.punch_in), 'h:mm aa')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {punch.punch_out
                        ? format(new Date(punch.punch_out), 'h:mm aa')
                        : <span className="text-green-600 font-medium">In progress</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {mins == null ? <span className="text-green-600">…</span> : formatMins(mins)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
