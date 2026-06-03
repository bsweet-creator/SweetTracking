import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthPage from './components/auth/AuthPage'
import UpdatePassword from './components/auth/UpdatePassword'
import Onboarding from './components/onboarding/Onboarding'
import EmployeeDashboard from './components/employee/EmployeeDashboard'
import AdminDashboard from './components/admin/AdminDashboard'

// Invite token passed via URL: https://app/?invite=TOKEN
// Persist it so it survives the email-confirmation round-trip (the
// confirmation link returns to the bare Site URL without the param).
const urlInvite = new URLSearchParams(window.location.search).get('invite')
if (urlInvite) localStorage.setItem('pendingInvite', urlInvite)
const inviteToken = urlInvite || localStorage.getItem('pendingInvite')

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Arrived via a password-reset link → show the set-new-password screen
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true)
        setSession(session)
        setLoading(false)
        return
      }
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    // Validate the session first. A stale/deleted-user token returns an
    // error here — in that case sign out and fall back to the login screen
    // instead of spinning forever.
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      setLoading(false)
      return
    }

    let data = null
    for (let i = 0; i < 5; i++) {
      const { data: row } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (row) { data = row; break }
      await new Promise(r => setTimeout(r, 800))
    }

    if (!data) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          // role defaults to 'employee', org_id to NULL (locked by column grant)
        })
        .select()
        .single()
      data = created
    }

    setProfile(data)
    setLoading(false)
  }

  async function reloadProfile() {
    if (session) await fetchProfile(session.user.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (recovery) {
    return <UpdatePassword onDone={async () => { setRecovery(false); await reloadProfile() }} />
  }

  if (!session) return <AuthPage inviteToken={inviteToken} />

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Setting up your account…</p>
      </div>
    )
  }

  // Authenticated but not yet part of an organization → onboarding
  if (!profile.org_id) {
    return <Onboarding profile={profile} inviteToken={inviteToken} onComplete={reloadProfile} />
  }

  if (profile.role === 'admin') return <AdminDashboard profile={profile} onReload={reloadProfile} />

  return <EmployeeDashboard profile={profile} onReload={reloadProfile} />
}
