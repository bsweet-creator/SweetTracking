import { useEffect, useState } from 'react'
import { format, differenceInSeconds } from 'date-fns'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function ClockWidget({ activePunch, onClockIn, onClockOut }) {
  const [elapsed, setElapsed] = useState(0)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date())
      if (activePunch) {
        setElapsed(differenceInSeconds(new Date(), new Date(activePunch.punch_in)))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [activePunch])

  useEffect(() => {
    if (activePunch) {
      setElapsed(differenceInSeconds(new Date(), new Date(activePunch.punch_in)))
    } else {
      setElapsed(0)
    }
  }, [activePunch])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{format(now, 'EEEE, MMMM d')}</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums mt-0.5">
            {format(now, 'h:mm:ss aa')}
          </p>
        </div>

        <div className="text-right">
          {activePunch ? (
            <>
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Clocked In</p>
              <p className="text-2xl font-mono font-semibold text-gray-800">{formatDuration(elapsed)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                since {format(new Date(activePunch.punch_in), 'h:mm aa')}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Not clocked in</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        {!activePunch ? (
          <button
            onClick={onClockIn}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl py-3 text-sm transition-colors"
          >
            Clock In
          </button>
        ) : (
          <button
            onClick={onClockOut}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl py-3 text-sm transition-colors"
          >
            Clock Out
          </button>
        )}
      </div>
    </div>
  )
}
