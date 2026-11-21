import { useRef, useState } from 'react';
import { Download, Eye, Upload, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store';
import { Card, Empty, Modal, Pill } from '../components/ui';
import { TAGS } from '../lib/constants';
import * as db from '../lib/db';
import { isConfigured } from '../lib/supabase';
import { fmt, today, uid } from '../lib/utils';
export default function Documents() {
    const { docs, setDocs, saveDocument, deleteDocument, team, flash, log, canEdit } = useApp();
    const [tag, setTag] = useState('Report'), [fTag, setFTag] = useState('All'), [q, setQ] = useState('');
    const [view, setView] = useState(null);
    const [editingDoc, setEditingDoc] = useState(null);
    const ref = useRef(null);
    const list = docs.filter((d) => (fTag === 'All' || d.tag === fTag) && d.name.toLowerCase().includes(q.toLowerCase()));
    const onFile = async (f) => {
        if (!f)
            return;
        if (!canEdit)
            return flash('Your account is pending approval.');
        try {
          if (isConfigured) {
            const uploaded = await db.uploadFile(team.id, f, tag)
            setDocs(p => [{ id: uploaded.id, name: uploaded.name, tag: uploaded.tag, size: uploaded.size_bytes, type: uploaded.mime_type, url: uploaded.url, storage_path: uploaded.storage_path, date: uploaded.created_at.slice(0, 10) }, ...p])
          } else setDocs(p => [{ id: uid(), name: f.name, tag, size: f.size, type: f.type, url: URL.createObjectURL(f), date: today() }, ...p])
          log(`uploaded ${f.name}`)
          flash('Uploaded')
        } catch (error) { flash(`Upload failed: ${error.message}`) }
    };
    const open = (d) => d.url ? d : null;
    const preview = async d => {
      if (!d.storage_path || !isConfigured) return open(d) ? setView(d) : flash('This sample file is not stored.')
      try { setView({ ...d, url: await db.getDocumentUrl(d.storage_path) }) } catch (error) { flash(`Preview failed: ${error.message}`) }
    }
    const downloadFile = async d => {
      try {
        const url = d.storage_path && isConfigured ? await db.getDocumentUrl(d.storage_path) : d.url
        if (!url) return flash('This sample file is not stored.')
        Object.assign(document.createElement('a'), { href: url, download: d.name }).click()
      } catch (error) { flash(`Download failed: ${error.message}`) }
    }
    return (<Card title="Workspace documents">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input w-56" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)}/>
        <select className="input w-40" value={fTag} onChange={e => setFTag(e.target.value)}>{['All', ...TAGS].map(t => <option key={t}>{t}</option>)}</select>
        <span className="ml-auto text-sm text-slate-500">Tag new file as</span>
        <select className="input w-40" value={tag} onChange={e => setTag(e.target.value)}>{TAGS.map(t => <option key={t}>{t}</option>)}</select>
        <input ref={ref} type="file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.zip" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }}/>
        <button className="btn" disabled={!canEdit} onClick={() => ref.current?.click()}><Upload size={14}/>Upload file</button>
      </div>
      {list.length === 0 ? <Empty text="No documents match. Upload a PDF, DOCX, PPTX, image or ZIP."/> : (<div className="divide-y divide-slate-100">{list.map((d) => (<div key={d.id} className="flex items-center gap-3 py-2.5 text-sm"><b className="min-w-0 flex-1 truncate">{d.name}</b><Pill>{d.tag}</Pill><span className="w-20 text-right text-xs text-slate-500">{(d.size / 1024).toFixed(0)} KB</span><span className="w-14 text-xs text-slate-500">{fmt(d.date)}</span>
            <button aria-label="Preview" className="text-slate-500" onClick={() => preview(d)}><Eye size={16}/></button>
            <button aria-label="Download" className="text-slate-500" onClick={() => downloadFile(d)}><Download size={16}/></button>
            {canEdit && <button aria-label="Edit document" className="text-slate-500" onClick={() => setEditingDoc({ ...d })}><Pencil size={16}/></button>}
            {canEdit && <button aria-label="Delete document" className="text-slate-500" onClick={() => deleteDocument(d)}><Trash2 size={16}/></button>}</div>))}</div>)}
      {editingDoc && <Modal title="Edit document" onClose={() => setEditingDoc(null)}><div className="space-y-3"><input className="input" value={editingDoc.name} onChange={e => setEditingDoc({ ...editingDoc, name: e.target.value })}/><select className="input" value={editingDoc.tag} onChange={e => setEditingDoc({ ...editingDoc, tag: e.target.value })}>{TAGS.map(t => <option key={t}>{t}</option>)}</select><div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEditingDoc(null)}>Cancel</button><button className="btn" onClick={() => { saveDocument(editingDoc); setEditingDoc(null); }}>Save</button></div></div></Modal>}
      {view && <Modal wide title={view.name} onClose={() => setView(null)}>
        {view.type.startsWith('image/') ? <img src={view.url} alt={view.name} className="max-h-[70vh] w-full object-contain"/> : view.type === 'application/pdf' ? <iframe title={view.name} src={view.url} className="h-[70vh] w-full"/> : <p className="text-sm text-slate-500">Preview is not available for this file type. Use download instead.</p>}
      </Modal>}
    </Card>);
}
