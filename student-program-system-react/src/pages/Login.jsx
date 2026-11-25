import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUsers, setSession, getLock, setLock, clearLock, toast } from '../store.js'
import { showLoader, hideLoader, sleep } from '../ui.jsx'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState(localStorage.getItem('sps_remember') || '')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(!!localStorage.getItem('sps_remember'))
  const [msg, setMsg] = useState({ t: '', n: 0 })
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil(((getLock().until || 0) - Date.now()) / 1000)))

  // live lockout countdown
  useEffect(() => {
    if (!left) return
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil(((getLock().until || 0) - Date.now()) / 1000))), 500)
    return () => clearInterval(t)
  }, [left])

  const fail = t => setMsg(m => ({ t, n: m.n + 1 }))
  const submit = async e => {
    e.preventDefault()
    if (busy) return
    const L = getLock()
    if (L.until && Date.now() < L.until) return fail('Too many failed attempts. Try again in ' + Math.ceil((L.until - Date.now()) / 1000) + ' seconds.')
    setBusy(true); showLoader('Verifying your details…')
    await sleep(900)
    const u = getUsers().find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === pw)
    if (!u) {
      hideLoader(); setBusy(false)
      const n = (L.n || 0) + 1
      if (n >= 5) { setLock({ n: 0, until: Date.now() + 30000 }); setLeft(30) } else setLock({ n })
      return fail('Invalid email or password.' + (n >= 5 ? ' Too many attempts - locked for 30 seconds.' : ' ' + (5 - n) + ' attempt(s) left.'))
    }
    clearLock()
    remember ? localStorage.setItem('sps_remember', email.trim()) : localStorage.removeItem('sps_remember')
    setSession({ email: u.email, role: u.role })
    showLoader('Welcome, ' + u.name.split(' ')[0] + '! Loading your dashboard…')
    await sleep(800)
    toast('Welcome back, ' + u.name.split(' ')[0])
    nav('/' + u.role)
    setTimeout(hideLoader, 250)
  }

  return (
    <div className="login-body">
      <div className="login-bg"><span></span><span></span><span></span></div>
      <div className="login-card">
        <div className="logo-box">🎓</div>
        <h1>Student Program System</h1>
        <p className="sub">Student Information &amp; Academic Management</p>
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" placeholder="Enter email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
          <label>Password</label>
          <div className="pw-wrap">
            <input type={show ? 'text' : 'password'} placeholder="Enter password" required autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} />
            <button type="button" className="eye" onClick={() => setShow(s => !s)} aria-label="Show or hide password">{show ? '🙈' : '👁️'}</button>
          </div>
          <label className="check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember my email</label>
          <button className="btn primary full" type="submit" disabled={left > 0 || busy}>{left > 0 ? 'Locked - wait ' + left + 's' : busy ? <><span className="spin"></span> Signing in…</> : <>Login <span className="arrow">→</span></>}</button>
        </form>
        <div key={msg.n} className={'msg error' + (msg.t ? ' shake' : '')}>{msg.t}</div>
        <p className="register-link">New here? <Link to="/register">Create a student or parent account</Link></p>
      </div>
    </div>
  )
}
