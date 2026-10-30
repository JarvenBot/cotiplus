import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { AuthScreen } from './AuthScreen'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  // Al abrir la app, revisamos si hay una sesión activa guardada
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingSession(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loadingSession) {
    return <div style={{ background: '#111', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Cargando CotiPlus...</div>
  }

  // Si no hay sesión iniciada, mostramos la pantalla de login/registro (abre limpio)
  if (!session) {
    return <AuthScreen onLoginSuccess={() => {}} />
  }

  // Si ya inició sesión, mostramos la aplicación con el usuario conectado
  return (
    <div style={{ minHeight: '100vh', background: '#1e1e1e', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '12px 24px', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <div>
          <span style={{ fontWeight: 800, color: '#f97316', fontSize: 18, marginRight: 12 }}>COTIPLUS</span>
          <span style={{ fontSize: 13, color: '#888' }}>Usuario: <strong>{session.user.email}</strong></span>
        </div>
        <button 
          onClick={() => supabase.auth.signOut()} 
          style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          Cerrar Sesión
        </button>
      </div>
      
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2 style={{ color: '#fff', marginBottom: 12 }}>¡Sesión Iniciada Correctamente!</h2>
        <p style={{ color: '#aaa', fontSize: 14 }}>Tus datos y cotizaciones se sincronizarán con tu cuenta en la nube.</p>
      </div>
    </div>
  )
}
