require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// MongoDB connection string. Accept both MONGODB_URI (the Render/Atlas
// convention) and the legacy MONGO_URI, preferring MONGODB_URI. There is NO
// hardcoded localhost fallback in production: if the platform env var is missing
// we fail loudly at boot instead of silently connecting to 127.0.0.1 (the cause
// of the Render fallback). Localhost is only used outside production for dev.
const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  (isProduction ? '' : 'mongodb://127.0.0.1:27017/nilecon_hr');

if (!mongoUri) {
  throw new Error(
    'Missing MongoDB connection string. Set MONGODB_URI (preferred) or MONGO_URI ' +
      'in the environment.'
  );
}

const lineChannelId = process.env.LINE_CHANNEL_ID || '';

// Mock mode is on if explicitly enabled OR if no channel id is configured.
const lineMockEnabled =
  String(process.env.LINE_MOCK_ENABLED).toLowerCase() === 'true' || !lineChannelId;

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 4000,
  mongoUri,

  // LINE
  lineChannelId,
  lineMockEnabled,
  // Messaging API channel access token (for push notifications). When empty,
  // pushes are skipped gracefully so dev/mock mode never fails on delivery.
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',

  // JWT (HR sessions)
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',

  // Password hashing
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,

  // Default HR/Admin credentials used by the seed script (npm run seed) and by
  // the on-boot auto-seed (see userService.ensureDefaultAdmin).
  hrDefaultUsername: (process.env.HR_DEFAULT_USERNAME || 'admin').toLowerCase(),
  hrDefaultPassword: process.env.HR_DEFAULT_PASSWORD || 'ChangeMe123!',
  // True when the admin password falls back to the built-in default (i.e. no
  // HR_DEFAULT_PASSWORD was provided) — used to warn loudly in production.
  hrDefaultPasswordIsFallback: !process.env.HR_DEFAULT_PASSWORD,
  hrDefaultNationalId: process.env.HR_DEFAULT_NATIONAL_ID || '000000',

  // Auto-create the default admin on a successful DB connection when no admin
  // exists yet. Defaults ON everywhere so a fresh cloud DB (e.g. Render + Atlas)
  // self-heals with no manual seed and without depending on NODE_ENV being set.
  // Disable only by explicitly setting AUTO_SEED_ADMIN=false. The operation is
  // idempotent, so leaving it on is safe on every boot.
  autoSeedAdmin: String(process.env.AUTO_SEED_ADMIN ?? 'true').toLowerCase() !== 'false',
};
