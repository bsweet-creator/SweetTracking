import { useEffect, useRef, useState } from 'react'
import { format, isToday, differenceInSeconds } from 'date-fns'
import confetti from 'canvas-confetti'

const GOAL_SECONDS = 8 * 3600 // 8-hour workday

function greeting(date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtHM(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Sum today's worked seconds (completed shifts + live elapsed of the open one)
function todaySeconds(punches, now) {
  let total = 0
  for (const p of punches) {
    const start = new Date(p.punch_in)
    if (!isToday(start)) continue
    const end = p.punch_out ? new Date(p.punch_out) : now
    total += Math.max(0, differenceInSeconds(end, start))
  }
  return total
}

export default function ClockWidget({ name, activePunch, punches, onClockIn, onClockOut }) {
  const [now, setNow] = useState(new Date())
  const celebratedRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const worked = todaySeconds(punches, now)
  const progress = Math.min(worked / GOAL_SECONDS, 1)
  const pct = Math.round(progress * 100)
  const complete = worked >= GOAL_SECONDS
  const overtime = Math.max(0, worked - GOAL_SECONDS)

  // One-time confetti celebration when crossing 8h (once per day)
  useEffect(() => {
    if (!complete) return
    const key = `celebrated-${format(now, 'yyyy-MM-dd')}`
    if (celebratedRef.current || localStorage.getItem(key)) return
    celebratedRef.current = true
    localStorage.setItem(key, '1')
    const end = Date.now() + 1200
    ;(function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors: ['#6366f1', '#d946ef', '#10b981'] })
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors: ['#6366f1', '#d946ef', '#10b981'] })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
  }, [complete, now])

  // SVG ring geometry
  const R = 100
  const C = 2 * Math.PI * R
  const dash = C * (1 - progress)

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-sm">
      {/* Accent gradient header strip */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
        <p className="text-sm/none opacity-90">{greeting(now)},</p>
        <p className="text-xl font-semibold mt-1">{name || 'there'} 👋</p>
        <p className="text-xs opacity-80 mt-1">{format(now, 'EEEE, MMMM d · h:mm:ss aa')}</p>
      </div>

      <div className="px-6 py-7 flex flex-col items-center">
        {/* The ring meter */}
        <div className="relative w-[240px] h-[240px]">
          <svg viewBox="0 0 240 240" className="w-full h-full -rotate-90">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={complete ? '#10b981' : '#6366f1'} />
                <stop offset="100%" stopColor={complete ? '#34d399' : '#d946ef'} />
              </linearGradient>
            </defs>
            <circle cx="120" cy="120" r={R} fill="none" stroke="#f1f1f4" strokeWidth="16" />
            <circle
              cx="120" cy="120" r={R} fill="none"
              stroke="url(#ringGrad)" strokeWidth="16" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={dash}
              style={{ transition: 'stroke-dashoffset 0.9s ease' }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-4xl font-bold tabular-nums text-gray-900">{fmtHM(worked)}</span>
            <span className="text-sm text-gray-400 mt-0.5">of 8h goal</span>
            <span className={`mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${
              complete ? 'bg-emerald-100 text-emerald-700'
              : activePunch ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-500'
            }`}>
              {complete ? `🎉 Goal reached${overtime ? ` · +${fmtHM(overtime)}` : ''}`
                : activePunch ? `${pct}% · clocked in`
                : `${pct}%`}
            </span>
          </div>
        </div>

        {/* Status line */}
        <div className="mt-5 flex items-center gap-2 text-sm">
          {activePunch ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-gray-600">
                Clocked in since {format(new Date(activePunch.punch_in), 'h:mm aa')}
              </span>
            </>
          ) : (
            <span className="text-gray-400">You're clocked out</span>
          )}
        </div>

        {/* Action button */}
        <div className="mt-4 w-full max-w-xs">
          {!activePunch ? (
            <button
              onClick={onClockIn}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-2xl py-4 text-base shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all"
            >
              Clock In
            </button>
          ) : (
            <button
              onClick={onClockOut}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-2xl py-4 text-base shadow-lg active:scale-[0.98] transition-all"
            >
              Clock Out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
