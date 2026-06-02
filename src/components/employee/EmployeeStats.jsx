import { useEffect, useState } from 'react'
import {
  format, isSameDay, isToday, differenceInSeconds,
  startOfWeek, addDays, subDays,
} from 'date-fns'

const GOAL = 8 * 3600

function fmtHM(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Worked seconds on a given day (live for today's open punch)
function secondsOnDay(punches, day, now) {
  let total = 0
  for (const p of punches) {
    const start = new Date(p.punch_in)
    if (!isSameDay(start, day)) continue
    const end = p.punch_out ? new Date(p.punch_out) : (isToday(day) ? now : start)
    total += Math.max(0, differenceInSeconds(end, start))
  }
  return total
}

export default function EmployeeStats({ punches }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Week (Mon–Sun)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const perDay = days.map(d => secondsOnDay(punches, d, now))

  const todaySec = secondsOnDay(punches, now, now)
  const weekSec = perDay.reduce((a, b) => a + b, 0)

  // Streak: consecutive days (ending today or yesterday) with any worked time
  const worked = new Set(
    punches.map(p => format(new Date(p.punch_in), 'yyyy-MM-dd'))
  )
  let streak = 0
  let cursor = new Date(now)
  if (!worked.has(format(cursor, 'yyyy-MM-dd'))) cursor = subDays(cursor, 1)
  while (worked.has(format(cursor, 'yyyy-MM-dd'))) {
    streak++
    cursor = subDays(cursor, 1)
  }

  const scale = Math.max(GOAL, ...perDay)
  const CHART_H = 120
  const goalY = (GOAL / scale) * CHART_H

  const cards = [
    { label: 'Today',     value: fmtHM(todaySec), chip: 'bg-indigo-100 text-indigo-600',  icon: '⏱️' },
    { label: 'This week',  value: fmtHM(weekSec),  chip: 'bg-fuchsia-100 text-fuchsia-600', icon: '📅' },
    { label: 'Day streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}`, chip: 'bg-emerald-100 text-emerald-600', icon: '🔥' },
  ]

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-base ${c.chip}`}>
              {c.icon}
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mt-2 tabular-nums">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly bar chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">This week</h2>
          <span className="text-xs text-gray-400">Goal 8h/day</span>
        </div>

        <div className="relative" style={{ height: CHART_H }}>
          {/* Goal line */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-indigo-300"
            style={{ bottom: goalY }}
          />
          <div className="absolute inset-0 flex items-end justify-between gap-2">
            {days.map((d, i) => {
              const sec = perDay[i]
              const h = scale ? (sec / scale) * CHART_H : 0
              const today = isToday(d)
              const reached = sec >= GOAL
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={`w-full max-w-[28px] rounded-t-md transition-all duration-700 ${
                      sec === 0 ? 'bg-gray-100'
                      : reached ? 'bg-gradient-to-t from-emerald-500 to-emerald-400'
                      : today ? 'bg-gradient-to-t from-indigo-600 to-fuchsia-500'
                      : 'bg-gradient-to-t from-indigo-400 to-violet-400'
                    }`}
                    style={{ height: Math.max(sec ? 4 : 2, h) }}
                    title={fmtHM(sec)}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Day labels */}
        <div className="flex items-center justify-between gap-2 mt-2">
          {days.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              <span className={`text-[11px] ${isToday(d) ? 'font-bold text-indigo-600' : 'text-gray-400'}`}>
                {format(d, 'EEEEE')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
