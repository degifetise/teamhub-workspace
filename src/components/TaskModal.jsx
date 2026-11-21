import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store';
import { STATUSES } from '../lib/constants';
import { Field, Modal } from './ui';
export default function TaskModal() {
    const { editing, setEditing, saveTask, deleteTask, members, tasks, canEditTasks, canDeleteTasks } = useApp();
    const [t, setT] = useState({ ...editing });
    const [sub, setSub] = useState('');
    const set = (k, v) => setT((p) => ({ ...p, [k]: v }));
    const exists = tasks.some((x) => x.id === t.id);
    const done = t.subtasks.filter((s) => s.done).length;
    return (<Modal title={exists ? 'Edit task' : 'New task'} onClose={() => setEditing(null)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title"><input className="input" autoFocus value={t.title} onChange={e => set('title', e.target.value)}/></Field></div>
        <Field label="Status"><select className="input" value={t.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority"><select className="input" value={t.priority} onChange={e => set('priority', e.target.value)}>{['High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Category tag"><input className="input" value={t.category} onChange={e => set('category', e.target.value)}/></Field>
        <Field label="Module"><input className="input" value={t.module} onChange={e => set('module', e.target.value)}/></Field>
        <Field label="Due date"><input type="date" className="input" value={t.due} onChange={e => set('due', e.target.value)}/></Field>
        <Field label="Assignee"><select className="input" value={t.assignee} onChange={e => set('assignee', e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-slate-500">Checklist {t.subtasks.length > 0 && `(${done}/${t.subtasks.length} · ${Math.round((done / t.subtasks.length) * 100)}%)`}</p>
        {t.subtasks.map((s, i) => (<div key={i} className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={s.done} onChange={() => set('subtasks', t.subtasks.map((x, j) => j === i ? { ...x, done: !x.done } : x))}/>
            <input className={`min-w-0 flex-1 border-0 bg-transparent text-sm outline-none ${s.done ? 'text-slate-400 line-through' : ''}`} value={s.t} onChange={e => set('subtasks', t.subtasks.map((x, j) => j === i ? { ...x, t: e.target.value } : x))}/>
            <button onClick={() => set('subtasks', t.subtasks.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={14} className="text-slate-400"/></button>
          </div>))}
        <div className="mt-1 flex gap-2">
          <input className="input" placeholder="Add checklist item" value={sub} onChange={e => setSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && sub.trim()) {
        set('subtasks', [...t.subtasks, { t: sub.trim(), done: false }]);
        setSub('');
    } }}/>
          <button className="btn-ghost" onClick={() => { if (sub.trim()) {
        set('subtasks', [...t.subtasks, { t: sub.trim(), done: false }]);
        setSub('');
    } }}><Plus size={14}/></button>
        </div>
      </div>
      <div className="mt-5 flex justify-between">
        {exists && canDeleteTasks ? <button className="btn-ghost text-red-600" onClick={() => { if (window.confirm(`Delete "${t.title}"?`)) { deleteTask(t.id); setEditing(null); } }}>Delete</button> : <span />}
        {canEditTasks && <button className="btn" disabled={!t.title.trim()} onClick={() => { saveTask(t); setEditing(null); }}>Save task</button>}
      </div>
    </Modal>);
}
