# TeamChat

TeamChat is a responsive messaging application built for the Exactspace frontend assignment. Registered users can join a shared team conversation or chat one-to-one, with messages and likes saved in MongoDB and shared through Socket.IO.

## Features

- Sign up with a name, location, age, email and password; sign in and log out using an HTTP-only JWT session cookie.
- Browse and search registered people, see online status and open Team Chat or a private direct conversation.
- Each message shows the real account name and a separately labelled **Assignment label**, randomly chosen once from Alan, Bob, Carol, Dean and Elin. The label is saved with the message; it is not the sender's identity. This retains the original assignment requirement while showing the actual sender accurately.
- Like any message repeatedly. Every click atomically increments that message's own count and broadcasts the result.
- Search emojis by name, browse categories and insert an emoji at the cursor. Type `@` or use the mention control to insert one of the five assignment example names. These are examples, not mentions of registered accounts; valid names are rendered safely as text.
- Send with Enter or the Send button; Shift+Enter adds a line. Messages are limited to 2,000 characters and blank messages are rejected. The composer, error states and scroll behavior work across screen sizes.

## Project structure

```text
backend/src/    Express, sessions, models and Socket.IO
backend/test/   Validation and optional database integration tests
frontend/src/   React screens, composer and styles
package.json    npm workspace scripts
```

## Requirements and Atlas setup

- Node.js 20 or newer and npm.
- A MongoDB Atlas cluster and database user with read/write and index-creation permissions on the app database.
- In Atlas **Security > Network Access**, add the public IP address of the machine or server running the backend to the IP Access List. Use a suitably restricted rule.
- URL-encode any special characters in the MongoDB password when building the connection string. Never put the URI or JWT secret in frontend variables or commit them to Git.

## Local setup

From the project root, install all workspace dependencies:

```powershell
npm install
```

Copy `backend/.env.example` to `backend/.env` if you do not already have one. Set:

```env
MONGODB_URI=<your Atlas connection string>
JWT_SECRET=<a unique, randomly generated secret of at least 32 characters>
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

Keep the real values private. `backend/.env` is ignored by Git. A random JWT secret is required; changing it invalidates existing sessions. Copy `frontend/.env.example` to `frontend/.env` if needed and set `VITE_SERVER_URL=http://localhost:3001`. Both `localhost` values should use the same hostname for local cookie behavior.

Start the backend and frontend in **separate terminals** from the project root:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Open the Local URL printed by Vite, normally `http://localhost:5173`. If Vite chooses a different port, update `CLIENT_ORIGIN` and restart the backend. A MongoDB startup error means the URI, database permissions, network access or Atlas IP Access List needs attention.

## Existing messages

At startup the backend creates the Team Chat if necessary and migrates old messages that have no conversation. It keeps their original text, timestamp and likes, uses the old random username as their assignment label, and marks the actual sender as **Earlier message (unattributed)**. This update is idempotent and does not delete old records. Back up your database before deploying an upgrade to important data.

## Manual verification

1. Create two accounts with different email addresses. Use two different browser profiles, or a normal and an incognito window, so that their cookies remain separate.
2. Sign in to each account. Send messages in Team Chat and confirm they appear in both windows with the real name and a separate assignment label.
3. Select the other account in the sidebar and exchange private messages. A third account should not be able to join or read that direct conversation, including by changing the conversation ID in a request.
4. Click Like repeatedly and confirm the correct count updates in both windows and survives refresh. Refresh to confirm messages persist too.
5. Open another tab in the same signed-in profile. Close one tab and confirm that account stays online until its last connected tab closes. Check counts and indicators after reconnecting.
6. Test emoji search and insertion at the cursor, the five example mentions, keyboard controls, mobile layout, registration errors, logout, and login again.

## Tests and build

```powershell
npm test
npm run build
```

The validation tests run without a database. The integration test is skipped unless `TEST_MONGODB_URI` points to a **dedicated test database** with read/write and index-creation permission. It creates test accounts, sessions, conversations and messages, and removes its test records afterward; it also initializes Team Chat and runs the legacy migration on that test database. Do not use a production database as the test database.

```powershell
$env:TEST_MONGODB_URI = '<dedicated test database connection string>'
npm test
```

The integration test exercises account validation, duplicate email handling, password hashing, authenticated sockets, team messages, private access control, repeated likes, persistence, multiple tabs and logout. It does not replace browser, accessibility, cross-site cookie and mobile checks. The frontend production output is `frontend/dist`.

## Deployment

Deploy the Node backend to a host that supports Socket.IO and WebSocket connections. Install from the repository root and start it with `npm run start --workspace backend`. Configure `MONGODB_URI`, a long random `JWT_SECRET`, `CLIENT_ORIGIN` as the exact frontend origin (scheme, hostname and port), and `PORT` if needed. Allow the backend's outbound IP in Atlas. `/health` returns 200 when the database is connected and 503 when it is unavailable.

Deploy the Vite output as static files. Set `VITE_SERVER_URL` to the public HTTPS backend origin **before building**, run `npm run build`, and publish `frontend/dist`. CORS and Socket.IO are configured for credentials; the backend also checks the origin of state-changing HTTP requests and socket handshakes.

Use HTTPS in deployment. Set `COOKIE_SECURE=true`. For frontend and backend on different sites, set `COOKIE_SAME_SITE=none`; this requires secure cookies and can still be blocked by browsers that restrict third-party cookies. A same-site frontend and API deployment with `COOKIE_SAME_SITE=lax` is preferable. Verify login, logout, socket connections and cookie behavior on your actual domains.

## Interview explanation

React renders the conversation and tracks the current selection. Express validates sign-up and login; bcrypt hashes passwords, and a signed JWT in an HTTP-only cookie identifies a revocable server-side session. MongoDB stores users, conversations and messages. Socket.IO authenticates the same session, checks membership before joining or modifying a conversation, then broadcasts a saved message only to that room. The backend tracks a set of sockets per user for presence. MongoDB's atomic `$inc` keeps repeated or concurrent likes independent and consistent.

## Known limitations

- Presence and login throttling are held in one server's memory. Multiple backend instances need a shared presence store, Socket.IO adapter and shared rate limiting before their counts or enforcement can be relied on.
- Password reset, email verification, account editing, moderation, message deletion, read receipts, typing indicators and file uploads are not implemented. This is an assignment demo, not a production-ready public service.
- Histories and user lists are loaded in full; pagination and more efficient preview queries are needed at larger scale.
- A request can time out after the message is saved. The composer retains the text and asks the user to check the thread before retrying; it does not retry automatically.
- Sessions expire after seven days. Logging out revokes the current session and disconnects its tabs; separate sign-ins remain separate sessions.
