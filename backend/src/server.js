import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { authenticate, cookieOptions, COOKIE_NAME, login, register, validateRegistration } from './auth.js';
import { Conversation, Message, Session, User, messageView, userView } from './models.js';
import { normalizeText, randomName } from './messageRules.js';

export function createChatServer({ clientOrigin, jwtSecret, isDatabaseReady = () => true }) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: clientOrigin, credentials: true, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) => callback(null, !req.headers.origin || req.headers.origin === clientOrigin),
  });
  io.engine.use(cookieParser());
  const online = new Map();
  const options = cookieOptions();
  const isId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id);
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== clientOrigin) return res.status(403).json({ error: 'Request origin is not allowed.' });
    next();
  });
  app.get('/health', (_req, res) => res.status(isDatabaseReady() ? 200 : 503).json({ status: isDatabaseReady() ? 'ok' : 'database unavailable' }));
  const requireAuth = wrap(async (req, _res, next) => {
    try { req.auth = await authenticate(req.cookies[COOKIE_NAME], jwtSecret); next(); }
    catch (error) { if (error.message === 'Authentication required.') throw fail(401, 'Please sign in.'); throw error; }
  });
  const attempts = new Map();
  app.post('/api/auth/register', wrap(async (req, res) => {
    try { validateRegistration(req.body); } catch (error) { throw fail(400, error.message); }
    try { await register(req.body); }
    catch (error) { if (error.code === 11000) throw fail(409, 'An account with that email already exists.'); throw error; }
    io.emit('users:changed');
    res.status(201).json({ message: 'Account created. Please sign in.' });
  }));
  app.post('/api/auth/login', wrap(async (req, res) => {
    const key = req.ip;
    const now = Date.now();
    const entry = attempts.get(key);
    const recent = entry && entry.until > now ? entry : { count: 0, until: now + 15 * 60 * 1000 };
    if (recent.count >= 15) throw fail(429, 'Too many attempts. Please try again later.');
    recent.count++; attempts.set(key, recent);
    try {
      const result = await login(req.body?.email, req.body?.password, jwtSecret);
      attempts.delete(key);
      res.cookie(COOKIE_NAME, result.token, options).json({ user: userView(result.user) });
    } catch (error) {
      if (error.message === 'Invalid email or password.') throw fail(401, error.message);
      throw error;
    }
  }));
  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: userView(req.auth.user) }));
  app.post('/api/auth/logout', requireAuth, wrap(async (req, res) => {
    await Session.deleteOne({ _id: req.auth.sessionId });
    res.clearCookie(COOKIE_NAME, { ...options, maxAge: undefined });
    for (const socket of io.sockets.sockets.values()) if (socket.data.auth.sessionId === req.auth.sessionId) socket.disconnect(true);
    res.json({ ok: true });
  }));

  const presence = () => [...online.keys()];
  const emitPresence = () => io.emit('presence:changed', { onlineUserIds: presence() });
  async function allowedConversation(id, userId) {
    if (!isId(id)) throw fail(400, 'Invalid conversation.');
    const conversation = await Conversation.findById(id).lean();
    if (!conversation || (conversation.type === 'direct' && !conversation.participants.some((id) => String(id) === userId))) throw fail(403, 'Conversation is unavailable.');
    return conversation;
  }
  function notifyConversation(conversation) {
    if (conversation.type === 'team') io.emit('conversations:changed');
    else for (const userId of conversation.participants) io.to(`user:${userId}`).emit('conversations:changed');
  }
  app.get('/api/users', requireAuth, wrap(async (req, res) => {
    const users = await User.find().select('name').sort({ name: 1 }).lean();
    const conversations = await Conversation.find({ $or: [{ type: 'team' }, { type: 'direct', participants: req.auth.user._id }] }).lean();
    const previews = await Promise.all(conversations.map(async (conversation) => {
      const last = await Message.findOne({ conversation: conversation._id }).sort({ createdAt: -1, _id: -1 }).select('text createdAt').lean();
      return { id: String(conversation._id), type: conversation.type, participants: conversation.participants.map(String), lastMessage: last ? { text: last.text, createdAt: last.createdAt } : null };
    }));
    res.json({ users: users.map(userView), conversations: previews, onlineUserIds: presence() });
  }));
  app.post('/api/conversations/direct', requireAuth, wrap(async (req, res) => {
    const otherId = req.body?.userId;
    const self = String(req.auth.user._id);
    if (!isId(otherId) || otherId === self || !(await User.exists({ _id: otherId }))) throw fail(400, 'Choose a valid user.');
    const participants = [self, otherId].sort();
    const pairKey = participants.join(':');
    let conversation;
    try { conversation = await Conversation.findOneAndUpdate({ pairKey }, { $setOnInsert: { type: 'direct', participants, pairKey } }, { new: true, upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; conversation = await Conversation.findOne({ pairKey }); }
    notifyConversation(conversation);
    res.json({ id: String(conversation._id) });
  }));
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error('Request failed.');
    res.status(status).json({ error: status >= 500 ? 'The request could not be completed. Please try again.' : error.message });
  });

  io.use(async (socket, next) => {
    try { socket.data.auth = await authenticate(socket.request.cookies?.[COOKIE_NAME], jwtSecret); next(); }
    catch (error) { next(new Error(error.message === 'Authentication required.' ? 'Authentication required.' : 'Database unavailable.')); }
  });
  io.on('connection', (socket) => {
    const userId = String(socket.data.auth.user._id);
    socket.join(`user:${userId}`);
    if (!online.has(userId)) online.set(userId, new Set());
    online.get(userId).add(socket.id);
    emitPresence();
    socket.emit('service:status', { databaseReady: isDatabaseReady() });
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, Math.min(socket.data.auth.expiresAt - Date.now(), 2147483647)));
    const handle = (event, action) => socket.on(event, async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const joinOrder = event === 'conversation:join' ? (socket.data.joinOrder = (socket.data.joinOrder || 0) + 1) : 0;
      try {
        if (!isDatabaseReady()) throw fail(503, 'Database is unavailable. Please try again shortly.');
        await authenticate(socket.request.cookies?.[COOKIE_NAME], jwtSecret);
        reply({ ok: true, data: await action(payload || {}, joinOrder) });
      } catch (error) {
        const message = error.status || ['Authentication required.', 'Please enter a message.'].includes(error.message) || error.message?.startsWith('Messages must be ') ? error.message : 'The request could not be completed. Please try again.';
        reply({ ok: false, error: message });
      }
    });
    handle('conversation:join', async ({ conversationId }, joinOrder) => {
      await allowedConversation(conversationId, userId);
      if (socket.data.joinOrder !== joinOrder) throw fail(409, 'A newer conversation was selected.');
      for (const room of socket.rooms) if (room.startsWith('conversation:')) socket.leave(room);
      socket.join(`conversation:${conversationId}`);
      const messages = await Message.find({ conversation: conversationId }).sort({ createdAt: 1, _id: 1 }).populate('sender', 'name').lean();
      return messages.map(messageView);
    });
    handle('message:create', async ({ conversationId, text }) => {
      const conversation = await allowedConversation(conversationId, userId);
      const message = await Message.create({ conversation: conversation._id, sender: userId, assignmentLabel: randomName(), text: normalizeText(text) });
      await message.populate('sender', 'name');
      const result = messageView(message);
      io.to(`conversation:${conversationId}`).emit('message:created', result);
      notifyConversation(conversation);
      return result;
    });
    handle('message:like', async ({ conversationId, messageId }) => {
      const conversation = await allowedConversation(conversationId, userId);
      if (!isId(messageId)) throw fail(400, 'Invalid message.');
      const message = await Message.findOneAndUpdate({ _id: messageId, conversation: conversation._id }, { $inc: { likes: 1 } }, { new: true }).populate('sender', 'name').lean();
      if (!message) throw fail(404, 'Message not found.');
      const result = messageView(message);
      io.to(`conversation:${conversationId}`).emit('message:updated', result);
      return result;
    });
    socket.on('disconnect', () => { clearTimeout(expiry); const connections = online.get(userId); connections?.delete(socket.id); if (!connections?.size) online.delete(userId); emitPresence(); });
  });
  return { app, httpServer, io };
}
