import { supabase } from './supabase.js'

// Backend + WebAuthn helpers (ported from the vanilla app).
export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
export const IS_ANDROID = /Android/.test(navigator.userAgent)
export const BIO = IS_APPLE ? 'Face ID / Touch ID' : IS_ANDROID ? 'fingerprint or face unlock' : 'your fingerprint, face or PIN'
export const VAULT = IS_APPLE ? 'iCloud Keychain' : IS_ANDROID ? 'Google Password Manager' : 'your password manager'

export const webauthnOK = () => typeof window.PublicKeyCredential !== 'undefined'

let remoteBase = ''
let remoteToken = null
export function setRemoteAuth(base, token) { remoteBase = base || ''; remoteToken = token || null }

export async function api(path, opts) {
  // INTERCEPTOR DE RUTAS CON SUPABASE (Evita las llamadas fetch al servidor backend antiguo)
  try {
    // 1. Cargar usuarios (Admin)
    if (path === '/api/admin/users') {
      const { data: profiles } = await supabase.from('profiles').select('*')
      const users = (profiles || []).map(p => ({
        id: p.id,
        name: p.name || p.email?.split('@')[0] || 'User',
        email: p.email,
        admin: p.role === 'admin' || p.is_admin,
        disabled: !!p.disabled,
        workouts: p.workouts_count || 0,
        lastWorkout: p.last_workout_at,
        lastSync: p.last_sync_at ? new Date(p.last_sync_at).getTime() : null,
        hasPush: !!p.has_push,
        live: p.is_training ? p.live_session : null
      }))
      return { users, invite_only: false }
    }

    // 2. Detalle de usuario (Admin)
    if (path.startsWith('/api/admin/user?id=')) {
      const id = decodeURIComponent(path.split('=')[1])
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
      const { data: workouts } = await supabase.from('workouts').select('*').eq('user_id', id)
      const { data: bodyweight } = await supabase.from('bodyweight').select('*').eq('user_id', id)
      const { data: routines } = await supabase.from('routines').select('*').eq('user_id', id)

      return {
        user: {
          id: profile?.id,
          name: profile?.name || 'User',
          admin: profile?.role === 'admin' || profile?.is_admin,
          disabled: !!profile?.disabled,
          created: profile?.created_at,
          invitedBy: profile?.invited_by
        },
        workouts: workouts || [],
        bodyweight: bodyweight || [],
        routines: routines || [],
        lastSync: profile?.last_sync_at ? new Date(profile?.last_sync_at).getTime() : null,
        unit: profile?.unit || 'kg'
      }
    }

    // 3. Deshabilitar / Habilitar usuario (Admin)
    if (path === '/api/admin/user/disable') {
      const body = JSON.parse(opts?.body || '{}')
      await supabase.from('profiles').update({ disabled: body.disabled }).eq('id', body.id)
      return { ok: true }
    }

    // 4. Cargar invitaciones (Admin)
    if (path === '/api/admin/invites') {
      const { data: invites } = await supabase.from('invites').select('*')
      return { invites: invites || [] }
    }

    // 5. Crear invitación (Admin)
    if (path === '/api/admin/invites/new') {
      const code = 'GYM-' + Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data } = await supabase.from('invites').insert([{ code }]).select().single()
      return { invite: data || { code } }
    }

    // 6. Revocar invitación (Admin)
    if (path === '/api/admin/invites/revoke') {
      const body = JSON.parse(opts?.body || '{}')
      await supabase.from('invites').delete().eq('code', body.code)
      return { ok: true }
    }

    // 7. Cargar Audit Log (Admin)
    if (path.startsWith('/api/admin/audit')) {
      const { data: events } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      const formattedEvents = (events || []).map(e => ({
        id: e.id,
        ev: e.action || 'auth.login',
        ts: e.created_at ? new Date(e.created_at).getTime() : Date.now(),
        ok: e.status !== 'failed',
        user: e.user_email || e.user_id || 'System'
      }))

      return {
        enabled: true,
        total: formattedEvents.length,
        retention: { days: 30 },
        ip_mode: 'off',
        events: formattedEvents,
        now: Date.now()
      }
    }

    // 8. Limpiar log (Admin)
    if (path === '/api/admin/audit/clear') {
      await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      return { ok: true }
    }

    // 9. Coach status (Admin)
    if (path === '/api/admin/coach') {
      return { status: 'idle', active: false }
    }

    // 10. Configuración global de la app
    if (path === '/api/config') {
      return { allow_signup: true, require_invite: false }
    }

   // 11. Datos del usuario actual (me)
if (path === '/api/me') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  
  return { 
    user: profile ? {
      ...profile,
      name: profile.name || profile.username || 'Luismi',
      accent: profile.accent || 'lime'
    } : { id: user.id, email: user.email } 
  }
}

