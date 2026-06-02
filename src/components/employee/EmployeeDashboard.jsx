import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { format, differenceInMinutes } from 'date-fns'
import ClockWidget from './ClockWidget'
import VacationForm from './VacationForm'
import PunchHistory from './PunchHistory'
import VacationHistory from './VacationHistory'

export default function EmployeeDashboard({ profile }) {
  const [activePunch, setActivePunch] = useState(null)
  const [punches, setPunches] = useState([])
  const [vacations, setVacations] = useState([])
  const [tab, setTab] = useState('time') // 'time' | 'vacation'

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: punchData }, { data: vacData }] = await Promise.all([
      supabase
        .from('time_punches')
        .select('*')
        .eq('user_id', profile.id)
        .order('punch_in', { ascending: false })
        .limit(30),
      supabase
        .from('vacation_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false }),
    ])

    if (punchData) {
      setPunches(punchData)
      const open = punchData.find(p => !p.punch_out)
      setActivePunch(open || null)
    }
    if (vacData) setVacations(vacData)
  }

  async function handleClockIn() {
    const { data, error } = await supabase
      .from('time_punches')
      .insert({ user_id: profile.id, punch_in: new Date().toISOString() })
      .select()
      .single()
    if (error) return toast.error(error.message)
    setActivePunch(data)
    setPunches(prev => [data, ...prev])
    toast.success('Clocked in!')
  }

  async function handleClockOut() {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('time_punches')
      .update({ punch_out: now })
      .eq('id', activePunch.id)
      .select()
      .single()
    if (error) return toast.error(error.message)
    setActivePunch(null)
    setPunches(prev => prev.map(p => (p.id === data.id ? data : p)))
    toast.success('Clocked out!')
  }

  async function submitVacation(formData) {
    const { data, error } = await supabase
      .from('vacation_requests')
      .insert({ user_id: profile.id, ...formData })
      .select()
      .single()
    if (error) return toast.error(error.message)
    setVacations(prev => [data, ...prev])
    toast.success('Vacation request submitted!')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">TimeTracker</h1>
          <p className="text-sm text-gray-500">{profile.full_name || profile.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Clock widget always visible */}
        <ClockWidget
          activePunch={activePunch}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {['time', 'vacation'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'time' ? 'Time History' : 'Vacation'}
            </button>
          ))}
        </div>

        {tab === 'time' && <PunchHistory punches={punches} />}

        {tab === 'vacation' && (
          <div className="space-y-6">
            <VacationForm onSubmit={submitVacation} />
            <VacationHistory vacations={vacations} />
          </div>
        )}
      </main>
    </div>
  )
}
