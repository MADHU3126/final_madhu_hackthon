import { useState } from 'react'
import { Panel } from '../components/Shell.jsx'
import { Ring, confirmBox, withLoader } from '../ui.jsx'
import {
  getUsers, getQuizzes, saveQuizzes, getSubs, saveSubs, subOf, quizTotal, quizClosed, suggestMarks, newId, today, toast,
  logActivity, download, toCSV, fmtYmd
} from '../store.js'

const blankQ = type => ({ id: newId(), type, text: '', options: type === 'mcq' ? ['', '', '', ''] : undefined, answer: type === 'mcq' ? '0' : '', marks: 1 })
const ansText = (q, a) => (a == null || a === '' ? '(not answered)' : q.type === 'mcq' ? (q.options[Number(a)] ?? '(invalid)') : a)
const keyText = q => (q.type === 'mcq' ? q.options[Number(q.answer)] : String(q.answer || '').split('|')[0])
const pctOf = (got, tot) => (tot ? Math.round((got / tot) * 100) : 0)

/* =====================  ADMIN  ===================== */

function QuizForm({ quiz, addNew, onDone }) {
  const locked = quiz && getSubs().some(s => s.quizId === quiz.id) // existing questions are frozen once students have answered (new ones can still be added)
  const [frozen] = useState(() => new Set(locked ? quiz.questions.map(q => q.id) : []))
  const [f, setF] = useState(() => quiz ? { title: quiz.title, subject: quiz.subject, closes: quiz.closes || '', instructions: quiz.instructions || '' } : { title: '', subject: '', closes: '', instructions: '' })
  const [qs, setQs] = useState(() => quiz ? [...quiz.questions.map(q => ({ ...q, options: q.options ? [...q.options] : undefined })), ...(addNew ? [blankQ('bit')] : [])] : [blankQ('bit'), blankQ('bit')])
  const [err, setErr] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const upd = (id, patch) => setQs(l => l.map(q => (q.id === id ? { ...q, ...patch } : q)))
  const setOpt = (id, i, v) => setQs(l => l.map(q => (q.id === id ? { ...q, options: q.options.map((o, k) => (k === i ? v : o)) } : q)))
  const total = qs.reduce((a, q) => a + (Number(q.marks) || 0), 0)

  const save = async e => {
    e.preventDefault()
    if (!qs.length) return setErr('Add at least one question.')
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i], n = 'Question ' + (i + 1)
      if (frozen.has(q.id)) continue
      if (!q.text.trim()) return setErr(n + ': enter the question text.')
      if (!(Number(q.marks) > 0)) return setErr(n + ': marks must be more than 0.')
      if (q.type === 'mcq') {
        if (q.options.filter(o => o.trim()).length < 2) return setErr(n + ': give at least 2 options.')
        if (!q.options[Number(q.answer)]?.trim()) return setErr(n + ': the correct option is empty.')
      }
    }
    setErr('')
    await withLoader('Saving quiz…', async () => {
      const clean = qs.map(q => ({ ...q, text: q.text.trim(), marks: Number(q.marks), answer: q.type === 'bit' ? String(q.answer).trim() : q.answer, options: q.options?.map(o => o.trim()) }))
      const all = getQuizzes()
      if (quiz) saveQuizzes(all.map(x => (x.id === quiz.id ? { ...x, title: f.title.trim(), subject: f.subject.trim(), closes: f.closes, instructions: f.instructions.trim(), questions: clean.map(q => (frozen.has(q.id) ? x.questions.find(o => o.id === q.id) : q)) } : x)))
      else saveQuizzes([{ id: newId(), title: f.title.trim(), subject: f.subject.trim(), closes: f.closes, instructions: f.instructions.trim(), createdAt: today(), closed: false, questions: clean }, ...all])
      logActivity((quiz ? (qs.length > quiz.questions.length ? 'Added ' + (qs.length - quiz.questions.length) + ' question(s) to quiz "' : 'Updated quiz "') : 'Created quiz "') + f.title.trim() + '"')
    }, 600)
    toast(quiz ? (addNew ? 'Question added' : 'Quiz updated') : 'Quiz created - students can see it now')
    onDone()
  }

  return (
    <Panel title={quiz ? 'Edit Quiz' : 'Create Quiz'} desc="Add short 'bit' questions (type the answer) or multiple-choice. You correct and upload marks later." icon="🧩">
      <form onSubmit={save}>
        <div className="form-grid">
          <div className="form-group"><label>Quiz title</label><input required value={f.title} onChange={set('title')} placeholder="e.g. Unit 1 - Quiz" /></div>
          <div className="form-group"><label>Subject</label><input required value={f.subject} onChange={set('subject')} placeholder="e.g. Data Structures" /></div>
          <div className="form-group"><label>Last date to answer (optional)</label><input type="date" value={f.closes} onChange={set('closes')} /></div>
          <div className="form-group"><label>Instructions (optional)</label><input value={f.instructions} onChange={set('instructions')} placeholder="Shown to students" /></div>
        </div>
        {locked && <div className="alert-bar" style={{ marginTop: 14 }}>🔒 Students have already answered this quiz, so existing questions are locked. You can still add new questions at the bottom (students who already submitted will get 0 for them unless you re-correct), and change title, subject, instructions and last date.</div>}
        <div className="q-list">
          {qs.map((q, i) => (
            <div className="q-card" key={q.id} ref={el => { if (el && addNew && i === qs.length - 1 && !el.dataset.f) { el.dataset.f = 1; el.scrollIntoView({ block: 'center' }) } }}>
              <div className="q-head"><b>Q{i + 1}</b><span className="badge">{q.type === 'mcq' ? 'Multiple choice' : 'Bit / short answer'}</span>
                {!frozen.has(q.id) && <button type="button" className="small-btn red" onClick={() => setQs(l => l.filter(x => x.id !== q.id))}>Remove</button>}</div>
              <div className="form-group"><label>Question</label><input disabled={frozen.has(q.id)} value={q.text} onChange={e => upd(q.id, { text: e.target.value })} placeholder={q.type === 'bit' ? 'e.g. The default value of an int in Java is ______ .' : 'Type the question'} /></div>
              {q.type === 'mcq'
                ? <div className="opt-grid">{q.options.map((o, k) => (
                    <label key={k} className={'opt-row' + (q.answer === String(k) ? ' right' : '')}>
                      <input type="radio" name={'c' + q.id} disabled={frozen.has(q.id)} checked={q.answer === String(k)} onChange={() => upd(q.id, { answer: String(k) })} />
                      <input disabled={frozen.has(q.id)} value={o} onChange={e => setOpt(q.id, k, e.target.value)} placeholder={'Option ' + 'ABCD'[k]} />
                    </label>))}
                    <small className="muted">Select the radio button of the correct option.</small></div>
                : <div className="form-group"><label>Model answer (for your reference; use | for alternatives, e.g. main|Main())</label><input disabled={frozen.has(q.id)} value={q.answer} onChange={e => upd(q.id, { answer: e.target.value })} placeholder="Correct answer" /></div>}
              <div className="form-group" style={{ maxWidth: 140 }}><label>Marks</label><input type="number" min="0.5" step="0.5" disabled={frozen.has(q.id)} value={q.marks} onChange={e => upd(q.id, { marks: e.target.value })} /></div>
            </div>
          ))}
        </div>
        {<div className="toolbar" style={{ marginTop: 14 }}>
          <div><button type="button" className="btn alt" onClick={() => setQs(l => [...l, blankQ('bit')])}>+ Add bit</button>{' '}
            <button type="button" className="btn alt" onClick={() => setQs(l => [...l, blankQ('mcq')])}>+ Add multiple choice</button></div>
          <b>Total: {total} marks</b></div>}
        {err && <div className="msg error">{err}</div>}
        <div style={{ marginTop: 14 }}><button className="btn primary" type="submit">{quiz ? 'Save changes' : 'Publish quiz'}</button>{' '}
          <button type="button" className="btn alt" onClick={onDone}>Cancel</button></div>
      </form>
    </Panel>
  )
}

