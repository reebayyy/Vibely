import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load server/.env first, then fall back to a .env in the project root.
// Variables already set are not overwritten.
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true })
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true })
