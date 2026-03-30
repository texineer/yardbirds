import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, displayName)
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="relative overflow-hidden py-10 px-6 text-center" style={{ background: 'var(--navy)' }}>
        <div className="relative z-10 max-w-lg mx-auto">
          <Link to="/" className="no-underline">
            <h1 className="font-display text-4xl text-white tracking-wider">BLEACHERBOX</h1>
          </Link>
          <p className="text-sm mt-1 font-medium" style={{ color: 'var(--gold)' }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>
        <div className="stitch-line mt-6" />
      </header>

      <main className="flex-1 px-4 py-8 max-w-sm mx-auto w-full">
        {/* Toggle tabs */}
        <div className="flex rounded-xl overflow-hidden border-2 p-0.5 gap-0.5 mb-6"
          style={{ borderColor: 'var(--border)', background: 'var(--sky)' }}>
          {['login', 'register'].map(m => (
            <button key={m}
              className="flex-1 py-2.5 rounded-lg font-display text-lg tracking-wider transition-all"
              style={{
                background: mode === m ? 'var(--navy)' : 'transparent',
                color: mode === m ? 'white' : 'var(--navy-muted)',
              }}
              onClick={() => { setMode(m); setError('') }}>
              {m === 'login' ? 'SIGN IN' : 'REGISTER'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
                style={{ color: 'var(--navy-muted)' }}>Display Name</label>
              <input
                type="text"
                className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: 'var(--navy-muted)' }}>Email</label>
            <input
              type="email"
              required
              className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: 'var(--navy-muted)' }}>Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
              placeholder={mode === 'register' ? 'Min 8 characters' : 'Your password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm font-semibold text-center py-2 px-3 rounded-lg"
              style={{ color: 'var(--loss)', background: 'var(--loss-bg, #fdecea)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform"
            style={{ background: loading ? 'var(--navy-muted)' : 'var(--navy)' }}>
            {loading ? 'PLEASE WAIT...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm font-semibold no-underline" style={{ color: 'var(--navy-muted)' }}>
            Back to teams
          </Link>
        </div>
      </main>

      <footer className="text-center py-4 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--navy-muted)' }}>
        BleacherBox
      </footer>
    </div>
  )
}
