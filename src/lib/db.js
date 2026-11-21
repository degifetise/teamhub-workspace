import { supabase } from './supabase'

const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}
const result = ({ data, error }) => {
  if (error) throw error
  return data
}
const one = response => result(response)
const memberRole = role => role || 'Frontend'

export async function register({ name, email, password, year, department, semester }) {
  const client = requireClient()
  return one(await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: name.trim(), academic_year: year, department, semester } },
  }))
}

export async function signIn(email, password) {
  return one(await requireClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password }))
}

export async function signOut() {
  return one(await requireClient().auth.signOut())
}
export async function saveProfile(userId, profile) {
  if (!isUuid(userId)) return
  await one(await requireClient().from('profiles').update({
    full_name: profile.full_name, academic_year: profile.academic_year,
    department: profile.department, semester: profile.semester,
  }).eq('id', userId))
}

const mapWorkspace = (row, access, userId) => ({
  id: row.id,
  name: row.name,
  code: row.join_code,
  locked: row.is_locked,
  mode: row.mode,
  createdBy: row.created_by,
  advisor: { name: row.advisor_name || '', email: row.advisor_email || '' },
  access: access?.isAdvisor ? 'advisor' : row.created_by === userId ? 'owner' : access?.team_role === 'Team Lead' ? 'lead' : 'member',
})

async function loadOrCreateProfile(client, user) {
  try {
    const existing = one(await client.from('profiles').select('*').eq('id', user.id).maybeSingle())
    if (existing) return existing

    const metadata = user.user_metadata || {}
    return one(await client.from('profiles').upsert({
      id: user.id,
      email: user.email?.toLowerCase() || null,
      full_name: metadata.full_name || metadata.name || null,
      academic_year: metadata.academic_year || metadata.year || null,
      department: metadata.department || null,
      semester: metadata.semester || null,
    }, { onConflict: 'id' }).select('*').single())
  } catch (error) {
    throw new Error(`Could not load or create your profile: ${error?.message || 'Unknown Supabase error'}`)
  }
}

export async function loadWorkspaceIndex(user) {
  try {
    const client = requireClient()
    await one(await client.rpc('link_confirmed_advisor_workspaces'))
    const [profile, membershipRows, advisorRows] = await Promise.all([
      loadOrCreateProfile(client, user),
      one(await client.from('workspace_members').select('workspace_id, team_role').eq('user_id', user.id).eq('is_active', true)),
      one(await client.from('workspace_advisors').select('workspace_id').eq('user_id', user.id)),
    ])
    const accessById = new Map(membershipRows.map(row => [row.workspace_id, row]))
    advisorRows.forEach(row => accessById.set(row.workspace_id, { isAdvisor: true }))
    const ids = [...accessById.keys()]
    if (!ids.length) return { profile, workspaces: [] }
    const rows = one(await client.from('workspaces').select('*').in('id', ids))
    return { profile, workspaces: rows.map(row => mapWorkspace(row, accessById.get(row.id), user.id)) }
  } catch (error) {
    throw new Error(`Could not load your workspace access: ${error?.message || 'Unknown Supabase error'}`)
  }
}

const toTask = row => ({
  id: row.id, title: row.title, status: row.status, priority: row.priority, category: row.category || 'General',
  module: row.module || 'General', due: row.due_date || '', time: row.due_time || undefined,
  assignee: row.assignee_id || '', subtasks: (row.task_subtasks || []).sort((a, b) => a.position - b.position).map(s => ({ id: s.id, t: s.title, done: s.is_done })),
})

async function signedUrl(bucket, path) {
  if (!path) return null
  const { signedUrl: url } = one(await requireClient().storage.from(bucket).createSignedUrl(path, 3600))
  return url
}
export async function getDocumentUrl(path) { return signedUrl('workspace-documents', path) }

