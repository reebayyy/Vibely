import { MongoClient } from 'mongodb'

import './config.js'

let client = null
let db = null

function databaseNameFromUri(uri) {
  try {
    const name = new URL(uri).pathname.replace(/^\/+/, '').split('?')[0]
    return name || null
  } catch {
    return null
  }
}

export async function connectDB() {
  // Accept both common spellings of the connection string.
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI

  if (!uri) {
    throw new Error(
      'MONGODB_URI is missing. Add your MongoDB connection string to server/.env.',
    )
  }

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(
    process.env.MONGO_DB || databaseNameFromUri(uri) || 'social-app',
  )

  // One account per email address.
  await db.collection('users').createIndex({ email: 1 }, { unique: true })

  // Feed is sorted newest first.
  await db.collection('posts').createIndex({ createdAt: -1 })

  // One direct conversation per pair of users.
  await db.collection('conversations').createIndex(
    { directKey: 1 },
    {
      unique: true,
      partialFilterExpression: { directKey: { $type: 'string' } },
    },
  )

  // Chat history is loaded newest first for the newest 100 messages.
  await db.collection('messages').createIndex({ conversationId: 1, createdAt: -1 })

  return db
}

export function getDB() {
  if (!db) throw new Error('Database is not connected yet')
  return db
}

export async function closeDB() {
  await client?.close()
  client = null
  db = null
}