function GradeSheet({ quiz, sub, student, onDone }) {
  const [marks, setMarks] = useState(() => Object.fromEntries(quiz.questions.map(q => [q.id, sub.marks?.[q.id] ?? suggestMarks(q, sub.answers[q.id])])))
  const [fb, setFb] = useState(sub.feedback || '')
  const total = quiz.questions.reduce((a, q) => a + (Number(marks[q.id]) || 0), 0), max = quizTotal(quiz)
  const set = (q, v) => setMarks(m => ({ ...m, [q.id]: Math.max(0, Math.min(Number(q.marks), Number(v))) }))
  const auto = () => { setMarks(Object.fromEntries(quiz.questions.map(q => [q.id, suggestMarks(q, sub.answers[q.id])]))); toast('Suggested marks filled - please verify') }
  const save = async () => {
    await withLoader('Uploading marks…', async () => {
      saveSubs(getSubs().map(s => (s.id === sub.id ? { ...s, marks: Object.fromEntries(quiz.questions.map(q => [q.id, Number(marks[q.id]) || 0])), total, status: 'graded', gradedAt: today(), feedback: fb.trim() } : s)))
      logActivity('Marks uploaded: ' + student.name + ' - ' + quiz.title + ' (' + total + '/' + max + ')')
    }, 600)
    toast('Marks uploaded - student can see them now'); onDone()
  }
  return (
    <Panel title={'Correct answers - ' + student.name} desc={quiz.title + ' • submitted ' + sub.submittedAt} icon="✅" style={{ marginTop: 18 }}>
      {quiz.questions.map((q, i) => {
        const a = sub.answers[q.id], sugg = suggestMarks(q, a)
        return (
          <div className="q-card" key={q.id}>
            <div className="q-head"><b>Q{i + 1}. {q.text}</b><span className="badge">{q.marks} mark{q.marks > 1 ? 's' : ''}</span></div>
            <div className="ans-grid">
              <div className="info"><small>Student's answer</small><b>{ansText(q, a)}</b></div>
              <div className="info"><small>Model answer</small><b>{keyText(q) || '-'}</b></div>
            </div>
            <div className="mark-row"><label>Marks awarded (max {q.marks})</label>
              <input type="number" min="0" max={q.marks} step="0.5" value={marks[q.id]} onChange={e => set(q, e.target.value)} />
              <span className={'badge' + (sugg ? '' : ' warn')}>{sugg ? 'Looks correct' : 'Check manually'}</span></div>
          </div>
        )
      })}
      <div className="form-group" style={{ marginTop: 12 }}><label>Feedback for the student (optional)</label><input value={fb} onChange={e => setFb(e.target.value)} placeholder="Well done / revise unit 2 ..." /></div>
      <div className="toolbar" style={{ marginTop: 14 }}>
        <div><button className="btn primary" onClick={save}>Upload marks</button>{' '}<button className="btn alt" onClick={auto}>✨ Fill suggested marks</button>{' '}<button className="btn alt" onClick={onDone}>Back</button></div>
        <b>Total: {total} / {max} ({pctOf(total, max)}%)</b></div>
    </Panel>
  )
}