export async function loadWorkspaceData(workspaceId) {
  if (!isUuid(workspaceId)) return null
  const client = requireClient()
  let user, workspace, membershipRows, taskRows, proposals, logs, meetingRows, ratingRows, messageRows, documentRows, activityRows, advisorRows
  try {
    user = one(await client.auth.getUser())?.user
    if (!user) throw new Error('No authenticated user is available.')
    [workspace, membershipRows, taskRows, proposals, logs, meetingRows, ratingRows, messageRows, documentRows, activityRows, advisorRows] = await Promise.all([
      one(await client.from('workspaces').select('*').eq('id', workspaceId).single()),
      one(await client.from('workspace_members').select('user_id, team_role, email, is_active').eq('workspace_id', workspaceId).eq('is_active', true)),
      one(await client.from('tasks').select('*, task_subtasks(*)').eq('workspace_id', workspaceId)),
      one(await client.from('proposals').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })),
      one(await client.from('weekly_logs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })),
      one(await client.from('meetings').select('*, meeting_attendance(user_id, status)').eq('workspace_id', workspaceId).order('meeting_date', { ascending: false })),
      one(await client.from('member_ratings').select('*').eq('workspace_id', workspaceId).eq('rater_id', user.id)),
      one(await client.from('chat_messages').select('*, chat_channels(kind)').eq('workspace_id', workspaceId).order('created_at')),
      one(await client.from('workspace_documents').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })),
      one(await client.from('activity_logs').select('id, actor_id, action, created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)),
      one(await client.from('workspace_advisors').select('user_id').eq('workspace_id', workspaceId)),
    ])
  } catch (error) {
    throw new Error(`Could not load workspace members and data: ${error?.message || 'Unknown Supabase error'}`)
  }
  const profileIds = [...new Set([...membershipRows.map(row => row.user_id), ...advisorRows.map(row => row.user_id), ...activityRows.map(row => row.actor_id).filter(Boolean)])]
  const profiles = profileIds.length ? one(await client.from('profiles').select('id, full_name, email').in('id', profileIds)) : []
  const profileById = new Map(profiles.map(row => [row.id, row]))
  const members = membershipRows.map(row => ({
    id: row.user_id, name: profileById.get(row.user_id)?.full_name || row.email || 'Member',
    email: profileById.get(row.user_id)?.email || row.email || '', role: memberRole(row.team_role), capacity: 5, status: 'active',
  }))
  for (const advisor of advisorRows) {
    const profile = profileById.get(advisor.user_id)
    members.push({ id: advisor.user_id, name: profile?.full_name || 'Advisor', email: profile?.email || '', role: 'Advisor', capacity: 0, status: 'active' })
  }
  const docs = await Promise.all(documentRows.map(async row => ({
    id: row.id, name: row.name, tag: row.tag || 'Report', size: Number(row.size_bytes || 0), type: row.mime_type || '',
    date: row.created_at.slice(0, 10), storage_path: row.storage_path,
    url: await signedUrl('workspace-documents', row.storage_path),
  })))
  const messages = await Promise.all(messageRows.map(async row => ({
    id: row.id, channel: row.chat_channels?.kind || 'team', author: row.author_name || 'Member',
    role: row.author_role || 'Member', text: row.body, audio: row.audio_storage_path ? await signedUrl('voice-notes', row.audio_storage_path) : row.audio_url,
    audio_path: row.audio_storage_path, authorId: row.author_id, pinned: row.is_pinned, ts: row.created_at,
  })))
  return {
    team: mapWorkspace(workspace, null, workspace.created_by),
    members, tasks: taskRows.map(toTask),
    proposals: proposals.map(row => ({ id: row.id, title: row.title, abstract: row.abstract || '', status: row.status, similarity: row.similarity_score })),
    logbooks: logs.map(row => ({ id: row.id, authorId: row.author_id, week: row.week_label, finished: row.finished || '', next: row.next_steps || '', blockers: row.blockers || '', status: row.status, note: row.review_note || '' })),
    meetings: meetingRows.map(row => ({ id: row.id, title: row.title, date: row.meeting_date, agenda: row.agenda || '', notes: row.notes || '', actions: row.action_items || [], attendance: Object.fromEntries((row.meeting_attendance || []).map(a => [a.user_id, a.status])) })),
    ratings: ratingRows.map(row => ({ memberId: row.member_id, reliability: row.reliability, quality: row.quality, communication: row.communication, note: row.note || '' })),
    messages, docs,
    activity: activityRows.map(row => ({ id: row.id, time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), who: profileById.get(row.actor_id)?.full_name || 'Member', text: row.action })),
  }
}

export async function createTeam(name, mode, advisor = {}) {
  const created = one(await requireClient().rpc('create_workspace', {
    p_name: name.trim(), p_mode: mode, p_advisor_name: advisor.name?.trim() || null,
    p_advisor_email: advisor.email?.trim().toLowerCase() || null,
  }))
  if (!created?.id) throw new Error('Workspace was created without returning its id.')
  return created
}

