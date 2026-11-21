import { useState } from 'react';
import { Provider, useApp } from './lib/store';
import { Header, Sidebar } from './components/Shell';
import AuthGate from './components/AuthGate';
import WorkspaceGate from './components/WorkspaceGate';
import TaskModal from './components/TaskModal';
import Overview from './pages/Overview';
import Tasks from './pages/Tasks';
import Proposals from './pages/Proposals';
import Calendar from './pages/Calendar';
import Analytics from './pages/Analytics';
import Documents from './pages/Documents';
import Messages from './pages/Messages';
import TeamPage from './pages/TeamPage';
import SettingsPage from './pages/SettingsPage';
const PAGES = { overview: Overview, tasks: Tasks, proposals: Proposals, calendar: Calendar, analytics: Analytics, documents: Documents, messages: Messages, team: TeamPage, settings: SettingsPage };
function Shell() {
    const { page, editing, toast, authLoading, session, team, demoMode, signOut, workspaceIndexLoading } = useApp();
    const [mobileOpen, setMobileOpen] = useState(false);
    const Page = PAGES[page] ?? Overview;
    if (authLoading) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading session…</div>;
    if (!demoMode && !session) return <AuthGate />;
    if (!demoMode && workspaceIndexLoading) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading your workspaces…</div>;
    if (!demoMode && !team) return <WorkspaceGate />;
    return (<div className="flex h-screen overflow-hidden">
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)}/>}
      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenu={() => setMobileOpen(true)} onSignOut={signOut} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-5"><Page /></main>
      </div>
      {editing && <TaskModal key={editing.id}/>}
      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </div>);
}
export default function App() { return <Provider><Shell /></Provider>; }