function Submissions({ quiz, bump, onBack }) {
  const [grading, setGrading] = useState(null)
  const students = getUsers().filter(u => u.role === 'student'), max = quizTotal(quiz)
  const rows = students.map(s => ({ s, sub: subOf(quiz.id, s.email) }))
  const got = rows.filter(r => r.sub), done = got.filter(r => r.sub.status === 'graded')
  const avg = done.length ? Math.round(done.reduce((a, r) => a + pctOf(r.sub.total, max), 0) / done.length) : 0
  const csv = () => download('quiz-' + quiz.title.replace(/\W+/g, '-') + '.csv', toCSV([['Student', 'Email', 'Status', 'Marks', 'Out of', 'Percent'],
    ...rows.map(({ s, sub }) => [s.name, s.email, sub ? sub.status : 'not attempted', sub?.status === 'graded' ? sub.total : '', max, sub?.status === 'graded' ? pctOf(sub.total, max) : ''])]), 'text/csv')
  if (grading) { const r = rows.find(x => x.s.email === grading); return <GradeSheet quiz={quiz} sub={r.sub} student={r.s} onDone={() => { setGrading(null); bump() }} /> }
  return (
    <Panel title={'Submissions - ' + quiz.title} desc={quiz.subject + ' • ' + max + ' marks'} icon="📥">
      <div className="toolbar"><div className="muted">{got.length} of {students.length} submitted • {done.length} graded{done.length ? ' • class average ' + avg + '%' : ''}</div>
        <div><button className="btn alt" onClick={csv}>⬇ Export marks</button>{' '}<button className="btn alt" onClick={onBack}>← All quizzes</button></div></div>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Student</th><th>Status</th><th>Marks</th><th>Submitted</th><th>Action</th></tr></thead>
        <tbody>{rows.map(({ s, sub }) => (
          <tr key={s.email}><td><span className="mini-av">{s.name[0]}</span>{s.name}</td>
            <td>{!sub ? <span className="badge red">Not attempted</span> : sub.status === 'graded' ? <span className="badge">Graded</span> : <span className="badge warn">Needs correction</span>}</td>
            <td>{sub?.status === 'graded' ? sub.total + ' / ' + max : '-'}</td><td>{sub ? sub.submittedAt : '-'}</td>
            <td className="actions">{sub ? <button className="small-btn blue" onClick={() => setGrading(s.email)}>{sub.status === 'graded' ? 'Review / edit marks' : 'Correct & upload marks'}</button> : <span className="muted">-</span>}</td></tr>))}
          {!rows.length && <tr><td colSpan="5">No students yet.</td></tr>}</tbody>
      </table></div>
    </Panel>
  )
}

