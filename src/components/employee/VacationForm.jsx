import { useState } from 'react'
import toast from 'react-hot-toast'

const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Emergency Leave', 'Other']
const AVAILABILITY = ['Fully Available', 'Partially Available', 'Not Available']
const CONTACT_METHODS = ['Phone', 'Email', 'WhatsApp', 'Teams', 'Other']

const EMPTY = {
  leave_type: 'Annual Leave',
  start_date: '',
  end_date: '',
  reason: '',
  availability: 'Fully Available',
  available_window: '',
  contact_method: 'Phone',
  emergency_contact: '',
  coverage_tasks: '',
  backup_person: '',
  informed_backup: false,
  critical_deadlines: '',
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function VacationForm({ profile, onSubmit }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  function onChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.end_date < form.start_date) return toast.error('End date must be after start date')
    if (!form.reason.trim()) return toast.error('Reason for leave is required')
    setLoading(true)
    await onSubmit(form)
    setForm(EMPTY)
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900">Team Holiday Request & Availability Form</h2>
      <p className="text-sm text-gray-500 mt-0.5 mb-5">Fields marked with * are required.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identity (read-only, from profile) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Full Name</label>
            <input value={profile.full_name || ''} disabled className={`${inputClass} bg-gray-50 text-gray-500`} />
          </div>
          <div>
            <label className={labelClass}>Email Address</label>
            <input value={profile.email || ''} disabled className={`${inputClass} bg-gray-50 text-gray-500`} />
          </div>
        </div>

        {/* Leave type */}
        <div>
          <label className={labelClass}>Type of Leave *</label>
          <select name="leave_type" value={form.leave_type} onChange={onChange} required className={inputClass}>
            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Date *</label>
            <input
              type="date" name="start_date" value={form.start_date} onChange={onChange} required
              min={new Date().toISOString().split('T')[0]} className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>End Date *</label>
            <input
              type="date" name="end_date" value={form.end_date} onChange={onChange} required
              min={form.start_date || new Date().toISOString().split('T')[0]} className={inputClass}
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className={labelClass}>Reason for Leave *</label>
          <textarea
            name="reason" value={form.reason} onChange={onChange} required rows={3}
            className={`${inputClass} resize-none`} placeholder="Briefly describe the reason for your leave"
          />
        </div>

        {/* Availability */}
        <div>
          <label className={labelClass}>Will you be available during your leave? *</label>
          <select name="availability" value={form.availability} onChange={onChange} required className={inputClass}>
            {AVAILABILITY.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Available window — only relevant if not fully unavailable */}
        {form.availability !== 'Not Available' && (
          <div>
            <label className={labelClass}>Available Time Window (BD Time)</label>
            <input
              name="available_window" value={form.available_window} onChange={onChange}
              className={inputClass} placeholder="e.g. 10:00 AM – 12:00 PM"
            />
          </div>
        )}

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Preferred Contact Method</label>
            <select name="contact_method" value={form.contact_method} onChange={onChange} className={inputClass}>
              {CONTACT_METHODS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Emergency Contact Number</label>
            <input
              name="emergency_contact" value={form.emergency_contact} onChange={onChange}
              className={inputClass} placeholder="+880 ..."
            />
          </div>
        </div>

        {/* Coverage */}
        <div>
          <label className={labelClass}>Tasks that need coverage during your absence</label>
          <textarea
            name="coverage_tasks" value={form.coverage_tasks} onChange={onChange} rows={2}
            className={`${inputClass} resize-none`} placeholder="List tasks, one per line"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className={labelClass}>Backup Person</label>
            <input
              name="backup_person" value={form.backup_person} onChange={onChange}
              className={inputClass} placeholder="Name of colleague covering for you"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input
              type="checkbox" name="informed_backup" checked={form.informed_backup} onChange={onChange}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            I have informed my backup person
          </label>
        </div>

        {/* Deadlines */}
        <div>
          <label className={labelClass}>Any critical deadlines during this period?</label>
          <textarea
            name="critical_deadlines" value={form.critical_deadlines} onChange={onChange} rows={2}
            className={`${inputClass} resize-none`} placeholder="Note any deadlines that fall within your leave"
          />
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
        >
          {loading ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
