import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import CategoryManager from './CategoryManager'

function inviteUrl(token) {
  return `${window.location.origin}/?invite=${token}`
}

export default function TeamManagement({ profile, org, members, invitations, categories, onChange, onCategoriesChange, onSetNotify, onRenameOrg }) {
  const [role, setRole] = useState('employee')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [orgName, setOrgName] = useState(org?.name || '')
  const [savingName, setSavingName] = useState(false)

  const pending = invitations.filter(i => i.status === 'pending')
  const notifyOn = org?.notify_vacation ?? true

  async function saveOrgName(e) {
    e.preventDefault()
    if (!orgName.trim() || orgName.trim() === org?.name) return
    setSavingName(true)
    await onRenameOrg(orgName.trim())
    setSavingName(false)
  }

  async function createInvite(e) {
    e.preventDefault()
    setBusy(true)
    const token = crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase.from('invitations').insert({
      org_id: profile.org_id,
      role,
      email: email.trim() || null,
      token,
      invited_by: profile.id,
    })
    setBusy(false)
    if (error) return toast.error(error.message)
    setEmail('')
    await navigator.clipboard.writeText(inviteUrl(token)).catch(() => {})
    toast.success('Invite link created & copied to clipboard')
    onChange()
  }

  async function copyLink(token) {
    await navigator.clipboard.writeText(inviteUrl(token)).catch(() => {})
    toast.success('Link copied')
  }

  async function revoke(id) {
    const { error } = await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Invite revoked')
    onChange()
  }

  return (
    <div className="space-y-6">
      {/* Organization name */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Organization</h2>
        <p className="text-sm text-gray-500 mb-4">The name shown across the app.</p>
        <form onSubmit={saveOrgName} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingName || !orgName.trim() || orgName.trim() === org?.name}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      {/* Activity categories */}
      <CategoryManager orgId={profile.org_id} categories={categories} onChange={onCategoriesChange} />

      {/* Notification setting */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Email notifications</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Email all admins when an employee submits a time-off request.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifyOn}
            onClick={() => onSetNotify(!notifyOn)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              notifyOn ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                notifyOn ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Invite a team member</h2>
        <form onSubmit={createInvite} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional, for your reference)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="person@company.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {busy ? 'Creating…' : 'Create invite link'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-3">
          A unique link is generated and copied to your clipboard. Share it however you like — the person joins by opening it and signing in.
        </p>
      </div>

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Pending invites ({pending.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pending.map(inv => (
              <div key={inv.id} className="px-6 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{inv.email || 'Anyone with the link'}</p>
                  <p className="text-xs text-gray-500 capitalize">{inv.role}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => copyLink(inv.token)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Copy link
                  </button>
                  <button onClick={() => revoke(inv.id)} className="text-xs text-gray-400 hover:text-red-600">
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Members ({members.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {members.map(m => (
            <div key={m.id} className="px-6 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-800">
                  {m.full_name || m.email}
                  {m.id === profile.id && <span className="text-gray-400 font-normal"> (you)</span>}
                </p>
                <p className="text-xs text-gray-500">{m.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${
                m.role === 'admin'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
