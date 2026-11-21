export const iso = (d) => d.toISOString().slice(0, 10);
export const today = () => iso(new Date());
export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
export const fmt = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const initials = (n) => n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2, 10));
export const genCode = () => 'PPMS-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
export const PRIORITY_COLOR = { High: '#ef4444', Medium: '#f59e0b', Low: '#2563eb' };
export const COLORS = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
export const AVATAR_BG = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2));
/** Jaccard similarity between two texts, 0-100 */
export function similarity(a, b) {
    const A = words(a), B = words(b);
    if (!A.size || !B.size)
        return 0;
    let i = 0;
    A.forEach(w => B.has(w) && i++);
    return Math.round((i / (A.size + B.size - i)) * 100);
}
export function toCSV(rows) {
    if (!rows.length)
        return '';
    const cols = Object.keys(rows[0]);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}
export function download(name, content, type = 'text/csv') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}
export const isOverdue = (t) => !!t.due && t.status !== 'Done' && t.due < today();
export const isToday = (t) => !!t.due && t.status !== 'Done' && t.due === today();
export const isSoon = (t) => !!t.due && t.status !== 'Done' && t.due > today() && t.due <= addDays(3);
