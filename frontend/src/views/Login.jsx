import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { hasData } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { supabase } from '../lib/supabase.js'

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])

  const go = async () => {
    const e = email.trim()
    const p = password.trim()
    const n = name.trim()

    if (!e || !p) { useUI.getState().toast(t('Introduce un email y contraseña')); return }
    if (p.length < 6) { useUI.getState().toast(t('La contraseña debe tener al menos 6 caracteres')); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: e,
        password: p,
        options: { data: { name: n || e.split('@')[0] } }
      })

      if (error) throw error

      const u = { id: data.user?.id, name: n || e.split('@')[0], email: e }
      setUser(u)
      close()

      if (hasData(useStore.getState().S)) {
        await pushState()
        useUI.getState().toast(t('Perfil creado — datos guardados'))
      } else {
        await pullState()
        useUI.getState().toast(t('Bienvenido, {0}', u.name))
      }
    } catch (err) {
      useUI.getState().toast(err.message || t('Error en el registro'))
    } finally {
      setLoading(false)
    }
  }

  return <>
    <h3>{t('Crear cuenta')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Introduce tus datos para registrarte en Supabase.')}</div>
    <form onSubmit={(e) => { e.preventDefault(); go(); }}>
      <input 
        ref={ref} 
        className="input" 
        type="email" 
        autoComplete="email"
        placeholder={t('Tu Email')} 
        value={email} 
        onChange={e => setEmail(e.target.value)} 
      />
      <div style={{ height: 10 }} />
      <input 
        className="input" 
        type="password" 
        autoComplete="new-password"
        placeholder={t('Contraseña')} 
        value={password} 
        onChange={e => setPassword(e.target.value)} 
      />
      <div style={{ height: 10 }} />
      <input 
        className="input" 
        type="text"
        autoComplete="name"
        placeholder={t('Nombre (opcional)')} 
        maxLength={40} 
        value={name} 
        onChange={e => setName(e.target.value)} 
      />
      <div style={{ height: 12 }} />
      <Button variant="primary" onClick={go} disabled={loading}>{loading ? t('Registrando...') : t('Registrarse')}</Button>
    </form>
  </>
}

export default function Login() {
  const { setUser, pullState, setGuest } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    const e = email.trim()
    const p = password.trim()

    if (!e || !p) { useUI.getState().toast(t('Introduce tu email y contraseña')); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: e,
        password: p,
      })

      if (error) throw error

      const u = { id: data.user?.id, name: data.user?.user_metadata?.name || e.split('@')[0], email: e }
      setUser(u)
      await pullState()
      useUI.getState().toast(t('Bienvenido de nuevo, {0}', u.name))
    } catch (err) {
      useUI.getState().toast(err.message || t('Error al iniciar sesión'))
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (err) {
      useUI.getState().toast(err.message || t('Error al conectar con Google'))
    }
  }

  const head = <>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>openGym</h1>
  </>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 24 }}>{t('Tus entrenamientos. Tu progreso.')}</div>

      <Button onClick={signInWithGoogle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', marginBottom: 14 }}>
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        {t('Continuar con Google')}
      </Button>

      <div className="muted small" style={{ marginBottom: 14 }}>{t('o entra con tu cuenta')}</div>

      <form onSubmit={(e) => { e.preventDefault(); signIn(); }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <input 
            className="input" 
            type="email" 
            autoComplete="username"
            placeholder={t('Email')} 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            className="input" 
            type="password" 
            autoComplete="current-password"
            placeholder={t('Contraseña')} 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
        </div>

        <Button variant="primary" icon="person" onClick={signIn} disabled={loading}>{loading ? t('Cargando...') : t('Iniciar sesión')}</Button>
      </form>
      <div style={{ height: 10 }} />
      <Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>{t('Crear nueva cuenta')}</Button>
      <div style={{ height: 10 }} />
      <Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continuar sin cuenta')}</Button>
    </div>
  )
}