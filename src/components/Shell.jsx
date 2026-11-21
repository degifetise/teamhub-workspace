import { Activity, BarChart3, CalendarDays, ChevronDown, FileText, FolderOpen, HelpCircle, Home, ListChecks, LogOut, Menu, MessageSquare, Moon, Search, Settings, Sun, Users, X } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar } from './ui'

export const NAV = [
  { id: 'overview', icon: Home, label: 'Overview', sub: "Your team's work at a glance" },
  { id: 'proposals', icon: FolderOpen, label: 'Projects / Proposals', sub: 'Proposals, similarity check and logbooks' },
  { id: 'tasks', icon: ListChecks, label: 'Tasks', sub: "Manage and track your team's work" },
  { id: 'calendar', icon: CalendarDays, label: 'Calendar / Deadlines', sub: 'Upcoming deadlines and meetings' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics & Reports', sub: 'Progress, velocity and exports' },
  { id: 'documents', icon: FileText, label: 'Documents', sub: 'Files scoped to your workspace' },
  { id: 'messages', icon: MessageSquare, label: 'Messages & Voice', sub: 'Team chat and advisor check-ins' },
  { id: 'team', icon: Users, label: 'Team & Advisor', sub: 'Members, meetings and ratings' },
  { id: 'settings', icon: Settings, label: 'Settings', sub: 'Workspace mode and profile' },
]

export function Sidebar({ mobileOpen = false, onNavigate = () => {}, onClose = () => {} }) {
  const { page, setPage, terms, team, account, role, members, dark, setDark, workspaces, switchWorkspace, signOut } = useApp()
  return <aside className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white p-4 transition-transform dark:border-[#2d2d2d] dark:bg-[#161616] lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="mb-5 flex items-center gap-3 px-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-extrabold text-white lg:hidden">TH</span>
      <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-extrabold text-white lg:grid">TH</span>
      <div className="flex-1"><p className="text-lg font-extrabold leading-tight">TeamHub</p><p className="text-xs text-slate-500">Workspace</p></div>
      <button className="btn-ghost !p-2 lg:hidden" aria-label="Close navigation" onClick={onClose}><X size={17}/></button>
    </div>
    {workspaces.length > 1 && <select aria-label="Switch workspace" className="input mb-3" value={team?.id || ''} onChange={event => switchWorkspace(event.target.value)}>{workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select>}
    <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
      {NAV.map(item => <button key={item.id} onClick={() => { setPage(item.id); onNavigate() }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${page === item.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#242424]'}`}>
        <item.icon size={18}/>{item.label}
      </button>)}
    </nav>
    <div className="mt-3 space-y-3">
      <div className="rounded-xl bg-blue-50 p-3 text-sm dark:bg-[#202020]">
        <p className="font-bold">{terms.label}</p>
        <p className="truncate text-xs text-slate-500">{team?.name || 'No workspace'}{account.year ? ` · ${account.year}` : ''}{account.semester ? ` · ${account.semester}` : ''}</p>
        <button className="btn mt-2 w-full" onClick={() => { setPage('settings'); onNavigate() }}>Workspace settings</button>
        <button className="btn-ghost mt-2 w-full" onClick={() => setDark(!dark)}>{dark ? <Sun size={15}/> : <Moon size={15}/>} {dark ? 'Light Mode' : 'Dark Mode'}</button>
      </div>
      <div className="flex items-center gap-2 px-1">
        <Avatar name={account.name || account.email || '?'} size={36}/>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{account.name || account.email || 'Account'}</p><p className="truncate text-xs capitalize text-slate-500">{role === 'lead' ? 'Team Lead' : role}</p></div>
        <button className="btn-ghost !p-2" aria-label="Sign out" onClick={signOut}><LogOut size={15}/></button>
      </div>
    </div>
  </aside>
}

export function Header({ onMenu = () => {}, onSignOut = () => {} }) {
  const { dark, setDark, page, setPage, filter, setFilter, q, setQ, setEditing, newTask, account, canEditTasks, activity, flash } = useApp()
  const current = NAV.find(item => item.id === page) || NAV[0]
  return <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-[#2d2d2d] dark:bg-[#191919] lg:px-5">
    <button className="btn-ghost !px-2.5 lg:hidden" aria-label="Open navigation" onClick={onMenu}><Menu size={18}/></button>
    <div className="mr-auto min-w-32"><h1 className="text-lg font-bold">{current.label}</h1><p className="hidden text-xs text-slate-500 sm:block">{current.sub}</p></div>
    <div className="relative hidden md:block"><Search size={14} className="absolute left-3 top-3 text-slate-400"/><input className="input w-48 pl-8 lg:w-56" placeholder="Search tasks" value={q} onChange={event => setQ(event.target.value)}/></div>
    <div className="relative hidden sm:block"><select aria-label="Filter by priority" className="input w-36" value={filter} onChange={event => setFilter(event.target.value)}>{['All', 'High', 'Medium', 'Low'].map(priority => <option key={priority} value={priority}>{priority === 'All' ? 'Filter: All' : `${priority} priority`}</option>)}</select></div>
    <button className="btn" disabled={!canEditTasks} onClick={() => setEditing(newTask())}>+ Add Task</button>
    <button aria-label="Recent activity" title={`${activity.length} recent activity entries`} onClick={() => { setPage('overview'); flash(activity.length ? `${activity.length} recent activity entries` : 'No activity recorded yet.') }} className="btn-ghost !px-2.5"><Activity size={17}/></button>
    <button aria-label="Toggle light or dark mode" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)} className="btn-ghost !px-2.5">{dark ? <Sun size={16}/> : <Moon size={16}/>}</button>
    <button aria-label="Help" onClick={() => flash('See README.md for Supabase setup help.')} className="btn-ghost !px-2.5"><HelpCircle size={16}/></button>
    <button aria-label="Sign out" onClick={onSignOut} className="btn-ghost !px-2.5"><LogOut size={16}/></button>
    <Avatar name={account.name || account.email || '?'} size={32}/>
  </header>
}
