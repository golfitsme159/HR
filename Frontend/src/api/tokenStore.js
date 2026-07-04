// Small token store shared by the axios interceptor.
//
// - The employee LINE id token lives in memory only (set after LIFF init).
// - The HR JWT is persisted in localStorage so a page refresh keeps the session.

const HR_TOKEN_KEY = 'nilecon_hr_jwt';
const HR_USER_KEY = 'nilecon_hr_user';

let lineIdToken = null;

export function setLineIdToken(token) {
  lineIdToken = token;
}
export function getLineIdToken() {
  return lineIdToken;
}

export function setHrSession(token, user) {
  localStorage.setItem(HR_TOKEN_KEY, token);
  localStorage.setItem(HR_USER_KEY, JSON.stringify(user));
}
export function getHrToken() {
  return localStorage.getItem(HR_TOKEN_KEY);
}
export function getHrUser() {
  const raw = localStorage.getItem(HR_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function clearHrSession() {
  localStorage.removeItem(HR_TOKEN_KEY);
  localStorage.removeItem(HR_USER_KEY);
}
