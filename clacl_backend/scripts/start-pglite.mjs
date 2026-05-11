#!/usr/bin/env node
// Standalone PGlite server. Spawns a WASM-based Postgres listening on TCP,
// which the NestJS backend (via Prisma's adapter-pg) treats as a regular
// postgres server. No system-level postgres install required.
//
// Persists data under ./pgdata so restarts keep state.

import { PGlite } from '@electric-sql/pglite';
import { fromNodeSocket } from 'pg-gateway/node';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.PGLITE_PORT ?? 5433);
const DATA_DIR = resolve(process.cwd(), process.env.PGLITE_DATA_DIR ?? 'pgdata');
const DB_NAME = process.env.PGLITE_DB ?? 'clacfun';
const USER = process.env.PGLITE_USER ?? 'clacfun';
const PASSWORD = process.env.PGLITE_PASSWORD ?? 'clacfun';

mkdirSync(DATA_DIR, { recursive: true });

console.log(`[pglite] Initializing at ${DATA_DIR}…`);
const db = await PGlite.create({ dataDir: DATA_DIR });
await db.waitReady;
console.log(`[pglite] Ready. Database "${DB_NAME}" available.`);

const server = createServer(async (socket) => {
  await fromNodeSocket(socket, {
    serverVersion: '16.0',
    auth: { method: 'trust' },
    async onMessage(data, { isAuthenticated }) {
      if (!isAuthenticated) return;
      return await db.execProtocolRaw(data);
    },
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[pglite] Listening on postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB_NAME}`);
  console.log(
    `[pglite] DATABASE_URL=postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB_NAME}?sslmode=disable`,
  );
});

const shutdown = async () => {
  console.log('\n[pglite] Shutting down…');
  server.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
