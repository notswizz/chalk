'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ref, push, onChildAdded, query, limitToLast, serverTimestamp, off } from 'firebase/database';
import { db, ensureAuth } from '@/lib/firebase';

interface Message {
  id: string;
  text: string;
  uid: string;
  name: string;
  timestamp: number;
}

const COLORS = [
  'var(--color-yellow)', 'var(--color-green)', 'var(--color-blue)', 'var(--color-orange)', 'var(--color-red)',
  '#a78bfa', '#22d3ee', '#e879f9', '#a3e635', '#fbbf24',
];

function getColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getRandomName(): string {
  const adjectives = ['Swift', 'Clutch', 'Hype', 'Chill', 'Bold', 'Slick', 'Fresh', 'Loud', 'Wild', 'Smooth'];
  const nouns = ['Fan', 'Baller', 'Hooper', 'Viewer', 'Legend', 'Goat', 'Champ', 'Player', 'Chief', 'Boss'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 99);
  return `${adj}${noun}${num}`;
}

const NAME_KEY = 'streamhub-chat-name';

function getSavedName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(NAME_KEY) || '';
}

function saveName(name: string) {
  localStorage.setItem(NAME_KEY, name);
}

export function GameChat({ gameId }: { gameId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    ensureAuth()
      .then((user) => {
        setUid(user.uid);
        const saved = getSavedName();
        if (saved) {
          setUserName(saved);
        } else {
          const name = getRandomName();
          setUserName(name);
          saveName(name);
        }
        setReady(true);
      })
      .catch(() => {
        setAuthError(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const chatRef = query(ref(db, `chats/${gameId}`), limitToLast(100));

    const handleNewMessage = (snapshot: { key: string | null; val: () => { text: string; uid: string; name: string; timestamp: number } }) => {
      const data = snapshot.val();
      if (!data) return;
      const msg: Message = {
        id: snapshot.key ?? '',
        text: data.text,
        uid: data.uid,
        name: data.name,
        timestamp: data.timestamp || Date.now(),
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-100);
      });
    };

    onChildAdded(chatRef, handleNewMessage);
    const timer = setTimeout(() => { initialLoad.current = false; }, 1500);

    return () => {
      off(chatRef, 'child_added', handleNewMessage);
      clearTimeout(timer);
    };
  }, [gameId, ready]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, mobileOpen]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !uid) return;
    setInput('');
    try {
      const chatRef = ref(db, `chats/${gameId}`);
      await push(chatRef, {
        text,
        uid,
        name: userName,
        timestamp: serverTimestamp(),
      });
      scrollToBottom();
    } catch { /* failed to send */ }
  };

  if (authError) return null;

  const chatPanel = (
    <div
      className="rounded-[4px] overflow-hidden flex flex-col h-full"
      style={{
        background: 'var(--board-dark)',
        border: '1px dashed var(--dust-medium)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px dashed var(--dust-light)' }}
      >
        <div className="flex items-center gap-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="text-xs font-bold" style={{ color: 'var(--chalk-dim)' }}>Chalk Talk</span>
          {messages.length > 0 && (
            <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--chalk-ghost)' }}>
              {messages.length}
            </span>
          )}
        </div>

        {/* Close on mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden w-6 h-6 rounded-[4px] flex items-center justify-center transition-colors"
          style={{ color: 'var(--chalk-ghost)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--dust-light) transparent' }}
      >
        {!ready && (
          <div className="text-center py-12">
            <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--color-yellow)', borderTopColor: 'transparent' }} />
          </div>
        )}
        {ready && messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[11px]" style={{ color: 'var(--chalk-ghost)' }}>No messages yet — be the first!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.uid === uid;
          const color = getColor(msg.uid);
          return (
            <div key={msg.id}>
              <span className="text-[11px] font-bold" style={{ color }}>
                {msg.name}
                {isMe && <span className="font-normal ml-1" style={{ color: 'var(--chalk-ghost)' }}>(you)</span>}
              </span>
              <p className="text-[13px] leading-snug break-words mt-0.5" style={{ color: 'var(--chalk-dim)' }}>
                {msg.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{ borderTop: '1px dashed var(--dust-light)' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={ready ? 'Send a message...' : 'Connecting...'}
          disabled={!ready}
          maxLength={200}
          className="input-field flex-1"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !ready}
          className="w-9 h-9 rounded-[4px] flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-20"
          style={{
            background: input.trim() ? 'var(--color-yellow)' : 'var(--dust-light)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={input.trim() ? 'var(--board-dark)' : 'var(--chalk-ghost)'} stroke="none">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: always visible, matches player height */}
      <div className="hidden lg:flex lg:flex-col lg:h-full" style={{ minHeight: 200, maxHeight: 280 }}>
        {chatPanel}
      </div>

      {/* Mobile: toggle button + collapsible panel */}
      <div className="lg:hidden">
        {!mobileOpen ? (
          <button
            onClick={() => { setMobileOpen(true); setTimeout(scrollToBottom, 50); }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-[4px] transition-all duration-200"
            style={{
              background: 'var(--dust-light)',
              border: '1px dashed var(--dust-light)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--chalk-ghost)" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <span className="text-sm font-semibold" style={{ color: 'var(--chalk-ghost)' }}>Chalk Talk</span>
              {messages.length > 0 && (
                <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--chalk-ghost)' }}>{messages.length}</span>
              )}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--chalk-ghost)' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : (
          <div style={{ height: 250 }}>
            {chatPanel}
          </div>
        )}
      </div>
    </>
  );
}
