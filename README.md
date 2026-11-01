# Social App

A small multi-user social app built with React + TypeScript + Vite, an Express
API, JWT auth and MongoDB. Sign in, set up a profile, share photos in a global
feed, visit other people's profiles and message them directly.

## Features

- Sign up / sign in with email + password (bcrypt hashed, JWT session)
- Protected routes: signed-out users are sent to `/login`
- Feed page at `/feed`: everyone can post a photo with an optional caption and
  see posts from all users, newest first
- Public profile pages at `/users/:id` with profile info, gallery and posts;
  click any post author to open theirs
- Direct messages:
  - find people by name and start a private conversation
  - inbox with last message, timestamps and unread counts
  - automatic refresh every few seconds (history is stored in MongoDB)
  - unread messages are marked read when you open the conversation
- Profile page at `/profile`:
  - profile picture upload
  - name and bio (300 character limit)
  - up to 9 optional gallery photos
  - saved to MongoDB, reloads after a page refresh
- New accounts start on profile setup; after saving they land on the feed
- Images are stored in MongoDB in production, or in `server/uploads/` for
  local development. Cloudinary is optional.

## Requirements

- Node.js 20+
- A MongoDB database (local `mongod` or a free MongoDB Atlas cluster)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `server/.env` (copy `server/.env.example`) and add your MongoDB
   connection string:

   ```env
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/
   PORT=5000
   JWT_SECRET=a-long-random-string
   ```

   `MONGO_URI` is also accepted instead of `MONGODB_URI`. `MONGO_DB` is
   optional — the database name is taken from the connection string when
   present, otherwise `social-app` is used. `.env` files are git-ignored — never
   commit them.

3. Start the API (terminal 1):

   ```bash
   npm run server
   ```

4. Start the frontend (terminal 2):

   ```bash
   npm run dev
   ```

5. Open http://localhost:5173 — create an account from the sign-up form, or
   sign in. Vite proxies `/api` and `/uploads` to `http://localhost:5000`.

## Deployment

Everything runs on **Vercel** and **MongoDB Atlas** — no separate API host:

- Vercel serves the Vite frontend.
- `api/index.js` runs the Express API as a Vercel Function at `/api`.
- Atlas stores users, posts, conversations, messages and images.

Vercel Functions cannot keep a Socket.IO connection open, so the chat client
polls for new messages every 2.5 seconds. Delivery is near-real-time without
another hosting account.

### 1. Vercel environment variables

In the Vercel project → **Settings → Environment Variables**, add:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=a-long-random-string
NODE_ENV=production
```

`STORE_IMAGES=mongo` is optional because `NODE_ENV=production` already selects
MongoDB. Do **not** set `VITE_API_URL` when the frontend and API share the same
Vercel domain. Never put `MONGODB_URI` or `JWT_SECRET` in a `VITE_*` variable.

### 2. Deploy

Push to `main`; Vercel builds the frontend and the function automatically.
Alternatively, run `vercel --prod`.

In MongoDB Atlas → **Network Access**, allow `0.0.0.0/0`. Vercel Functions use
changing outbound IPs, so a fixed allowlist will not work.

Check `https://your-project.vercel.app/api/health`; it should return
`{"ok":true,"service":"social-app-api"}`.

### 3. Image storage

Production uploads go into the `images` collection in Atlas. Atlas's free tier
includes 512 MB, and each image is limited to **3 MB** so the base64 request
stays under Vercel's 4.5 MB function limit.

Cloudinary remains optional: set `CLOUDINARY_URL` if you later want a CDN and
larger images.

Images uploaded locally before deployment keep `/uploads/...` paths. Re-upload
them from the profile page after the production API is live.

## Scripts

| Script           | What it does                          |
| ---------------- | ------------------------------------- |
| `npm run dev`    | Start the Vite dev server (port 5173) |
| `npm run server` | Start the Express API (port 5000)     |
| `npm run build`  | Type-check and build for production   |
| `npm run lint`   | Run ESLint                            |

## API

| Method | Route                | Auth | Description                          |
| ------ | -------------------- | ---- | ------------------------------------ |
| GET    | `/api/health`        | –    | Health check                         |
| GET    | `/api/images/:id`    | –    | Serve an image stored in MongoDB     |
| POST   | `/api/auth/register` | –    | Create account, returns JWT + user   |
| POST   | `/api/auth/login`    | –    | Sign in, returns JWT + user          |
| GET    | `/api/auth/me`       | ✓    | Current user (used to restore session)|
| PUT    | `/api/profile`       | ✓    | Update name, bio, picture, photos    |
| GET    | `/api/posts`         | ✓    | Feed of posts from all users         |
| POST   | `/api/posts`         | ✓    | Create a post (image + caption)      |
| GET    | `/api/users?q=`      | ✓    | Search other users by name           |
| GET    | `/api/users/:id`     | ✓    | Public profile + that user's posts   |
| POST   | `/api/uploads`       | ✓    | Upload an image (base64 data URL)    |
| GET    | `/api/conversations` | ✓    | My conversations + unread counts     |
| POST   | `/api/conversations` | ✓    | Open/create a DM with `{ userId }`   |
| GET    | `/api/conversations/:id/messages` | ✓ | Latest 100 messages      |
| POST   | `/api/conversations/:id/messages` | ✓ | Send a text message      |
| POST   | `/api/conversations/:id/read`     | ✓ | Mark a conversation read |

Only conversation participants can read or send in a thread. The client polls
the conversation and inbox endpoints; there is no WebSocket server.

## Project layout

```
api/
  index.js         Vercel Function entry point (connects to MongoDB)
server/
  app.js           Express app and all REST routes
  server.js        Local API process (port 5000)
  config.js        Loads server/.env
  db.js            MongoDB connection + indexes
  .env             Local secrets (git-ignored)
  uploads/         Local uploaded images (git-ignored)
src/
  pages/           AuthPage, FeedPage, ProfilePage, UserProfilePage, MessagesPage
  components/      TopBar, route guards, page loader
  context/         AuthContext (session + user), ChatContext (inbox + unread)
  lib/             API client, image/format helpers
```

## Next steps

- Likes and comments on posts
- Followers and a people directory
- Group conversations and message attachments
