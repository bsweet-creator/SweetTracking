import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthPage({ inviteToken }) {
  // An invited person should land on sign-up, not login
  const [mode, setMode] = useState(inviteToken ? 'signup' : 'login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [inviteOrg, setInviteOrg] = useState(null)
  const [confirmEmail, setConfirmEmail] = useState(null) // email awaiting confirmation

  // If arriving via an invite link, show which org they're joining
  useEffect(() => {
    if (!inviteToken) return
    supabase.rpc('get_invitation', { p_token: inviteToken }).then(({ data }) => {
      const row = data?.[0]
      if (row && row.status === 'pending') setInviteOrg(row.org_name)
    })
  }, [inviteToken])

  function onChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    if (error) toast.error(error.message)
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!form.full_name.trim()) return toast.error('Full name is required')
    setLoading(true)
    // Send the confirmation link back to the invite URL (if any) so the
    // invitation survives the email round-trip.
    const redirectTo = inviteToken
      ? `${window.location.origin}/?invite=${inviteToken}`
      : window.location.origin
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name }, emailRedirectTo: redirectTo },
    })
    setLoading(false)
    if (error) return toast.error(error.message)

    // No session returned → email confirmation is required before sign-in.
    if (!data.session) {
      setConfirmEmail(form.email)
    } else {
      toast.success('Account created!')
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!form.email.trim()) return toast.error('Enter your email first')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success('Password reset link sent — check your email')
    setMode('login')
  }

  const submitHandler =
    mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleForgot

  // "Check your email" screen shown after a signup that needs confirmation
  if (confirmEmail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-sm text-gray-600">
            We sent a confirmation link to <span className="font-medium text-gray-900">{confirmEmail}</span>.
            Click it to activate your account, then sign in.
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Don't see it? Check your spam folder — it can take a minute to arrive.
          </p>
          <button
            onClick={() => { setConfirmEmail(null); setMode('login') }}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">TimeTracker</h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'login' ? 'Sign in to your account'
            : mode === 'signup' ? 'Create a new account'
            : 'Reset your password'}
        </p>

        {inviteOrg && (
          <div className="mb-6 -mt-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
            <p className="text-sm text-blue-800">
              You've been invited to join <span className="font-semibold">{inviteOrg}</span>.
              Create an account to continue.
            </p>
          </div>
        )}

        <form onSubmit={submitHandler} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={onChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jane Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@company.com"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                required
                minLength={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            {loading ? 'Please wait…'
              : mode === 'login' ? 'Sign In'
              : mode === 'signup' ? 'Create Account'
              : 'Send reset link'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === 'forgot' ? (
            <button onClick={() => setMode('login')} className="text-blue-600 hover:underline font-medium">
              ← Back to sign in
            </button>
          ) : (
            <>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-blue-600 hover:underline font-medium"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
