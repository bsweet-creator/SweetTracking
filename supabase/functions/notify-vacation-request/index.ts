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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Who submitted it + which org
    const { data: requester, error: reqErr } = await supabase
      .from('profiles')
      .select('full_name, email, org_id')
      .eq('id', record.user_id)
      .single()
    console.log('requester:', JSON.stringify(requester), 'err:', reqErr?.message)
    if (!requester?.org_id) return new Response('no org', { status: 200 })

    // Org-wide toggle
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('name, notify_vacation')
      .eq('id', requester.org_id)
      .single()
    console.log('org:', JSON.stringify(org), 'err:', orgErr?.message)
    if (!org?.notify_vacation) return new Response('notifications disabled', { status: 200 })

    // Recipients = all admins in the org
    const { data: admins, error: adminErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('org_id', requester.org_id)
      .eq('role', 'admin')
    const to = (admins ?? []).map((a) => a.email).filter(Boolean)
    console.log('admin recipients:', JSON.stringify(to), 'err:', adminErr?.message)
    if (to.length === 0) return new Response('no admins', { status: 200 })

    const name = requester.full_name || requester.email
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