// 11b. Guardar ajustes del usuario (Color, Idioma, Settings) - ESCRITURA
if (path === '/api/me' || path === '/api/user/settings' || path === '/api/user/profile') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const body = JSON.parse(opts?.body || '{}')
  
  // Extraemos los campos que la interfaz puede enviar al guardar
  const updateData = {}
  if (body.accent !== undefined) updateData.accent = body.accent
  if (body.settings !== undefined) updateData.settings = body.settings
  if (body.language !== undefined) updateData.settings = { ...(body.settings || {}), lang: body.language }
  if (body.check_in !== undefined) updateData.check_in = body.check_in

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (error) console.error('Error guardando ajustes en Supabase:', error)
  return { ok: !error, user: { id: user.id, ...updateData } }
}

    // 12. Datos generales de entrenamientos/rutinas
    if (path === '/api/data') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { workouts: [], bodyweight: [], routines: [] }
      const { data: workouts } = await supabase.from('workouts').select('*').eq('user_id', user.id)
      return { workouts: workouts || [], bodyweight: [], routines: [] }
    }

  } catch (err) {
    console.error('Error procesando solicitud en Supabase:', path, err)
    throw err
  }

// 13. Guardar cambios del usuario (Acento, Tema, Configuración)
if (path === '/api/user' || path === '/user') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : (opts?.body || {})

  // Extraemos lo que envía la app y actualizamos profiles en Supabase
  const updateData = {}
  if (body.accent !== undefined) updateData.accent = body.accent
  if (body.settings !== undefined) updateData.settings = body.settings
  if (body.theme !== undefined) updateData.settings = { ...(body.settings || {}), theme: body.theme }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (error) console.error('Error actualizando perfil en Supabase:', error)

  return { ok: !error, ...body }
}

  // COMPORTAMIENTO FALLBACK (Para cualquier otra ruta no capturada)
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts && opts.headers)
  if (remoteToken) headers.Authorization = 'Bearer ' + remoteToken
  const r = await fetch(remoteBase + path, Object.assign({}, opts, { headers }))
  const data = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(data.error || ('HTTP ' + r.status)); e.status = r.status; e.data = data; throw e }
  return data
}

// RESTO DE FUNCIONES (WebAuthn / Passkeys)
export async function pairRedeem(serverBase, code) {
  const r = await fetch(serverBase + '/api/pair/redeem', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(data.error || ('HTTP ' + r.status)); e.status = r.status; throw e }
  return data
}

const bufToB64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64uToBuf = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)).buffer

function toCreationOptions(o) {
  o.challenge = b64uToBuf(o.challenge)
  o.user.id = b64uToBuf(o.user.id)
  ;(o.excludeCredentials || []).forEach(c => { c.id = b64uToBuf(c.id) })
  return o
}
function toRequestOptions(o) {
  o.challenge = b64uToBuf(o.challenge)
  ;(o.allowCredentials || []).forEach(c => { c.id = b64uToBuf(c.id) })
  return o
}
function credToJSON(cred) {
  const r = cred.response
  const out = {
    id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || null,
    response: { clientDataJSON: bufToB64u(r.clientDataJSON) }
  }
  if (r.attestationObject) {
    out.response.attestationObject = bufToB64u(r.attestationObject)
    out.response.transports = r.getTransports ? r.getTransports() : ['internal']
  }
  if (r.authenticatorData) {
    out.response.authenticatorData = bufToB64u(r.authenticatorData)
    out.response.signature = bufToB64u(r.signature)
    out.response.userHandle = r.userHandle ? bufToB64u(r.userHandle) : null
  }
  return out
}
export async function passkeyRegister(name, code) {
  const { cid, options } = await api('/api/register/options', { method: 'POST', body: JSON.stringify({ name, code: code || '' }) })
  const cred = await navigator.credentials.create({ publicKey: toCreationOptions(options) })
  const res = await api('/api/register/verify', { method: 'POST', body: JSON.stringify({ cid, credential: credToJSON(cred) }) })
  return res.user
}
export async function passkeyLogin() {
  const { cid, options } = await api('/api/login/options', { method: 'POST', body: '{}' })
  const cred = await navigator.credentials.get({ publicKey: toRequestOptions(options) })
  const res = await api('/api/login/verify', { method: 'POST', body: JSON.stringify({ cid, credential: credToJSON(cred) }) })
  return res.user
}