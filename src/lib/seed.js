import { addDays } from './utils';
const T = (id, title, status, priority, category, module, due, assignee, subs = [], time) => ({ id, title, status, priority, category, module, due: addDays(due), assignee, time, subtasks: subs.map(([t, done]) => ({ t, done })) });
export const members = [
    { id: 'm1', name: 'Alex Johnson', email: 'alex@uni.edu', role: 'Team Lead', capacity: 6 },
    { id: 'm2', name: 'Sarah Miller', email: 'sarah@uni.edu', role: 'Frontend', capacity: 6 },
    { id: 'm3', name: 'Mike Chen', email: 'mike@uni.edu', role: 'Backend', capacity: 5 },
    { id: 'm4', name: 'Emma Davis', email: 'emma@uni.edu', role: 'Database', capacity: 5 },
    { id: 'm5', name: 'Liya Bekele', email: 'liya@uni.edu', role: 'Docs/QA', capacity: 4 },
];
export const tasks = [
    T('t1', 'Design homepage', 'To Do', 'High', 'Design', 'Frontend', 0, 'm2', [['Wireframe', true], ['Hero section', false], ['Footer', false]], '9:00 AM'),
    T('t2', 'Prepare wireframes', 'To Do', 'Medium', 'UI/UX', 'Frontend', 1, 'm2', [['Login', false], ['Dashboard', false]]),
    T('t3', 'Collect client requirements', 'To Do', 'Medium', 'Research', 'Docs', 2, 'm5', [], '10:30 AM'),
    T('t4', 'Setup style guide', 'To Do', 'Low', 'Design', 'Frontend', 5, 'm2'),
    T('t5', 'Dashboard UI', 'In Progress', 'High', 'Interface', 'Frontend', -1, 'm1', [['Kanban', true], ['Charts', false]]),
    T('t6', 'Auth + RBAC policies', 'In Progress', 'High', 'Development', 'Backend', 0, 'm3', [['Sign in', true], ['RLS', true], ['Roles', false]], '1:00 PM'),
    T('t7', 'Database schema', 'In Progress', 'Medium', 'Development', 'Database', 3, 'm4', [['Tables', true], ['Indexes', false]]),
    T('t8', 'API integration', 'In Progress', 'Medium', 'Development', 'Backend', 4, 'm3'),
    T('t9', 'Landing page review', 'In Review', 'Medium', 'Review', 'Frontend', 0, 'm2', [], '2:00 PM'),
    T('t10', 'Similarity checker', 'In Review', 'High', 'Prototype', 'Backend', 2, 'm3'),
    T('t11', 'Logo revision', 'In Review', 'Low', 'Branding', 'Docs', 6, 'm5'),
    T('t12', 'User research', 'Done', 'Medium', 'Research', 'Docs', -4, 'm5', [['Interviews', true]]),
    T('t13', 'Sitemap structure', 'Done', 'Low', 'Planning', 'Docs', -3, 'm1'),
    T('t14', 'Color system', 'Done', 'Low', 'Branding', 'Frontend', -2, 'm2'),
    T('t15', 'Typography setup', 'Done', 'Low', 'Design', 'Frontend', -1, 'm2'),
    T('t16', 'Send invoice', 'To Do', 'Low', 'Finance', 'Docs', 0, 'm1', [], '4:30 PM'),
];
export const team = { id: 'demo-team', name: 'Team Alpha', code: 'PPMS-ALPH-4821', locked: false, advisor: { name: 'Dr. Girma N.', email: 'advisor@uni.edu' } };
export const account = { name: 'Alex Johnson', email: 'alex@uni.edu', year: '2026/27', department: 'Information Technology', semester: 'Semester 1', status: 'approved' };
export const pastProjects = [
    { title: 'Online Student Project Proposal Management System', abstract: 'Web platform for submitting and reviewing final year project proposals with advisor feedback and duplicate checking.' },
    { title: 'Hospital Appointment Booking App', abstract: 'Mobile friendly appointment scheduling for outpatient clinics with SMS reminders.' },
    { title: 'Smart Library Management Information System', abstract: 'Digital library catalogue, borrowing and fine tracking for university libraries.' },
    { title: 'Pharmacy Point of Sale and Inventory', abstract: 'Multi tenant point of sale with expiry tracking and stock alerts for pharmacies.' },
];
export const proposals = [
    { id: 'p1', title: 'Team Task Tracker for Capstone Groups', abstract: 'A shared workspace where capstone groups track tasks, logbooks and advisor feedback.', status: 'Approved' },
];
export const logbooks = [
    { id: 'l1', week: 'Week 1', finished: 'Requirements gathering and repo setup', next: 'Database design', blockers: 'None', status: 'Approved', note: 'Good start.' },
    { id: 'l2', week: 'Week 2', finished: 'ER diagram, auth prototype', next: 'Kanban UI', blockers: 'Waiting on RLS review', status: 'Pending' },
];
export const meetings = [
    { id: 'mt1', title: 'Sprint 2 planning', date: addDays(-5), agenda: 'Scope, task split', notes: 'Agreed to ship Kanban first.', actions: ['Mike: finish auth', 'Sarah: dashboard UI'], attendance: { m1: 'Attended', m2: 'Attended', m3: 'Attended', m4: 'Excused', m5: 'Not Attended' } },
    { id: 'mt2', title: 'Advisor check-in', date: addDays(2), agenda: 'Demo progress', notes: '', actions: [], attendance: {} },
];
export const ratings = members.map((m, i) => ({ memberId: m.id, reliability: 4 - (i % 2), quality: 4, communication: 3 + (i % 2), note: '' }));
export const messages = [
    { id: 'c1', channel: 'team', author: 'Alex Johnson', role: 'Team Lead', text: 'Stand-up at 3 PM. Please update your tasks.', pinned: true, ts: new Date(Date.now() - 36e5).toISOString() },
    { id: 'c2', channel: 'team', author: 'Mike Chen', role: 'Backend', text: 'RLS policies are in review.', pinned: false, ts: new Date(Date.now() - 18e5).toISOString() },
    { id: 'c3', channel: 'advisor', author: 'Dr. Girma N.', role: 'Advisor', text: 'Please add the similarity check results to your next logbook.', pinned: false, ts: new Date(Date.now() - 72e5).toISOString() },
];
export const docs = [
    { id: 'd1', name: 'proposal-v1.pdf', tag: 'Proposal', size: 482000, type: 'application/pdf', date: addDays(-9) },
    { id: 'd2', name: 'er-diagram.png', tag: 'Design', size: 120000, type: 'image/png', date: addDays(-4) },
];
export const activity = [
    { id: 'a1', time: '09:20', who: 'Alex Johnson', text: 'moved "Dashboard UI" to In Progress' },
    { id: 'a2', time: '10:15', who: 'Sarah Miller', text: 'completed "Typography setup"' },
    { id: 'a3', time: '11:40', who: 'Mike Chen', text: 'added a comment to "API integration"' },
    { id: 'a4', time: '13:10', who: 'Emma Davis', text: 'changed priority of "Database schema" to Medium' },
];
