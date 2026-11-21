import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Lock, Trash2, UserPlus } from 'lucide-react';
import { useApp } from '../lib/store';
import { Avatar, Bar, Card, Field, Pill } from '../components/ui';
import { ROLES } from '../lib/constants';
import { uid, fmt } from '../lib/utils';
const ATT = ['Attended', 'Not Attended', 'Excused'];
export default function TeamPage() {
    const { team, saveWorkspace, deleteWorkspace, regenerateCode, setJoinLock, members, tasks, terms, removeMember, addMember, saveMember, flash, mode, canManageMembers, canManageWorkspace, createWorkspace, joinWorkspace, session } = useApp();
    const [tab, setTab] = useState('members');
    const [name, setName] = useState(''), [code, setCode] = useState('');
    const [nm, setNm] = useState({ email: '', role: 'Frontend' });
    const [advisor, setAdvisor] = useState(team?.advisor || { name: '', email: '' });
    useEffect(() => setAdvisor(team?.advisor || { name: '', email: '' }), [team?.id]);
    const lead = canManageMembers;
    const create = async () => { if (!name.trim()) return; try { await createWorkspace(name.trim(), mode, {}); setName(''); flash('Team created. You are the owner.'); } catch (error) { flash(error.message); } };
    const join = async () => {
        const c = code.trim().toUpperCase();
        if (!c)
            return;
        if (c === team.code)
            return flash('You are already in this team.');
        try { await joinWorkspace(c); flash('Joined team'); } catch (error) { flash(error.message); }
    };
    return (<div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Your team">
          <p className="text-lg font-bold">{team.name}</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2"><code className="flex-1 text-sm font-bold">{team.code}</code>
            <button aria-label="Copy code" className="btn-ghost" onClick={() => { navigator.clipboard?.writeText(team.code); flash('Code copied'); }}><Copy size={14}/></button>
            {lead && <><button aria-label="Regenerate code" className="btn-ghost" onClick={() => regenerateCode().catch(error => flash(error.message))}><RefreshCw size={14}/></button>
              <button aria-label="Lock code" className={`btn-ghost ${team.locked ? 'text-red-600' : ''}`} onClick={() => setJoinLock(!team.locked)}><Lock size={14}/></button></>}</div>
          {team.locked && <p className="mt-1 text-xs text-red-600">Code locked: no new members can join.</p>}
        </Card>
        <Card title="Create a team"><div className="flex gap-2"><input className="input" placeholder="Team name" value={name} onChange={e => setName(e.target.value)}/><button className="btn" onClick={create}>Create</button></div></Card>
        <Card title="Join with code"><div className="flex gap-2"><input className="input" placeholder="PPMS-XXXX-0000" value={code} onChange={e => setCode(e.target.value)}/><button className="btn" onClick={join}>Join</button></div></Card>
      </div>
      <Card title={`${terms.advisor}`}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Name"><input className="input" disabled={!canManageWorkspace} value={advisor.name} onChange={e => setAdvisor({ ...advisor, name: e.target.value })}/></Field>
          <Field label="Email (confirmed email links advisor access)"><input className="input" disabled={!canManageWorkspace} type="email" value={advisor.email} onChange={e => setAdvisor({ ...advisor, email: e.target.value.trim().toLowerCase() })}/></Field></div>
        <div className="mt-3 flex gap-2">{canManageWorkspace && <><button className="btn" onClick={() => saveWorkspace({ advisor })}>Save advisor link</button><button className="btn-ghost text-red-600" onClick={deleteWorkspace}>Delete workspace</button></>}</div>
      </Card>
      <div className="flex gap-2">{['members', 'meetings', 'ratings'].map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-white'}`}>{t}</button>)}</div>
      {tab === 'members' && <Card title="Members and workload">
        {members.map((m, i) => {
                const open = tasks.filter((t) => t.assignee === m.id && t.status !== 'Done').length;
                return (<div key={m.id} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0"><Avatar name={m.name} i={i} size={34}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{m.name}</p><p className="truncate text-xs text-slate-500">{m.email}</p></div>
            {lead && m.role !== 'Advisor' && <select className="input w-32" value={m.role} onChange={e => saveMember({ ...m, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>}
            {m.role !== 'Advisor' && <div className="hidden w-32 sm:block"><p className="text-xs text-slate-500">{open}/{m.capacity} open tasks</p><Bar value={m.capacity ? open / m.capacity * 100 : 0}/></div>}
            {lead && members.length > 1 && m.id !== session?.user?.id && m.role !== 'Advisor' && <button aria-label="Remove member" onClick={() => removeMember(m.id)}><Trash2 size={15} className="text-slate-400"/></button>}</div>);
            })}
        {lead && <div className="mt-3 flex flex-wrap gap-2"><input className="input w-52" placeholder="Registered member email" type="email" value={nm.email} onChange={e => setNm({ ...nm, email: e.target.value })}/>
          <select className="input w-32" value={nm.role} onChange={e => setNm({ ...nm, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
          <button className="btn" disabled={!nm.email} onClick={() => { addMember(nm.email, nm.role).then(added => { if (added) setNm({ email: '', role: 'Frontend' }); }); }}><UserPlus size={14}/>Add member</button></div>}
        <p className="mt-2 text-xs text-slate-500">Removing a member revokes access, keeps their past contributions and moves their open tasks to the team lead.</p>
      </Card>}
      {tab === 'meetings' && <Meetings />}
      {tab === 'ratings' && <Ratings />}
    </div>);
}
function Meetings() {
    const { meetings, setMeetings, saveMeeting, deleteMeeting, members, setEditing, newTask, flash, canEdit } = useApp();
    const [f, setF] = useState({ title: '', date: new Date().toISOString().slice(0, 10), agenda: '', notes: '', actions: '' });
    return (<div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card title="Log a meeting"><div className="space-y-3">
        <Field label="Title"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })}/></Field>
        <Field label="Date"><input type="date" className="input" value={f.date} onChange={e => setF({ ...f, date: e.target.value })}/></Field>
        <Field label="Agenda"><textarea className="input" value={f.agenda} onChange={e => setF({ ...f, agenda: e.target.value })}/></Field>
        <Field label="Notes"><textarea className="input" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })}/></Field>
        <Field label="Action items (one per line)"><textarea className="input" value={f.actions} onChange={e => setF({ ...f, actions: e.target.value })}/></Field>
        <button className="btn" disabled={!f.title || !canEdit} onClick={() => { saveMeeting({ id: uid(), ...f, actions: f.actions.split('\n').filter(Boolean), attendance: {} }); setF({ ...f, title: '', agenda: '', notes: '', actions: '' }); flash('Meeting saved'); }}>Save meeting</button></div></Card>
      <div className="space-y-3">{meetings.map((m) => {
            const rec = Object.values(m.attendance);
            const pct = rec.length ? Math.round(rec.filter(x => x === 'Attended').length / rec.length * 100) : 0;
            return (<Card key={m.id}><div className="flex items-center justify-between"><b>{m.title}</b><span className="text-xs text-slate-500">{fmt(m.date)} · {pct}% attended</span></div>
          {canEdit && <div className="mt-2 flex gap-2"><button className="btn-ghost" onClick={() => setMeetings(l => l.map(x => x.id === m.id ? { ...x, editing: !x.editing } : x))}>Edit</button><button className="btn-ghost text-red-600" onClick={() => deleteMeeting(m.id)}>Delete</button></div>}
          {m.editing && canEdit && <div className="mt-2 grid gap-2 sm:grid-cols-2"><Field label="Title"><input className="input" value={m.title} onChange={e => setMeetings(l => l.map(x => x.id === m.id ? { ...x, title: e.target.value } : x))}/></Field><Field label="Date"><input type="date" className="input" value={m.date} onChange={e => setMeetings(l => l.map(x => x.id === m.id ? { ...x, date: e.target.value } : x))}/></Field><Field label="Agenda"><textarea className="input" value={m.agenda} onChange={e => setMeetings(l => l.map(x => x.id === m.id ? { ...x, agenda: e.target.value } : x))}/></Field><Field label="Notes"><textarea className="input" value={m.notes} onChange={e => setMeetings(l => l.map(x => x.id === m.id ? { ...x, notes: e.target.value } : x))}/></Field><button className="btn" onClick={() => { saveMeeting({ ...m, editing: false }); }}>Save changes</button></div>}
          {m.agenda && <p className="mt-1 text-sm"><span className="text-slate-500">Agenda:</span> {m.agenda}</p>}{m.notes && <p className="text-sm"><span className="text-slate-500">Notes:</span> {m.notes}</p>}
          {m.actions.map((a, i) => <div key={i} className="mt-1 flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-sm">{a}<button className="text-xs font-semibold text-blue-600" onClick={() => setEditing({ ...newTask(), title: a })}>Make task</button></div>)}
          <div className="mt-3 space-y-1">{members.map((p) => <div key={p.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{p.name}</span>
            <select disabled={!canEdit} className="input w-36 py-1" value={m.attendance[p.id] ?? ''} onChange={e => { const next = { ...m, attendance: { ...m.attendance, [p.id]: e.target.value } }; setMeetings(l => l.map(x => x.id === m.id ? next : x)); saveMeeting(next); }}><option value="">Not marked</option>{ATT.map(a => <option key={a}>{a}</option>)}</select></div>)}</div></Card>);
        })}</div>
    </div>);
}
function Ratings() {
    const { ratings, setRatings, saveRating, deleteRating, members, canEdit } = useApp();
    const upd = (id, k, v) => setRatings((p) => p.map((r) => r.memberId === id ? { ...r, [k]: v } : r));
    const crit = [['reliability', 'Task and deadline reliability'], ['quality', 'Work quality and collaboration'], ['communication', 'Attendance and communication']];
    return (<div className="grid gap-4 md:grid-cols-2">{members.map((m, i) => {
            const r = ratings.find((x) => x.memberId === m.id) ?? { memberId: m.id, reliability: 3, quality: 3, communication: 3, note: '' };
            return (<Card key={m.id}><div className="mb-3 flex items-center gap-2"><Avatar name={m.name} i={i}/><b>{m.name}</b><Pill>{m.role}</Pill></div>
        {crit.map(([k, l]) => <div key={k} className="mb-2 flex items-center justify-between text-sm"><span>{l}</span><div className="flex gap-1">{[1, 2, 3, 4, 5].map(n => <button disabled={!canEdit} key={n} aria-label={`${n} stars`} onClick={() => { const next = { ...r, [k]: n }; if (!ratings.some((x) => x.memberId === m.id)) setRatings((p) => [...p, next]); else upd(m.id, k, n); saveRating(next); }} className={`h-6 w-6 rounded text-xs font-bold disabled:opacity-50 ${n <= r[k] ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</button>)}</div></div>)}
        <textarea disabled={!canEdit} className="input mt-1" placeholder="Constructive note" value={r.note} onChange={e => upd(m.id, 'note', e.target.value)} onBlur={() => saveRating({ ...r, note: r.note })}/>{canEdit && <button className="btn-ghost mt-2 text-red-600" onClick={() => deleteRating(m.id)}>Delete rating</button>}</Card>);
        })}</div>);
}
