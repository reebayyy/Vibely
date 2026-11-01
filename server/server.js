import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import bcrypt from 'bcryptjs'
import { v2 as cloudinary } from 'cloudinary'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { Server as SocketServer } from 'socket.io'

import './config.js'
import { connectDB, getDB } from './db.js'

const PORT = Number(process.env.PORT) || 5000
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error(
    'JWT_SECRET is missing. Add JWT_SECRET to server/.env before starting the server.',
  )
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, 'uploads')

const MAX_BIO_LENGTH = 300
const MAX_PHOTOS = 9
const MAX_MESSAGE_LENGTH = 2000
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

await fs.mkdir(UPLOADS_DIR, { recursive: true })

// Cloudinary is optional: local development falls back to server/uploads.
let cloudinaryReady = false
let cloudinaryCloudName = ''

if (process.env.CLOUDINARY_URL) {
  try {
    const cloudinaryUrl = new URL(process.env.CLOUDINARY_URL)
    cloudinaryCloudName = cloudinaryUrl.hostname
    cloudinary.config({
      cloud_name: cloudinaryCloudName,
      api_key: decodeURIComponent(cloudinaryUrl.username),
      api_secret: decodeURIComponent(cloudinaryUrl.password),
      secure: true,
    })
    cloudinaryReady = true
  } catch {
    console.warn(
      'CLOUDINARY_URL is invalid. Image uploads will use server/uploads instead.',
    )
  }
}

const app = express()

app.use(cors())
app.use(express.json({ limit: '12mb' }))
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }))

// ---------------------------------------------------------------------------
// Real-time (Socket.IO)
// ---------------------------------------------------------------------------

const httpServer = http.createServer(app)
const io = new SocketServer(httpServer, {
  cors: { origin: true, credentials: true },
})

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('unauthorized'))

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    socket.userId = payload.sub
    next()
  } catch {
    next(new Error('unauthorized'))
  }
})

io.on('connection', (socket) => {
  // Every signed-in user gets a private room so messages can be delivered
  // to all of their open tabs/devices.
  socket.join(`user:${socket.userId}`)
})

function notifyUser(userId, event, payload) {
  io.to(`user:${String(userId)}`).emit(event, payload)
}

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    bio: user.bio ?? '',
    profilePic: user.profilePic ?? '',
    photos: user.photos ?? [],
    profileCompleted: Boolean(user.profileCompleted),
    createdAt: user.createdAt,
  }
}

function publicProfile(user) {
  return {
    id: String(user._id),
    name: user.name,
    bio: user.bio ?? '',
    profilePic: user.profilePic ?? '',
    photos: user.photos ?? [],
    createdAt: user.createdAt,
  }
}

function createToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: '7d' })
}

function publicPost(post) {
  return {
    id: String(post._id),
    image: post.image,
    caption: post.caption ?? '',
    createdAt: post.createdAt,
    author: {
      id: String(post.author._id),
      name: post.author.name,
      profilePic: post.author.profilePic ?? '',
    },
  }
}

function publicConversation(conversation, otherUser, unreadCount = 0) {
  const last = conversation.lastMessage

  return {
    id: String(conversation._id),
    otherUser: {
      id: String(otherUser._id),
      name: otherUser.name,
      profilePic: otherUser.profilePic ?? '',
    },
    lastMessage: last
      ? {
          text: last.text,
          senderId: String(last.senderId),
          createdAt: last.createdAt,
        }
      : null,
    lastMessageAt: conversation.lastMessageAt ?? null,
    unreadCount,
    createdAt: conversation.createdAt,
  }
}

function publicMessage(message) {
  return {
    id: String(message._id),
    conversationId: String(message.conversationId),
    senderId: String(message.senderId),
    text: message.text,
    createdAt: message.createdAt,
  }
}

function otherParticipantId(conversation, userId) {
  return conversation.participants.find(
    (participant) => String(participant) !== String(userId),
  )
}

