import { useMemo, useState } from 'react';
import { Donut, GroupBars } from '../components/charts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import { useApp } from '../lib/store';
import { Card, Field, Bar as PBar } from '../components/ui';
import { COLORS, addDays, download, isOverdue, toCSV, today } from '../lib/utils';
export default function Analytics() {
    const { tasks, members, meetings, ratings, log, team, logbooks } = useApp();
    const [from, setFrom] = useState(addDays(-6)), [to, setTo] = useState(addDays(0));
    const inRange = (d) => d >= from && d <= to;
    const sel = tasks.filter((t) => inRange(t.due));
    const mods = [...new Set(tasks.map((t) => t.module))];
    const velocity = useMemo(() => [-21, -14, -7, 0].map((o, i) => { const s = addDays(o - 6), e = addDays(o); const l = tasks.filter((t) => t.due >= s && t.due <= e); return { week: `W-${3 - i}`, planned: l.length, completed: l.filter((t) => t.status === 'Done').length }; }), [tasks]);
    const stat = ['To Do', 'In Progress', 'In Review', 'Done'].map(s => ({ name: s, v: tasks.filter((t) => t.status === s).length }));
    const att = members.map((m) => { const r = meetings.filter((x) => x.attendance[m.id]); const a = r.filter((x) => x.attendance[m.id] === 'Attended').length; return { name: m.name, pct: r.length ? Math.round(a / r.length * 100) : 0 }; });
    const avg = (r) => ((r.reliability + r.quality + r.communication) / 3).toFixed(1);
    const name = (id) => members.find((m) => m.id === id)?.name ?? id;
    const exportCSV = () => { download(`tasks_${from}_to_${to}.csv`, toCSV(sel.map((t) => ({ Title: t.title, Status: t.status, Priority: t.priority, Module: t.module, Due: t.due, Assignee: name(t.assignee), Overdue: isOverdue(t) ? 'Yes' : 'No', Checklist: `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` })))); log('exported a CSV report'); };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16); doc.text(`${team.name} report`, 14, 16);
        doc.setFontSize(10); doc.text(`${from} to ${to}  |  generated ${today()}`, 14, 23);
        autoTable(doc, { startY: 29, head: [['Title', 'Status', 'Priority', 'Module', 'Due', 'Assignee']], body: sel.map(t => [t.title, t.status, t.priority, t.module, t.due, name(t.assignee)]), headStyles: { fillColor: [37, 99, 235] }, styles: { fontSize: 9 } });
        autoTable(doc, { head: [['Member', 'Meeting attendance', 'Avg rating (of 5)']], body: members.map(m => [m.name, `${(att.find(a => a.name === m.name) || {}).pct || 0}%`, (ratings.find(r => r.memberId === m.id) ? avg(ratings.find(r => r.memberId === m.id)) : '-')]), headStyles: { fillColor: [16, 185, 129] }, styles: { fontSize: 9 } });
        autoTable(doc, { head: [['Module', 'Progress']], body: mods.map(m => { const l = tasks.filter(t => t.module === m); return [m, `${Math.round(l.filter(t => t.status === 'Done').length / l.length * 100)}%`]; }), headStyles: { fillColor: [139, 92, 246] }, styles: { fontSize: 9 } });
        doc.save(`report_${from}_to_${to}.pdf`); log('exported a PDF report');
    };
    const exportMD = () => {
        const md = `# ${team.name} report: ${from} to ${to}\n\n## Tasks (${sel.length})\n- Completed: ${sel.filter((t) => t.status === 'Done').length}\n- Overdue: ${sel.filter(isOverdue).length}\n\n${sel.map((t) => `- [${t.status === 'Done' ? 'x' : ' '}] ${t.title} (${t.priority}, due ${t.due}, ${name(t.assignee)})`).join('\n')}\n\n## Meeting attendance\n${att.map(a => `- ${a.name}: ${a.pct}%`).join('\n')}\n\n## Ratings (avg of 3 criteria)\n${ratings.map((r) => `- ${name(r.memberId)}: ${avg(r)}/5`).join('\n')}\n\n## Module progress\n${mods.map(m => { const l = tasks.filter((t) => t.module === m); return `- ${m}: ${Math.round(l.filter((t) => t.status === 'Done').length / l.length * 100)}%`; }).join('\n')}\n\nGenerated ${today()}\n`;
        download(`report_${from}_to_${to}.md`, md, 'text/markdown');
        log('exported a summary report');
    };
    return (<div className="space-y-4">
      <Card title="Reports">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From date"><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)}/></Field>
          <Field label="To date"><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)}/></Field>
          <button className="btn-ghost" onClick={() => { setFrom(addDays(-6)); setTo(addDays(0)); }}>This week</button>
          <button className="btn" onClick={exportPDF}><Download size={14}/>PDF</button><button className="btn-ghost" onClick={exportCSV}><Download size={14}/>CSV</button><button className="btn-ghost" onClick={exportMD}><Download size={14}/>Summary (Markdown)</button>
          <span className="text-sm text-slate-500">{sel.length} tasks in range</span>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Weekly planned vs completed"><div className="h-64"><GroupBars labels={velocity.map(v => v.week)} datasets={[{ label: 'Planned', data: velocity.map(v => v.planned), color: '#93c5fd' }, { label: 'Completed', data: velocity.map(v => v.completed), color: '#2563eb' }]}/></div></Card>
        <Card title="Task completion"><div className="h-64"><Donut legend cutout="60%" data={stat.map((x, i) => ({ label: x.name, value: x.v, color: COLORS[i] }))}/></div></Card>
        <Card title="Module progress">{mods.map(m => { const l = tasks.filter((t) => t.module === m); const p = Math.round(l.filter((t) => t.status === 'Done').length / l.length * 100); return <div key={m} className="mb-3"><div className="mb-1 flex justify-between text-sm"><b>{m}</b><span>{p}%</span></div><PBar value={p}/></div>; })}</Card>
        <Card title="Blocked and attendance">
          <p className="mb-2 text-sm font-semibold">Blockers from logbooks</p>
          <p className="mb-4 text-sm text-slate-600">{logbooks.filter((l) => l.blockers && l.blockers !== 'None').map((l) => `${l.week}: ${l.blockers}`).join('; ') || 'No blockers reported.'}</p>
          <p className="mb-2 text-sm font-semibold">Meeting attendance</p>
          {att.map(a => <div key={a.name} className="mb-2 flex items-center gap-2 text-sm"><span className="w-28 truncate">{a.name}</span><div className="flex-1"><PBar value={a.pct} color="#10b981"/></div><b className="w-10 text-right">{a.pct}%</b></div>)}
        </Card>
      </div>
    </div>);
}
