import pg from 'pg';
import { config } from './config.mjs';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
export const query = (text, params) => pool.query(text, params);
export const closeDb = () => pool.end();
