# Social App

A small multi-user social app built with React + TypeScript + Vite, an Express
API, JWT auth, MongoDB and Socket.IO. Sign in, set up a profile, share photos in a
global feed, visit other people's profiles and message them directly.

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
  - instant delivery through Socket.IO (history is still stored in MongoDB)
  - unread messages are marked read when you open the conversation
- Profile page at `/profile`:
  - profile picture upload
  - name and bio (300 character limit)
  - up to 9 optional gallery photos
  - saved to MongoDB, reloads after a page refresh
- New accounts start on profile setup; after saving they land on the feed
- Images are stored on the server in `server/uploads/` and served from `/uploads`

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
   sign in. Vite proxies `/api`, `/uploads` and `/socket.io` (including
   WebSockets) to `http://localhost:5000`.

## Deployment

Vercel can host the Vite frontend, but the Express API and Socket.IO server
need a long-running Node host (for example Render, Railway or Fly.io).

1. Deploy the API with `npm run server` and set these environment variables on
   that host (not in Vercel):

   ```env
   MONGODB_URI=...
   JWT_SECRET=...
   ```

   Allow the host to reach MongoDB Atlas under **Network Access**. Uploaded
   files live in `server/uploads/`; use a persistent disk or external storage
   if the host's filesystem is ephemeral.

2. Deploy the frontend to Vercel with build command `npm run build` and output
   directory `dist`. Add this environment variable, then redeploy:

   ```env
   VITE_API_URL=https://your-api-host.example.com
   ```

   `VITE_SOCKET_URL` is optional and defaults to `VITE_API_URL`. Never put
   `MONGODB_URI` or `JWT_SECRET` in a `VITE_*` variable — those values are
   exposed to the browser.

   `vercel.json` rewrites client-side routes such as `/feed` and `/messages`
   back to `index.html` so they survive a refresh.

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

Only conversation participants can read or send in a thread. New messages are
emitted over Socket.IO to the recipient's `user:<id>` room.

## Project layout

```
server/
  server.js        Express app, REST routes, Socket.IO server
  config.js        Loads server/.env
  db.js            MongoDB connection + indexes
  .env             Local secrets (git-ignored)
  uploads/         Uploaded images (git-ignored)
src/
  pages/           AuthPage, FeedPage, ProfilePage, UserProfilePage, MessagesPage
  components/      TopBar, route guards, page loader
  context/         AuthContext (session + user), ChatContext (inbox + unread)
  lib/             API client, Socket.IO client, image/format helpers
```

## Next steps

- Likes and comments on posts
- Followers and a people directory
- Group conversations and message attachments
