import 'dotenv/config';
import mongoose from 'mongoose';
import { prepareDatabase } from './models.js';
import { createChatServer } from './server.js';
import { cookieOptions } from './auth.js';

const port = Number(process.env.PORT || 3001);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is missing. Add it to backend/.env before starting the server.');
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is missing or too short. Set a random secret of at least 32 characters in backend/.env.');
  process.exit(1);
}
try { cookieOptions(); } catch (error) { console.error(error.message); process.exit(1); }

mongoose.set('bufferCommands', false);
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await prepareDatabase();
} catch {
  console.error('Could not initialize MongoDB. Check the URI, permissions, network access, and Atlas IP Access List.');
  process.exit(1);
}

const server = createChatServer({ clientOrigin, jwtSecret: process.env.JWT_SECRET, isDatabaseReady: () => mongoose.connection.readyState === 1 });
mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected. Waiting for reconnection.');
  server.io.emit('service:status', { databaseReady: false });
});
mongoose.connection.on('connected', () => server.io.emit('service:status', { databaseReady: true }));
mongoose.connection.on('error', () => console.error('MongoDB connection error. Check the database and network settings.'));
server.httpServer.listen(port, () => console.log(`TeamChat server listening on port ${port}`));
