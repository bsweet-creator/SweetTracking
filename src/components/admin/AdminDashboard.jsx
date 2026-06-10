import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import EmployeeTimeView from './EmployeeTimeView'
import Reports from './Reports'
import Calendar from './Calendar'
import VacationReview from './VacationReview'
import TeamManagement from './TeamManagement'
import AccountSettings from '../settings/AccountSettings'

export default function AdminDashboard({ profile, onReload }) {
  const [tab, setTab] = useState('time') // 'time' | 'vacation' | 'team'
  const [org, setOrg] = useState(null)
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [punches, setPunches] = useState([])
  const [vacations, setVacations] = useState([])
  const [categories, setCategories] = useState([])
  const [segments, setSegments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: orgData },
      { data: memberData },
      { data: invData },
      { data: punchData },
      { data: vacData },
      { data: catData },
      { data: segData },
    ] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', profile.org_id).single(),
      supabase.from('profiles').select('*').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase
        .from('time_punches')
        .select('*, profiles(full_name, email)')
        .order('punch_in', { ascending: false })
        .limit(200),
      supabase
        .from('vacation_requests')
        .select('*, profiles!vacation_requests_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false }),
      supabase
        .from('activity_categories')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('archived', false)
        .order('sort_order'),
      supabase
        .from('time_segments')
        .select('*, activity_categories(name)')
        .order('started_at', { ascending: false })
        .limit(2000),
    ])
    if (orgData) setOrg(orgData)
    if (memberData) setMembers(memberData)
    if (invData) setInvitations(invData)
    if (punchData) setPunches(punchData)
    if (vacData) setVacations(vacData)
    if (catData) setCategories(catData)
    if (segData) setSegments(segData)
    setLoading(false)
  }

  async function reloadCategories() {
    const { data } = await supabase
      .from('activity_categories')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('archived', false)
      .order('sort_order')
    if (data) setCategories(data)
  }

  async function reloadTeam() {
    const [{ data: memberData }, { data: invData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
    ])
    if (memberData) setMembers(memberData)
    if (invData) setInvitations(invData)
  }

  async function reviewVacation(id, status, managerComments) {
    const { data, error } = await supabase.rpc('review_vacation', {
      p_id: id,
      p_status: status,
      p_comments: managerComments ?? null,
    })
    if (error) return toast.error(error.message)
    const updated = Array.isArray(data) ? data[0] : data
    // Preserve the joined profile info already in local state
    setVacations(prev => prev.map(v => (v.id === id ? { ...v, ...updated } : v)))
    toast.success(status === 'approved' ? 'Request approved' : status === 'denied' ? 'Request rejected' : 'Comment saved')
  }

  async function setNotifyVacation(value) {
    const { data, error } = await supabase
      .from('organizations')
      .update({ notify_vacation: value })
      .eq('id', profile.org_id)
      .select()
      .single()
    if (error) return toast.error(error.message)
    setOrg(data)
    toast.success(value ? 'Email notifications turned on' : 'Email notifications turned off')
  }

  async function renameOrg(name) {
    const { data, error } = await supabase
      .from('organizations')
      .update({ name })
      .eq('id', profile.org_id)
      .select()
      .single()
    if (error) return toast.error(error.message)
    setOrg(data)
    toast.success('Organization renamed')
  }

  async function removeMember(id) {
    const { error } = await supabase.rpc('remove_member', { p_user_id: id })
    if (error) return toast.error(error.message)
    toast.success('Member removed')
    reloadTeam()
  }

  async function setMemberRole(id, role) {
    const { error } = await supabase.rpc('set_member_role', { p_user_id: id, p_role: role })
    if (error) return toast.error(error.message)
    toast.success('Role updated')
    reloadTeam()
  }

  async function transferOwnership(id) {
    const { error } = await supabase.rpc('transfer_ownership', { p_user_id: id })
    if (error) return toast.error(error.message)
    toast.success('Ownership transferred')
    await reloadTeam()
    await onReload?.() // current user is now an admin — refresh own profile
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const employees = members.filter(m => m.role === 'employee')
  const pendingCount = vacations.filter(v => v.status === 'pending').length
  const pendingInvites = invitations.filter(i => i.status === 'pending').length

  const stats = [
    { label: 'Members', value: members.length, accent: 'bg-indigo-500' },
    { label: 'Clocked In Now', value: punches.filter(p => !p.punch_out).length, accent: 'bg-emerald-500' },
    { label: 'Pending Requests', value: pendingCount, accent: 'bg-amber-500' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white font-bold">
              {(org?.name || 'A').charAt(0).toUpperCase()}
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-semibold text-gray-900">{org?.name || 'Admin'}</h1>
              <p className="text-xs text-gray-500">
                {profile.full_name || profile.email} · {profile.role === 'owner' ? 'Owner' : 'Admin'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowSettings(true)} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              Settings
            </button>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="relative bg-white rounded-2xl border border-gray-200 shadow-sm p-5 overflow-hidden">
              <span className={`absolute left-0 top-0 h-full w-1.5 ${stat.accent}`} />
              <p className="text-xs uppercase tracking-wide text-gray-400">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
          {[
            { key: 'time', label: 'Time Logs' },
            { key: 'reports', label: 'Reports' },
            { key: 'calendar', label: 'Calendar' },
            { key: 'vacation', label: `Vacation${pendingCount ? ` (${pendingCount})` : ''}` },
            { key: 'team', label: `Team${pendingInvites ? ` (${pendingInvites})` : ''}` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'time' ? (
          <EmployeeTimeView employees={employees} punches={punches} />
        ) : tab === 'reports' ? (
          <Reports punches={punches} segments={segments} />
        ) : tab === 'calendar' ? (
          <Calendar vacations={vacations} />
        ) : tab === 'vacation' ? (
          <VacationReview vacations={vacations} onReview={reviewVacation} />
        ) : (
          <TeamManagement
            profile={profile}
            org={org}
            members={members}
            invitations={invitations}
            categories={categories}
            onChange={reloadTeam}
            onCategoriesChange={reloadCategories}
            onSetNotify={setNotifyVacation}
            onRenameOrg={renameOrg}
            onRemoveMember={removeMember}
            onSetMemberRole={setMemberRole}
            onTransferOwnership={transferOwnership}
          />
        )}
      </main>

      {showSettings && (
        <AccountSettings profile={profile} onReload={onReload} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
