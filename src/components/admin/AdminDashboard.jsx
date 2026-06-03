import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import EmployeeTimeView from './EmployeeTimeView'
import Reports from './Reports'
import VacationReview from './VacationReview'
import TeamManagement from './TeamManagement'

export default function AdminDashboard({ profile }) {
  const [tab, setTab] = useState('time') // 'time' | 'vacation' | 'team'
  const [org, setOrg] = useState(null)
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [punches, setPunches] = useState([])
  const [vacations, setVacations] = useState([])
  const [loading, setLoading] = useState(true)

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
    ])
    if (orgData) setOrg(orgData)
    if (memberData) setMembers(memberData)
    if (invData) setInvitations(invData)
    if (punchData) setPunches(punchData)
    if (vacData) setVacations(vacData)
    setLoading(false)
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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const employees = members.filter(m => m.role === 'employee')
  const pendingCount = vacations.filter(v => v.status === 'pending').length
  const pendingInvites = invitations.filter(i => i.status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{org?.name || 'Admin'}</h1>
          <p className="text-sm text-gray-500">{profile.full_name || profile.email} · Admin</p>
        </div>
        <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Members', value: members.length },
            { label: 'Clocked In Now', value: punches.filter(p => !p.punch_out).length },
            { label: 'Pending Requests', value: pendingCount },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'time', label: 'Time Logs' },
            { key: 'reports', label: 'Reports' },
            { key: 'vacation', label: `Vacation${pendingCount ? ` (${pendingCount})` : ''}` },
            { key: 'team', label: `Team${pendingInvites ? ` (${pendingInvites})` : ''}` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
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
          <Reports punches={punches} />
        ) : tab === 'vacation' ? (
          <VacationReview vacations={vacations} onReview={reviewVacation} />
        ) : (
          <TeamManagement
            profile={profile}
            members={members}
            invitations={invitations}
            onChange={reloadTeam}
          />
        )}
      </main>
    </div>
  )
}