export function AdminQuizzes({ bump }) {
  const [mode, setMode] = useState({ k: 'list' }) // list | form | subs
  const back = () => { setMode({ k: 'list' }); bump() }
  const quizzes = getQuizzes(), subs = getSubs()

  if (mode.k === 'form') return <QuizForm quiz={mode.quiz} addNew={mode.addNew} onDone={back} />
  if (mode.k === 'subs') { const q = quizzes.find(x => x.id === mode.id); if (q) return <Submissions quiz={q} bump={bump} onBack={back} /> }

  const toggle = q => { saveQuizzes(quizzes.map(x => (x.id === q.id ? { ...x, closed: !x.closed } : x))); toast(q.closed ? 'Quiz reopened' : 'Quiz closed'); bump() }
  const del = async q => {
    if (!(await confirmBox('Delete "' + q.title + '" and all student answers/marks for it?', { title: 'Delete quiz' }))) return
    saveQuizzes(quizzes.filter(x => x.id !== q.id)); saveSubs(subs.filter(s => s.quizId !== q.id)); logActivity('Deleted quiz "' + q.title + '"'); toast('Quiz deleted'); bump()
  }
  return (
    <Panel title="Quizzes" desc="Create small quizzes with bits. Students answer online; you correct them and upload marks." icon="🧩">
      <div className="toolbar"><div className="muted">{quizzes.length} quiz{quizzes.length === 1 ? '' : 'zes'}</div><button className="btn primary" onClick={() => setMode({ k: 'form' })}>+ Create Quiz</button></div>
      <div className="quiz-grid">
        {quizzes.map((q, i) => {
          const qs = subs.filter(s => s.quizId === q.id), pend = qs.filter(s => s.status !== 'graded').length, closed = quizClosed(q)
          return (
            <div className="quiz-card" key={q.id} style={{ '--i': i }}>
              <div className="q-head"><b>{q.title}</b><span className={'badge' + (closed ? ' red' : '')}>{closed ? 'Closed' : 'Open'}</span></div>
              <small className="muted">{q.subject} • {q.questions.length} questions • {quizTotal(q)} marks{q.closes ? ' • till ' + fmtYmd(q.closes) : ''}</small>
              <div className="quiz-stats"><span>📥 {qs.length} submitted</span><span className={pend ? 'warn-text' : ''}>✍️ {pend} to correct</span></div>
              <div className="actions-row">
                <button className="small-btn blue" onClick={() => setMode({ k: 'subs', id: q.id })}>Correct / marks{pend ? ' (' + pend + ')' : ''}</button>
                <button className="small-btn green" onClick={() => setMode({ k: 'form', quiz: q, addNew: true })}>+ Add question</button>
                <button className="small-btn" onClick={() => setMode({ k: 'form', quiz: q })}>Edit</button>
                <button className="small-btn" onClick={() => toggle(q)}>{q.closed ? 'Reopen' : 'Close'}</button>
                <button className="small-btn red" onClick={() => del(q)}>Delete</button>
              </div>
            </div>)
        })}
        {!quizzes.length && <p className="empty">No quizzes yet. Click "Create Quiz".</p>}
      </div>
    </Panel>
  )
}

