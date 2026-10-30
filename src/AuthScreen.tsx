import { useState } from 'react'
import { supabase } from './supabaseClient'

export function AuthScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')

    if (isRecovering) {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) setMensaje('Error: ' + error.message)
      else setMensaje('¡Correo de recuperación enviado! Revisa tu bandeja.')
      setLoading(false)
      return
    }

    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMensaje('Error al registrarse: ' + error.message)
      else setMensaje('¡Registro exitoso! Ya puedes iniciar sesión.')
      setLoading(false)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMensaje('Credenciales incorrectas o error: ' + error.message)
      else onLoginSuccess()
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#111', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#1e1e1e', padding: 32, borderRadius: 12, width: 380, border: '1px solid #333', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
        <h2 style={{ marginBottom: 8, textAlign: 'center', color: '#f97316', fontSize: 22 }}>COTIPLUS</h2>
        <p style={{ textAlign: 'center', color: '#888', fontSize: 13, marginBottom: 24 }}>
          {isRecovering ? 'Recuperar contraseña' : isRegistering ? 'Crea una cuenta nueva' : 'Inicia sesión para sincronizar'}
        </p>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input 
            type="email" 
            placeholder="Correo electrónico" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 11, borderRadius: 8, background: '#2a2a2a', border: '1px solid #444', color: '#fff', fontSize: 13 }}
            required 
          />
          {!isRecovering && (
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: 11, borderRadius: 8, background: '#2a2a2a', border: '1px solid #444', color: '#fff', fontSize: 13 }}
              required 
            />
          )}

          <button type="submit" disabled={loading} style={{ background: '#f97316', color: '#fff', padding: 11, border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Procesando...' : isRecovering ? 'Enviar enlace' : isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
          </button>

          {mensaje && <p style={{ fontSize: 12, color: mensaje.includes('Error') ? '#dc2626' : '#4ade80', textAlign: 'center', margin: '4px 0' }}>{mensaje}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8, color: '#aaa' }}>
            <span onClick={() => { setIsRecovering(false); setIsRegistering(!isRegistering); setMensaje(''); }} style={{ cursor: 'pointer', color: '#f97316' }}>
              {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : 'Crear cuenta nueva'}
            </span>
            {!isRegistering && (
              <span onClick={() => { setIsRecovering(!isRecovering); setMensaje(''); }} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                {isRecovering ? 'Volver' : '¿Olvidaste tu contraseña?'}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