export async function joinByCode(code) {
  return one(await requireClient().rpc('join_team_by_code', { p_code: code.trim().toUpperCase() }))
}

export async function addMember(ws, email, role) {
  return one(await requireClient().rpc('add_workspace_member', { p_workspace_id: ws, p_email: email.trim().toLowerCase(), p_team_role: role }))
}

export async function saveTask(ws, task) {
  if (!isUuid(ws)) return
  const client = requireClient()
  const row = { workspace_id: ws, title: task.title, status: task.status, priority: task.priority, category: task.category, module: task.module, due_date: task.due || null, due_time: task.time || null, assignee_id: isUuid(task.assignee) ? task.assignee : null }
  if (isUuid(task.id)) row.id = task.id
  const saved = one(await client.from('tasks').upsert(row).select('id').single())
  if (isUuid(task.id)) await one(await client.from('task_subtasks').delete().eq('task_id', task.id))
  if (task.subtasks?.length) await one(await client.from('task_subtasks').insert(task.subtasks.map((sub, index) => ({ task_id: saved.id, title: sub.t, is_done: sub.done, position: index }))))
}
export async function removeTask(id) { if (isUuid(id)) await one(await requireClient().from('tasks').delete().eq('id', id)) }

export async function saveWorkspace(id, patch) {
  if (!isUuid(id)) return
  await one(await requireClient().from('workspaces').update({ name: patch.name, mode: patch.mode, join_code: patch.join_code, is_locked: patch.is_locked, advisor_name: patch.advisor_name, advisor_email: patch.advisor_email }).eq('id', id))
}
export async function removeWorkspace(id) { if (isUuid(id)) await one(await requireClient().rpc('delete_workspace', { p_workspace_id: id })) }
export async function regenerateJoinCode(id) { return one(await requireClient().rpc('regenerate_workspace_join_code', { p_workspace_id: id })) }
export async function setJoinLock(id, locked) { await one(await requireClient().rpc('set_workspace_join_lock', { p_workspace_id: id, p_locked: locked })) }
export async function saveMember(ws, member) {
  if (!isUuid(ws) || !isUuid(member.id)) return
  await one(await requireClient().from('workspace_members').update({ team_role: member.role, is_active: member.status !== 'inactive' }).eq('workspace_id', ws).eq('user_id', member.id))
}
export async function removeMember(ws, id) { if (isUuid(ws) && isUuid(id)) await one(await requireClient().from('workspace_members').update({ is_active: false }).eq('workspace_id', ws).eq('user_id', id)) }

export async function saveProposal(ws, proposal) {
  if (!isUuid(ws)) return
  const row = { workspace_id: ws, title: proposal.title, abstract: proposal.abstract, status: proposal.status }
  if (isUuid(proposal.id)) row.id = proposal.id
  await one(await requireClient().from('proposals').upsert(row))
}
export async function removeProposal(id) { if (isUuid(id)) await one(await requireClient().from('proposals').delete().eq('id', id)) }
export async function saveLog(ws, log) {
  if (!isUuid(ws)) return
  const row = { workspace_id: ws, week_label: log.week, finished: log.finished, next_steps: log.next, blockers: log.blockers, status: log.status, review_note: log.note || null }
  if (isUuid(log.id)) row.id = log.id
  await one(await requireClient().from('weekly_logs').upsert(row))
}
export async function removeLog(id) { if (isUuid(id)) await one(await requireClient().from('weekly_logs').delete().eq('id', id)) }
export async function reviewLog(id, status, note) {
  await one(await requireClient().rpc('review_weekly_log', { p_log_id: id, p_status: status, p_note: note }))
}
export async function saveMeeting(ws, meeting) {
  if (!isUuid(ws)) return
  const row = { workspace_id: ws, title: meeting.title, meeting_date: meeting.date, agenda: meeting.agenda, notes: meeting.notes, action_items: meeting.actions || [] }
  if (isUuid(meeting.id)) row.id = meeting.id
  const saved = one(await requireClient().from('meetings').upsert(row).select('id').single())
  for (const [userId, status] of Object.entries(meeting.attendance || {})) {
    if (!isUuid(userId)) continue
    if (status) await one(await requireClient().from('meeting_attendance').upsert({ meeting_id: saved.id, user_id: userId, status }))
    else await one(await requireClient().from('meeting_attendance').delete().eq('meeting_id', saved.id).eq('user_id', userId))
  }
}
export async function removeMeeting(id) { if (isUuid(id)) await one(await requireClient().from('meetings').delete().eq('id', id)) }
export async function saveRating(ws, rating) {
  if (!isUuid(ws) || !isUuid(rating.memberId)) return
  const client = requireClient()
  const { user } = one(await client.auth.getUser())
  await one(await client.from('member_ratings').upsert({
    workspace_id: ws, member_id: rating.memberId, rater_id: user.id,
    reliability: rating.reliability, quality: rating.quality, communication: rating.communication, note: rating.note,
  }, { onConflict: 'workspace_id,member_id,rater_id' }))
}
export async function removeRating(ws, memberId) {
  if (!isUuid(ws) || !isUuid(memberId)) return
  const client = requireClient()
  const { user } = one(await client.auth.getUser())
  await one(await client.from('member_ratings').delete().eq('workspace_id', ws).eq('member_id', memberId).eq('rater_id', user.id))
}

