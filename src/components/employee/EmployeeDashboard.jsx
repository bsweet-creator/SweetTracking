import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { format, differenceInMinutes } from 'date-fns'
import ClockWidget from './ClockWidget'
import EmployeeStats from './EmployeeStats'
import VacationForm from './VacationForm'
import PunchHistory from './PunchHistory'
import PunchEditor from './PunchEditor'
import VacationHistory from './VacationHistory'

export default function EmployeeDashboard({ profile }) {
  const [activePunch, setActivePunch] = useState(null)
  const [punches, setPunches] = useState([])
  const [vacations, setVacations] = useState([])
  const [tab, setTab] = useState('time') // 'time' | 'vacation'
  const [editor, setEditor] = useState(null) // null = closed, { punch } = open

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

  // Recompute which punch (if any) is currently open
  function syncActive(list) {
    setActivePunch(list.find(p => !p.punch_out) || null)
  }

  async function savePunch(values) {
    if (editor.punch) {
      // Editing an existing entry
      const { data, error } = await supabase
        .from('time_punches')
        .update({ punch_in: values.punch_in, punch_out: values.punch_out })
        .eq('id', editor.punch.id)
        .select()
        .single()
      if (error) return toast.error(error.message)
      const next = punches.map(p => (p.id === data.id ? data : p))
      setPunches(next)
      syncActive(next)
      toast.success('Entry updated')
    } else {
      // Adding a manual entry
      const { data, error } = await supabase
        .from('time_punches')
        .insert({ user_id: profile.id, punch_in: values.punch_in, punch_out: values.punch_out })
        .select()
        .single()
      if (error) return toast.error(error.message)
      const next = [data, ...punches].sort(
        (a, b) => new Date(b.punch_in) - new Date(a.punch_in)
      )
      setPunches(next)
      syncActive(next)
      toast.success('Entry added')
    }
    setEditor(null)
  }

  async function deletePunch(punch) {
    if (!window.confirm('Delete this time entry? This cannot be undone.')) return
    const { error } = await supabase.from('time_punches').delete().eq('id', punch.id)
    if (error) return toast.error(error.message)
    const next = punches.filter(p => p.id !== punch.id)
    setPunches(next)
    syncActive(next)
    toast.success('Entry deleted')
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Slim brand bar */}
      <header className="px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white text-sm font-bold">T</span>
          <span className="font-semibold text-gray-800">TimeTracker</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-12 pt-2 space-y-6">
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

        {tab === 'time' && (
          <div className="space-y-6">
            <EmployeeStats punches={punches} />
            <PunchHistory
              punches={punches}
              onAdd={() => setEditor({ punch: null })}
              onEdit={punch => setEditor({ punch })}
              onDelete={deletePunch}
            />
          </div>
        )}

        {tab === 'vacation' && (
          <div className="space-y-6">
            <VacationForm profile={profile} onSubmit={submitVacation} />
            <VacationHistory vacations={vacations} />
          </div>
        )}

        {/* Clock widget */}
        <ClockWidget
          name={profile.full_name}
          activePunch={activePunch}
          punches={punches}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
        />
      </main>

      {editor && (
        <PunchEditor
          punch={editor.punch}
          onClose={() => setEditor(null)}
          onSave={savePunch}
        />
      )}
    </div>
  )
}
