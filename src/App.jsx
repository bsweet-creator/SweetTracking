import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthPage from './components/auth/AuthPage'
import EmployeeDashboard from './components/employee/EmployeeDashboard'
import AdminDashboard from './components/admin/AdminDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    let data = null
    for (let i = 0; i < 5; i++) {
      const { data: row } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (row) { data = row; break }
      await new Promise(r => setTimeout(r, 800))
    }

    if (!data) {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          role: user.user_metadata?.role || 'employee',
        })
        .select()
        .single()
      data = created
    }

    setProfile(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <AuthPage />

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Setting up your account…</p>
      </div>
    )
  }

  if (profile?.role === 'admin') return <AdminDashboard profile={profile} />

  return <EmployeeDashboard profile={profile} />
}
