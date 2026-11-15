import { useEffect, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { AtSign, Send, Smile, X } from 'lucide-react';

const NAMES = ['Alan', 'Bob', 'Carol', 'Dean', 'Elin'];
const MAX_LENGTH = 2000;

export default function Composer({ disabled, onSend, conversationId }) {
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(null);
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);
  const input = useRef(null);
  const box = useRef(null);
  const range = useRef(null);
  const currentConversation = useRef(conversationId);
  const names = picker === 'mention' && range.current?.typed ? NAMES.filter((name) => name.toLowerCase().startsWith(text.slice(range.current.start + 1, range.current.end).toLowerCase())) : NAMES;
  useEffect(() => { currentConversation.current = conversationId; setText(''); setPicker(null); }, [conversationId]);
  useEffect(() => { const close = (event) => { if (!box.current?.contains(event.target)) setPicker(null); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, []);
  function insert(value, selectedRange) {
    const node = input.current;
    const start = selectedRange?.start ?? node.selectionStart;
    const end = selectedRange?.end ?? node.selectionEnd;
    const next = text.slice(0, start) + value + text.slice(end);
    if (next.length > MAX_LENGTH) return;
    setText(next); setPicker(null);
    requestAnimationFrame(() => { node.focus(); node.setSelectionRange(start + value.length, start + value.length); });
  }
  function update(event) {
    const value = event.target.value, cursor = event.target.selectionStart;
    setText(value);
    const match = value.slice(0, cursor).match(/@([a-zA-Z]*)$/);
    if (match) { range.current = { start: cursor - match[1].length - 1, end: cursor, typed: true }; setActive(0); setPicker('mention'); }
    else if (picker === 'mention') setPicker(null);
  }
  function openMention() { range.current = { start: input.current.selectionStart, end: input.current.selectionEnd, typed: false }; setActive(0); setPicker('mention'); input.current.focus(); }
  async function submit() {
    if (disabled || sending || !text.trim()) return;
    const sent = text, conversation = conversationId;
    setSending(true);
    const ok = await onSend(sent, conversation);
    if (ok && currentConversation.current === conversation) setText((value) => value === sent ? '' : value);
    setSending(false); setPicker(null); input.current?.focus();
  }
  function keyDown(event) {
    if (picker && event.key === 'Escape') { event.preventDefault(); setPicker(null); return; }
    if (picker === 'mention' && names.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + names.length) % names.length); return; }
    if (picker === 'mention' && names.length && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); insert(`@${names[active] || names[0]} `, range.current); return; }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
  }
  return <div className="composer-area" ref={box}>
    {picker === 'emoji' && <div className="emoji-popover"><div className="picker-title">Choose an emoji <button aria-label="Close emoji picker" onClick={() => setPicker(null)}><X size={16} /></button></div><EmojiPicker onEmojiClick={(emoji) => insert(emoji.emoji)} searchPlaceholder="Search emoji" width="100%" height={350} lazyLoadEmojis /></div>}
    {picker === 'mention' && <div className="mention-popover"><div className="picker-title">Assignment example names <button aria-label="Close mentions" onClick={() => setPicker(null)}><X size={16} /></button></div><p>These are example names, not account mentions.</p>{names.length ? names.map((name, i) => <button key={name} className={i === active ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => insert(`@${name} `, range.current)}>@{name}</button>) : <span>No matching names</span>}</div>}
    <div className="composer"><button className="tool-button" onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')} aria-label="Choose an emoji" aria-expanded={picker === 'emoji'}><Smile size={21} /></button><button className="tool-button" onClick={openMention} aria-label="Insert an assignment name" aria-expanded={picker === 'mention'}><AtSign size={20} /></button><label className="sr-only" htmlFor="message-input">Write a message</label><textarea id="message-input" ref={input} value={text} onChange={update} onKeyDown={keyDown} placeholder="Write a message..." rows="1" maxLength={MAX_LENGTH} aria-describedby="composer-help" /><button className="primary send" onClick={submit} disabled={disabled || sending || !text.trim()}>{sending ? 'Sending' : 'Send'} <Send size={16} /></button></div>
    <div id="composer-help" className="composer-help"><span>Enter to send · Shift + Enter for a new line</span><span>{text.length > 1800 ? `${text.length}/${MAX_LENGTH}` : 'Be kind, always ♥'}</span></div>
  </div>;
}
