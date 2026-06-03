import { useState, useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay, format,
  addMonths, subMonths,
} from 'date-fns'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayAt(s) {
  return new Date(s + 'T00:00:00')
}
function firstName(v) {
  const n = v.profiles?.full_name || v.profiles?.email || 'Unknown'
  return n.split(' ')[0]
}

export default function Calendar({ vacations }) {
  const [month, setMonth] = useState(startOfMonth(new Date()))

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [month])

  const relevant = useMemo(
    () => vacations.filter(v => v.status === 'approved' || v.status === 'pending'),
    [vacations],
  )

  function offOn(day) {
    return relevant.filter(v => {
      const s = dayAt(v.start_date)
      const e = dayAt(v.end_date)
      return day >= s && day <= e
    })
  }

  return (
    <div className="space-y-4">
      {/* Header / nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(m => subMonths(m, 1))}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ‹ Prev
          </button>
          <button
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setMonth(m => addMonths(m, 1))}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-indigo-500" /> Approved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded border border-amber-400 bg-amber-50" /> Pending
        </span>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {WEEKDAYS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const off = offOn(day)
            const inMonth = isSameMonth(day, month)
            const today = isToday(day)
            const shown = off.slice(0, 3)
            const extra = off.length - shown.length
            return (
              <div
                key={i}
                className={`min-h-[92px] border-b border-r border-gray-100 p-1.5 ${
                  inMonth ? 'bg-white' : 'bg-gray-50/60'
                } ${i % 7 === 0 ? 'border-l' : ''}`}
              >
                <div className="flex justify-end">
                  <span
                    className={`text-xs ${
                      today
                        ? 'bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center'
                        : inMonth ? 'text-gray-600' : 'text-gray-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  {shown.map(v => (
                    <div
                      key={v.id}
                      title={`${v.profiles?.full_name || v.profiles?.email} · ${v.leave_type} (${v.status})`}
                      className={`truncate text-[11px] leading-tight px-1.5 py-0.5 rounded ${
                        v.status === 'approved'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-amber-50 text-amber-700 border border-amber-300'
                      }`}
                    >
                      {firstName(v)}
                    </div>
                  ))}
                  {extra > 0 && (
                    <div className="text-[11px] text-gray-400 px-1.5">+{extra} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
