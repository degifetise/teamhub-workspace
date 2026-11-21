import { useState } from 'react'
import { LogOut, Plus, UsersRound } from 'lucide-react'
import { useApp } from '../lib/store'
import { MODES } from '../lib/constants'
import { Card, Field } from './ui'

export default function WorkspaceGate() {
  const { createWorkspace, joinWorkspace, workspaces, switchWorkspace, signOut, profile, flash, toast } = useApp()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState('capstone')
  const [advisor, setAdvisor] = useState({ name: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const perform = async action => {
    setBusy(true)
    setNotice('')
    try { await action() } catch (error) {
      const message = error?.message || String(error || 'Workspace action failed.')
      setNotice(message)
      flash(message)
    } finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-slate-50 p-4 dark:bg-[#191919]">
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 font-extrabold text-white">TH</span><div><h1 className="text-xl font-extrabold">TeamHub</h1><p className="text-sm text-slate-500">Workspace setup · {profile?.full_name || profile?.email}</p></div></div><button className="btn-ghost" onClick={signOut}><LogOut size={15}/>Sign out</button></header>
      {workspaces.length > 0 && <Card title="Select a workspace" className="mb-4"><div className="space-y-2">{workspaces.map(item => <button key={item.id} className="btn-ghost w-full justify-between" onClick={() => switchWorkspace(item.id)}>{item.name}<span className="text-xs capitalize text-slate-500">{item.access}</span></button>)}</div></Card>}
      {(notice || toast) && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{notice || toast}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Create team">
          <div className="space-y-3"><Field label="Team name"><input className="input" required value={name} onChange={event => setName(event.target.value)}/></Field>
            <Field label="Workspace mode"><select className="input" value={mode} onChange={event => setMode(event.target.value)}>{Object.entries(MODES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></Field>
            <Field label="Advisor / mentor name (optional)"><input className="input" value={advisor.name} onChange={event => setAdvisor({ ...advisor, name: event.target.value })}/></Field>
            <Field label="Advisor / mentor email (optional)"><input className="input" type="email" value={advisor.email} onChange={event => setAdvisor({ ...advisor, email: event.target.value })}/></Field>
            <button disabled={!name.trim() || busy} className="btn w-full" onClick={() => perform(() => createWorkspace(name.trim(), mode, advisor))}><Plus size={15}/>Create team</button>
          </div>
        </Card>
        <Card title="Join team">
          <div className="space-y-3"><p className="text-sm text-slate-500">Enter a join code shared by a team lead or owner.</p><Field label="Join code"><input className="input uppercase" value={code} onChange={event => setCode(event.target.value)}/></Field>
            <button disabled={!code.trim() || busy} className="btn w-full" onClick={() => perform(() => joinWorkspace(code))}><UsersRound size={15}/>Join with code</button>
          </div>
        </Card>
      </div>
    </div>
  </main>
}
