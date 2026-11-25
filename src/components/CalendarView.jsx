import { useState, useReducer } from 'react'
import { Panel } from './Shell.jsx'
import { dialog, confirmBox } from '../ui.jsx'
import { getCalendar, saveCalendar, resetCalendar, EVENT_TYPES, ymd, parseYmd, fmtYmd, newId, toast, logActivity, download, toCSV } from '../store.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const covers = (e, key) => e.start <= key && key <= (e.end || e.start)
const range = e => (e.end && e.end !== e.start ? fmtYmd(e.start) + ' - ' + fmtYmd(e.end) : fmtYmd(e.start))
const daysFrom = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5)
const when = (e, todayKey) => {
  if (covers(e, todayKey)) return 'Happening now'
  const d = daysFrom(e.start, todayKey)
  return d === 1 ? 'Tomorrow' : 'In ' + d + ' days'
}

export default function CalendarView({ admin = false, bump }) {
  const now = new Date(), todayKey = ymd(now)
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [view, setView] = useState('month')
  const [sel, setSel] = useState(todayKey)
  const [off, setOff] = useState([])
  const [, force] = useReducer(x => x + 1, 0)
  const all = getCalendar(), events = all.filter(e => !off.includes(e.type))
  const refresh = () => { force(); bump && bump() }

  const shift = n => setCur(c => { const d = new Date(c.y, c.m + (view === 'month' ? n : 12 * n), 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const goToday = () => { setCur({ y: now.getFullYear(), m: now.getMonth() }); setSel(todayKey) }

  // ---- admin actions ----
  const fields = (e = {}) => [
    { name: 'title', label: 'Title', value: e.title, placeholder: 'e.g. Mid-Term Exams' },
    { name: 'type', label: 'Category', options: Object.entries(EVENT_TYPES).map(([k, v]) => ({ value: k, label: v.icon + ' ' + v.label })), value: e.type || 'academic' },
    { name: 'start', label: 'Start date', type: 'date', value: e.start || sel },
    { name: 'end', label: 'End date (optional - for multi-day)', type: 'date', value: e.end || '', optional: true },
    { name: 'note', label: 'Note (optional)', value: e.note || '', optional: true }
  ]
  const validate = v => (v.end && v.end < v.start ? 'End date cannot be before the start date.' : '')
  const add = async () => {
    const v = await dialog({ title: 'Add calendar event', confirmText: 'Add', fields: fields(), validate }); if (!v) return
    saveCalendar([...getCalendar(), { id: newId(), title: v.title.trim(), type: v.type, start: v.start, end: v.end && v.end !== v.start ? v.end : '', note: v.note.trim() }])
    logActivity('Calendar: added "' + v.title.trim() + '"'); toast('Event added'); setSel(v.start); refresh()
  }
  const edit = async e => {
    const v = await dialog({ title: 'Edit event', confirmText: 'Save', fields: fields(e), validate }); if (!v) return
    saveCalendar(getCalendar().map(x => (x.id === e.id ? { ...x, title: v.title.trim(), type: v.type, start: v.start, end: v.end && v.end !== v.start ? v.end : '', note: v.note.trim() } : x)))
    logActivity('Calendar: updated "' + v.title.trim() + '"'); toast('Event updated'); refresh()
  }
  const del = async e => {
    if (!(await confirmBox('Remove "' + e.title + '" from the calendar?', { title: 'Remove event' }))) return
    saveCalendar(getCalendar().filter(x => x.id !== e.id)); logActivity('Calendar: removed "' + e.title + '"'); toast('Event removed'); refresh()
  }
  const reset = async () => {
    if (!(await confirmBox('Replace the whole calendar with the default 2026-27 calendar? Your changes will be lost.', { title: 'Reset calendar', confirmText: 'Reset' }))) return
    resetCalendar(); logActivity('Calendar reset to default'); toast('Calendar reset'); refresh()
  }
  const exportCsv = () => download('academic-calendar.csv', toCSV([['Title', 'Category', 'Start', 'End', 'Note'], ...[...all].sort((a, b) => a.start.localeCompare(b.start)).map(e => [e.title, EVENT_TYPES[e.type]?.label, e.start, e.end, e.note])]), 'text/csv')

  const EventRow = ({ e, showWhen }) => {
    const t = EVENT_TYPES[e.type] || EVENT_TYPES.event
    return (
      <div className="cal-event" style={{ '--c': t.color }}>
        <div className="cal-event-main"><b>{t.icon} {e.title}</b><small>{range(e)}{showWhen ? ' • ' + when(e, todayKey) : ''}</small>{e.note && <small>{e.note}</small>}</div>
        {admin && !showWhen && <div className="cal-event-actions"><button className="small-btn blue" onClick={() => edit(e)}>Edit</button><button className="small-btn red" onClick={() => del(e)}>Delete</button></div>}
      </div>
    )
  }

  // ---- month grid ----
  const first = new Date(cur.y, cur.m, 1), lead = first.getDay(), dim = new Date(cur.y, cur.m + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  const upcoming = all.filter(e => (e.end || e.start) >= todayKey).sort((a, b) => a.start.localeCompare(b.start))
  const nextHoliday = upcoming.find(e => e.type === 'holiday')
  const selEvents = all.filter(e => covers(e, sel))
  const yearEvents = events.filter(e => e.start.startsWith(String(cur.y)) || (e.end || '').startsWith(String(cur.y))).sort((a, b) => a.start.localeCompare(b.start))
  const byMonth = {}; yearEvents.forEach(e => { const m = e.start.startsWith(String(cur.y)) ? +e.start.slice(5, 7) - 1 : 0; (byMonth[m] ||= []).push(e) })

  return (
    <>
      {nextHoliday && <div className="cal-next">🎉 <span>Next holiday: <b>{nextHoliday.title}</b> • {range(nextHoliday)} • <b>{when(nextHoliday, todayKey)}</b></span></div>}
      <div className="cal-layout">
        <Panel title={view === 'month' ? MONTHS[cur.m] + ' ' + cur.y : 'Year ' + cur.y} desc="Academic dates, exams, holidays and events" icon="📅">
          <div className="toolbar no-print">
            <div className="cal-nav"><button className="small-btn" onClick={() => shift(-1)} aria-label="Previous">◀</button><button className="small-btn" onClick={goToday}>Today</button><button className="small-btn" onClick={() => shift(1)} aria-label="Next">▶</button></div>
            <div className="seg small" style={{ margin: 0 }}><button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button><button className={view === 'year' ? 'on' : ''} onClick={() => setView('year')}>Year list</button></div>
          </div>
          <div className="cal-legend no-print">{Object.entries(EVENT_TYPES).map(([k, t]) => (
            <button key={k} className={'cal-key' + (off.includes(k) ? ' off' : '')} style={{ '--c': t.color }} onClick={() => setOff(o => (o.includes(k) ? o.filter(x => x !== k) : [...o, k]))}><i></i>{t.label}</button>))}</div>
          {view === 'month' ? (
            <div className="cal-grid" key={cur.y + '-' + cur.m}>
              {DOW.map((d, i) => <div key={d} className={'cal-dow' + (i === 0 ? ' sun' : '')}>{d}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="cal-cell blank" />
                const key = ymd(new Date(cur.y, cur.m, d)), evs = events.filter(e => covers(e, key)), hol = evs.some(e => e.type === 'holiday')
                return (
                  <button key={i} className={'cal-cell' + (key === todayKey ? ' today' : '') + (key === sel ? ' sel' : '') + (hol ? ' hol' : '') + (i % 7 === 0 ? ' sun' : '')} onClick={() => setSel(key)} style={{ '--i': i }}>
                    <span className="cal-num">{d}</span>
                    {evs.slice(0, 2).map(e => <span key={e.id} className="cal-chip" style={{ '--c': EVENT_TYPES[e.type]?.color }} title={e.title}>{e.title}</span>)}
                    {evs.length > 2 && <span className="cal-more">+{evs.length - 2} more</span>}
                  </button>)
              })}
            </div>
          ) : (
            <div className="cal-year">
              {Object.keys(byMonth).map(m => (
                <div key={m}><h4>{MONTHS[m]} {cur.y}</h4>{byMonth[m].map(e => <EventRow key={e.id} e={e} />)}</div>))}
              {!yearEvents.length && <p className="empty">No events in {cur.y}.</p>}
            </div>
          )}
          <div className="no-print" style={{ marginTop: 14 }}>
            {admin && <><button className="btn primary" onClick={add}>+ Add event</button>{' '}<button className="btn alt" onClick={exportCsv}>⬇ Export CSV</button>{' '}<button className="btn alt" onClick={reset}>↺ Reset to default</button>{' '}</>}
            <button className="btn alt" onClick={() => window.print()}>🖨️ Print</button>
          </div>
        </Panel>

        <div className="cal-side">
          <Panel title={view === 'month' ? fmtYmd(sel) : 'Selected day'} desc={sel === todayKey ? 'Today' : 'Click any date to see details'} icon="🗓️">
            {selEvents.map(e => <EventRow key={e.id} e={e} />)}
            {!selEvents.length && <p className="empty">No events on this day.</p>}
            {admin && <button className="small-btn blue no-print" onClick={add}>+ Add on this day</button>}
          </Panel>
          <Panel title="Upcoming" desc="Next dates to remember" icon="⏳" style={{ marginTop: 18 }}>
            {upcoming.slice(0, 6).map(e => <EventRow key={e.id} e={e} showWhen />)}
            {!upcoming.length && <p className="empty">Nothing upcoming.</p>}
          </Panel>
        </div>
      </div>
    </>
  )
}
