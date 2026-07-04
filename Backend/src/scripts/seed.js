/**
 * Seed script: creates a default HR/Admin account (for hr-login) and a couple
 * of sample employees for local development.
 *
 *   npm run seed
 *
 * In LINE mock mode, an employee whose lineUserId is "mock:<x>" can authenticate
 * by sending `Authorization: Bearer <x>` (the raw idToken becomes "mock:<x>").
 * e.g. the sample below is reachable with `Authorization: Bearer emp-somchai`.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const env = require('../config/env');
const User = require('../models/User');

async function upsertUser(filter, doc) {
  const user = await User.findOneAndUpdate(
    filter,
    { $set: doc },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return user;
}

async function seed() {
  await connectDB();

  const passwordHash = await bcrypt.hash(env.hrDefaultPassword, env.bcryptSaltRounds);

  const admin = await upsertUser(
    { username: env.hrDefaultUsername },
    {
      fullName: 'System Administrator',
      nickname: 'Admin',
      nationalIdLast6: '000000',
      role: 'ADMIN',
      username: env.hrDefaultUsername,
      passwordHash,
    }
  );

  await upsertUser(
    { nationalIdLast6: '123456' },
    {
      fullName: 'Somchai Jaidee',
      nickname: 'Chai',
      nationalIdLast6: '123456',
      role: 'EMPLOYEE',
      lineUserId: 'mock:emp-somchai', // dev: Authorization: Bearer emp-somchai
      maxWfhPerMonth: 10,
      annualLeaveQuota: 6,
    }
  );

  await upsertUser(
    { nationalIdLast6: '654321' },
    {
      fullName: 'Suda Rakdee',
      nickname: 'Su',
      nationalIdLast6: '654321',
      role: 'EMPLOYEE',
      // Not linked yet — exercise POST /api/auth/link-line with idToken "su-token".
      maxWfhPerMonth: 8,
      annualLeaveQuota: 6,
    }
  );

  // eslint-disable-next-line no-console
  console.log('[seed] Done.');
  // eslint-disable-next-line no-console
  console.log(`[seed] HR login  -> username: ${admin.username}  password: ${env.hrDefaultPassword}`);
  // eslint-disable-next-line no-console
  console.log('[seed] Employee  -> Somchai (linked, Bearer emp-somchai), Suda (unlinked, nationalIdLast6 654321)');

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] Failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
