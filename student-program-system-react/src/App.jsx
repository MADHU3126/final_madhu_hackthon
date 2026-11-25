import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login.jsx'
import { ToastHost, DialogHost, LoaderHost, Waves } from './ui.jsx'
import { getSession, getUsers } from './store.js'

// Dashboards load on demand - on a slow network the wave loader shows while they download
const Register = lazy(() => import('./pages/Register.jsx'))
const Student = lazy(() => import('./pages/Student.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const Parent = lazy(() => import('./pages/Parent.jsx'))

function Guard({ role, children }) {
  const s = getSession()
  if (!s || s.role !== role || !getUsers().find(u => u.email === s.email)) return <Navigate to="/" replace />
  return children
}

// Already logged in? Skip the login page.
function Home() {
  const s = getSession()
  if (s && getUsers().find(u => u.email === s.email)) return <Navigate to={'/' + s.role} replace />
  return <Login />
}

export default function App() {
  const { pathname } = useLocation()
  return (
    <>
      <div className="route" key={pathname}>
        <Suspense fallback={<div className="page-loading"><Waves text="Loading…" /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/student" element={<Guard role="student"><Student /></Guard>} />
            <Route path="/admin" element={<Guard role="admin"><Admin /></Guard>} />
            <Route path="/parent" element={<Guard role="parent"><Parent /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      <ToastHost />
      <DialogHost />
      <LoaderHost />
    </>
  )
}
