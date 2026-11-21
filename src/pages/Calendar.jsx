import { useApp } from '../lib/store';
import { Card, Empty, Pill } from '../components/ui';
import { fmt, today } from '../lib/utils';
export default function Calendar() {
    const { tasks, meetings, setEditing } = useApp();
    const items = [
        ...tasks.filter((t) => t.status !== 'Done').map((t) => ({ date: t.due, label: t.title, kind: 'Task', tag: t.priority, t })),
        ...meetings.map((m) => ({ date: m.date, label: m.title, kind: 'Meeting', tag: 'Meeting', t: null })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const groups = items.reduce((g, i) => { var _a; return ((g[_a = i.date] || (g[_a] = [])).push(i), g); }, {});
    return (<Card title="Deadlines and meetings">
      {Object.keys(groups).length === 0 ? <Empty text="No upcoming deadlines."/> : Object.entries(groups).map(([d, list]) => (<div key={d} className="flex gap-4 border-b border-slate-100 py-3 last:border-0">
          <div className="w-24 shrink-0"><p className="font-bold">{fmt(d)}</p><p className={`text-xs ${d < today() ? 'font-bold text-red-500' : d === today() ? 'font-bold text-amber-600' : 'text-slate-500'}`}>{d < today() ? 'Overdue' : d === today() ? 'Today' : ''}</p></div>
          <div className="flex-1 space-y-1.5">{list.map((i, k) => <button key={k} onClick={() => i.t && setEditing(i.t)} className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm"><span className="flex-1 font-semibold">{i.label}</span><span className="text-xs text-slate-500">{i.kind}</span><Pill>{i.tag}</Pill></button>)}</div>
        </div>))}
    </Card>);
}
