import { X } from 'lucide-react';
import { AVATAR_BG, initials } from '../lib/utils';
export const Avatar = ({ name, i = 0, size = 28 }) => (<span className={`inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${AVATAR_BG[i % AVATAR_BG.length]}`} style={{ width: size, height: size }}>{initials(name || '?')}</span>);
const PILL = { Design: 'bg-blue-50 text-blue-600', 'UI/UX': 'bg-violet-50 text-violet-600', Research: 'bg-emerald-50 text-emerald-600', Review: 'bg-violet-50 text-violet-600', Meeting: 'bg-amber-50 text-amber-600', Finance: 'bg-emerald-50 text-emerald-600', Development: 'bg-amber-50 text-amber-600', High: 'bg-red-50 text-red-500', Medium: 'bg-amber-50 text-amber-600', Low: 'bg-blue-50 text-blue-600', Approved: 'bg-emerald-50 text-emerald-600', Pending: 'bg-amber-50 text-amber-600', 'Needs Changes': 'bg-red-50 text-red-500', Submitted: 'bg-blue-50 text-blue-600', Draft: 'bg-slate-100 text-slate-600' };
export const Pill = ({ children }) => <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${PILL[children] ?? 'bg-slate-100 text-slate-600'}`}>{children}</span>;
export const Bar = ({ value, color = '#2563eb' }) => (<div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }}/></div>);
export const Card = ({ title, action, children, className = '' }) => (<section className={`card p-4 ${className}`}>
    {title && <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold">{title}</h3>{action}</div>}
    {children}
  </section>);
export const Modal = ({ title, onClose, children, wide }) => (<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
    <div className={`card max-h-[90vh] w-full overflow-auto p-5 ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onClick={e => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} aria-label="Close"><X size={18}/></button></div>
      {children}
    </div>
  </div>);
export const Field = ({ label, children }) => <label className="block text-xs font-semibold text-slate-500">{label}<div className="mt-1 font-normal">{children}</div></label>;
export const Empty = ({ text }) => <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">{text}</p>;
