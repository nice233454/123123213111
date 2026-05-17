import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Message, Profile, Chat, ChatMember } from '../lib/types';
import { ArrowLeft, Send, Users, User, Trash2 } from 'lucide-react';

interface ChatRoomProps {
  chatId: string;
  onNavigate: (page: string) => void;
}

export function ChatRoom({ chatId, onNavigate }: ChatRoomProps) {
  const { profile } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  useEffect(() => {
    fetchChatData();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function fetchChatData() {
    const { data: chatData } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .maybeSingle();

    if (chatData) setChat(chatData as Chat);

    const { data: memberData } = await supabase
      .from('chat_members')
      .select('*')
      .eq('chat_id', chatId);

    if (memberData) {
      const memberList = memberData as ChatMember[];
      setMembers(memberList);

      const memberUserIds = memberList.map((m) => m.user_id);
      if (memberUserIds.length > 0) {
        const { data: memberProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', memberUserIds);

        const profMap: Record<string, Profile> = {};
        if (memberProfiles) {
          (memberProfiles as Profile[]).forEach((p) => { profMap[p.id] = p; });
        }
        setProfiles(profMap);
      }
    }

    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesData) setMessages(messagesData as Message[]);
    setLoading(false);

    // Subscribe to real-time messages after loading initial data
    subscribeToMessages();
  }

  function subscribeToMessages() {
    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`chat-messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
  }

  async function sendMessage() {
    if (!newMessage.trim() || !profile) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: profile.id,
        content: messageText,
      });

    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText);
      return;
    }

    // Update chat's updated_at timestamp
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);
  }

  async function deleteChat() {
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId);

    if (error) {
      console.error('Error deleting chat:', error);
      return;
    }
    onNavigate('chats');
  }

  function getChatName(): string {
    if (chat?.type === 'group' && chat.name) return chat.name;
    const other = members.find((m) => m.user_id !== profile?.id);
    if (other) {
      const otherProfile = profiles[other.user_id];
      if (otherProfile) return otherProfile.full_name;
    }
    return 'Чат';
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
      ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCreator = chat?.created_by === profile?.id;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-4 border-b border-slate-200 bg-white">
        <button
          onClick={() => onNavigate('chats')}
          className="text-slate-400 hover:text-slate-600 lg:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          {chat?.type === 'group' ? (
            <Users className="w-5 h-5 text-slate-500" />
          ) : (
            <User className="w-5 h-5 text-slate-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 truncate">{getChatName()}</h2>
          <p className="text-xs text-slate-400">
            {chat?.type === 'group'
              ? `${members.length} участников`
              : 'Личный чат'}
          </p>
        </div>

        {/* Delete chat button for creator */}
        {isCreator && (
          <div className="relative">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 hidden sm:inline">Удалить?</span>
                <button
                  onClick={deleteChat}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Да
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-slate-500 text-xs hover:text-slate-700"
                >
                  Нет
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Удалить чат"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-4 bg-slate-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-sm">Начните общение</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.sender_id === profile?.id;
            const senderProfile = profiles[msg.sender_id];
            const showAvatar = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;

            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                {showAvatar ? (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
                    {senderProfile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                ) : (
                  <div className="w-8 flex-shrink-0" />
                )}
                <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  {showAvatar && (
                    <p className={`text-xs text-slate-400 mb-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                      {senderProfile?.full_name || 'Неизвестный'}
                    </p>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm ${
                      isOwn
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <p className={`text-[10px] text-slate-300 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 lg:px-6 py-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Написать сообщение..."
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
