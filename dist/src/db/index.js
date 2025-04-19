import env from '@/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schemas from './schema';
export const connection = postgres(env.DATABASE_URL, {
    max: env.DB_MIGRATING || env.DB_SEEDING ? 1 : undefined,
    onnotice: env.DB_SEEDING ? () => { } : undefined,
});
export const db = drizzle(connection, { schema: schemas, logger: true });
export default db;
