import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// Extract a token from either a raw token or a full invite URL the user pasted
function parseToken(input) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    return url.searchParams.get('invite') || ''
  } catch {
    return trimmed // not a URL — treat as a raw token
  }
}

export default function Onboarding({ profile, inviteToken, onComplete }) {
  // 'choose' | 'create' | 'join'
  const [mode, setMode] = useState(inviteToken ? 'join' : 'choose')
  const [orgName, setOrgName] = useState('')
  const [tokenInput, setTokenInput] = useState(inviteToken || '')
  const [invite, setInvite] = useState(null)       // { org_name, role, status }
  const [busy, setBusy] = useState(false)
  const [lookupError, setLookupError] = useState('')

  // If we arrived via an invite link, look up its details automatically
  useEffect(() => {
    if (inviteToken) lookupInvite(inviteToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function lookupInvite(token) {
    setLookupError('')
    setInvite(null)
    const { data, error } = await supabase.rpc('get_invitation', { p_token: token })
    const row = data?.[0]
    if (error || !row) { setLookupError('Invitation not found. Double-check the link.'); return }
    if (row.status !== 'pending') { setLookupError('This invitation has already been used or was revoked.'); return }
    setInvite(row)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!orgName.trim()) return toast.error('Please enter an organization name')
    setBusy(true)
    const { error } = await supabase.rpc('create_organization', { p_name: orgName })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success(`Created ${orgName.trim()}`)
    await onComplete()
  }

  async function handleJoin() {
    const token = parseToken(tokenInput)
    if (!token) return toast.error('Please paste your invite link or code')
    setBusy(true)
    const { error } = await supabase.rpc('accept_invitation', { p_token: token })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('You have joined the organization!')
    await onComplete()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome, {profile.full_name || 'there'}</h1>
        <p className="text-sm text-gray-500 mb-6">Let's get you set up.</p>

        {/* Choose path */}
        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full text-left border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl p-4 transition-colors"
            >
              <p className="font-medium text-gray-900">Create an organization</p>
              <p className="text-sm text-gray-500 mt-0.5">Start fresh and invite your team. You'll be the admin.</p>
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full text-left border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl p-4 transition-colors"
            >
              <p className="font-medium text-gray-900">Join with an invite</p>
              <p className="text-sm text-gray-500 mt-0.5">Have an invite link or code? Join an existing organization.</p>
            </button>
          </div>
        )}

        {/* Create org */}
        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                autoFocus
                placeholder="Acme Inc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {busy ? 'Creating…' : 'Create organization'}
            </button>
            {!inviteToken && (
              <button type="button" onClick={() => setMode('choose')} className="w-full text-sm text-gray-500 hover:text-gray-800">
                ← Back
              </button>
            )}
          </form>
        )}

        {/* Join org */}
        {mode === 'join' && (
          <div className="space-y-4">
            {invite ? (
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-sm text-gray-500">You've been invited to join</p>
                <p className="text-lg font-semibold text-gray-900">{invite.org_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  as <span className="font-medium capitalize">{invite.role}</span>
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invite link or code</label>
                <input
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  onBlur={() => tokenInput && lookupInvite(parseToken(tokenInput))}
                  autoFocus
                  placeholder="Paste your invite link here"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {lookupError && <p className="text-xs text-red-600 mt-1">{lookupError}</p>}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={busy || (!invite && !tokenInput)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {busy ? 'Joining…' : invite ? `Join ${invite.org_name}` : 'Join organization'}
            </button>

            {!inviteToken && (
              <button type="button" onClick={() => { setMode('choose'); setInvite(null); setLookupError('') }} className="w-full text-sm text-gray-500 hover:text-gray-800">
                ← Back
              </button>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-gray-600">
            Sign out ({profile.email})
          </button>
        </div>
      </div>
    </div>
  )
}
