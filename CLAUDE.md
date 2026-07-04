# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WFH & Leave Management system for a **LINE LIFF** app.

- `Backend/` — Node.js · Express · MongoDB (Mongoose) REST API. Implemented.
- `Frontend/` — LIFF client (React + Vite + Tailwind). **Complete and operational.**
  Employee LIFF flow (account linking, WFH calendar, leave form, request history
  with modify/cancel) and the HR/Admin console (WFH & leave approvals, employee
  pre-registration) are all built. Run from `Frontend/`: `npm install`, then
  `npm run dev` (Vite dev server) or `npm run build`.

## Backend

### Commands (run from `Backend/`)

```bash
npm install         # install deps
npm run seed        # create default HR/Admin + sample employees
npm run dev         # start with nodemon (auto-reload)
npm start           # start with node (production)
```

Requires a running MongoDB (`MONGO_URI` in `.env`; copy from `.env.example`).
There is no test runner or linter configured yet.

### Timezone

Business-day rules use the **server's local time**. Run with `TZ=Asia/Bangkok`
(or deploy in that timezone) so "today" matches employees.

### LINE mock mode

`LINE_MOCK_ENABLED=true` (default when `LINE_CHANNEL_ID` is empty) skips real
LINE token verification and treats the raw `idToken` as the LINE user id, so the
link/request flow can be exercised locally without LINE. See
`src/services/lineService.js`.

### LINE push notifications

On every HR approve/reject decision, `lineService` best-effort pushes a Flex
Message to the employee via the Messaging API (`sendWfhStatusNotification` /
`sendLeaveStatusNotification`, green for APPROVED, red for REJECTED, hooked into
`wfhService.decideRequest` and `leaveService.decideLeaveRequest`). Requires
`LINE_CHANNEL_ACCESS_TOKEN`; in mock/dev mode (or with no token, or a `mock:`
user id) the push is **skipped and logged**, never throwing — so HR decisions
never fail on notification delivery.

### Architecture

Strict layering: **routes → controllers → services → models**.

- `server.js` connects Mongo then starts the HTTP server; `src/app.js` builds
  the Express app (helmet/cors/json/morgan) and mounts `src/routes` under `/api`.
- **Business rules live in `src/services/`**, not controllers. `wfhService.js` and
  `leaveService.js` own all validation; controllers stay thin and only marshal
  request/response.
- Errors: throw `ApiError(status, message)` (`src/utils/ApiError.js`) from any
  layer; the central handler in `src/middleware/errorHandler.js` renders it as
  `{ success: false, error }` and also normalizes Mongoose validation/cast/dup-key
  errors. Wrap every async route handler in `asyncHandler` (`src/utils/`) so
  rejections reach that handler.
- Date logic is centralized in `src/utils/dateUtils.js`.

### Authentication (two schemes, both `Authorization: Bearer <token>`)

Middleware in `src/middleware/auth.js`; logic in `src/services/authService.js`.

- **Employees** send their **LINE ID token**. `protectEmployee` verifies it,
  finds the user by `lineUserId`, sets `req.user`. Used on `/api/wfh/*` and
  `/api/leave/*`. Account must be linked first via `POST /api/auth/link-line`.
- **HR/Admin** send a **JWT** from `POST /api/auth/hr-login` (username/password,
  bcrypt-checked against `User.username`/`passwordHash`). `protectHR` verifies the
  JWT, reloads the user, enforces role `HR`/`ADMIN`. `router.use(protectHR)` guards
  all `/api/hr/*` routes.
- **Never trust body-supplied identity.** The deciding HR user and the requesting
  employee both come from `req.user`, not the request body.
- In **mock mode** the raw idToken becomes `mock:<token>` as the `lineUserId`
  (see `lineService.js`); the seeded employee is reachable with
  `Authorization: Bearer emp-somchai`.

### WFH business rules (in `wfhService`, shared by create & update via `assertWfhDateAllowed`)

1. Requested date must be in the future.
2. WFH allowed **only Tue/Wed/Thu** — Sat/Sun/Mon/Fri are blocked
   (`BLOCKED_WFH_DAYS` in `dateUtils.js`).
3. **Not a Thai public holiday** — enforced server-side via `isPublicHoliday`
   (`HOLIDAYS_2026` in `dateUtils.js`, incl. Songkran Apr 13–15). This mirrors
   `Frontend/src/lib/holidays.js` so the calendar and the API agree.
4. **≥ 1 business day notice**: `businessDaysBetween(today, requestedDate)` counts
   business days *strictly between* the two dates and must be ≥ 1. This is the
   anchor — a Tuesday request must be filed by the previous Friday (Monday is the
   one business day in between); filing on Monday for Tuesday gives 0 and fails.
5. No duplicate active (PENDING/APPROVED) request for the same day — also enforced
   by a partial unique index on `WfhRequest`.
6. Monthly count of non-rejected requests must stay within `user.maxWfhPerMonth`.

**Modify / cancel** (`PUT /api/wfh/:id`, `protectEmployee`, in
`wfhService.updateWfhRequest`): an employee may reschedule or cancel their **own**
PENDING/APPROVED request (ownership checked against `req.user`, never the body).
Rescheduling re-runs all six rules on the new date (ignoring this request in the
duplicate/quota checks) and drops the request back to **PENDING** for re-approval.
Cancelling sets status **CANCELLED** (a new enum value; excluded from the active
partial index so the day is freed) and still requires ≥ 1 business day of notice
on the original date, so last-minute cancels are blocked.

### Leave business rules (in `leaveService`)

- `leaveType` ∈ `ANNUAL` / `PERSONAL` / `SICK`. Range must be valid and not in the
  past; `numberOfDays` = **business days inclusive** (weekends never consume quota),
  computed once at creation and stored on the doc.
- **Quota applies to `ANNUAL` only.** At request time: `requested + already-pending
  annual days ≤ annualLeaveQuota`. At approval time the deduction is an **atomic
  guarded `$inc`** (`findOneAndUpdate` with `annualLeaveQuota: { $gte: numberOfDays }`)
  so concurrent approvals can't push the balance negative — if the guard fails the
  approval is rejected with 409.
- `annualLeaveQuota` is the **live remaining balance**, decremented on approval.

### Data model notes

- `User.nationalIdLast6` (unique) is how HR pre-registers employees; the employee
  later links their LINE account against it via `POST /api/auth/link-line`.
- `User.lineUserId` is `sparse` + `unique` — many unlinked (null) users allowed,
  but a LINE id maps to at most one user.
- `User.username` (sparse unique) + `passwordHash` (`select:false`) exist only on
  HR/Admin accounts. `passwordHash` is stripped in `toJSON` and zeroed after login.
- `WfhRequest` / `LeaveRequest` use Mongoose `timestamps` (`createdAt`/`updatedAt`);
  `decidedAt` records when HR approved/rejected. `WfhRequest` has a partial unique
  index blocking duplicate active (PENDING/APPROVED) requests per user per day.
