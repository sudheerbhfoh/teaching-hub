import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import TuitionTracker from './TuitionTracker'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) { setError('Please enter email and password'); return }
    setError('')
    setSigningIn(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setSigningIn(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#F8F9FF', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'40px', marginBottom:'12px' }}>📚</div>
        <div style={{ fontSize:'16px', fontWeight:700, color:'#667eea' }}>Loading TuitionHub...</div>
      </div>
    </div>
  )

  if (!session) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'linear-gradient(135deg,#667eea,#764ba2)', fontFamily:"'Segoe UI',system-ui,sans-serif", padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'20px', padding:'32px 28px', width:'100%', maxWidth:'380px', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'48px', marginBottom:'8px' }}>📚</div>
          <div style={{ fontSize:'24px', fontWeight:800, color:'#1a1a2e' }}>TuitionHub</div>
          <div style={{ fontSize:'13px', color:'#888', marginTop:'4px' }}>Sign in to continue</div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:'14px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#555', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e5e7eb', fontSize:'14px', outline:'none' }}
            />
          </div>

          <div style={{ marginBottom:'20px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#555', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e5e7eb', fontSize:'14px', outline:'none' }}
            />
          </div>

          {error && (
            <div style={{ background:'#FFEBEE', color:'#C62828', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', marginBottom:'16px', textAlign:'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={signingIn}
            style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'none', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', fontSize:'15px', fontWeight:700, cursor:'pointer', opacity: signingIn ? 0.7 : 1 }}
          >
            {signingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:'20px', fontSize:'12px', color:'#aaa' }}>
          🔒 Private access only
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Logout button */}
      <div style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:100 }}>
        <button
          onClick={handleLogout}
          style={{ padding:'8px 16px', borderRadius:'10px', border:'none', background:'#fff', color:'#667eea', fontSize:'12px', fontWeight:700, cursor:'pointer', boxShadow:'0 2px 10px rgba(0,0,0,0.15)' }}
        >
          🚪 Sign Out
        </button>
      </div>
      <TuitionTracker />
    </div>
  )
}
