// Supabase Edge Function: notify-vacation-request
// Triggered by a Database Webhook on INSERT into public.vacation_requests.
// Emails every admin in the requester's organization via Resend — but only
// if that org has notify_vacation = true.
//
// Required secret (Edge Functions → Secrets):
//   RESEND_API_KEY
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FROM = 'SweetTracking <noreply@sweetbuilds.com>'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    console.log('webhook payload type:', payload.type, 'record id:', record?.id, 'user:', record?.user_id)
    if (!record?.user_id) return new Response('no record', { status: 200 })

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    console.log('service key present:', serviceKey.length > 0, 'len:', serviceKey.length)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
      },
    )

    // One SECURITY DEFINER call: org name, toggle, requester name, admin emails
    const { data: targets, error: tErr } = await supabase
      .rpc('vacation_notify_targets', { p_user_id: record.user_id })
    const t = Array.isArray(targets) ? targets[0] : targets
    console.log('targets:', JSON.stringify(t), 'err:', tErr?.message)
    if (!t) return new Response('no targets', { status: 200 })
    if (!t.notify) return new Response('notifications disabled', { status: 200 })

    const to = (t.admin_emails ?? []).filter(Boolean)
    if (to.length === 0) return new Response('no admins', { status: 200 })

    const name = t.requester_name
    const subject = `New time-off request from ${name}`
    const html = `
      <div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#1f2937">
        <h2 style="margin:0 0 12px">New time-off request</h2>
        <p><strong>${name}</strong> submitted a <strong>${record.leave_type}</strong> request.</p>
        <ul style="line-height:1.7">
          <li><strong>Dates:</strong> ${record.start_date} &rarr; ${record.end_date}</li>
          <li><strong>Reason:</strong> ${record.reason ?? '—'}</li>
          <li><strong>Availability:</strong> ${record.availability ?? '—'}</li>
        </ul>
        <p style="margin-top:16px">
          <a href="https://track.sweetbuilds.com" style="color:#4f46e5">Review it in SweetTracking →</a>
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })

    const body = await res.text()
    console.log('resend status:', res.status, 'body:', body)
    if (!res.ok) {
      return new Response(`resend error: ${body}`, { status: 500 })
    }
    return new Response('sent', { status: 200 })
  } catch (e) {
    return new Response(`error: ${(e as Error).message}`, { status: 500 })
  }
})
