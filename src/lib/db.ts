import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing!");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase/Vercel Postgres
  }
});

export default pool;
