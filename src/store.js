// All data is stored in the browser's localStorage.
export const KEY_USERS = 'sps_users', KEY_REPORTS = 'sps_reports', KEY_SESSION = 'sps_session', KEY_NOTICE = 'sps_notices'
export const KEY_ADMIN = 'sps_admin_override', KEY_LOCK = 'sps_lock', KEY_ACT = 'sps_activity'

// ===== DEFAULT ADMIN LOGIN (change here, or in Admin > Settings) =====
export const ADMIN_EMAIL = 'admin@studentprogram.com'
export const ADMIN_PASSWORD = 'Mna6HCpD4d@97#'

const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
export const today = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const demoReports = [
  { email: 'student@gmail.com', marks: 86, attendance: 91, format: 'percentage', remarks: 'Good performance. Keep improving in problem solving.', updated: '24 Sep 2026' },
  { email: 'rahul@gmail.com', marks: 78, attendance: 84, format: 'percentage', remarks: 'Good progress. Focus more on attendance and revision.', updated: '23 Sep 2026' }
]
const demoNotices = [
  { title: 'Mid-Term Examination', text: 'Mid-term examinations begin from 10 October 2026.', type: 'urgent' },
  { title: 'Fee Payment', text: 'Pay pending semester fees before the due date.', type: 'important' },
  { title: 'Academic Registration', text: 'Course registration window is open.', type: 'info' }
]

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch { return d } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

// ---------- users ----------
export function adminCreds() {
  const o = read(KEY_ADMIN, null)
  return o && o.email && o.password ? o : { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
}
export function getUsers() {
  let x = read(KEY_USERS, [])
  if (!Array.isArray(x)) x = []
  const a = adminCreds()
  const adm = { id: 'ADM001', name: 'Administrator', email: a.email, password: a.password, role: 'admin' }
  const i = x.findIndex(u => u.role === 'admin')
  if (i >= 0 && x[i].email === adm.email && x[i].password === adm.password) return x
  if (i >= 0) x[i] = adm; else x.unshift(adm)
  write(KEY_USERS, x)
  return x
}
export const saveUsers = u => write(KEY_USERS, u)
export const findUser = email => getUsers().find(u => u.email === email)

// ---------- reports (history: many per student, newest is last) ----------
export function getReports() {
  let x = read(KEY_REPORTS, null)
  if (!Array.isArray(x)) { x = demoReports.map(r => ({ ...r })); x.forEach(r => (r.id = uid())); write(KEY_REPORTS, x); return x }
  if (x.some(r => !r.id)) { x.forEach(r => { if (!r.id) r.id = uid() }); write(KEY_REPORTS, x) }
  return x
}
export const saveReports = r => write(KEY_REPORTS, r)
export const reportsOf = email => getReports().filter(r => r.email === email)
export const latestOf = email => { const l = reportsOf(email); return l[l.length - 1] }
export const newId = uid

// ---------- notices ----------
export function getNotices() {
  let x = read(KEY_NOTICE, null)
  if (!Array.isArray(x)) { x = demoNotices.map(n => ({ ...n, id: uid() })); write(KEY_NOTICE, x); return x }
  if (x.some(n => !n.id)) { x.forEach(n => { if (!n.id) n.id = uid() }); write(KEY_NOTICE, x) }
  return x
}
export const saveNotices = n => write(KEY_NOTICE, n)
export const getSeen = id => read('sps_seen_' + id, [])
export const setSeen = (id, ids) => write('sps_seen_' + id, ids)

// ---------- session ----------
export const getSession = () => read(KEY_SESSION, null)
export const setSession = s => write(KEY_SESSION, s)
export const clearSession = () => localStorage.removeItem(KEY_SESSION)

// ---------- student extras: assignments & fees ----------
const addDays = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d }
export const getAssignments = () => [
  ['a1', 'Java OOP Program', 'Java Programming', -1], ['a2', 'Binary Search Tree', 'Data Structures', 3],
  ['a3', 'SQL Queries', 'Database Systems', 5], ['a4', 'Matrix Operations Worksheet', 'Engineering Mathematics', 9],
  ['a5', 'Process Scheduling Report', 'Operating Systems', 12]
].map(([id, title, subject, off]) => ({ id, title, subject, due: addDays(off) }))
export const getDone = email => read('sps_done_' + email, ['a2'])
export const setDone = (email, d) => write('sps_done_' + email, d)
export const getFee = email => read('sps_fee_' + email, { total: 85000, paid: 70000, receipts: [] })
export const setFee = (email, f) => write('sps_fee_' + email, f)

// ---------- activity log (admin dashboard) ----------
export const getActivity = () => read(KEY_ACT, [])
export function logActivity(text) { write(KEY_ACT, [{ text, ts: Date.now() }, ...getActivity()].slice(0, 20)) }
export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + ' min ago'
  if (s < 86400) return Math.floor(s / 3600) + ' hr ago'
  return Math.floor(s / 86400) + ' d ago'
}

