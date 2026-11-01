import app from '../server/app.js'
import { connectDB } from '../server/db.js'

let dbPromise = null

async function ensureDatabase() {
  if (!dbPromise) {
    dbPromise = connectDB().catch((error) => {
      // Allow the next invocation to retry after a cold-start failure.
      dbPromise = null
      throw error
    })
  }

  return dbPromise
}

export default async function handler(req, res) {
  try {
    await ensureDatabase()
    return app(req, res)
  } catch (error) {
    console.error('Database connection failed:', error.message)
    return res.status(500).json({ error: 'Database connection failed.' })
  }
}