/* =====================  STUDENT  ===================== */

function Attempt({ quiz, u, onDone }) {
  const [ans, setAns] = useState({})
  const left = quiz.questions.filter(q => !String(ans[q.id] ?? '').trim()).length
  const submit = async e => {
    e.preventDefault()
    const msg = left ? 'You left ' + left + ' question(s) blank. Submit anyway? You cannot change answers after submitting.' : 'Submit your answers? You cannot change them after submitting.'
    if (!(await confirmBox(msg, { title: 'Submit quiz', confirmText: 'Submit', danger: false }))) return
    await withLoader('Submitting your answers…', async () => {
      if (subOf(quiz.id, u.email)) return
      saveSubs([...getSubs(), { id: newId(), quizId: quiz.id, email: u.email, answers: ans, submittedAt: today(), status: 'submitted' }])
    }, 800)
    toast('Quiz submitted 🎉 - marks will appear after your teacher corrects it'); onDone()
  }
  return (
    <Panel title={quiz.title} desc={quiz.subject + ' • ' + quizTotal(quiz) + ' marks' + (quiz.closes ? ' • last date ' + fmtYmd(quiz.closes) : '')} icon="🧩">
      {quiz.instructions && <div className="notice info"><b>Instructions</b><span>{quiz.instructions}</span></div>}
      <form onSubmit={submit}>
        {quiz.questions.map((q, i) => (
          <div className="q-card" key={q.id}>
            <div className="q-head"><b>Q{i + 1}. {q.text}</b><span className="badge">{q.marks} mark{q.marks > 1 ? 's' : ''}</span></div>
            {q.type === 'mcq'
              ? <div className="opt-grid">{q.options.map((o, k) => o.trim() && (
                  <label key={k} className={'opt-row pick' + (ans[q.id] === String(k) ? ' right' : '')}>
                    <input type="radio" name={q.id} checked={ans[q.id] === String(k)} onChange={() => setAns({ ...ans, [q.id]: String(k) })} /><span>{'ABCD'[k]}. {o}</span></label>))}</div>
              : <input className="bit-input" placeholder="Type your answer" value={ans[q.id] || ''} onChange={e => setAns({ ...ans, [q.id]: e.target.value })} />}
          </div>
        ))}
        <div className="toolbar" style={{ marginTop: 14 }}><span className="muted">{quiz.questions.length - left} of {quiz.questions.length} answered</span>
          <div><button type="button" className="btn alt" onClick={onDone}>Cancel</button>{' '}<button className="btn primary" type="submit">Submit answers</button></div></div>
      </form>
    </Panel>
  )
}

function Result({ quiz, sub, onBack }) {
  const max = quizTotal(quiz), pct = pctOf(sub.total, max)
  return (
    <Panel title={quiz.title + ' - Result'} desc={quiz.subject + ' • marks uploaded ' + sub.gradedAt} icon="🏅">
      <div className="planner" style={{ marginTop: 0, marginBottom: 14 }}>
        <Ring value={pct} size={110} color={pct < 40 ? 'var(--red)' : pct < 60 ? 'var(--orange)' : 'var(--green)'} />
        <p><b style={{ fontSize: 22 }}>{sub.total} / {max}</b><br />{sub.feedback ? <>Teacher says: <i>"{sub.feedback}"</i></> : 'Well done for completing the quiz!'}</p>
      </div>
      {quiz.questions.map((q, i) => { const got = sub.marks?.[q.id] ?? 0; return (
        <div className="q-card" key={q.id}>
          <div className="q-head"><b>Q{i + 1}. {q.text}</b><span className={'badge' + (got >= q.marks ? '' : got > 0 ? ' warn' : ' red')}>{got} / {q.marks}</span></div>
          <div className="ans-grid"><div className="info"><small>Your answer</small><b>{ansText(q, sub.answers[q.id])}</b></div><div className="info"><small>Correct answer</small><b>{keyText(q) || '-'}</b></div></div>
        </div>) })}
      <button className="btn alt" onClick={onBack}>← Back to quizzes</button>
    </Panel>
  )
}

