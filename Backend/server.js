const app = require('./src/app');
const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const { ensureDefaultAdmin } = require('./src/services/userService');

async function bootstrap() {
  await connectDB();

  // Reconcile indexes so schema changes take effect on an EXISTING database.
  // createIndex won't modify an index that already exists with different
  // options, so the old sparse+unique lineUserId index (which broke multi-
  // employee pre-registration) must be dropped and rebuilt as the partial
  // index. syncIndexes() does exactly that. Best-effort: log but don't block.
  try {
    await User.syncIndexes();
    console.log('[server] User indexes synced (lineUserId partial index applied).');
  } catch (err) {
    console.error('[server] User index sync failed:', err.message);
  }

  // Auto-provision the default admin so a fresh cloud DB (e.g. Render + Atlas)
  // has a working HR login without a manual `npm run seed`. Idempotent and
  // best-effort: a failure here is logged but must not prevent the API booting.
  if (env.autoSeedAdmin) {
    try {
      const result = await ensureDefaultAdmin();
      if (result.created) {
        console.log(`[server] Auto-seeded default admin account: '${result.username}'.`);
        if (result.usedFallbackPassword) {
          console.warn(
            "[server] WARNING: admin created with the built-in default password. " +
              'Set HR_DEFAULT_PASSWORD and/or change it after first login.'
          );
        }
      } else {
        console.log(`[server] Admin account '${result.username}' already exists; skipping seed.`);
      }
    } catch (err) {
      console.error('[server] Admin auto-seed failed:', err.message);
    }
  }

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Nilecon HR API listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] ${signal} received, shutting down gracefully...`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
