import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Order, Profile } from '../lib/types';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '../lib/types';
import { ClipboardList, Clock, Search, Filter, UserPlus } from 'lucide-react';

interface OrdersFeedProps {
  onNavigate: (page: string, data?: Record<string, string>) => void;
}

export function OrdersFeed({ onNavigate }: OrdersFeedProps) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data as Order[]);
      const ids = [...new Set([
        ...data.map((o: Order) => o.manager_id),
        ...data.map((o: Order) => o.developer_id).filter(Boolean) as string[],
      ])];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
        if (profs) {
          const map: Record<string, Profile> = {};
          profs.forEach((p: Profile) => { map[p.id] = p; });
          setProfiles(map);
        }
      }
    }
    setLoading(false);
  }

  async function claimOrder(orderId: string) {
    if (!profile) return;
    setClaiming(orderId);
    const { error } = await supabase
      .from('orders')
      .update({ developer_id: profile.id, status: 'in_progress' })
      .eq('id', orderId)
      .eq('status', 'open')
      .is('developer_id', null);

    if (error) {
      console.error('Error claiming order:', error);
    } else {
      setOrders((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, developer_id: profile.id, status: 'in_progress' as const } : o)
      );
    }
    setClaiming(null);
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.title.toLowerCase().includes(search.toLowerCase()) ||
      order.client_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Лента заказов</h1>
        <p className="text-slate-500 mt-1">Все заказы команды</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или клиенту..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Все статусы</option>
            <option value="open">Открыт</option>
            <option value="in_progress">В работе</option>
            <option value="review">На проверке</option>
            <option value="revision">На доработке</option>
            <option value="completed">Выполнен</option>
          </select>
        </div>
      </div>

      {/* Orders */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Заказов не найдено</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
                  {PRIORITY_LABELS[order.priority]}
                </span>
              </div>

              <button
                onClick={() => onNavigate('order-detail', { id: order.id })}
                className="text-left w-full"
              >
                <h3 className="text-base font-semibold text-slate-900 line-clamp-2 hover:text-emerald-600 transition-colors">
                  {order.title}
                </h3>
              </button>

              <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{order.description}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Клиент: {order.client_name || 'Не указан'}</span>
                  {order.deadline && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.deadline).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Менеджер: {profiles[order.manager_id]?.full_name || '—'}</span>
                  {order.developer_id && profiles[order.developer_id] && (
                    <span>Разраб: {profiles[order.developer_id].full_name}</span>
                  )}
                </div>
              </div>

              {order.status === 'open' && profile?.role === 'developer' && (
                <button
                  onClick={() => claimOrder(order.id)}
                  disabled={claiming === order.id}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {claiming === order.id ? 'Берем...' : 'Взять заказ'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
