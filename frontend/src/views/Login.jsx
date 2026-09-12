import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { hasData } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { supabase } from '../lib/supabase.js' // Si la ruta a tu cliente supabase varía, ajústala aquí

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
    <input ref={ref} className="input" type="email" placeholder={t('Tu Email')} value={email} onChange={e => setEmail(e.target.value)} />
    <div style={{ height: 10 }} />
    <input className="input" type="password" placeholder={t('Contraseña')} value={password} onChange={e => setPassword(e.target.value)} />
    <div style={{ height: 10 }} />
    <input className="input" placeholder={t('Nombre (opcional)')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={go} disabled={loading}>{loading ? t('Registrando...') : t('Registrarse')}</Button>
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

  const head = <>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>openGym</h1>
  </>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 24 }}>{t('Tus entrenamientos. Tu progreso.')}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <input className="input" type="email" placeholder={t('Email')} value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder={t('Contraseña')} value={password} onChange={e => setPassword(e.target.value)} />
      </div>

      <Button variant="primary" icon="person" onClick={signIn} disabled={loading}>{loading ? t('Cargando...') : t('Iniciar sesión')}</Button>
      <div style={{ height: 10 }} />
      <Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>{t('Crear nueva cuenta')}</Button>
      <div style={{ height: 10 }} />
      <Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continuar sin cuenta')}</Button>
    </div>
  )
}
