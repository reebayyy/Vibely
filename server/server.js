import './config.js'
import { connectDB } from './db.js'
import app, { imageStorage } from './app.js'

const PORT = Number(process.env.PORT) || 5000
const HOST = process.env.IP || '0.0.0.0'

async function start() {
  // Keep retrying so the API recovers automatically once Atlas/network access
  // is fixed, instead of crashing and leaving the frontend with 502 errors.
  for (;;) {
    try {
      await connectDB()
      console.log('Connected to MongoDB')
      break
    } catch (error) {
      console.error('\nCould not connect to MongoDB:', error.message)
      console.error(
        'Check server/.env and your Atlas Network Access (IP allowlist). Retrying in 10 seconds…\n',
      )
      await new Promise((resolve) => setTimeout(resolve, 10_000))
    }
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT} (images: ${imageStorage})`)
  })
}

start()
