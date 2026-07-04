require('dotenv').config();

const lineChannelId = process.env.LINE_CHANNEL_ID || '';

// Mock mode is on if explicitly enabled OR if no channel id is configured.
const lineMockEnabled =
  String(process.env.LINE_MOCK_ENABLED).toLowerCase() === 'true' || !lineChannelId;

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nilecon_hr',

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

  // Default HR/Admin credentials used by the seed script (npm run seed)
  hrDefaultUsername: (process.env.HR_DEFAULT_USERNAME || 'admin').toLowerCase(),
  hrDefaultPassword: process.env.HR_DEFAULT_PASSWORD || 'ChangeMe123!',
};
