import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '../lib/store';
import { isOverdue, isSoon, isToday } from '../lib/utils';
/** Overdue / Due today / Due soon / Completed reminder strip */
export default function Digest() {
    const { tasks, setEditing, account } = useApp();
    const o = tasks.filter(isOverdue), d = tasks.filter(isToday), s = tasks.filter(isSoon), c = tasks.filter((t) => t.status === 'Done');
    return (<div className="space-y-2">
      {account.status !== 'approved' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Your registration is <b>{account.status}</b>. Editing is locked until an admin or coordinator approves it (Settings → Approval queue).</div>}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[{ l: 'Overdue', n: o, c: 'text-red-600 bg-red-50', I: AlertTriangle }, { l: 'Due today', n: d, c: 'text-amber-600 bg-amber-50', I: Clock }, { l: 'Due soon (3 days)', n: s, c: 'text-blue-600 bg-blue-50', I: Clock }, { l: 'Completed', n: c, c: 'text-emerald-600 bg-emerald-50', I: CheckCircle2 }].map(x => (<div key={x.l} className={`rounded-xl p-3 ${x.c}`}>
            <p className="flex items-center gap-2 text-sm font-bold"><x.I size={15}/>{x.l}<span className="ml-auto text-lg">{x.n.length}</span></p>
            <p className="mt-1 truncate text-xs opacity-80">{x.n.slice(0, 2).map((t) => t.title).join(', ') || 'Nothing here'}</p>
          </div>))}
      </div>
    </div>);
}