// ---------- helpers ----------
export const initials = n => (n || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase()
export const gradeOf = m => (m >= 90 ? 'A+' : m >= 80 ? 'A' : m >= 70 ? 'B' : m >= 60 ? 'C' : 'D')
export const gradeClass = g => (g === 'A+' || g === 'A' ? '' : g === 'B' || g === 'C' ? ' warn' : ' red')
export const inr = n => '₹' + Number(n).toLocaleString('en-IN')
export const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
export function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

export const toast = (t, kind = 'ok') => window.dispatchEvent(new CustomEvent('sps-toast', { detail: { t, kind } }))
export const isDark = () => document.body.classList.contains('dark')
export function toggleDark() {
  document.body.classList.toggle('dark')
  localStorage.setItem('sps_dark', isDark())
  return isDark()
}
export function resetAll() {
  Object.keys(localStorage).filter(k => k.startsWith('sps_') && k !== 'sps_dark').forEach(k => localStorage.removeItem(k))
}

// ---- login lockout (5 wrong attempts = 30 seconds) ----
export const getLock = () => read(KEY_LOCK, {})
export const setLock = l => write(KEY_LOCK, l)
export const clearLock = () => localStorage.removeItem(KEY_LOCK)

// ---- CSV / download helpers ----
export function download(name, text, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }))
  a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 500)
}
const csvCell = v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }
export const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n')

// ---------- timetable (edited by admin, shown to students) ----------
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const defaultTT = {
  Monday: [['09:00', 'Java Programming', 'Dr. Rao', 'CSE-1'], ['10:00', 'Data Structures', 'Dr. Kumar', 'CSE-2'], ['11:00', 'Database Systems', 'Dr. Priya', 'CSE-3'], ['14:00', 'Mathematics', 'Dr. Reddy', 'CSE-4'], ['15:00', 'Computer Networks', 'Dr. Nair', 'CSE-5']],
  Tuesday: [['09:00', 'Operating Systems', 'Dr. Singh', 'CSE-1'], ['10:00', 'Java Programming Lab', 'Dr. Rao', 'LAB-1'], ['11:00', 'Java Programming Lab', 'Dr. Rao', 'LAB-1'], ['14:00', 'Data Structures', 'Dr. Kumar', 'CSE-2']],
  Wednesday: [['09:00', 'Mathematics', 'Dr. Reddy', 'CSE-1'], ['10:00', 'Database Systems', 'Dr. Priya', 'CSE-2'], ['11:00', 'Computer Networks', 'Dr. Nair', 'CSE-3'], ['14:00', 'Operating Systems', 'Dr. Singh', 'CSE-4'], ['15:00', 'Mentoring', 'Dr. Rao', 'CSE-5']],
  Thursday: [['09:00', 'Data Structures', 'Dr. Kumar', 'CSE-1'], ['10:00', 'Database Lab', 'Dr. Priya', 'LAB-2'], ['11:00', 'Database Lab', 'Dr. Priya', 'LAB-2'], ['14:00', 'Java Programming', 'Dr. Rao', 'CSE-4']],
  Friday: [['09:00', 'Computer Networks', 'Dr. Nair', 'CSE-1'], ['10:00', 'Mathematics', 'Dr. Reddy', 'CSE-2'], ['11:00', 'Operating Systems', 'Dr. Singh', 'CSE-3'], ['14:00', 'Seminar / Sports', '-', 'HALL']]
}
export const getTimetable = () => { const t = read('sps_timetable', null); return t && DAYS.every(d => Array.isArray(t[d])) ? t : defaultTT }
export const saveTimetable = t => write('sps_timetable', t)

// ---------- date helpers (local time, no UTC shifts) ----------
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d) }
export const fmtYmd = s => fmtDate(parseYmd(s))

// ---------- quizzes (admin creates, students answer, admin grades) ----------
export const getQuizzes = () => {
  let x = read('sps_quizzes', null)
  if (!Array.isArray(x)) {
    x = [{
      id: uid(), title: 'Java Basics - Quiz 1', subject: 'Java Programming', closes: ymd(addDays(7)), createdAt: today(), closed: false,
      instructions: 'Answer all questions. Short answers: write one word or one line.',
      questions: [
        { id: uid(), type: 'bit', text: 'JVM stands for ______ .', answer: 'Java Virtual Machine', marks: 2 },
        { id: uid(), type: 'mcq', text: 'Which keyword is used to inherit a class in Java?', options: ['implements', 'extends', 'inherits', 'super'], answer: '1', marks: 1 },
        { id: uid(), type: 'bit', text: 'The method that starts every Java program is ______ .', answer: 'main', marks: 1 }
      ]
    }]
    write('sps_quizzes', x)
  }
  return x
}
export const saveQuizzes = q => write('sps_quizzes', q)
export const getSubs = () => { const x = read('sps_subs', []); return Array.isArray(x) ? x : [] }
export const saveSubs = s => write('sps_subs', s)
export const subOf = (quizId, email) => getSubs().find(s => s.quizId === quizId && s.email === email)
export const quizTotal = q => q.questions.reduce((a, x) => a + Number(x.marks || 0), 0)
export const quizClosed = q => !!q.closed || (!!q.closes && parseYmd(q.closes).getTime() + 86399000 < Date.now())
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
// suggested marks for one answer (admin can always override)
export function suggestMarks(q, ans) {
  if (ans == null || ans === '') return 0
  if (q.type === 'mcq') return String(ans) === String(q.answer) ? Number(q.marks) : 0
  return String(q.answer || '').split('|').some(k => norm(k) === norm(ans)) ? Number(q.marks) : 0
}

