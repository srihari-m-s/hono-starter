import env from '@/env';
import { pinoLogger } from 'hono-pino';
import path from 'path';
const logFilePath = path.join(process.cwd(), 'logs', 'app.log');
export function usePinoLogger() {
    return pinoLogger({
        pino: {
            level: env.LOG_LEVEL || 'info',
            transport: {
                target: 'pino/file',
                options: { destination: logFilePath, mkdir: true },
            },
            formatters: {
                log: (log) => ({ ...log, reqId: crypto.randomUUID() }),
            },
        },
    });
}