function directKeyFor(userIdA, userIdB) {
  return [String(userIdA), String(userIdB)].sort().join(':')
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    return res.status(401).json({ error: 'Please sign in to continue.' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Your session expired. Please sign in again.' })
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function isStoredImageUrl(value) {
  if (value.startsWith('/uploads/')) return true
  if (!cloudinaryReady) return false

  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'res.cloudinary.com' &&
      url.pathname.startsWith(`/${cloudinaryCloudName}/image/upload/`)
    )
  } catch {
    return false
  }
}

async function storeImage(buffer, extension) {
  if (!cloudinaryReady) {
    const filename = `${crypto.randomUUID()}.${extension}`
    await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer)
    return `/uploads/${filename}`
  }

  const uploaded = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'vibely', resource_type: 'image' },
      (error, result) => (error ? reject(error) : resolve(result)),
    )

    stream.end(buffer)
  })

  if (!uploaded?.secure_url) {
    throw new Error('Cloudinary did not return an image URL.')
  }

  return uploaded.secure_url
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'social-app-api' })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'social-app-api' })
})

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  const name = cleanText(req.body?.name, 40)
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password ?? '')

  if (name.length < 2) {
    return res.status(400).json({ error: 'Please enter your name.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }

  const users = getDB().collection('users')
  const existing = await users.findOne({ email })
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' })
  }

  const now = new Date()
  const doc = {
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    bio: '',
    profilePic: '',
    photos: [],
    createdAt: now,
    updatedAt: now,
  }

  const result = await users.insertOne(doc)
  const user = { ...doc, _id: result.insertedId }

  res.status(201).json({ token: createToken(result.insertedId), user: publicUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password ?? '')

  const user = await getDB().collection('users').findOne({ email })
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false

  if (!user || !passwordOk) {
    return res.status(401).json({ error: 'Incorrect email or password.' })
  }

  res.json({ token: createToken(user._id), user: publicUser(user) })
})

app.get('/api/auth/me', authRequired, async (req, res) => {
  const user = await getDB()
    .collection('users')
    .findOne({ _id: new ObjectId(req.userId) })

  if (!user) {
    return res.status(401).json({ error: 'Account not found. Please sign in again.' })
  }

  res.json({ user: publicUser(user) })
})

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

app.put('/api/profile', authRequired, async (req, res) => {
  const updates = {}

  if (req.body?.name !== undefined) {
    const name = cleanText(req.body.name, 40)
    if (name.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' })
    }
    updates.name = name
  }

  if (req.body?.bio !== undefined) {
    updates.bio = cleanText(req.body.bio, MAX_BIO_LENGTH)
  }

  if (req.body?.profilePic !== undefined) {
    const profilePic = cleanText(req.body.profilePic, 500)
    if (profilePic && !isStoredImageUrl(profilePic)) {
      return res.status(400).json({ error: 'Profile picture must be an uploaded image.' })
    }
    updates.profilePic = profilePic
  }

  if (req.body?.photos !== undefined) {
    if (!Array.isArray(req.body.photos)) {
      return res.status(400).json({ error: 'Photos must be a list.' })
    }
    const photos = req.body.photos.map((photo) => cleanText(photo, 500))
    if (photos.length > MAX_PHOTOS) {
      return res.status(400).json({ error: `You can upload up to ${MAX_PHOTOS} photos.` })
    }
    if (photos.some((photo) => !isStoredImageUrl(photo))) {
      return res.status(400).json({ error: 'Photos must be uploaded images.' })
    }
    updates.photos = photos
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update.' })
  }

  updates.updatedAt = new Date()
  updates.profileCompleted = true

  const result = await getDB()
    .collection('users')
    .findOneAndUpdate(
      { _id: new ObjectId(req.userId) },
      { $set: updates },
      { returnDocument: 'after' },
    )

  if (!result) {
    return res.status(404).json({ error: 'Account not found.' })
  }

  res.json({ user: publicUser(result) })
})

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

app.get('/api/users', authRequired, async (req, res) => {
  const query = cleanText(req.query.q, 50)

  if (!query) {
    return res.json({ users: [] })
  }

  const users = await getDB()
    .collection('users')
    .find({
      _id: { $ne: new ObjectId(req.userId) },
      name: new RegExp(escapeRegex(query), 'i'),
    })
    .project({ name: 1, profilePic: 1, bio: 1 })
    .sort({ name: 1 })
    .limit(20)
    .toArray()

  res.json({
    users: users.map((user) => ({
      id: String(user._id),
      name: user.name,
      profilePic: user.profilePic ?? '',
      bio: user.bio ?? '',
    })),
  })
})

app.get('/api/users/:id', authRequired, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'User not found.' })
  }

  const userId = new ObjectId(req.params.id)
  const user = await getDB().collection('users').findOne({ _id: userId })

  if (!user) {
    return res.status(404).json({ error: 'User not found.' })
  }

  const posts = await getDB()
    .collection('posts')
    .find({ authorId: userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray()

  res.json({
    user: publicProfile(user),
    posts: posts.map((post) => publicPost({ ...post, author: user })),
  })
})

