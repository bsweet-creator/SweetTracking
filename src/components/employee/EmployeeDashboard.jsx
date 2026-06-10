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
import AccountSettings from '../settings/AccountSettings'

export default function EmployeeDashboard({ profile, onReload }) {
  const [activePunch, setActivePunch] = useState(null)
  const [punches, setPunches] = useState([])
  const [vacations, setVacations] = useState([])
  const [categories, setCategories] = useState([])
  const [activeSegment, setActiveSegment] = useState(null) // open segment of the active punch
  const [tab, setTab] = useState('time') // 'time' | 'vacation'
  const [editor, setEditor] = useState(null) // null = closed, { punch } = open
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: punchData }, { data: vacData }, { data: catData }] = await Promise.all([
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
      profile.org_id
        ? supabase
            .from('activity_categories')
            .select('*')
            .eq('org_id', profile.org_id)
            .eq('archived', false)
            .order('sort_order')
        : Promise.resolve({ data: [] }),
    ])

    if (catData) setCategories(catData)
    if (vacData) setVacations(vacData)
    if (punchData) {
      setPunches(punchData)
      const open = punchData.find(p => !p.punch_out)
      setActivePunch(open || null)
      if (open) {
        const { data: seg } = await supabase
          .from('time_segments')
          .select('*')
          .eq('punch_id', open.id)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        setActiveSegment(seg || null)
      } else {
        setActiveSegment(null)
      }
    }
  }

  async function handleClockIn(categoryId) {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('time_punches')
      .insert({ user_id: profile.id, punch_in: now })
      .select()
      .single()
    if (error) return toast.error(error.message)
    setActivePunch(data)
    setPunches(prev => [data, ...prev])
    // Open the first activity segment (category optional)
    const { data: seg } = await supabase
      .from('time_segments')
      .insert({ punch_id: data.id, user_id: profile.id, category_id: categoryId || null, started_at: now })
      .select()
      .single()
    setActiveSegment(seg || null)
    toast.success('Clocked in!')
  }

  async function switchActivity(categoryId) {
    const now = new Date().toISOString()
    // Close the current open segment, then open a new one
    if (activeSegment) {
      await supabase.from('time_segments').update({ ended_at: now }).eq('id', activeSegment.id)
    }
    const { data: seg, error } = await supabase
      .from('time_segments')
      .insert({ punch_id: activePunch.id, user_id: profile.id, category_id: categoryId || null, started_at: now })
      .select()
      .single()
    if (error) return toast.error(error.message)
    setActiveSegment(seg)
    toast.success('Activity switched')
  }

  async function handleClockOut() {
    const now = new Date().toISOString()
    // Close the open activity segment first
    if (activeSegment) {
      await supabase.from('time_segments').update({ ended_at: now }).eq('id', activeSegment.id)
    }
    const { data, error } = await supabase
      .from('time_punches')
      .update({ punch_out: now })
      .eq('id', activePunch.id)
      .select()
      .single()
    if (error) return toast.error(error.message)
    setActivePunch(null)
    setActiveSegment(null)
    setPunches(prev => prev.map(p => (p.id === data.id ? data : p)))
    toast.success('Clocked out!')
  }

  // Recompute which punch (if any) is currently open
  function syncActive(list) {
    setActivePunch(list.find(p => !p.punch_out) || null)
  }

  // Open the editor; for an existing punch, load its segments first
  async function openEditor(punch) {
    if (!punch) return setEditor({ punch: null, segments: [] })
    const { data } = await supabase
      .from('time_segments')
      .select('*')
      .eq('punch_id', punch.id)
      .order('started_at')
    setEditor({ punch, segments: data || [] })
  }

  async function savePunch(values) {
    const { punch_in, punch_out, category_id } = values
    if (editor.punch) {
      // Editing an existing entry
      const { data, error } = await supabase
        .from('time_punches')
        .update({ punch_in, punch_out })
        .eq('id', editor.punch.id)
        .select()
        .single()
      if (error) return toast.error(error.message)
      // Keep the single segment in sync (multi-segment entries are left alone)
      if (editor.segments.length <= 1) {
        if (editor.segments.length === 1) {
          await supabase
            .from('time_segments')
            .update({ category_id: category_id || null, started_at: punch_in, ended_at: punch_out })
            .eq('id', editor.segments[0].id)
        } else if (category_id) {
          await supabase
            .from('time_segments')
            .insert({ punch_id: editor.punch.id, user_id: profile.id, category_id, started_at: punch_in, ended_at: punch_out })
        }
      }
      const next = punches.map(p => (p.id === data.id ? data : p))
      setPunches(next)
      syncActive(next)
      toast.success('Entry updated')
    } else {
      // Adding a manual entry
      const { data, error } = await supabase
        .from('time_punches')
        .insert({ user_id: profile.id, punch_in, punch_out })
        .select()
        .single()
      if (error) return toast.error(error.message)
      if (category_id) {
        await supabase
          .from('time_segments')
          .insert({ punch_id: data.id, user_id: profile.id, category_id, started_at: punch_in, ended_at: punch_out })
      }
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSettings(true)}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
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
            <ClockWidget
              name={profile.full_name}
              activePunch={activePunch}
              punches={punches}
              categories={categories}
              activeSegment={activeSegment}
              onClockIn={handleClockIn}
              onSwitch={switchActivity}
              onClockOut={handleClockOut}
            />
            <PunchHistory
              punches={punches}
              onAdd={() => openEditor(null)}
              onEdit={openEditor}
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
      </main>

      {editor && (
        <PunchEditor
          punch={editor.punch}
          segments={editor.segments}
          categories={categories}
          onClose={() => setEditor(null)}
          onSave={savePunch}
        />
      )}

      {showSettings && (
        <AccountSettings profile={profile} onReload={onReload} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