export async function sendMessage(ws, message) {
  if (!isUuid(ws)) return
  const client = requireClient()
  const { user } = one(await client.auth.getUser())
  const channel = one(await client.from('chat_channels').select('id').eq('workspace_id', ws).eq('kind', message.channel).single())
  await one(await client.from('chat_messages').insert({ channel_id: channel.id, workspace_id: ws, author_id: user.id, author_name: message.author, author_role: message.role, body: message.text || null, audio_storage_path: message.audio_path || null }))
}
export async function updateMessage(message) {
  if (isUuid(message.id)) await one(await requireClient().from('chat_messages').update({ body: message.text || null, is_pinned: !!message.pinned }).eq('id', message.id))
}
export async function removeMessage(id) { if (isUuid(id)) await one(await requireClient().from('chat_messages').delete().eq('id', id)) }

export async function uploadFile(ws, file, tag = 'Report') {
  if (!isUuid(ws)) return null
  const client = requireClient()
  const path = `${ws}/${crypto.randomUUID()}-${file.name.replace(/[\\/]/g, '_')}`
  await one(await client.storage.from('workspace-documents').upload(path, file, { upsert: false }))
  const row = one(await client.from('workspace_documents').insert({ workspace_id: ws, name: file.name, tag, storage_path: path, size_bytes: file.size, mime_type: file.type }).select('*').single())
  return { ...row, url: await signedUrl('workspace-documents', path) }
}
export async function uploadVoice(ws, blob) {
  if (!isUuid(ws)) return null
  const client = requireClient()
  const path = `${ws}/${crypto.randomUUID()}.webm`
  await one(await client.storage.from('voice-notes').upload(path, blob, { contentType: 'audio/webm', upsert: false }))
  return { path, url: await signedUrl('voice-notes', path) }
}
export async function saveDocument(ws, document) {
  if (isUuid(ws) && isUuid(document.id)) await one(await requireClient().from('workspace_documents').update({ name: document.name, tag: document.tag }).eq('id', document.id).eq('workspace_id', ws))
}
export async function removeDocument(document) {
  if (!document || !isUuid(document.id)) return
  const client = requireClient()
  await one(await client.from('workspace_documents').delete().eq('id', document.id))
  if (document.storage_path) await one(await client.storage.from('workspace-documents').remove([document.storage_path]))
}
export async function logActivity(ws, action) {
  if (isUuid(ws)) await one(await requireClient().from('activity_logs').insert({ workspace_id: ws, action }))
}

export function subscribeWorkspace(ws, callback) {
  if (!supabase || !isUuid(ws)) return () => {}
  const tables = ['tasks', 'weekly_logs', 'meetings', 'proposals', 'workspace_documents', 'chat_messages', 'activity_logs', 'workspace_members', 'workspace_advisors']
  const channel = supabase.channel(`workspace-${ws}`)
  tables.forEach(table => channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `workspace_id=eq.${ws}` }, callback))
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${ws}` }, payload => callback({ ...payload, table: 'workspaces' }))
  channel.subscribe()
  return () => { supabase.removeChannel(channel) }
}