// ---------------------------------------------------------------------------
// Direct messages
// ---------------------------------------------------------------------------

async function findConversationForUser(conversationId, userId) {
  if (!ObjectId.isValid(conversationId)) return null

  return getDB()
    .collection('conversations')
    .findOne({
      _id: new ObjectId(conversationId),
      participants: new ObjectId(userId),
    })
}

app.get('/api/conversations', authRequired, async (req, res) => {
  const me = new ObjectId(req.userId)

  const conversations = await getDB()
    .collection('conversations')
    .find({ participants: me })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(50)
    .toArray()

  if (conversations.length === 0) {
    return res.json({ conversations: [] })
  }

  const otherIds = conversations
    .map((conversation) => otherParticipantId(conversation, me))
    .filter(Boolean)

  const users = await getDB()
    .collection('users')
    .find({ _id: { $in: otherIds } })
    .project({ name: 1, profilePic: 1 })
    .toArray()

  const usersById = new Map(users.map((user) => [String(user._id), user]))

  const unreadRows = await getDB()
    .collection('messages')
    .aggregate([
      {
        $match: {
          conversationId: { $in: conversations.map((conversation) => conversation._id) },
          senderId: { $ne: me },
          readBy: { $ne: me },
        },
      },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
    ])
    .toArray()

  const unreadByConversation = new Map(
    unreadRows.map((row) => [String(row._id), row.count]),
  )

  res.json({
    conversations: conversations
      .map((conversation) => {
        const other = usersById.get(String(otherParticipantId(conversation, me)))
        if (!other) return null

        return publicConversation(
          conversation,
          other,
          unreadByConversation.get(String(conversation._id)) ?? 0,
        )
      })
      .filter(Boolean),
  })
})

app.post('/api/conversations', authRequired, async (req, res) => {
  const otherId = cleanText(req.body?.userId, 100)

  if (!ObjectId.isValid(otherId) || otherId === String(req.userId)) {
    return res.status(400).json({ error: 'Choose someone to message.' })
  }

  const me = new ObjectId(req.userId)
  const otherObjectId = new ObjectId(otherId)

  const other = await getDB().collection('users').findOne({ _id: otherObjectId })
  if (!other) {
    return res.status(404).json({ error: 'User not found.' })
  }

  const conversations = getDB().collection('conversations')
  const directKey = directKeyFor(me, otherObjectId)

  let conversation = await conversations.findOne({ directKey })
  let created = false

  if (!conversation) {
    const now = new Date()
    const doc = {
      participants: [me, otherObjectId],
      directKey,
      lastMessage: null,
      lastMessageAt: now,
      createdAt: now,
    }

    try {
      const result = await conversations.insertOne(doc)
      conversation = { ...doc, _id: result.insertedId }
      created = true
    } catch (error) {
      // A parallel request may have created the same direct conversation first.
      if (error?.code !== 11000) throw error
      conversation = await conversations.findOne({ directKey })
    }
  }

  if (!conversation) {
    return res.status(500).json({ error: 'Could not open this conversation.' })
  }

  res.status(created ? 201 : 200).json({
    conversation: publicConversation(conversation, other, 0),
  })
})

app.get('/api/conversations/:id/messages', authRequired, async (req, res) => {
  const conversation = await findConversationForUser(req.params.id, req.userId)
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found.' })
  }

  const messages = await getDB()
    .collection('messages')
    .find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray()

  res.json({ messages: messages.reverse().map(publicMessage) })
})

