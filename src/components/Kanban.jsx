import { useState } from 'react';
import { MoreVertical, Check, ListChecks } from 'lucide-react';
import { useApp } from '../lib/store';
import { STATUSES } from '../lib/constants';
import { PRIORITY_COLOR, fmt, isOverdue } from '../lib/utils';
import { Avatar, Pill } from './ui';
const HEAD = { 'To Do': 'bg-blue-100', 'In Progress': 'bg-amber-100', 'In Review': 'bg-violet-100', Done: 'bg-emerald-100' };
export default function Kanban({ tasks }) {
    const { members, moveTask, setEditing, newTask, canEditTasks } = useApp();
    const [over, setOver] = useState('');
    return (<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {STATUSES.map(s => {
            const col = tasks.filter(t => t.status === s);
            return (<div key={s} onDragOver={e => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver('')} onDrop={e => { moveTask(e.dataTransfer.getData('id'), s); setOver(''); }} className={`rounded-xl p-2 ${over === s ? 'bg-blue-50' : 'bg-slate-50'}`}>
            <div className={`mb-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${HEAD[s]}`}>{s}<span className="rounded-full bg-white/70 px-2 text-xs">{col.length}</span></div>
            <div className="space-y-2">
              {col.map(t => {
                    const i = members.findIndex((m) => m.id === t.assignee);
                    const done = t.subtasks.filter(x => x.done).length;
                    return (<div key={t.id} draggable onDragStart={e => e.dataTransfer.setData('id', t.id)} onClick={() => setEditing(t)} className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-[13px] font-semibold"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }}/>{t.title}</div>
                      <MoreVertical size={14} className="shrink-0 text-slate-400"/>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1"><Pill>{t.category}</Pill>{t.priority === 'High' && <Pill>High</Pill>}</div>
                    {t.subtasks.length > 0 && (<div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500"><ListChecks size={12}/>{done}/{t.subtasks.length}<div className="h-1 flex-1 rounded bg-slate-100"><div className="h-1 rounded bg-blue-500" style={{ width: `${(done / t.subtasks.length) * 100}%` }}/></div></div>)}
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[11px] ${isOverdue(t) ? 'font-bold text-red-500' : 'text-slate-500'}`}>{fmt(t.due)}{isOverdue(t) && ' overdue'}</span>
                      {s === 'Done' ? <Check size={16} className="rounded-full bg-emerald-500 p-0.5 text-white"/> : <Avatar name={members[i]?.name ?? '?'} i={i} size={24}/>}
                    </div>
                  </div>);
                })}
            </div>
            {canEditTasks && <button onClick={() => setEditing(newTask(s))} className="mt-2 w-full py-1 text-sm font-semibold text-blue-600 hover:underline">+ Add Task</button>}
          </div>);
        })}
    </div>);
}
