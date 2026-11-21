import { useEffect, useState } from 'react'
import { useApp } from '../lib/store'
import { Card, Field, Pill } from '../components/ui'
import { MODES } from '../lib/constants'
import { isConfigured } from '../lib/supabase'

export default function SettingsPage() {
  const { mode, setMode, account, profile, team, saveWorkspace, updateProfile, canManageWorkspace, role, flash, signOut } = useApp()
  const [form, setForm] = useState({ full_name: '', academic_year: '', department: '', semester: '' })
  const [advisor, setAdvisor] = useState({ name: '', email: '' })
  const [workspaceName, setWorkspaceName] = useState('')
  useEffect(() => {
    setForm({ full_name: account.name, academic_year: account.year, department: account.department, semester: account.semester })
  }, [account.name, account.year, account.department, account.semester])
  useEffect(() => {
    setAdvisor(team?.advisor || { name: '', email: '' })
    setWorkspaceName(team?.name || '')
  }, [team?.id, team?.name])
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const saveMode = value => {
    if (!canManageWorkspace) return flash('Only the workspace owner can change workspace settings.')
    setMode(value)
    saveWorkspace({ mode: value })
  }
  return <div className="grid gap-4 xl:grid-cols-2">
    <Card title="Workspace mode">
      <div className="grid gap-2 sm:grid-cols-3">{Object.entries(MODES).map(([key, item]) => <button key={key} disabled={!canManageWorkspace} onClick={() => saveMode(key)} className={`rounded-xl border p-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${mode === key ? 'border-blue-600 bg-blue-50 dark:bg-blue-950' : 'border-slate-200 dark:border-[#333]'}`}><b>{item.label}</b><p className="mt-1 text-xs text-slate-500">{item.advisor}, {item.deliverable}</p></button>)}</div>
      <p className="mt-3 text-sm text-slate-600">Labels: <b>{MODES[mode].advisor}</b>, <b>{MODES[mode].proposals}</b>, <b>{MODES[mode].logbook}</b>.</p>
      <p className="mt-3 text-xs text-slate-500">Workspace access: <Pill>{role === 'lead' ? 'Team Lead' : role}</Pill> · {isConfigured ? 'Supabase connected' : 'Seeded demo mode'}</p>
      {canManageWorkspace && team && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-[#333]"><Field label="Workspace name"><input className="input" value={workspaceName} onChange={event => setWorkspaceName(event.target.value)}/></Field><button className="btn" onClick={() => saveWorkspace({ name: workspaceName })}>Save workspace</button><Field label="Advisor / mentor name"><input className="input" value={advisor.name} onChange={event => setAdvisor({ ...advisor, name: event.target.value })}/></Field><Field label="Advisor / mentor email"><input className="input" type="email" value={advisor.email} onChange={event => setAdvisor({ ...advisor, email: event.target.value })}/></Field><button className="btn" onClick={() => saveWorkspace({ advisor })}>Save advisor link</button></div>}
    </Card>
    <Card title="Profile">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={form.full_name} onChange={event => set('full_name', event.target.value)}/></Field>
        <Field label="Email"><input className="input opacity-70" value={account.email} disabled/></Field>
        <Field label="Academic year"><input className="input" value={form.academic_year} onChange={event => set('academic_year', event.target.value)}/></Field>
        <Field label="Department"><input className="input" value={form.department} onChange={event => set('department', event.target.value)}/></Field>
        <Field label="Semester"><input className="input" value={form.semester} onChange={event => set('semester', event.target.value)}/></Field>
      </div>
      <button className="btn mt-3" disabled={!isConfigured || !profile} onClick={() => updateProfile(form)}>Save profile</button>
      {!isConfigured && <p className="mt-2 text-xs text-slate-500">Profile editing is available after connecting Supabase Auth.</p>}
      <p className="mt-4 text-sm">Account status: <Pill>{profile?.status || 'Demo'}</Pill></p>
      <button className="btn-ghost mt-3" onClick={signOut}>Sign out</button>
    </Card>
  </div>
}
