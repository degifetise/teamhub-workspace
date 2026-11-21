import { useState } from 'react';
import { useApp } from '../lib/store';
import { Card, Empty, Field, Pill } from '../components/ui';
import { pastProjects } from '../lib/seed';
import { similarity, uid } from '../lib/utils';
import { SIMILARITY_LEVELS } from '../lib/constants';
export default function Proposals() {
    const { terms, proposals, saveProposal, deleteProposal, logbooks, setLogbooks, saveLog, reviewLog, flash, log, canEdit, canReviewLogs, canManageMembers, session, demoMode } = useApp();
    const [f, setF] = useState({ title: '', abstract: '' });
    const [res, setRes] = useState(null);
    const [lb, setLb] = useState({ week: '', finished: '', next: '', blockers: '' });
    const [reviewNotes, setReviewNotes] = useState({});
    const reviewer = canReviewLogs;
    const proposalReviewer = canManageMembers;
    const check = () => {
        const pool = [...(demoMode ? pastProjects : []), ...proposals.map((p) => ({ title: p.title, abstract: p.abstract }))];
        setRes(pool.map(p => ({ title: p.title, score: Math.max(similarity(f.title, p.title), similarity(f.title + ' ' + f.abstract, p.title + ' ' + p.abstract)) })).sort((a, b) => b.score - a.score).slice(0, 4));
    };
    const top = res?.[0]?.score ?? 0;
    const submit = (status) => {
        if (!canEdit)
            return flash('Your account is pending approval.');
        const proposal = f.id ? { ...f, status } : { id: uid(), ...f, status };
        saveProposal(proposal);
        setF({ title: '', abstract: '' });
        setRes(null);
        log(`${status === 'Draft' ? 'saved a draft of' : 'submitted'} a ${terms.deliverable.toLowerCase()}`);
        flash(status === 'Draft' ? 'Draft saved' : 'Submitted for review');
    };
    const review = (entry, status) => reviewLog(entry.id, status, reviewNotes[entry.id] || entry.note || (status === 'Approved' ? 'Reviewed.' : 'Please revise and resubmit.'));
    const setPStatus = (proposal, status) => saveProposal({ ...proposal, status });
    return (<div className="grid gap-4 xl:grid-cols-2">
      <Card title={`New ${terms.deliverable}`}>
        <div className="space-y-3">
          <Field label="Title"><input className="input" disabled={!canEdit} value={f.title} onChange={e => setF({ ...f, title: e.target.value })}/></Field>
          <Field label="Abstract / keywords"><textarea className="input h-24" disabled={!canEdit} value={f.abstract} onChange={e => setF({ ...f, abstract: e.target.value })}/></Field>
          <button className="btn-ghost" disabled={!f.title.trim()} onClick={check}>Run similarity check</button>
          {res && <div className="rounded-xl border border-slate-200 p-3">
            <p className={`mb-2 text-sm font-bold ${top >= SIMILARITY_LEVELS.high ? 'text-red-600' : top >= SIMILARITY_LEVELS.review ? 'text-amber-600' : 'text-emerald-600'}`}>{top >= SIMILARITY_LEVELS.high ? 'High overlap. Revise before submitting.' : top >= SIMILARITY_LEVELS.review ? 'Some overlap. Review the matches.' : 'No significant overlap found.'}</p>
            {res.map(r => <div key={r.title} className="flex justify-between py-0.5 text-sm"><span className="truncate pr-2">{r.title}</span><b>{r.score}%</b></div>)}
          </div>}
          <div className="flex gap-2"><button className="btn-ghost" disabled={!f.title.trim()} onClick={() => submit('Draft')}>Save draft</button><button className="btn" disabled={!f.title.trim() || !res} onClick={() => submit('Submitted')}>Submit</button></div>
          {!res && f.title && <p className="text-xs text-slate-500">Run the similarity check before submitting.</p>}
        </div>
        <h4 className="mb-2 mt-5 text-sm font-bold">{terms.proposals}</h4>
        {proposals.length === 0 ? <Empty text="Nothing yet. Draft your first one above."/> : proposals.map((p) => (<div key={p.id} className="mb-2 rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><b className="text-sm">{p.title}</b><Pill>{p.status}</Pill></div><p className="mt-1 text-xs text-slate-500">{p.abstract}</p>
            {p.status === 'Draft' && canEdit && <div className="mt-2 flex gap-2"><button className="btn-ghost" onClick={() => { setF({ id: p.id, title: p.title, abstract: p.abstract }); setRes(null); }}>Edit draft</button><button className="btn-ghost text-red-600" onClick={() => deleteProposal(p.id)}>Delete draft</button></div>}
            {proposalReviewer && p.status === 'Submitted' && <div className="mt-2 flex gap-2"><button className="btn-ghost" onClick={() => setPStatus(p, 'Approved')}>Approve</button><button className="btn-ghost" onClick={() => setPStatus(p, 'Needs Changes')}>Needs changes</button></div>}</div>))}
      </Card>
      <Card title={terms.logbook}>
        <div className="grid gap-3">
          <Field label="Week"><input className="input" disabled={!canEdit} placeholder="Week label" value={lb.week} onChange={e => setLb({ ...lb, week: e.target.value })}/></Field>
          <Field label="What I finished"><textarea className="input" disabled={!canEdit} value={lb.finished} onChange={e => setLb({ ...lb, finished: e.target.value })}/></Field>
          <Field label="What's next"><textarea className="input" disabled={!canEdit} value={lb.next} onChange={e => setLb({ ...lb, next: e.target.value })}/></Field>
          <Field label="Blockers"><textarea className="input" disabled={!canEdit} value={lb.blockers} onChange={e => setLb({ ...lb, blockers: e.target.value })}/></Field>
          <button className="btn" disabled={!lb.week || !lb.finished || !canEdit} onClick={() => { const logEntry = lb.id ? { ...lb, status: lb.status ?? 'Pending' } : { id: uid(), ...lb, status: 'Pending' }; saveLog(logEntry); setLb({ week: '', finished: '', next: '', blockers: '' }); flash(lb.id ? 'Logbook updated' : 'Logbook submitted'); }}>{lb.id ? 'Save changes' : 'Submit logbook'}</button>
        </div>
        <div className="mt-5 space-y-2">{logbooks.map((l) => (<div key={l.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex items-center justify-between"><b>{l.week}</b><Pill>{l.status}</Pill></div>
            <p className="mt-1"><span className="text-slate-500">Finished:</span> {l.finished}</p><p><span className="text-slate-500">Next:</span> {l.next}</p><p><span className="text-slate-500">Blockers:</span> {l.blockers || 'None'}</p>
            {l.note && <p className="mt-1 text-xs italic text-slate-500">{terms.advisor}: {l.note}</p>}
            {(demoMode || l.status === 'Pending' && l.authorId === session?.user?.id) && <div className="mt-2"><button className="btn-ghost" onClick={() => setLb({ id: l.id, week: l.week, finished: l.finished, next: l.next, blockers: l.blockers, status: l.status })}>Edit</button></div>}
            {reviewer && l.status === 'Pending' && <div className="mt-2 flex gap-2"><button className="btn-ghost" onClick={() => review(l, 'Approved')}>Approve</button><button className="btn-ghost" onClick={() => review(l, 'Needs Changes')}>Needs changes</button><input className="input flex-1" placeholder="Review note" value={reviewNotes[l.id] ?? l.note ?? ''} onChange={e => setReviewNotes(p => ({ ...p, [l.id]: e.target.value }))}/></div>}</div>))}
        </div>
        {!reviewer && <p className="mt-3 text-xs text-slate-500">Only the linked {terms.advisor.toLowerCase()} can approve or request changes to logbooks.</p>}
      </Card>
    </div>);
}
