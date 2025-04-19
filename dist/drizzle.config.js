import env from '@/env';
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema/index.ts',
    out: './src/db/migrations',
    dbCredentials: {
        url: env.DATABASE_URL,
    },
});
