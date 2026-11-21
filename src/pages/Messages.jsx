import { useEffect, useRef, useState } from 'react';
import { Mic, Pin, Send, SquareCheck, Square, X, Trash2, Pencil } from 'lucide-react';
import { useApp } from '../lib/store';
import { Card } from '../components/ui';
import * as db from '../lib/db';
import { uid } from '../lib/utils';
export default function Messages() {
    const { messages, setMessages, saveMessage, deleteMessage, account, me, role, session, setEditing, newTask, flash, canEdit, canManageMembers, demoMode, refreshWorkspaceData } = useApp();
    const [ch, setCh] = useState('team');
    const [text, setText] = useState('');
    const [rec, setRec] = useState(false);
    const [clip, setClip] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const mr = useRef(null), chunks = useRef([]), end = useRef(null);
    const myRole = role === 'advisor' ? 'Advisor' : role === 'owner' || role === 'lead' ? 'Team Lead' : me?.role;
    useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, ch]);
    const push = (m) => {
        const full = { id: uid(), channel: ch, author: account.name, authorId: session?.user?.id, role: myRole, pinned: false, ts: new Date().toISOString(), ...m }
        setMessages(p => [...p, full])
        if (!demoMode) db.sendMessage(team.id, full)
          .then(() => refreshWorkspaceData().catch(error => flash(`Message sent, but refresh failed: ${error.message}`)))
          .catch(error => { setMessages(p => p.filter(item => item.id !== full.id)); flash(`Message could not be sent: ${error.message}`) })
    }
    const send = () => { if (!text.trim())
        return; if (!canEdit)
        return flash('Your account is pending approval.'); push({ text: text.trim() }); setText(''); };
    const start = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const r = new MediaRecorder(stream);
            chunks.current = [];
            r.ondataavailable = e => chunks.current.push(e.data);
            r.onstop = () => { const blob = new Blob(chunks.current, { type: 'audio/webm' }); setClip({ blob, url: URL.createObjectURL(blob) }); stream.getTracks().forEach(t => t.stop()); };
            r.start();
            mr.current = r;
            setRec(true);
        }
        catch {
            flash('Microphone blocked. Allow access in your browser and try again.');
        }
    };
    const stop = () => { mr.current?.stop(); setRec(false); };
    const sendClip = async () => {
        if (!clip) return
        if (!canEdit) return flash('Advisors cannot send messages in this workspace.')
        try {
          if (demoMode) push({ audio: clip.url })
          else {
            const uploaded = await db.uploadVoice(team.id, clip.blob)
            push({ audio: uploaded.url, audio_path: uploaded.path })
          }
          setClip(null)
        } catch (error) { flash(`Voice note could not be uploaded: ${error.message}`) }
    };
    const list = messages.filter((m) => m.channel === ch).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.ts.localeCompare(b.ts));
    return (<Card className="flex h-[calc(100vh-9rem)] min-h-[420px] flex-col">
      <div className="mb-3 flex gap-2">{[['team', 'Team Chat'], ['advisor', 'Advisor / Mentor Check-In']].map(([k, l]) => <button key={k} onClick={() => setCh(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${ch === k ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{l}</button>)}</div>
      <div className="flex-1 space-y-3 overflow-auto rounded-xl bg-slate-50 p-3">
        {list.map((m) => (<div key={m.id} className={`max-w-xl rounded-xl bg-white p-3 text-sm shadow-sm ${m.pinned ? 'ring-1 ring-amber-300' : ''}`}>
            <div className="mb-1 flex items-center gap-2"><b>{m.author}</b><span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${m.role === 'Advisor' || m.role === 'Coordinator' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>{m.role}</span><span className="text-xs text-slate-400">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="ml-auto flex gap-2 text-slate-400">
                {(demoMode || m.authorId === session?.user?.id || canManageMembers) && <button aria-label={m.pinned ? 'Unpin' : 'Pin'} onClick={() => saveMessage({ ...m, pinned: !m.pinned })}><Pin size={14} className={m.pinned ? 'text-amber-500' : ''}/></button>}
                {m.text && (demoMode || m.authorId === session?.user?.id || canManageMembers) && <button aria-label="Edit message" onClick={() => setEditingMessage({ id: m.id, text: m.text })}><Pencil size={14}/></button>}
                {(demoMode || m.authorId === session?.user?.id || canManageMembers) && <button aria-label="Delete message" onClick={() => deleteMessage(m.id)}><Trash2 size={14}/></button>}
                {m.text && <button aria-label="Convert to task" title="Convert to task" onClick={() => setEditing({ ...newTask(), title: m.text.slice(0, 80) })}><SquareCheck size={14}/></button>}</span></div>
            {editingMessage?.id === m.id ? <div className="mt-2 flex gap-2"><input className="input flex-1" value={editingMessage.text} onChange={e => setEditingMessage({ ...editingMessage, text: e.target.value })}/><button className="btn" onClick={() => { saveMessage({ ...m, text: editingMessage.text }); setEditingMessage(null); }}>Save</button><button className="btn-ghost" onClick={() => setEditingMessage(null)}>Cancel</button></div> : m.text && <p>{m.text}</p>}{m.audio && <audio controls src={m.audio} className="mt-1 h-9"/>}
          </div>))}
        <div ref={end}/>
      </div>
      {clip && <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 p-2"><audio controls src={clip.url} className="h-9 flex-1"/><button className="btn" onClick={sendClip}>Send</button><button className="btn-ghost" onClick={() => setClip(null)} aria-label="Cancel"><X size={14}/></button></div>}
      <div className="mt-3 flex gap-2">
        <input className="input" placeholder={ch === 'team' ? 'Message your team' : 'Message your advisor'} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}/>
        {rec ? <button className="btn bg-red-600 hover:bg-red-700" onClick={stop}><Square size={14}/>Stop</button> : canEdit && <button className="btn-ghost" onClick={start} aria-label="Record voice message"><Mic size={16}/></button>}
        <button className="btn" disabled={!canEdit} onClick={send}><Send size={14}/>Send</button>
      </div>
    </Card>);
}
