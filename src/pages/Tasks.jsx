import { useApp } from '../lib/store';
import Kanban from '../components/Kanban';
import Digest from '../components/Digest';
import { Bar, Card } from '../components/ui';
export default function Tasks() {
    const { vis, tasks } = useApp();
    const mods = [...new Set(tasks.map((t) => t.module))];
    return (<div className="space-y-4">
      <Digest />
      <Card title="My Tasks (Kanban)"><Kanban tasks={vis}/></Card>
      <Card title="Progress by module">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mods.map(m => { const l = tasks.filter((t) => t.module === m); const p = Math.round(l.filter((t) => t.status === 'Done').length / l.length * 100); return <div key={m}><div className="mb-1 flex justify-between text-sm"><b>{m}</b><span>{p}%</span></div><Bar value={p}/></div>; })}
        </div>
      </Card>
    </div>);
}
