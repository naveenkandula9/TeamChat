import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { ArrowDown, ArrowLeft, Heart, LogOut, MessageCircle, Search, Users, X } from 'lucide-react';
import Auth from './Auth.jsx';
import Composer from './Composer.jsx';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
async function api(path, { method = 'GET', body } = {}) {
  let response;
  try { response = await fetch(`${SERVER}${path}`, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Could not reach the server. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
function mergeMessages(current, incoming) {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) { const old = messages.get(message.id); messages.set(message.id, old ? { ...old, ...message, likes: Math.max(old.likes, message.likes) } : message); }
  return [...messages.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id));
}
function initials(name) { return (name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function Avatar({ name, id, online, team = false }) {
  let hash = 0; for (const char of id || name || '') hash += char.charCodeAt(0);
  return <span className={`avatar color-${hash % 6} ${team ? 'team-avatar' : ''}`} aria-hidden="true">{team ? <Users size={20} /> : initials(name)}{online !== undefined && <span className={`avatar-status ${online ? 'is-online' : ''}`} />}</span>;
}
function MessageText({ text }) {
  return text.split(/(@(?:Alan|Bob|Carol|Dean|Elin)\b)/g).map((part, index) => /^@(Alan|Bob|Carol|Dean|Elin)$/.test(part) ? <span className="mention" key={index}>{part}</span> : part);
}
function MessageRow({ message, me, onLike, disabled }) {
  const name = message.sender?.name || 'Earlier message (unattributed)';
  const mine = message.sender?.id === me.id;
  const date = new Date(message.createdAt);
  const time = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  const full = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  return <article className={`message ${mine ? 'mine' : ''}`}><Avatar name={name} id={message.sender?.id || 'legacy'} /><div className="message-card"><div className="message-top"><strong>{mine ? `${name} (you)` : name}</strong><time dateTime={message.createdAt} title={full}>{time}</time></div><div className="assignment-label">Assignment label: {message.assignmentLabel}</div><p><MessageText text={message.text} /></p></div><button className="like-button" onClick={() => onLike(message.id)} disabled={disabled} aria-label={`Like ${name}'s message, ${message.likes} likes`} title="Add a like"><Heart size={15} /><span>{message.likes}</span></button></article>;
}

export default function App() {
  const [me, setMe] = useState(null), [checking, setChecking] = useState(true);
  const [users, setUsers] = useState([]), [conversations, setConversations] = useState([]), [onlineIds, setOnlineIds] = useState([]);
  const [selected, setSelected] = useState(null), [mobileOpen, setMobileOpen] = useState(false), [search, setSearch] = useState('');
  const [messages, setMessages] = useState([]), [connected, setConnected] = useState(false), [databaseReady, setDatabaseReady] = useState(false), [reloadTick, setReloadTick] = useState(0), [loading, setLoading] = useState(false), [directoryLoading, setDirectoryLoading] = useState(true), [error, setError] = useState(''), [nearBottom, setNearBottom] = useState(true);
  const socket = useRef(null), selectedRef = useRef(null), thread = useRef(null), near = useRef(true), meRef = useRef(me);
  selectedRef.current = selected; meRef.current = me;
  useEffect(() => { let active = true; api('/api/auth/me').then((result) => { if (active) setMe(result.user); }).catch(() => {}).finally(() => { if (active) setChecking(false); }); return () => { active = false; }; }, []);
  const refreshDirectory = useCallback(async () => {
    try {
      const result = await api('/api/users');
      if (!meRef.current) return;
      setUsers(result.users); setConversations(result.conversations); setOnlineIds(result.onlineUserIds);
      setSelected((current) => current || (result.conversations.find((item) => item.type === 'team') ? { id: result.conversations.find((item) => item.type === 'team').id, type: 'team' } : null));
    } catch (err) { setError(err.message); } finally { setDirectoryLoading(false); }
  }, []);
  useEffect(() => {
    if (!me) return;
    setDirectoryLoading(true); refreshDirectory();
    const connection = io(SERVER, { withCredentials: true, autoConnect: false }); socket.current = connection;
    const onConnect = () => { setConnected(true); setError(''); refreshDirectory(); };
    const onDisconnect = (reason) => { setConnected(false); setDatabaseReady(false); if (reason === 'io server disconnect') api('/api/auth/me').catch(() => { setMe(null); setSelected(null); setMessages([]); }); };
    const onError = (err) => { setConnected(false); if (err.message === 'Authentication required.') { setMe(null); setError('Your session has ended. Please sign in again.'); } else setError('Unable to connect. Trying to reconnect.'); };
    const onStatus = (status) => { setDatabaseReady(status.databaseReady); if (!status.databaseReady) setError('The database is unavailable. Please try again shortly.'); else { setError(''); setReloadTick((tick) => tick + 1); refreshDirectory(); } };
    const onPresence = (status) => setOnlineIds(status.onlineUserIds);
    const onUpdate = (message) => { if (message.conversationId === selectedRef.current?.id) setMessages((old) => mergeMessages(old, [message])); };
    connection.on('connect', onConnect); connection.on('disconnect', onDisconnect); connection.on('connect_error', onError); connection.on('service:status', onStatus); connection.on('presence:changed', onPresence); connection.on('users:changed', refreshDirectory); connection.on('conversations:changed', refreshDirectory); connection.on('message:created', onUpdate); connection.on('message:updated', onUpdate); connection.connect();
    return () => { connection.removeAllListeners(); connection.disconnect(); if (socket.current === connection) socket.current = null; };
  }, [me, refreshDirectory]);
  useEffect(() => {
    if (!selected?.id || !connected || !socket.current) return;
    const id = selected.id; setLoading(true);
    socket.current.timeout(10000).emit('conversation:join', { conversationId: id }, (err, result) => {
      if (selectedRef.current?.id !== id) return;
      setLoading(false);
      if (err || !result?.ok) { setError(result?.error || 'Could not load this conversation.'); return; }
      setMessages((old) => mergeMessages(old, result.data));
    });
  }, [selected?.id, connected, reloadTick]);
  useLayoutEffect(() => { if (near.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [messages, loading]);
  function choose(conversation) { if (selectedRef.current?.id !== conversation.id) { near.current = true; setNearBottom(true); setMessages([]); setSelected(conversation); } setMobileOpen(true); }
  async function openUser(user) {
    const existing = conversations.find((conversation) => conversation.type === 'direct' && conversation.participants.includes(user.id));
    if (existing) { choose({ id: existing.id, type: 'direct', userId: user.id }); return; }
    try { const result = await api('/api/conversations/direct', { method: 'POST', body: { userId: user.id } }); choose({ id: result.id, type: 'direct', userId: user.id }); refreshDirectory(); } catch (err) { setError(err.message); }
  }
  function request(event, payload) {
    return new Promise((resolve) => {
      if (!socket.current?.connected || !databaseReady) { setError('You are disconnected. Please wait for reconnection.'); resolve(false); return; }
      socket.current.timeout(10000).emit(event, payload, (err, result) => {
        if (err || !result?.ok) { setError(result?.error || 'The request timed out. It may have been saved; check the conversation before trying again.'); resolve(false); return; }
        if (result.data?.id && result.data.conversationId === selectedRef.current?.id) setMessages((old) => mergeMessages(old, [result.data]));
        setError(''); resolve(true);
      });
    });
  }
  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); setMe(null); setSelected(null); setMessages([]); setUsers([]); setConversations([]); setMobileOpen(false); setError(''); }
    catch (err) { setError(err.message); }
  }
  function handleScroll() { const node = thread.current; const isNear = node.scrollHeight - node.scrollTop - node.clientHeight < 100; near.current = isNear; setNearBottom(isNear); }
  function bottom() { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; near.current = true; setNearBottom(true); }
  if (checking) return <div className="splash" role="status">Opening TeamChat...</div>;
  if (!me) return <Auth api={api} onLogin={(user) => { setError(''); setMe(user); }} />;
  const team = conversations.find((item) => item.type === 'team');
  const partner = users.find((user) => user.id === selected?.userId);
  const others = users.filter((user) => user.id !== me.id && user.name.toLowerCase().includes(search.trim().toLowerCase()));
  const onlineCount = users.filter((user) => onlineIds.includes(user.id)).length;
  const available = connected && databaseReady;
  return <main className={`workspace ${mobileOpen ? 'mobile-chat-open' : ''}`}><div className="workspace-shell">
    <aside className="sidebar" aria-label="Conversations"><div className="sidebar-brand"><div className="brand"><span className="brand-icon"><MessageCircle size={18} /></span>teamchat<span className="brand-dot">.</span></div><span className={`connection ${available ? 'connected' : ''}`}><span />{available ? 'Connected' : connected ? 'Database offline' : 'Connecting'}</span></div>
      <div className="profile"><Avatar name={me.name} id={me.id} online={connected ? onlineIds.includes(me.id) : undefined} /><div><strong>{me.name}</strong><span>Your workspace</span></div><button className="logout" onClick={logout} title="Log out" aria-label="Log out"><LogOut size={18} /></button></div>
      <div className="sidebar-heading"><div><p className="eyebrow">YOUR SPACE</p><h1>Messages <span>✳</span></h1></div><span className="heading-count">{users.length}</span></div>
      <label className="search"><Search size={17} /><span className="sr-only">Search people or conversations</span><input placeholder="Search people..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="presence-summary"><span><b>{directoryLoading ? '—' : users.length}</b> total</span><span><b>{connected && !directoryLoading ? onlineCount : '—'}</b> online</span><span><b>{connected && !directoryLoading ? Math.max(0, users.length - onlineCount) : '—'}</b> offline</span></div>
      <div className="conversation-list"><div className="list-title">CONVERSATIONS <span>{others.length + (team ? 1 : 0)}</span></div>
        {team && (!search.trim() || 'team chat'.includes(search.toLowerCase().trim())) && <button className={`conversation ${selected?.id === team.id ? 'selected' : ''}`} onClick={() => choose({ id: team.id, type: 'team' })}><Avatar name="Team Chat" team /><span className="conversation-text"><strong>Team Chat</strong><small>{team.lastMessage?.text || 'A place for everyone'}</small></span><span className="team-tag">TEAM</span></button>}
        {others.map((user) => { const direct = conversations.find((item) => item.type === 'direct' && item.participants.includes(user.id)); const isOnline = onlineIds.includes(user.id); return <button key={user.id} className={`conversation ${selected?.userId === user.id ? 'selected' : ''}`} onClick={() => openUser(user)}><Avatar name={user.name} id={user.id} online={connected ? isOnline : undefined} /><span className="conversation-text"><strong>{user.name}</strong><small>{direct?.lastMessage?.text || (!connected ? 'Status unavailable' : isOnline ? 'Online · say hello' : 'Offline · say hello')}</small></span></button>; })}
        {directoryLoading && <p className="list-empty">Loading people...</p>}{!directoryLoading && !others.length && <p className="list-empty">{search ? 'No people found.' : 'Invite a teammate to join the conversation.'}</p>}
      </div><div className="sidebar-footer">A little space for big ideas <span>✦</span></div>
    </aside>
    <section className="chat-panel" aria-label="Chat"><header className="chat-header"><button className="back-button" aria-label="Back to conversations" onClick={() => setMobileOpen(false)}><ArrowLeft size={20} /></button><Avatar name={selected?.type === 'team' ? 'Team Chat' : partner?.name} id={partner?.id} team={selected?.type === 'team'} online={selected?.type === 'direct' && connected ? onlineIds.includes(partner?.id) : undefined} /><div className="chat-title"><strong>{selected?.type === 'team' ? 'Team Chat' : partner?.name || 'Select a conversation'}</strong><span>{selected?.type === 'team' ? 'A place for everyone' : selected?.type === 'direct' ? (!connected ? 'Status unavailable' : onlineIds.includes(partner?.id) ? 'Online' : 'Offline') : 'Choose someone from your team'}</span></div><div className={`header-badge ${available ? 'live' : ''}`}><span /> {available ? 'Live conversation' : 'Reconnecting'}</div></header>
      <div className="thread-wrap"><div className="thread" ref={thread} onScroll={handleScroll} tabIndex="0" aria-label="Messages">{!selected ? <div className="empty-state"><div className="empty-icon"><MessageCircle size={25} /></div><strong>All your conversations, in one place.</strong><p>Choose Team Chat or a teammate to get started.</p></div> : <><div className="thread-intro"><span>✳</span><div><strong>{selected.type === 'team' ? 'The team is all here' : 'Say hello'}</strong><p>{selected.type === 'team' ? 'This is the beginning of your team conversation.' : 'This conversation is private to the two of you.'}</p></div></div><div className="thread-divider"><span /> CONVERSATION <span /></div>{loading && !messages.length ? <div className="empty-state"><strong>Loading messages...</strong></div> : !messages.length ? <div className="empty-state"><div className="empty-icon"><MessageCircle size={25} /></div><strong>It’s quiet in here... for now</strong><p>Send the first message and get things started.</p></div> : <div className="messages">{messages.map((message) => <MessageRow key={message.id} message={message} me={me} disabled={!available} onLike={(messageId) => request('message:like', { conversationId: selected.id, messageId })} />)}</div>}</>}</div>{!nearBottom && <button className="jump-button" onClick={bottom}><ArrowDown size={15} /> Latest messages</button>}</div>
      {error && <div className="error-banner" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
      {selected && <Composer conversationId={selected.id} disabled={!available} onSend={(text, conversationId) => request('message:create', { conversationId, text })} />}
    </section>
  </div></main>;
}
