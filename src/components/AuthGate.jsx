import { useState } from 'react'
import { KeyRound, UserRoundPlus } from 'lucide-react'
import { useApp } from '../lib/store'
import * as db from '../lib/db'
import { Card, Field } from './ui'

const initialForm = { name: '', email: '', password: '', year: '', department: '', semester: '' }

export default function AuthGate() {
  const { flash } = useApp()
  const [registering, setRegistering] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      if (registering) {
        const { session } = await db.register(form)
        if (!session) setNotice('Registration received. Confirm your email, then sign in.')
        else setNotice('Account created and signed in.')
      } else {
        await db.signIn(form.email, form.password)
      }
    } catch (error) {
      flash(error.message || 'Authentication failed.')
      setNotice(error.message || 'Authentication failed.')
    } finally { setBusy(false) }
  }
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }))
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-[#191919]">
    <Card className="w-full max-w-lg p-6">
      <div className="mb-6 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 font-extrabold text-white">TH</span><div><h1 className="text-xl font-extrabold">TeamHub</h1><p className="text-sm text-slate-500">Workspace</p></div></div>
      <h2 className="mb-4 text-lg font-bold">{registering ? 'Create your account' : 'Sign in'}</h2>
      <form className="space-y-3" onSubmit={submit}>
        {registering && <>
          <Field label="Name"><input className="input" required value={form.name} onChange={event => change('name', event.target.value)}/></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Academic year"><input className="input" required value={form.year} onChange={event => change('year', event.target.value)}/></Field><Field label="Department"><input className="input" required value={form.department} onChange={event => change('department', event.target.value)}/></Field></div>
          <Field label="Semester"><input className="input" required value={form.semester} onChange={event => change('semester', event.target.value)}/></Field>
        </>}
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={event => change('email', event.target.value)}/></Field>
        <Field label="Password"><input className="input" type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength="8" required value={form.password} onChange={event => change('password', event.target.value)}/></Field>
        <button className="btn w-full" disabled={busy}>{registering ? <UserRoundPlus size={16}/> : <KeyRound size={16}/>} {busy ? 'Please wait…' : registering ? 'Register' : 'Sign in'}</button>
      </form>
      {notice && <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-200">{notice}</p>}
      {registering && <p className="mt-4 text-xs text-slate-500">Enable Authentication → Providers → Email → Confirm email in Supabase to verify email addresses.</p>}
      <button className="btn-ghost mt-4 w-full" onClick={() => { setRegistering(value => !value); setNotice('') }}>{registering ? 'Already registered? Sign in' : 'New to TeamHub? Create an account'}</button>
    </Card>
  </main>
}
