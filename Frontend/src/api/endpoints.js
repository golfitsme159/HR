import client from './client';

// All calls return the `data` payload from our { success, data } envelope.
const unwrap = (res) => res.data.data;

// ---- Auth ----------------------------------------------------------------
export const authApi = {
  // Employee: resolve the current employee from their LINE token. 401 = unlinked.
  me: () => client.get('/auth/me').then(unwrap),
  linkLine: (idToken, nationalIdLast6) =>
    client.post('/auth/link-line', { idToken, nationalIdLast6 }).then(unwrap),
  hrLogin: (username, password) =>
    client.post('/auth/hr-login', { username, password }).then(unwrap),
};

// ---- Employee: WFH & Leave ----------------------------------------------
export const employeeApi = {
  requestWfh: (requestedDate) =>
    client.post('/wfh/request', { requestedDate }).then(unwrap),
  // Reschedule a pending/approved WFH request to a new date (re-validated server-side).
  modifyWfh: (id, requestedDate) =>
    client.put(`/wfh/${id}`, { requestedDate }).then(unwrap),
  // Cancel a pending/approved WFH request.
  cancelWfh: (id) => client.put(`/wfh/${id}`, { cancel: true }).then(unwrap),
  myWfh: () => client.get('/wfh/mine').then(unwrap),
  requestLeave: (payload) => client.post('/leave/request', payload).then(unwrap),
  myLeaves: () => client.get('/leave/mine').then(unwrap),
};

// ---- HR -----------------------------------------------------------------
export const hrApi = {
  listWfh: (status) => client.get('/hr/requests', { params: { status } }).then(unwrap),
  decideWfh: (requestId, status) =>
    client.post('/hr/approve', { requestId, status }).then(unwrap),
  listLeaves: (status) => client.get('/hr/leaves', { params: { status } }).then(unwrap),
  decideLeave: (requestId, status) =>
    client.post('/hr/leave/approve', { requestId, status }).then(unwrap),
  staff: () => client.get('/hr/staff').then(unwrap),
  createEmployee: (payload) => client.post('/hr/employees', payload).then(unwrap),
};
