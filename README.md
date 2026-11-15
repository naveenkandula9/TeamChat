# TeamChat

A responsive full-stack chat application built for the Exactspace Front End / UI Developer internship assignment.

## Features

- User registration and login with JWT authentication
- Shared Team Chat and private one-to-one conversations
- Real-time messages, likes, and online status
- Searchable emoji picker and example-name mentions
- MongoDB message persistence
- Responsive desktop and mobile layout

Each message shows the registered sender and a separate **Assignment label** randomly selected from Alan, Bob, Carol, Dean, and Elin. Every click on Like increases that message's count.

## Tech stack

- **Frontend:** React, Vite, CSS, Socket.IO Client
- **Backend:** Node.js, Express, Socket.IO, JWT
- **Database:** MongoDB Atlas and Mongoose

## Setup

Install dependencies from the project root:

```bash
npm install
```

Create `backend/.env` using `backend/.env.example` and configure:

```env
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-long-random-secret>
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

Add your machine’s IP address to the MongoDB Atlas IP Access List. Never commit your `.env` file or real credentials.

## Run locally

Start the backend and frontend in separate terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Open `http://localhost:5173`, create an account, and sign in.

## Test

```bash
npm test
npm run build
```

To check real-time chat, sign in with two accounts using separate browser profiles. Send messages and likes, then refresh to check persistence.

## Known limitations

Presence currently supports one backend instance. Password reset, email verification, file uploads, and pagination are not implemented.

## Author

**Naveen Kandula**
