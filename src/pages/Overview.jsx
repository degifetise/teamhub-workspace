import { Calendar, CheckCircle2, Activity, ListTodo } from 'lucide-react';
import { Donut, MiniBars } from '../components/charts';
import { useApp } from '../lib/store';
import Kanban from '../components/Kanban';
import Digest from '../components/Digest';
import { Avatar, Card, Pill } from '../components/ui';
import { fmt, isOverdue, isSoon, isToday, today } from '../lib/utils';
export default function Overview() {
    const { tasks, vis, members, activity, moveTask, setPage, setEditing, canEditTasks } = useApp();
    const n = (s) => tasks.filter((t) => t.status === s).length;
    const total = tasks.length, done = n('Done'), prog = n('In Progress'), todo = n('To Do'), rev = n('In Review');
    const pct = (x) => total ? Math.round((x / total) * 100) : 0;
    const donut = [{ name: 'Completed', v: done, c: '#2563eb' }, { name: 'In Progress', v: prog, c: '#f59e0b' }, { name: 'To Do', v: todo, c: '#fde68a' }, { name: 'In Review', v: rev, c: '#8b5cf6' }];
    const week = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = date.toISOString().slice(0, 10);
        return { d: index, v: tasks.filter(task => task.due === key).length };
    });
    const todays = tasks.filter((t) => t.due === today() || isOverdue(t)).slice(0, 6);
    const upcoming = tasks.filter((t) => t.status !== 'Done' && t.due >= today()).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
    const pr = (p) => tasks.filter((t) => t.priority === p).length;
    const load = members.filter(m => m.role !== 'Advisor').map((m) => ({ m, pct: m.capacity ? Math.min(100, Math.round(tasks.filter((t) => t.assignee === m.id && t.status !== 'Done').length / m.capacity * 100)) : 0 }));
    const cap = Math.round(load.reduce((a, x) => a + x.pct, 0) / Math.max(1, load.length));
    const kpis = [
        { l: 'Total Tasks', v: total, s: `${tasks.filter(isSoon).length + tasks.filter(isToday).length} due soon`, I: Calendar, c: 'bg-blue-100 text-blue-600' },
        { l: 'In Progress', v: prog, s: `${tasks.filter(isToday).length} due today`, I: Activity, c: 'bg-emerald-100 text-emerald-600' },
        { l: 'Completed', v: done, s: `${pct(done)}% of all tasks`, I: CheckCircle2, c: 'bg-violet-100 text-violet-600' },
        { l: 'Overdue', v: tasks.filter(isOverdue).length, s: 'needs attention', I: ListTodo, c: 'bg-red-100 text-red-500' },
    ];
    return (<div className="space-y-4">
      <Digest />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {kpis.map(k => (<div key={k.l} className="card flex items-center gap-3 p-3"><span className={`rounded-xl p-3 ${k.c}`}><k.I size={22}/></span>
                <div><p className="text-xs font-semibold text-slate-500">{k.l}</p><p className="text-2xl font-extrabold leading-tight">{k.v}</p><p className="text-[11px] font-semibold text-emerald-600">{k.s}</p></div></div>))}
          </div>
          <Card title="My Tasks (Kanban)" action={<button className="text-sm font-semibold text-blue-600" onClick={() => setPage('tasks')}>Open board</button>}><Kanban tasks={vis}/></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Task Timeline (Recent Activity)" action={<button className="text-sm font-semibold text-blue-600">View All</button>}>
              <ul className="space-y-3">{activity.slice(0, 5).map((a, i) => (<li key={a.id} className="flex items-center gap-3 text-sm"><span className="w-10 text-xs text-slate-400">{a.time}</span><Avatar name={a.who} i={i}/><span className="min-w-0 flex-1 truncate"><b>{a.who.split(' ')[0]}</b> {a.text}</span></li>))}</ul>
            </Card>
            <Card title="Team Workload" action={<span className="text-sm text-slate-500">This Week</span>}>
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1 space-y-2.5">{load.map((x, i) => (<div key={x.m.id} className="flex items-center gap-2 text-xs"><Avatar name={x.m.name} i={i} size={22}/><span className="w-20 truncate font-semibold">{x.m.name}</span><div className="flex-1"><Bar2 v={x.pct}/></div><span className="w-8 text-right font-semibold">{x.pct}%</span></div>))}</div>
                <div className="relative h-28 w-28 shrink-0"><Donut cutout="78%" data={[{ label: 'Used', value: cap, color: '#2563eb' }, { label: 'Free', value: 100 - cap, color: '#cbd5e1' }]}/>
                  <div className="absolute inset-0 flex flex-col items-center justify-center"><b className="text-lg">{cap}%</b><span className="text-[10px] text-slate-500">Capacity</span></div></div>
              </div>
            </Card>
          </div>
        </div>
        <div className="space-y-4">
          <Card title="Task Completion">
            <div className="flex items-center gap-3">
              <div className="h-28 w-28 shrink-0"><Donut data={donut.map(d => ({ label: d.name, value: d.v, color: d.c }))}/></div>
              <ul className="flex-1 space-y-1 text-xs">{donut.map(d => <li key={d.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: d.c }}/>{d.name}<b className="ml-auto">{pct(d.v)}%</b></li>)}</ul>
            </div>
            <div className="mt-2 h-14"><MiniBars values={week.map(w => w.v)}/></div>
          </Card>
          <Card title="Today's Tasks" action={<button className="text-sm font-semibold text-blue-600" onClick={() => setPage('tasks')}>View All</button>}>
            {todays.length === 0 ? <p className="text-sm text-slate-400">Nothing due today.</p> : <ul className="space-y-2.5">{todays.map((t) => (<li key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!canEditTasks} checked={t.status === 'Done'} onChange={() => moveTask(t.id, t.status === 'Done' ? 'To Do' : 'Done')}/>
                <button className="min-w-0 flex-1 truncate text-left" onClick={() => setEditing(t)}>{t.title}</button><Pill>{t.category}</Pill><span className="w-16 text-right text-xs text-slate-500">{t.time ?? fmt(t.due)}</span></li>))}</ul>}
          </Card>
          <Card title="Upcoming">
            <ul className="space-y-3">{upcoming.map((t) => <li key={t.id} className="flex items-center gap-3 text-sm"><Calendar size={15} className="text-blue-500"/><span className="w-12 text-slate-500">{fmt(t.due)}</span><span className="flex-1 truncate font-semibold">{t.title}</span><Pill>{t.priority}</Pill></li>)}</ul>
          </Card>
          <Card title="Priority Overview">
            <div className="grid grid-cols-3 gap-2 text-center">{[['High', 'bg-red-100 text-red-600'], ['Medium', 'bg-amber-100 text-amber-600'], ['Low', 'bg-blue-100 text-blue-600']].map(([p, c]) => <div key={p} className={`rounded-lg p-3 ${c}`}><p className="text-xs font-semibold">{p}</p><p className="text-2xl font-extrabold text-slate-900">{pr(p)}</p></div>)}</div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full">{[['High', '#ef4444'], ['Medium', '#f59e0b'], ['Low', '#2563eb']].map(([p, c]) => <div key={p} style={{ width: `${total ? (pr(p) / total) * 100 : 0}%`, background: c }}/>)}</div>
            <p className="mt-2 text-xs text-slate-500">Total: {total} Tasks</p>
          </Card>
        </div>
      </div>
    </div>);
}
const Bar2 = ({ v }) => <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${v}%` }}/></div>;
