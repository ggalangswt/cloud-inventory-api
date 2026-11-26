import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

export function createDatabasePool(env = process.env) {
  return mysql.createPool({
    host: env.DB_HOST || '127.0.0.1',
    port: env.DB_PORT || 3306,
    database: env.DB_NAME || 'inventory_db',
    user: env.DB_USER || 'inventory_app',
    password: env.DB_PASSWORD ?? '',
    // Count an existing row as matched even when a PUT sends the same values.
    flags: 'FOUND_ROWS',
    dateStrings: true,
    connectTimeout: 5000,
    connectionLimit: 5,
    ssl: env.DB_SSL_CA
      ? {
          ca: readFileSync(env.DB_SSL_CA, 'utf8'),
          rejectUnauthorized: true,
          verifyIdentity: true,
        }
      : undefined,
  });
}
