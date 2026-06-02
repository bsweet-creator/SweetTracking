import { useMemo, useState } from 'react'
import {
  format, differenceInMinutes,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks,
} from 'date-fns'

const PERIODS = {
  this_week:  'This week',
  last_week:  'Last week',
  this_month: 'This month',
  all:        'All time',
}

function periodRange(period) {
  const now = new Date()
  switch (period) {
    case 'this_week':  return [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })]
    case 'last_week': {
      const lw = subWeeks(now, 1)
      return [startOfWeek(lw, { weekStartsOn: 1 }), endOfWeek(lw, { weekStartsOn: 1 })]
    }
    case 'this_month': return [startOfMonth(now), endOfMonth(now)]
    default:           return [null, null] // all time
  }
}

function fmtHours(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function downloadCSV(filename, rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = rows.map(r => r.map(escape).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports({ punches }) {
  const [period, setPeriod] = useState('this_week')

  const [start, end] = periodRange(period)

  // Punches that fall within the selected period
  const inRange = useMemo(() => {
    return punches.filter(p => {
      const t = new Date(p.punch_in)
      return (!start || t >= start) && (!end || t <= end)
    })
  }, [punches, start, end])

  // Per-employee totals (completed punches only)
  const totals = useMemo(() => {
    const map = new Map()
    for (const p of inRange) {
      const name = p.profiles?.full_name || p.profiles?.email || 'Unknown'
      const entry = map.get(name) || { name, minutes: 0, shifts: 0, open: 0 }
      if (p.punch_out) {
        entry.minutes += differenceInMinutes(new Date(p.punch_out), new Date(p.punch_in))
        entry.shifts += 1
      } else {
        entry.open += 1
      }
      map.set(name, entry)
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes)
  }, [inRange])

  const grandTotal = totals.reduce((s, t) => s + t.minutes, 0)

  function exportCsv() {
    const header = ['Employee', 'Email', 'Date', 'Clock In', 'Clock Out', 'Hours (decimal)']
    const rows = inRange
      .slice()
      .sort((a, b) => new Date(a.punch_in) - new Date(b.punch_in))
      .map(p => {
        const mins = p.punch_out ? differenceInMinutes(new Date(p.punch_out), new Date(p.punch_in)) : 0
        return [
          p.profiles?.full_name || '',
          p.profiles?.email || '',
          format(new Date(p.punch_in), 'yyyy-MM-dd'),
          format(new Date(p.punch_in), 'HH:mm'),
          p.punch_out ? format(new Date(p.punch_out), 'HH:mm') : '',
          p.punch_out ? (mins / 60).toFixed(2) : '',
        ]
      })
    const label = PERIODS[period].toLowerCase().replace(/\s+/g, '-')
    downloadCSV(`timesheet-${label}.csv`, [header, ...rows])
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {Object.entries(PERIODS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          disabled={!inRange.length}
          className="bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Download CSV
        </button>
      </div>

      {start && (
        <p className="text-xs text-gray-400">
          {format(start, 'MMM d, yyyy')} – {format(end, 'MMM d, yyyy')}
        </p>
      )}

      {/* Totals table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {totals.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">No time logged in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Shifts', 'Total Hours'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {totals.map(t => (
                <tr key={t.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {t.name}
                    {t.open > 0 && <span className="ml-2 text-xs text-green-600">({t.open} in progress)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.shifts}</td>
                  <td className="px-4 py-3 font-mono text-gray-800">{fmtHours(t.minutes)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
                <td></td>
                <td className="px-4 py-3 font-mono font-semibold text-gray-900">{fmtHours(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
