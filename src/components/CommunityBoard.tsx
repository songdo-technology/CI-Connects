import React, { useState } from 'react';
import { 
  MessageSquare, 
  MapPin, 
  Clock, 
  Users, 
  Plus, 
  Heart, 
  Send, 
  Filter, 
  Sparkles, 
  Check, 
  X,
  MessageCircle,
  Building2,
  Calendar
} from 'lucide-react';
import { CommunityTopic, UserProfile } from '../types';

interface CommunityBoardProps {
  topics: CommunityTopic[];
  currentUser: UserProfile;
  onAddTopic: (topic: Omit<CommunityTopic, 'id' | 'createdAt' | 'likesCount' | 'replies' | 'rsvpUserIds'>) => void;
  onToggleRsvp: (topicId: string) => void;
  onAddReply: (topicId: string, replyText: string) => void;
  onToggleLike: (topicId: string) => void;
  initialFilter?: string;
}

export const CommunityBoard: React.FC<CommunityBoardProps> = ({
  topics,
  currentUser,
  onAddTopic,
  onToggleRsvp,
  onAddReply,
  onToggleLike,
  initialFilter,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState<{ [key: string]: string }>({});

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'General' | 'Informal Meetups' | 'Carpool & Dinners' | 'Ask Organizers'>('Informal Meetups');
  const [newLocation, setNewLocation] = useState('');
  const [newMeetupTime, setNewMeetupTime] = useState('');

  const categories = ['General', 'Informal Meetups', 'Carpool & Dinners', 'Ask Organizers'] as const;

  const filteredTopics = topics.filter(topic => {
    if (selectedCategory !== 'all' && topic.category !== selectedCategory) return false;
    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    onAddTopic({
      eventId: 'evt-ci-conference',
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      authorEmail: currentUser.email,
      authorAvatar: currentUser.avatarUrl,
      authorDepartment: currentUser.department,
      authorType: currentUser.userType,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      location: newLocation.trim() || undefined,
      meetupTime: newMeetupTime.trim() || undefined,
    });

    // Reset Form
    setNewTitle('');
    setNewContent('');
    setNewLocation('');
    setNewMeetupTime('');
    setIsCreateModalOpen(false);
  };

  const handleSendReply = (topicId: string) => {
    const text = replyInput[topicId]?.trim();
    if (!text) return;
    onAddReply(topicId, text);
    setReplyInput(prev => ({ ...prev, [topicId]: '' }));
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Action */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Community Board & Informal Meetups
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Whova-Inspired Engagement
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Coordinate subject-area lunch discussions, ask organizers logistical questions, or schedule breakout side meetups.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Propose Topic or Meetup</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Discussions ({topics.length})
        </button>
        {categories.map(cat => {
          const count = topics.filter(t => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Topics Feed */}
      <div className="space-y-4">
        {filteredTopics.map(topic => {
          const isRsvped = topic.rsvpUserIds.includes(currentUser.id);
          const isExpanded = expandedTopicId === topic.id;
          const isMeetup = topic.category === 'Informal Meetups';

          return (
            <div 
              key={topic.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5 transition-all hover:border-slate-300"
            >
              {/* Header: Author & Category */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={topic.authorAvatar}
                    alt={topic.authorName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        {topic.authorName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        • {topic.authorDepartment}
                      </span>
                      {topic.authorType === 'internal_faculty' && (
                        <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          Faculty
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{topic.createdAt}</p>
                  </div>
                </div>

                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  isMeetup 
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200' 
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {topic.category}
                </span>
              </div>

              {/* Title & Body */}
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {topic.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {topic.content}
                </p>
              </div>

              {/* Meetup Logistics Box if applicable */}
              {(topic.location || topic.meetupTime) && (
                <div className="bg-gradient-to-r from-indigo-50/70 to-blue-50/60 p-3 rounded-xl border border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    {topic.location && (
                      <div className="flex items-center gap-1.5 text-indigo-950 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Location: <strong>{topic.location}</strong></span>
                      </div>
                    )}
                    {topic.meetupTime && (
                      <div className="flex items-center gap-1.5 text-indigo-950 font-medium">
                        <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Meeting Time: <strong>{topic.meetupTime}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Meetup RSVP Button */}
                  <button
                    onClick={() => onToggleRsvp(topic.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
                      isRsvped
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isRsvped ? 'Attending ✓' : 'RSVP to Meetup'}</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-900">
                      {topic.rsvpUserIds.length}
                    </span>
                  </button>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onToggleLike(topic.id)}
                    className="flex items-center gap-1 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>{topic.likesCount}</span>
                  </button>

                  <button
                    onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 font-semibold transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{topic.replies.length} Replies</span>
                  </button>
                </div>

                <button
                  onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {isExpanded ? 'Collapse' : 'Reply & View Discussion'}
                </button>
              </div>

              {/* Threaded Replies Drawer */}
              {isExpanded && (
                <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in">
                  {topic.replies.length > 0 && (
                    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {topic.replies.map(reply => (
                        <div key={reply.id} className="text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">
                              {reply.authorName}{' '}
                              <span className="text-[10px] font-normal text-slate-400">({reply.authorDepartment})</span>
                            </span>
                            <span className="text-[10px] text-slate-400">{reply.createdAt}</span>
                          </div>
                          <p className="text-slate-600 leading-relaxed">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Reply Input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyInput[topic.id] || ''}
                      onChange={(e) => setReplyInput({ ...replyInput, [topic.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendReply(topic.id);
                      }}
                      placeholder={`Reply as ${currentUser.fullName}...`}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      onClick={() => handleSendReply(topic.id)}
                      className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shrink-0"
                      title="Post Reply"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Propose Topic / Meetup Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Propose Discussion or Informal Meetup
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                >
                  <option value="Informal Meetups">Informal Meetups (e.g. Lunch table, break discussion)</option>
                  <option value="General">General Discussion</option>
                  <option value="Carpool & Dinners">Carpool & Evening Dinners</option>
                  <option value="Ask Organizers">Ask Organizers & Help Desk</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Topic Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Math & CS Teachers Lunch Table or Shared Taxi to Airport"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Purpose</label>
                <textarea
                  required
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="What would you like to discuss or coordinate?"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>

              {newCategory === 'Informal Meetups' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Campus Location</label>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="e.g. Campus Courtyard Table 3"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Proposed Time</label>
                    <input
                      type="text"
                      value={newMeetupTime}
                      onChange={(e) => setNewMeetupTime(e.target.value)}
                      placeholder="e.g. Friday @ 12:30 PM"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                >
                  Publish to Community
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
