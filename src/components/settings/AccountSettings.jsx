import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function AccountSettings({ profile, onClose, onReload }) {
  const [name, setName] = useState(profile.full_name || '')
  const [savingName, setSavingName] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  async function saveName(e) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Name cannot be empty')
    setSavingName(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile.id)
    setSavingName(false)
    if (error) return toast.error(error.message)
    toast.success('Name updated')
    await onReload?.()
  }

  async function savePassword(e) {
    e.preventDefault()
    if (pw.length < 6) return toast.error('Password must be at least 6 characters')
    if (pw !== pw2) return toast.error('Passwords do not match')
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSavingPw(false)
    if (error) return toast.error(error.message)
    toast.success('Password updated')
    setPw('')
    setPw2('')
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-md my-8" onClick={e => e.stopPropagation()}>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
          <div className="flex items-start justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Account settings</h2>
            <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
          </div>

          {/* Display name */}
          <form onSubmit={saveName} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
            </div>
            <button
              type="submit"
              disabled={savingName}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {savingName ? 'Saving…' : 'Save name'}
            </button>
          </form>

          <hr className="my-5 border-gray-100" />

          {/* Change password */}
          <form onSubmit={savePassword} className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Change password</p>
            <input
              type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="New password" minLength={6} className={inputClass}
            />
            <input
              type="password" value={pw2} onChange={e => setPw2(e.target.value)}
              placeholder="Confirm new password" minLength={6} className={inputClass}
            />
            <button
              type="submit"
              disabled={savingPw || !pw}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {savingPw ? 'Saving…' : 'Update password'}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-5">Signed in as {profile.email}</p>
        </div>
      </div>
    </div>
  )
}
