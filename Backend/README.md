# Nilecon HR — Backend

WFH & Leave Management API for a LINE LIFF app. Node.js · Express · MongoDB (Mongoose).

## Getting started

```bash
cd Backend
cp .env.example .env      # then edit values
npm install
npm run seed              # create the default HR/Admin + sample employees
npm run dev               # nodemon, or `npm start` for production
```

Requires a running MongoDB instance (`MONGO_URI`). The API listens on `PORT` (default `4000`).

## Environment

| Variable            | Description                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| `PORT`              | HTTP port (default `4000`).                                            |
| `MONGO_URI`         | MongoDB connection string.                                             |
| `LINE_CHANNEL_ID`   | LINE Login channel id — the `client_id` used to verify the ID token.   |
| `LINE_MOCK_ENABLED` | `true` to skip real LINE verification (dev). Auto-on if no channel id. |
| `JWT_SECRET`        | Secret for signing HR session tokens.                                  |
| `JWT_EXPIRES_IN`    | HR token lifetime (default `2h`).                                      |
| `BCRYPT_SALT_ROUNDS`| Password hashing cost (default `10`).                                  |
| `HR_DEFAULT_*`      | Username/password for the account created by `npm run seed`.           |

> **Timezone:** business-day rules use the server's local time. Run with
> `TZ=Asia/Bangkok` (or deploy in that timezone) so "today" matches employees.

## Authentication

Two separate auth schemes, both via `Authorization: Bearer <token>`:

- **Employees** authenticate with their **LINE ID token** (`liff.getIDToken()`).
  The `protectEmployee` middleware verifies it, looks up the user by `lineUserId`,
  and sets `req.user`. The account must be linked first (`POST /api/auth/link-line`).
- **HR/Admin** authenticate with a **JWT** from `POST /api/auth/hr-login`. The
  `protectHR` middleware verifies the JWT, reloads the user, and enforces role
  `HR`/`ADMIN`.

> **Mock mode** (`LINE_MOCK_ENABLED=true`): the raw idToken becomes the LINE user
> id, prefixed `mock:`. The seeded employee has `lineUserId: mock:emp-somchai`, so
> in dev you can call employee endpoints with `Authorization: Bearer emp-somchai`.

## Project structure

```
Backend/
├── server.js               # Entry point: connects DB, starts HTTP server
└── src/
    ├── app.js              # Express app, middleware, route mounting
    ├── config/             # env.js (config), db.js (Mongo connection)
    ├── models/             # User, WfhRequest, LeaveRequest (Mongoose schemas)
    ├── services/           # authService, lineService, wfhService, leaveService
    ├── controllers/        # HTTP request/response handlers (thin)
    ├── routes/             # Express routers (auth, wfh, leave, hr)
    ├── middleware/         # auth.js (protectEmployee/protectHR), errorHandler.js
    ├── scripts/            # seed.js (npm run seed)
    └── utils/              # ApiError, asyncHandler, dateUtils, token (JWT)
```

Layering: **routes → controllers → services → models**. Business rules live in
`services/`; controllers stay thin.

## API

Base path: `/api`. Responses are `{ success, data }` or `{ success: false, error }`.
🔒 = requires `Authorization: Bearer <token>`.

### Auth

**`POST /api/auth/link-line`** — link a pre-registered employee to their LINE account.

```json
{ "idToken": "<LIFF id token>", "nationalIdLast6": "123456" }
```

**`POST /api/auth/hr-login`** — HR/Admin login, returns a short-lived JWT.

```json
{ "username": "admin", "password": "ChangeMe123!" }
```

### Employee (🔒 LINE token)

**`POST /api/wfh/request`** — submit a WFH request. Employee taken from the token.

```json
{ "requestedDate": "2026-07-07" }
```

Rules: (1) future date, (2) **Tue/Wed/Thu only** (Sat/Sun/Mon/Fri blocked),
(3) ≥ 1 business day notice (a Tuesday must be filed by the prior Friday),
(4) no duplicate active request, (5) within `maxWfhPerMonth`.

**`POST /api/leave/request`** — submit an annual/personal/sick leave request.

```json
{ "leaveType": "ANNUAL", "startDate": "2026-07-13", "endDate": "2026-07-17" }
```

Rules: valid range (`endDate >= startDate`, not in the past), ≥ 1 business day in
range (weekends excluded from `numberOfDays`). For `ANNUAL`, requested days +
already-pending annual days must not exceed the employee's `annualLeaveQuota`.

### HR/Admin (🔒 JWT)

- **`GET /api/hr/requests?status=PENDING`** — list WFH requests.
- **`POST /api/hr/approve`** — `{ requestId, status }` decide a WFH request.
- **`GET /api/hr/leaves?status=PENDING`** — list leave requests.
- **`POST /api/hr/leave/approve`** — `{ requestId, status }` decide a leave
  request. Approving `ANNUAL` leave atomically deducts `numberOfDays` from the
  employee's `annualLeaveQuota` (guarded against a negative balance).

The deciding HR user comes from the JWT — `hrUserId` is never read from the body.