app.post('/api/conversations/:id/messages', authRequired, async (req, res) => {
  const conversation = await findConversationForUser(req.params.id, req.userId)
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found.' })
  }

  const rawText = typeof req.body?.text === 'string' ? req.body.text : ''
  const text = rawText.trim()

  if (!text) {
    return res.status(400).json({ error: 'Write a message before sending.' })
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return res
      .status(400)
      .json({ error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.` })
  }

  const senderId = new ObjectId(req.userId)
  const now = new Date()
  const doc = {
    conversationId: conversation._id,
    senderId,
    text,
    readBy: [senderId],
    createdAt: now,
  }

  const result = await getDB().collection('messages').insertOne(doc)
  const message = { ...doc, _id: result.insertedId }

  await getDB()
    .collection('conversations')
    .updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: { text, senderId, createdAt: now },
          lastMessageAt: now,
        },
      },
    )

  // The sender already has the message from the HTTP response; notify the
  // other participant so their inbox and open chat update instantly.
  notifyUser(otherParticipantId(conversation, req.userId), 'message:new', {
    message: publicMessage(message),
  })

  res.status(201).json({ message: publicMessage(message) })
})

app.post('/api/conversations/:id/read', authRequired, async (req, res) => {
  const conversation = await findConversationForUser(req.params.id, req.userId)
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found.' })
  }

  const me = new ObjectId(req.userId)

  await getDB()
    .collection('messages')
    .updateMany(
      {
        conversationId: conversation._id,
        senderId: { $ne: me },
        readBy: { $ne: me },
      },
      { $addToSet: { readBy: me } },
    )

  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Posts / feed
// ---------------------------------------------------------------------------

app.get('/api/posts', authRequired, async (req, res) => {
  const requested = Number(req.query.limit)
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), 50)
    : 30

  const posts = await getDB()
    .collection('posts')
    .aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author',
        },
      },
      { $unwind: '$author' },
      {
        $project: {
          image: 1,
          caption: 1,
          createdAt: 1,
          'author._id': 1,
          'author.name': 1,
          'author.profilePic': 1,
        },
      },
    ])
    .toArray()

  res.json({ posts: posts.map(publicPost) })
})

app.post('/api/posts', authRequired, async (req, res) => {
  const image = cleanText(req.body?.image, 500)
  const caption = cleanText(req.body?.caption, 300)

  if (!isStoredImageUrl(image)) {
    return res.status(400).json({ error: 'Upload an image before posting.' })
  }

  const user = await getDB()
    .collection('users')
    .findOne({ _id: new ObjectId(req.userId) })

  if (!user) {
    return res.status(401).json({ error: 'Account not found. Please sign in again.' })
  }

  const doc = {
    authorId: user._id,
    image,
    caption,
    createdAt: new Date(),
  }

  const result = await getDB().collection('posts').insertOne(doc)

  res.status(201).json({
    post: publicPost({ ...doc, _id: result.insertedId, author: user }),
  })
})

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

app.post('/api/uploads', authRequired, async (req, res) => {
  const dataUrl = String(req.body?.data ?? '')
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/)

  if (!match) {
    return res
      .status(400)
      .json({ error: 'Unsupported image. Use a JPEG, PNG, WebP or GIF file.' })
  }

  const [, mimeType, base64] = match
  const buffer = Buffer.from(base64, 'base64')

  if (buffer.byteLength === 0) {
    return res.status(400).json({ error: 'The image file is empty.' })
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return res.status(400).json({ error: 'Images must be 4 MB or smaller.' })
  }

  const url = await storeImage(buffer, ALLOWED_IMAGE_TYPES[mimeType])

  res.status(201).json({ url })
})

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That file is too large.' })
  }

  console.error(error)
  res.status(500).json({ error: 'Something went wrong on the server.' })
})

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

  httpServer.listen(PORT, () =>
    console.log(
      `Server running on port ${PORT} (images: ${cloudinaryReady ? 'Cloudinary' : 'local disk'})`,
    ),
  )
}

start()
