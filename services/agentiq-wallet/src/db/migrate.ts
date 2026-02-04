import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

export async function runMigrationsIfEnabled(log: (o: any) => void) {
  const enabled = (process.env.RUN_DB_MIGRATIONS || 'false') === 'true';
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!enabled) {
    log({ db_migrate: 'skipped', reason: 'RUN_DB_MIGRATIONS!=true' });
    return { ran: false, reason: 'disabled' };
  }
  if (!databaseUrl) {
    log({ db_migrate: 'skipped', reason: 'DATABASE_URL missing' });
    return { ran: false, reason: 'no_database_url' };
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const dir = path.resolve(process.cwd(), 'db/migrations');
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      const filePath = path.join(dir, f);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      log({ db_migrate_file: f, status: 'ok' });
    }
    log({ db_migrate: 'ok', files: files.length });
    return { ran: true, files: files.length } as any;
  } catch (e) {
    await client.query('ROLLBACK');
    log({ db_migrate: 'error', error: (e as Error).message });
    throw e;
  } finally {
    await client.end();
  }
}
