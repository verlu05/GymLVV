import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- EXPORTS REQUERIDOS POR LA INTERFAZ (evitan errores de compilación) ---
export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
export const IS_ANDROID = /Android/.test(navigator.userAgent)
export const BIO = IS_APPLE ? 'Face ID / Touch ID' : IS_ANDROID ? 'fingerprint or face unlock' : 'your fingerprint, face or PIN'
export const VAULT = IS_APPLE ? 'iCloud Keychain' : IS_ANDROID ? 'Google Password Manager' : 'your password manager'

export const webauthnOK = () => false
export function setRemoteAuth() {}
export async function pairRedeem() { return { ok: true } }
export async function passkeyRegister() { throw new Error('Passkeys no configuradas') }
export async function passkeyLogin() { throw new Error('Passkeys no configuradas') }

// --- ESTADO POR DEFECTO SEGÚN OPENAPI ---
const DEFAULT_STATE = {
  routines: [],
  history: [],
  settings: {
    theme: 'system',
    accentColor: 'lime',
    unit: 'kg'
  }
}

// --- INTERCEPTOR PRINCIPAL DE API ---
export async function api(path, opts = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Configuración de la app
    if (path === '/api/config') {
      return {
        registrationEnabled: true,
        authProviders: ['email'],
        version: '1.0.0'
      }
    }

    // 2. Información del usuario
    if (path === '/api/me') {
      if (!user) return { user: null }
      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.email.split('@')[0],
          isAdmin: true
        }
      }
    }

    // 3. Carga del estado (GET /api/data)
    if (path === '/api/data' && (!opts.method || opts.method === 'GET')) {
      if (!user) return { state: DEFAULT_STATE, rev: 1 }

      const { data, error } = await supabase
        .from('user_states')
        .select('state, rev')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) console.error('Error leyendo user_states:', error)

      if (!data) {
        await supabase
          .from('user_states')
          .insert([{ user_id: user.id, state: DEFAULT_STATE, rev: 1 }])

        return { state: DEFAULT_STATE, rev: 1 }
      }

      return {
        state: data.state || DEFAULT_STATE,
        rev: data.rev || 1
      }
    }

    // 4. Guardado del estado (PUT /api/data)
    if (path === '/api/data' && opts.method === 'PUT') {
      if (!user) throw new Error('Usuario no autenticado')

      const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : (opts.body || {})
      const newState = body.state || DEFAULT_STATE
      const baseRev = body.baseRev || 1
      const nextRev = baseRev + 1

      const { data, error } = await supabase
        .from('user_states')
        .upsert({
          user_id: user.id,
          state: newState,
          rev: nextRev,
          updated_at: new Date().toISOString()
        })
        .select('state, rev')
        .single()

      if (error) {
        console.error('Error guardando en user_states:', error)
        throw error
      }

      return {
        state: data.state,
        rev: data.rev
      }
    }

    // 5. Endpoints secundarios (heartbeat, avisos de descanso, etc.)
    if (path === '/api/activity' || path === '/api/push/rest-timer') {
      return { ok: true }
    }

    return { ok: true }

  } catch (err) {
    console.error('Error en API Interceptor:', path, err)
    throw err
  }
}