// ---------- academic calendar (admin edits, everyone views) ----------
export const EVENT_TYPES = {
  academic: { label: 'Academic', color: '#1769d1', icon: '📘' },
  exam: { label: 'Exams', color: '#d99018', icon: '📝' },
  holiday: { label: 'Holiday', color: '#149c6d', icon: '🎉' },
  event: { label: 'Event', color: '#7b45df', icon: '🎪' },
  deadline: { label: 'Deadline', color: '#d84a4a', icon: '⏰' }
}
// [title, start, end, type, note]  (festival dates are sample/approximate - admin can edit)
const defaultCal = [
  ['Sankranti / Pongal Holidays', '2026-01-14', '2026-01-16', 'holiday'], ['Republic Day', '2026-01-26', '', 'holiday'],
  ['Ugadi', '2026-03-19', '', 'holiday'], ['Ramzan (Eid-ul-Fitr)', '2026-03-21', '', 'holiday', 'Date depends on moon sighting'],
  ['Sri Rama Navami', '2026-03-26', '', 'holiday'], ['Good Friday', '2026-04-03', '', 'holiday'], ['Dr. Ambedkar Jayanti', '2026-04-14', '', 'holiday'],
  ['Bakrid (Eid-ul-Adha)', '2026-05-27', '', 'holiday', 'Date depends on moon sighting'], ['Muharram', '2026-06-26', '', 'holiday', 'Date depends on moon sighting'],
  ['Odd Semester Classes Begin', '2026-07-01', '', 'academic'], ['Independence Day', '2026-08-15', '', 'holiday'],
  ['Internal Test - I', '2026-08-24', '2026-08-28', 'exam'], ['Milad-un-Nabi', '2026-08-26', '', 'holiday', 'Date depends on moon sighting'],
  ['Krishna Janmashtami', '2026-09-04', '', 'holiday'], ['Vinayaka Chavithi', '2026-09-14', '', 'holiday'], ['Gandhi Jayanti', '2026-10-02', '', 'holiday'],
  ['Mid-Term Examinations', '2026-10-10', '2026-10-17', 'exam'], ['Dussehra (Dasara) Holidays', '2026-10-19', '2026-10-21', 'holiday'],
  ['Diwali', '2026-11-08', '', 'holiday'], ['Internal Test - II', '2026-11-23', '2026-11-28', 'exam'],
  ['Last Date - Semester Fee Payment', '2026-11-30', '', 'deadline', 'Pay from Fee Details page'], ['Last Working Day (Odd Sem)', '2026-12-05', '', 'academic'],
  ['End-Sem Lab Exams', '2026-12-07', '2026-12-11', 'exam'], ['End-Sem Theory Exams', '2026-12-14', '2026-12-24', 'exam'],
  ['Christmas', '2026-12-25', '', 'holiday'], ['Winter Break', '2026-12-26', '2027-01-10', 'holiday'], ['New Year Day', '2027-01-01', '', 'holiday'],
  ['Odd Sem Results Declared', '2027-01-08', '', 'academic'], ['Bhogi / Sankranti / Kanuma', '2027-01-13', '2027-01-17', 'holiday'],
  ['Even Semester Classes Begin', '2027-01-18', '', 'academic'], ['Republic Day', '2027-01-26', '', 'holiday'],
  ['Sports Meet', '2027-02-05', '2027-02-06', 'event'], ['Annual Day', '2027-02-19', '', 'event'], ['Maha Shivaratri', '2027-03-06', '', 'holiday'],
  ['Mid-Term Examinations (Even Sem)', '2027-03-08', '2027-03-13', 'exam'], ['Holi', '2027-03-22', '', 'holiday'], ['Ugadi', '2027-04-07', '', 'holiday'],
  ['Dr. Ambedkar Jayanti', '2027-04-14', '', 'holiday'], ['Last Working Day (Even Sem)', '2027-04-30', '', 'academic'],
  ['End-Sem Examinations', '2027-05-03', '2027-05-15', 'exam'], ['Summer Vacation', '2027-05-17', '2027-06-27', 'holiday']
]
export const defaultCalendar = () => defaultCal.map(([title, start, end, type, note]) => ({ id: uid(), title, start, end, type, note: note || '' }))
export function getCalendar() {
  let x = read('sps_calendar', null)
  if (!Array.isArray(x)) { x = defaultCalendar(); write('sps_calendar', x) }
  return x
}
export const saveCalendar = c => write('sps_calendar', c)
export const resetCalendar = () => saveCalendar(defaultCalendar())