export function StudentQuizzes({ u, bump }) {
  const [mode, setMode] = useState({ k: 'list' })
  const back = () => { setMode({ k: 'list' }); bump() }
  const quizzes = getQuizzes()
  if (mode.k === 'take') { const q = quizzes.find(x => x.id === mode.id); if (q && !subOf(q.id, u.email)) return <Attempt quiz={q} u={u} onDone={back} /> }
  if (mode.k === 'result') { const q = quizzes.find(x => x.id === mode.id), s = q && subOf(q.id, u.email); if (s) return <Result quiz={q} sub={s} onBack={back} /> }
  return (
    <Panel title="Quizzes" desc="Answer the quizzes posted by your teacher. Marks appear here after correction." icon="🧩">
      <div className="quiz-grid">
        {quizzes.map((q, i) => {
          const s = subOf(q.id, u.email), closed = quizClosed(q), max = quizTotal(q)
          const state = s ? (s.status === 'graded' ? 'graded' : 'waiting') : closed ? 'missed' : 'open'
          return (
            <div className="quiz-card" key={q.id} style={{ '--i': i }}>
              <div className="q-head"><b>{q.title}</b>
                {state === 'open' && <span className="badge warn">To attempt</span>}{state === 'waiting' && <span className="badge warn">Awaiting marks</span>}
                {state === 'graded' && <span className="badge">{s.total} / {max}</span>}{state === 'missed' && <span className="badge red">Missed</span>}</div>
              <small className="muted">{q.subject} • {q.questions.length} questions • {max} marks{q.closes ? ' • last date ' + fmtYmd(q.closes) : ''}</small>
              <div className="actions-row">
                {state === 'open' && <button className="btn primary" onClick={() => setMode({ k: 'take', id: q.id })}>Start quiz →</button>}
                {state === 'waiting' && <span className="muted">Submitted {s.submittedAt} - waiting for your teacher to upload marks.</span>}
                {state === 'graded' && <button className="small-btn blue" onClick={() => setMode({ k: 'result', id: q.id })}>View result ({pctOf(s.total, max)}%)</button>}
                {state === 'missed' && <span className="muted">This quiz is closed.</span>}
              </div>
            </div>)
        })}
        {!quizzes.length && <p className="empty">No quizzes posted yet.</p>}
      </div>
    </Panel>
  )
}

// number of quizzes the student can still attempt (for dashboard alert)
export const openQuizCount = email => getQuizzes().filter(q => !quizClosed(q) && !subOf(q.id, email)).length

/* =====================  PARENT (read-only)  ===================== */

export function ParentQuizzes({ student }) {
  if (!student) return <Panel title="Quiz Results" icon="🧩"><p>No student linked.</p></Panel>
  const rows = getQuizzes().map(q => ({ q, s: subOf(q.id, student.email), max: quizTotal(q) }))
  return (
    <Panel title="Quiz Results" desc={'Quizzes attempted by ' + student.name} icon="🧩">
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Quiz</th><th>Subject</th><th>Status</th><th>Marks</th></tr></thead>
        <tbody>{rows.map(({ q, s, max }) => (
          <tr key={q.id}><td>{q.title}</td><td>{q.subject}</td>
            <td>{!s ? <span className={'badge ' + (quizClosed(q) ? 'red' : 'warn')}>{quizClosed(q) ? 'Missed' : 'Not attempted'}</span> : s.status === 'graded' ? <span className="badge">Graded</span> : <span className="badge warn">Awaiting marks</span>}</td>
            <td>{s?.status === 'graded' ? s.total + ' / ' + max + ' (' + pctOf(s.total, max) + '%)' : '-'}</td></tr>))}
          {!rows.length && <tr><td colSpan="4">No quizzes yet.</td></tr>}</tbody>
      </table></div>
    </Panel>
  )
}
