import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as seed from './seed'
import * as db from './db'
import { isConfigured, supabase } from './supabase'
import { uid } from './utils'
import { MODES } from './constants'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const emptyWorkspaceData = {
  members: [], tasks: [], proposals: [], logbooks: [], meetings: [], ratings: [], messages: [], docs: [], activity: [],
}

export function Provider({ children }) {
  const [page, setPage] = useState('overview')
  const [session, setSession] = useState(null)
  const authUserId = useRef(null)
  const activeWorkspaceId = useRef(isConfigured ? null : seed.team.id)
  const workspaceLoadToken = useRef(0)
  const [authLoading, setAuthLoading] = useState(isConfigured)
  const [workspaceIndexLoading, setWorkspaceIndexLoading] = useState(false)
  const [profile, setProfile] = useState(isConfigured ? null : seed.account)
  const [workspaces, setWorkspaces] = useState(isConfigured ? [] : [{ ...seed.team, access: 'owner' }])
  const [team, setTeam] = useState(isConfigured ? null : { ...seed.team, access: 'owner' })
  const [dataLoading, setDataLoading] = useState(false)
  const [workspaceData, setWorkspaceData] = useState(isConfigured ? emptyWorkspaceData : {
    members: seed.members, tasks: seed.tasks, proposals: seed.proposals, logbooks: seed.logbooks,
    meetings: seed.meetings, ratings: seed.ratings, messages: seed.messages, docs: seed.docs, activity: seed.activity,
  })
  const [mode, setMode] = useState(team?.mode || 'capstone')
  const [filter, setFilter] = useState('All')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('teamhub-theme') === 'dark' } catch { return false } })
  const account = profile ? {
    name: profile.full_name || profile.name || session?.user?.user_metadata?.full_name || '',
    email: profile.email || session?.user?.email || '',
    year: profile.academic_year || profile.year || '',
    department: profile.department || '',
    semester: profile.semester || '',
    status: profile.status || 'approved',
  } : { name: '', email: '', year: '', department: '', semester: '', status: 'approved' }
  const members = workspaceData.members
  const tasks = workspaceData.tasks
  const proposals = workspaceData.proposals
  const logbooks = workspaceData.logbooks
  const meetings = workspaceData.meetings
  const ratings = workspaceData.ratings
  const messages = workspaceData.messages
  const docs = workspaceData.docs
  const activity = workspaceData.activity
  const me = members.find(member => member.id === session?.user?.id) || members[0] || null
  const access = team?.access || (isConfigured ? 'member' : 'owner')
  const isOwner = access === 'owner'
  const isLead = isOwner || access === 'lead'
  const isAdvisor = access === 'advisor'
  const canEdit = !isAdvisor && (isConfigured ? !!session?.user : true)
  const canEditTasks = canEdit
  const canDeleteTasks = isLead
  const canManageMembers = isLead
  const canManageWorkspace = isOwner
  const canReviewLogs = isAdvisor
  const terms = MODES[mode] || MODES.capstone

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('teamhub-theme', dark ? 'dark' : 'light') } catch { }
  }, [dark])

  useEffect(() => {
    if (!isConfigured) return undefined
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) flash(`Session error: ${error.message || 'Could not load the current session.'}`)
      authUserId.current = data?.session?.user?.id || null
      setSession(data?.session || null)
      setWorkspaceIndexLoading(!!data?.session)
      setAuthLoading(false)
    }).catch(error => {
      if (!active) return
      authUserId.current = null
      setSession(null)
      setWorkspaceIndexLoading(false)
      setAuthLoading(false)
      flash(`Session error: ${error?.message || 'Could not load the current session.'}`)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      const nextUserId = nextSession?.user?.id || null
      if (nextUserId !== authUserId.current) {
        authUserId.current = nextUserId
        activeWorkspaceId.current = null
        workspaceLoadToken.current += 1
        setWorkspaceIndexLoading(!!nextSession?.user)
        setProfile(null)
        setWorkspaces([])
        setTeam(null)
        setWorkspaceData(emptyWorkspaceData)
      }
      if (!nextSession) {
        setWorkspaceIndexLoading(false)
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const flash = useCallback(message => setToast(message), [])
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  const refreshWorkspaces = useCallback(async (preferredId) => {
    if (!isConfigured || !session?.user) return
    setWorkspaceIndexLoading(true)
    try {
      const index = await db.loadWorkspaceIndex(session.user)
      if (authUserId.current !== session.user.id) return null
      setProfile(index.profile)
      setWorkspaces(index.workspaces)
      const selectedId = preferredId || localStorage.getItem('teamhub-workspace')
      const selected = index.workspaces.find(item => item.id === selectedId) || index.workspaces[0] || null
      if (activeWorkspaceId.current !== selected?.id) {
        workspaceLoadToken.current += 1
        setWorkspaceData(emptyWorkspaceData)
      }
      activeWorkspaceId.current = selected?.id || null
      setTeam(selected)
      if (selected) {
        localStorage.setItem('teamhub-workspace', selected.id)
        setMode(selected.mode || 'capstone')
      } else {
        localStorage.removeItem('teamhub-workspace')
        setWorkspaceData(emptyWorkspaceData)
      }
      return selected
    } finally {
      setWorkspaceIndexLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!isConfigured || !session?.user) return undefined
    let cancelled = false
    refreshWorkspaces().catch(error => { if (!cancelled) flash(`Could not load workspaces: ${error?.message || 'Unknown Supabase error'}`) })
    return () => { cancelled = true }
  }, [session?.user?.id, refreshWorkspaces])

  const refreshWorkspaceData = useCallback(async (workspaceId = team?.id) => {
    if (!isConfigured || !workspaceId) return
    const requestToken = ++workspaceLoadToken.current
    setDataLoading(true)
    try {
      const loaded = await db.loadWorkspaceData(workspaceId)
      if (!loaded || requestToken !== workspaceLoadToken.current || activeWorkspaceId.current !== workspaceId) return
      setWorkspaceData(loaded)
      setTeam(current => current?.id === workspaceId ? { ...current, ...loaded.team, access: current.access } : current)
    } finally {
      if (requestToken === workspaceLoadToken.current) setDataLoading(false)
    }
  }, [team?.id])

  useEffect(() => {
    if (!isConfigured || !team?.id) return undefined
    let cancelled = false
    const load = event => {
      if (event?.table === 'workspaces') {
        refreshWorkspaces(team.id).then(selected => selected && refreshWorkspaceData(selected.id)).catch(error => {
          if (!cancelled) flash(`Could not refresh workspace: ${error?.message || 'Unknown Supabase error'}`)
        })
        return
      }
      refreshWorkspaceData(team.id).catch(error => {
        if (!cancelled) flash(`Could not load workspace data: ${error?.message || 'Unknown Supabase error'}`)
      })
    }
    load()
    const unsubscribe = db.subscribeWorkspace(team.id, load)
    return () => { cancelled = true; unsubscribe() }
  }, [team?.id, refreshWorkspaceData])

  const run = async (promise, successMessage) => {
    try {
      await promise
      if (successMessage) flash(successMessage)
      return true
    } catch (error) {
      flash(error?.message || 'The action could not be completed.')
      return false
    }
  }
  const log = text => {
    setWorkspaceData(current => ({ ...current, activity: [{ id: uid(), time: new Date().toTimeString().slice(0, 5), who: account.name || 'You', text }, ...current.activity].slice(0, 50) }))
  }
  const setTasks = update => setWorkspaceData(current => ({ ...current, tasks: typeof update === 'function' ? update(current.tasks) : update }))
  const setMembers = update => setWorkspaceData(current => ({ ...current, members: typeof update === 'function' ? update(current.members) : update }))
  const setProposals = update => setWorkspaceData(current => ({ ...current, proposals: typeof update === 'function' ? update(current.proposals) : update }))
  const setLogbooks = update => setWorkspaceData(current => ({ ...current, logbooks: typeof update === 'function' ? update(current.logbooks) : update }))
  const setMeetings = update => setWorkspaceData(current => ({ ...current, meetings: typeof update === 'function' ? update(current.meetings) : update }))
  const setRatings = update => setWorkspaceData(current => ({ ...current, ratings: typeof update === 'function' ? update(current.ratings) : update }))
  const setMessages = update => setWorkspaceData(current => ({ ...current, messages: typeof update === 'function' ? update(current.messages) : update }))
  const setDocs = update => setWorkspaceData(current => ({ ...current, docs: typeof update === 'function' ? update(current.docs) : update }))

  const vis = useMemo(() => tasks.filter(task =>
    (filter === 'All' || task.priority === filter) &&
    (!q || `${task.title}${task.category}${task.module}`.toLowerCase().includes(q.toLowerCase()))
  ), [tasks, filter, q])
  const saveTask = task => {
    if (!canEditTasks) return flash('Advisors cannot edit tasks.')
    setTasks(prev => prev.some(item => item.id === task.id) ? prev.map(item => item.id === task.id ? task : item) : [...prev, task])
    if (isConfigured && team?.id) run(db.saveTask(team.id, task))
    log(`saved "${task.title}"`)
  }
  const moveTask = (id, status) => {
    const task = tasks.find(item => item.id === id)
    if (!task || task.status === status || !canEditTasks) return
    saveTask({ ...task, status })
    log(`moved "${task.title}" to ${status}`)
  }
  const deleteTask = id => {
    if (!canDeleteTasks) return flash('Only the team lead or owner can delete tasks.')
    setTasks(prev => prev.filter(task => task.id !== id))
    if (isConfigured) run(db.removeTask(id))
    log('deleted a task')
  }
  const newTask = (status = 'To Do') => ({ id: isConfigured ? undefined : uid(), title: '', status, priority: 'Medium', category: 'General', module: 'General', due: new Date().toISOString().slice(0, 10), assignee: me?.id || '', subtasks: [] })
  const updateCollection = (key, setter, updater) => setter(updater)

  const saveProposal = proposal => {
    if (!canEdit) return flash('Advisors cannot edit proposals.')
    setProposals(prev => prev.some(item => item.id === proposal.id) ? prev.map(item => item.id === proposal.id ? proposal : item) : [proposal, ...prev])
    if (isConfigured) run(db.saveProposal(team.id, proposal))
    log(`saved ${proposal.status.toLowerCase()} "${proposal.title}"`)
  }
  const deleteProposal = id => {
    if (!window.confirm('Delete this draft proposal?')) return
    setProposals(prev => prev.filter(item => item.id !== id))
    if (isConfigured) run(db.removeProposal(id))
    log('deleted a proposal draft')
  }
  const saveLog = entry => {
    if (!canEdit) return flash('You do not have permission to change this log.')
    setLogbooks(prev => prev.some(item => item.id === entry.id) ? prev.map(item => item.id === entry.id ? entry : item) : [entry, ...prev])
    if (isConfigured) run(db.saveLog(team.id, entry))
    log(`saved ${entry.week}`)
  }
  const deleteLog = id => { if (isConfigured) return flash('Logbook deletion is not enabled by the workspace permission policy.'); if (window.confirm('Delete this weekly log?')) setLogbooks(prev => prev.filter(item => item.id !== id)) }
  const reviewLog = (id, status, note) => {
    if (!canReviewLogs) return flash('Only the linked advisor can review logbooks.')
    setLogbooks(prev => prev.map(item => item.id === id ? { ...item, status, note } : item))
    if (isConfigured) run(db.reviewLog(id, status, note))
    log(`reviewed a logbook: ${status}`)
  }
  const saveMeeting = meeting => {
    if (!canEdit) return flash('Advisors cannot edit meetings.')
    setMeetings(prev => prev.some(item => item.id === meeting.id) ? prev.map(item => item.id === meeting.id ? meeting : item) : [meeting, ...prev])
    if (isConfigured) run(db.saveMeeting(team.id, meeting))
    log(`saved meeting "${meeting.title}"`)
  }
  const deleteMeeting = id => { if (!window.confirm('Delete this meeting and its attendance?')) return; setMeetings(prev => prev.filter(item => item.id !== id)); if (isConfigured) run(db.removeMeeting(id)); log('deleted a meeting') }
  const saveRating = rating => { if (!canEdit) return flash('Advisors cannot edit ratings.'); setRatings(prev => prev.some(item => item.memberId === rating.memberId) ? prev.map(item => item.memberId === rating.memberId ? rating : item) : [...prev, rating]); if (isConfigured) run(db.saveRating(team.id, rating)) }
  const deleteRating = memberId => { if (!window.confirm('Delete this member rating?')) return; setRatings(prev => prev.filter(item => item.memberId !== memberId)); if (isConfigured) run(db.removeRating(team.id, memberId)) }
  const saveMember = member => {
    if (!canManageMembers) return flash('Only the team lead or owner can manage members.')
    setMembers(prev => prev.map(item => item.id === member.id ? member : item))
    if (isConfigured) run(db.saveMember(team.id, member))
  }
  const addMember = async (email, memberRole) => {
    if (!canManageMembers) return flash('Only the team lead or owner can add members.')
    if (!isConfigured) return flash('Invite-by-email requires Supabase Auth.')
    const added = await run(db.addMember(team.id, email, memberRole), 'Member added')
    if (added) {
      try { await refreshWorkspaceData() } catch (error) {
        flash(`Member was added, but the workspace could not refresh: ${error?.message || 'Unknown Supabase error'}`)
      }
    }
    return added
  }
  const removeMember = id => {
    if (!canManageMembers) return flash('Only the team lead or owner can remove members.')
    if (!window.confirm('Remove this member from the workspace?')) return
    if (isConfigured) {
      run(db.removeMember(team.id, id).then(() => refreshWorkspaceData()), 'Member removed')
      return
    }
    setMembers(prev => prev.filter(member => member.id !== id))
    log('removed a member')
  }
  const saveWorkspace = patch => {
    if (!canManageWorkspace) return flash('Only the workspace owner can edit workspace settings or advisor details.')
    const next = { ...team, ...patch }
    setTeam(next)
    setWorkspaces(prev => prev.map(item => item.id === next.id ? next : item))
    if (isConfigured) run(db.saveWorkspace(team.id, { name: next.name, mode: next.mode || mode, join_code: next.code, is_locked: next.locked, advisor_name: next.advisor?.name, advisor_email: next.advisor?.email }))
  }
  const regenerateCode = async () => {
    if (!isLead) return flash('Only a team lead or owner can change the join code.')
    if (!isConfigured) return flash('Join code regeneration requires Supabase.')
    try {
      const code = await db.regenerateJoinCode(team.id)
      setTeam(prev => ({ ...prev, code }))
      flash('Join code regenerated')
    } catch (error) {
      flash(error?.message || 'Could not regenerate the join code.')
    }
  }
  const setJoinLock = async locked => {
    if (!isLead) return flash('Only a team lead or owner can change join-code access.')
    if (!isConfigured) return flash('Join-code access requires Supabase.')
    const saved = await run(db.setJoinLock(team.id, locked), locked ? 'Join code locked' : 'Join code unlocked')
    if (saved) setTeam(prev => ({ ...prev, locked }))
  }
  const deleteWorkspace = async () => {
    if (!canManageWorkspace) return flash('Only the workspace owner can delete this workspace.')
    if (!window.confirm('Delete this workspace and all associated data? This cannot be undone.')) return
    if (!isConfigured) return flash('Workspace deletion requires Supabase.')
    const deleted = await run(db.removeWorkspace(team.id))
    if (!deleted) return
    try {
      await refreshWorkspaces()
    } catch (error) {
      flash(`Workspace was deleted, but the workspace list could not refresh: ${error?.message || 'Unknown Supabase error'}`)
    }
  }
  const saveMessage = message => {
    setMessages(prev => prev.map(item => item.id === message.id ? message : item))
    if (isConfigured) run(db.updateMessage(message))
  }
  const deleteMessage = id => { if (!window.confirm('Delete this message?')) return; setMessages(prev => prev.filter(item => item.id !== id)); if (isConfigured) run(db.removeMessage(id)) }
  const saveDocument = document => { setDocs(prev => prev.map(item => item.id === document.id ? document : item)); if (isConfigured) run(db.saveDocument(team.id, document)) }
  const deleteDocument = document => { if (!window.confirm(`Delete "${document.name}"?`)) return; setDocs(prev => prev.filter(item => item.id !== document.id)); if (isConfigured) run(db.removeDocument(document)) }
  const switchWorkspace = id => {
    const selected = workspaces.find(item => item.id === id)
    if (!selected) return
    workspaceLoadToken.current += 1
    activeWorkspaceId.current = selected.id
    setTeam(selected)
    if (isConfigured) setWorkspaceData(emptyWorkspaceData)
    setMode(selected.mode || 'capstone')
    localStorage.setItem('teamhub-workspace', selected.id)
  }
  const createWorkspace = async (name, workspaceMode, advisor) => {
    const created = await db.createTeam(name, workspaceMode, advisor)
    const selected = await refreshWorkspaces(created.id)
    if (selected?.id !== created.id) throw new Error('Workspace was created, but could not be selected. Refresh your workspaces and try again.')
    await refreshWorkspaceData(created.id)
    return created
  }
  const joinWorkspace = async code => {
    const id = await db.joinByCode(code)
    if (!id) throw new Error('No unlocked workspace matches that join code.')
    await refreshWorkspaces(id)
    return id
  }
  const updateProfile = async nextProfile => {
    if (!session?.user?.id) return flash('Sign in before updating your profile.')
    const saved = await run(db.saveProfile(session.user.id, nextProfile), 'Profile updated')
    if (saved) setProfile(current => ({ ...current, ...nextProfile }))
  }

  const value = {
    dark, setDark, page, setPage, mode, setMode, role: access, account, profile, session, authLoading,
    workspaces, team, setTeam, switchWorkspace, refreshWorkspaces, refreshWorkspaceData, createWorkspace, joinWorkspace, workspaceIndexLoading,
    members, setMembers, tasks, setTasks, vis, proposals, setProposals, logbooks, setLogbooks, meetings, setMeetings,
    ratings, setRatings, messages, setMessages, docs, setDocs, activity, log, filter, setFilter, q, setQ, editing,
    setEditing, toast, flash, me, terms, canEdit, canEditTasks, canDeleteTasks, canManageMembers, canManageWorkspace,
    canReviewLogs, dataLoading, saveTask, moveTask, deleteTask, newTask, saveProposal, deleteProposal, saveLog, reviewLog,
    deleteLog, saveMeeting, deleteMeeting, saveRating, deleteRating, saveMember, addMember, removeMember,
    saveWorkspace, regenerateCode, setJoinLock, deleteWorkspace, saveMessage, deleteMessage, saveDocument, deleteDocument,
    demoMode: !isConfigured, signOut: () => isConfigured ? run(db.signOut()) : flash('Demo mode is active.'), updateProfile, updateCollection,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
