# Nilecon HR — Frontend

React (Vite) + Tailwind CSS frontend for the LINE LIFF WFH & Leave app.

## Getting started

```bash
cd Frontend
cp .env.example .env      # then edit values
npm install
npm run dev               # http://localhost:5173  (proxies /api -> :4000)
```

Run the backend (`../Backend`, `npm run dev` + `npm run seed`) alongside it.

### Running outside LINE (local dev)

The employee view normally needs the LINE app. For browser development, set
`VITE_DEV_LINE_TOKEN` to bypass the LIFF SDK and send a fixed id token. With the
backend in mock mode, the token becomes `mock:<token>`, so the seeded employee
(`lineUserId: mock:emp-somchai`) is reachable with:

```
VITE_DEV_LINE_TOKEN=emp-somchai
```

Leave `VITE_LIFF_ID`/`VITE_DEV_LINE_TOKEN` empty and set a real `VITE_LIFF_ID`
to run inside LINE for production.

## Routes

| Route       | Audience      | Auth                                            |
| ----------- | ------------- | ----------------------------------------------- |
| `/`         | —             | Landing / role picker                           |
| `/employee` | Employees     | LINE id token (via LIFF), attached automatically |
| `/hr`       | HR / Admin    | JWT from `/api/auth/hr-login` (localStorage)    |

## How auth is wired

`src/api/client.js` holds one axios instance with a **request interceptor that
picks the token by route**: on `/hr*` it sends the HR JWT from localStorage;
otherwise it sends the employee LINE id token held in memory (set after LIFF init
in `src/api/tokenStore.js`). A response interceptor clears a stale HR session on
401 so the login screen returns.

## Structure

```
src/
├── api/           client (axios + interceptor), tokenStore, endpoints
├── lib/           liff (SDK init/bypass), holidays (TH 2026), dates (WFH rules)
├── components/
│   ├── common/    ui.jsx — Card, Button, StatusBadge, Field, Alert, Spinner
│   ├── employee/  AccountLinking, EmployeeDashboard, WfhCalendar, LeaveForm, RequestsHistory
│   └── hr/        HrLogin, HrConsole, WfhApprovals, LeaveApprovals, EmployeeManagement
└── pages/         LandingPage, EmployeePage, HrPage
```

## Notes

- WFH calendar rules in `src/lib/dates.js` **mirror the backend** (block
  Sat/Sun/Mon/Fri, ≥ 1 business-day notice) and additionally disable Thai public
  holidays (`src/lib/holidays.js`). Holidays are enforced client-side only —
  verify the 2026 dates against the official calendar before go-live.
- The HR "acting as" dropdown is a confirmation gate; the authoritative approver
  is always the JWT holder recorded server-side.
