import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  } as any,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
})

// Keep connection alive — ping every 4 minutes
setInterval(async () => {
  try {
    await pool.query('SELECT 1')
  } catch (e) {
    // Silent — just a keep-alive ping
  }
}, 4 * 60 * 1000)

export const query = async (text: string, params?: any[], retries = 3): Promise<any> => {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect()
      try {
        const res = await client.query(text, params)
        return res
      } finally {
        client.release()
      }
    } catch (error: any) {
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('terminated')
      if (isTimeout && i < retries) {
        console.log(`DB timeout — retry ${i}/${retries}...`)
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      throw error
    }
  }
}

export const getClient = async () => {
  const client = await pool.connect()
  return client
}

export default pool