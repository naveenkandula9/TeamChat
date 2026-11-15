import mongoose from 'mongoose';
import { MAX_MESSAGE_LENGTH, NAMES } from './messageRules.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  location: { type: String, required: true, trim: true, maxlength: 100 },
  age: { type: Number, required: true, min: 13, max: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true, versionKey: false });

const conversationSchema = new mongoose.Schema({
  type: { type: String, enum: ['team', 'direct'], required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pairKey: { type: String },
}, { timestamps: true, versionKey: false });
conversationSchema.index({ pairKey: 1 }, { unique: true, sparse: true });
conversationSchema.index({ type: 1 }, { unique: true, partialFilterExpression: { type: 'team' } });

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignmentLabel: { type: String, enum: NAMES, required: true },
  text: { type: String, required: true, maxlength: MAX_MESSAGE_LENGTH },
  createdAt: { type: Date, default: Date.now, required: true },
  likes: { type: Number, default: 0, min: 0 },
}, { versionKey: false });
messageSchema.index({ conversation: 1, createdAt: 1, _id: 1 });

const sessionSchema = new mongoose.Schema({
  _id: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { versionKey: false });

export const User = mongoose.model('User', userSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
export const Session = mongoose.model('Session', sessionSchema);

export async function prepareDatabase() {
  await Promise.all([User.init(), Conversation.init(), Message.init(), Session.init()]);
  let team;
  try { team = await Conversation.findOneAndUpdate({ type: 'team' }, { $setOnInsert: { type: 'team', participants: [] } }, { upsert: true, new: true }); }
  catch (error) { if (error.code !== 11000) throw error; team = await Conversation.findOne({ type: 'team' }); }
  // Update raw legacy documents in place; their original name, text, date and likes stay intact.
  await Message.collection.updateMany({ conversation: { $exists: false } }, [
    { $set: { conversation: team._id, sender: null, assignmentLabel: '$username' } },
  ]);
  return team;
}

export function messageView(message) {
  return {
    id: String(message._id), conversationId: String(message.conversation),
    sender: message.sender ? { id: String(message.sender._id), name: message.sender.name } : null,
    assignmentLabel: message.assignmentLabel, text: message.text,
    createdAt: message.createdAt, likes: message.likes,
  };
}

export function userView(user) { return { id: String(user._id), name: user.name }; }
