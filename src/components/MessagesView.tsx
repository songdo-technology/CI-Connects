import React, { useMemo, useState } from 'react';
import { MessageSquare, Send, Linkedin, Mail, ArrowLeft } from 'lucide-react';
import { DirectMessage, UserProfile } from '../types';

interface MessagesViewProps {
  messages: DirectMessage[];
  profiles: UserProfile[];
  currentUser: UserProfile;
  /** Set when arriving from a directory or contact-card "Message" action. */
  initialThreadUserId?: string | null;
  onSendMessage: (toUserId: string, content: string) => void;
  onMarkRead: (fromUserId: string) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  messages, profiles, currentUser, initialThreadUserId, onSendMessage, onMarkRead,
}) => {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadUserId ?? null);
  const [draft, setDraft] = useState('');

  /** One thread per counterpart, newest activity first. */
  const threads = useMemo(() => {
    const mine = messages.filter((m) => m.fromUserId === currentUser.id || m.toUserId === currentUser.id);
    const byPerson = new Map<string, DirectMessage[]>();
    for (const m of mine) {
      const other = m.fromUserId === currentUser.id ? m.toUserId : m.fromUserId;
      byPerson.set(other, [...(byPerson.get(other) ?? []), m]);
    }
    return [...byPerson.entries()].map(([userId, msgs]) => ({
      userId,
      profile: profiles.find((p) => p.id === userId),
      messages: msgs,
      unread: msgs.filter((m) => m.toUserId === currentUser.id && !m.read).length,
      latest: msgs[msgs.length - 1],
    })).filter((t) => t.profile);
  }, [messages, profiles, currentUser.id]);

  const activeThread = threads.find((t) => t.userId === activeThreadId);

  const openThread = (userId: string) => {
    setActiveThreadId(userId);
    onMarkRead(userId);
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeThreadId) return;
    onSendMessage(activeThreadId, text);
    setDraft('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900">Messages</h2>
        <span className="text-xs text-slate-400">Reach colleagues directly, without leaving the platform</span>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] min-h-[26rem]">
        {/* Thread list */}
        <div className={`border-r border-slate-200 ${activeThreadId ? 'hidden md:block' : ''}`}>
          {threads.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-400 leading-relaxed">
                No conversations yet. Start one from the colleague directory or by
                scanning someone's badge.
              </p>
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.userId}
                onClick={() => openThread(t.userId)}
                className={`w-full flex items-start gap-3 p-3.5 text-left border-b border-slate-100 transition-colors cursor-pointer ${
                  activeThreadId === t.userId ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}
              >
                <img src={t.profile!.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{t.profile!.fullName}</span>
                    {t.unread > 0 && (
                      <span className="shrink-0 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{t.latest.content}</p>
                  <span className="text-[10px] text-slate-400">{t.latest.createdAt}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Active thread */}
        {activeThread ? (
          <div className="flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
              <button
                onClick={() => setActiveThreadId(null)}
                className="md:hidden p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
              </button>
              <img src={activeThread.profile!.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-800 truncate">{activeThread.profile!.fullName}</div>
                <div className="text-xs text-slate-500 truncate">{activeThread.profile!.title}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`mailto:${activeThread.profile!.email}`}
                  className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 transition-colors"
                  title="Email"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                </a>
                {activeThread.profile!.linkedInUrl && (
                  <a
                    href={activeThread.profile!.linkedInUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 transition-colors"
                    title="LinkedIn"
                  >
                    <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-80">
              {activeThread.messages.map((m) => {
                const mine = m.fromUserId === currentUser.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl ${
                      mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      <p className="text-sm leading-relaxed">{m.content}</p>
                      <span className={`text-[10px] block mt-1 ${mine ? 'text-blue-200' : 'text-slate-400'}`}>
                        {m.createdAt}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={send} className="p-3 border-t border-slate-200 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${activeThread.profile!.fullName.split(' ')[0]}…`}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="hidden md:flex items-center justify-center p-8">
            <p className="text-sm text-slate-400">Select a conversation to read it.</p>
          </div>
        )}
      </div>
    </div>
  );
};
