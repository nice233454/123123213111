import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Chat, Profile, ChatMember } from '../lib/types';
import { MessageCircle, Plus, Users, Search, Trash2 } from 'lucide-react';

interface ChatListProps {
  onNavigate: (page: string, data?: Record<string, string>) => void;
}

export function ChatList({ onNavigate }: ChatListProps) {
  const { profile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      fetchChats();
      fetchProfiles();
    }
  }, [profile]);

  async function fetchChats() {
    if (!profile) return;

    const { data: memberData, error: memberError } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', profile.id);

    if (memberError) {
      console.error('Error fetching chat members:', memberError);
      setLoading(false);
      return;
    }

    if (memberData && memberData.length > 0) {
      const chatIds = memberData.map((m: { chat_id: string }) => m.chat_id);

      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .in('id', chatIds)
        .order('updated_at', { ascending: false });

      if (chatError) {
        console.error('Error fetching chats:', chatError);
        setLoading(false);
        return;
      }

      if (chatData) {
        const chatsWithMembers = await Promise.all(
          (chatData as Chat[]).map(async (chat) => {
            const { data: members } = await supabase
              .from('chat_members')
              .select('*')
              .eq('chat_id', chat.id);

            const memberList = (members || []) as ChatMember[];

            const memberUserIds = memberList.map((m) => m.user_id);
            let membersWithProfiles = memberList;

            if (memberUserIds.length > 0) {
              const { data: memberProfiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', memberUserIds);

              const profileMap: Record<string, Profile> = {};
              if (memberProfiles) {
                (memberProfiles as Profile[]).forEach((p) => { profileMap[p.id] = p; });
              }

              membersWithProfiles = memberList.map((m) => ({
                ...m,
                profile: profileMap[m.user_id] || null,
              }));
            }

            return { ...chat, members: membersWithProfiles };
          })
        );
        setChats(chatsWithMembers);
      }
    } else {
      setChats([]);
    }
    setLoading(false);
  }

  async function fetchProfiles() {
    if (!profile) return;

    const { data, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', profile.id)
      .order('full_name');

    if (profError) {
      console.error('Error fetching profiles:', profError);
      return;
    }

    if (data) setAllProfiles(data as Profile[]);
  }

  async function createChat() {
    if (!profile || selectedUsers.length === 0) return;
    setCreating(true);
    setError('');

    try {
      const isDirect = selectedUsers.length === 1 && !newChatName.trim();
      const chatType = isDirect ? 'direct' : 'group';
      const chatName = isDirect
        ? ''
        : newChatName.trim() || 'Групповой чат';

      // Check if direct chat already exists with this user
      if (isDirect) {
        const { data: myChats, error: myChatsError } = await supabase
          .from('chat_members')
          .select('chat_id')
          .eq('user_id', profile.id);

        if (!myChatsError && myChats && myChats.length > 0) {
          const myChatIds = myChats.map((m: { chat_id: string }) => m.chat_id);

          const { data: otherMember } = await supabase
            .from('chat_members')
            .select('chat_id')
            .in('chat_id', myChatIds)
            .eq('user_id', selectedUsers[0])
            .maybeSingle();

          if (otherMember) {
            const { data: chatInfo } = await supabase
              .from('chats')
              .select('*')
              .eq('id', otherMember.chat_id)
              .eq('type', 'direct')
              .maybeSingle();

            if (chatInfo) {
              onNavigate('chat-room', { id: chatInfo.id });
              setShowNewChat(false);
              setCreating(false);
              setSelectedUsers([]);
              setNewChatName('');
              return;
            }
          }
        }
      }

      // Step 1: Create the chat
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .insert({ name: chatName, type: chatType, created_by: profile.id })
        .select()
        .maybeSingle();

      if (chatError) {
        console.error('Chat insert error:', chatError);
        throw new Error(chatError.message);
      }
      if (!chatData) throw new Error('Chat was not created');

      // Step 2: Add creator as member first
      const { error: selfError } = await supabase
        .from('chat_members')
        .insert({ chat_id: chatData.id, user_id: profile.id });

      if (selfError) {
        console.error('Self member insert error:', selfError);
        throw new Error(selfError.message);
      }

      // Step 3: Add other members
      if (selectedUsers.length > 0) {
        const otherMembers = selectedUsers.map((userId) => ({
          chat_id: chatData.id,
          user_id: userId,
        }));

        const { error: memberError } = await supabase
          .from('chat_members')
          .insert(otherMembers);

        if (memberError) {
          console.error('Other members insert error:', memberError);
          throw new Error(memberError.message);
        }
      }

      onNavigate('chat-room', { id: chatData.id });
      setShowNewChat(false);
      setNewChatName('');
      setSelectedUsers([]);
      fetchChats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка создания чата';
      console.error('Error creating chat:', err);
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingChatId(chatId);

    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId);

    if (error) {
      console.error('Error deleting chat:', error);
    } else {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
    }
    setDeletingChatId(null);
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function getChatDisplayName(chat: Chat): string {
    if (chat.type === 'group' && chat.name) return chat.name;
    if (chat.members) {
      const other = chat.members.find((m) => m.user_id !== profile?.id);
      if (other?.profile) return (other.profile as Profile).full_name;
    }
    return 'Чат';
  }

  const filteredProfiles = allProfiles.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Чаты</h1>
          <p className="text-slate-500 mt-1">Общение с командой</p>
        </div>
        <button
          onClick={() => setShowNewChat(!showNewChat)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Новый чат
        </button>
      </div>

      {/* New chat form */}
      {showNewChat && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Создать чат</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Название группы (для группового чата)
            </label>
            <input
              type="text"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              placeholder="Название группы..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Участники</label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск сотрудников..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {allProfiles.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Нет доступных сотрудников</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filteredProfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleUser(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedUsers.includes(p.id)
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                      selectedUsers.includes(p.id) ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {p.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-slate-400">{p.role === 'manager' ? 'Менеджер' : 'Разработчик'}</p>
                    </div>
                    {selectedUsers.includes(p.id) && (
                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={createChat}
              disabled={selectedUsers.length === 0 || creating}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {creating ? 'Создаем...' : 'Создать'}
            </button>
            <button
              onClick={() => { setShowNewChat(false); setSelectedUsers([]); setNewChatName(''); setError(''); }}
              className="px-6 py-2.5 text-slate-500 text-sm hover:text-slate-700"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Chat list */}
      {chats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Чатов пока нет</p>
          <p className="text-sm text-slate-400 mt-1">Создайте новый чат для общения</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onNavigate('chat-room', { id: chat.id })}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                {chat.type === 'group' ? (
                  <Users className="w-5 h-5 text-slate-500" />
                ) : (
                  <span className="text-lg font-semibold text-slate-600">
                    {getChatDisplayName(chat).charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  {getChatDisplayName(chat)}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {chat.type === 'group'
                    ? `${chat.members?.length || 0} участников`
                    : 'Личный чат'}
                </p>
              </div>
              {chat.created_by === profile?.id && (
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  disabled={deletingChatId === chat.id}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Удалить чат"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
