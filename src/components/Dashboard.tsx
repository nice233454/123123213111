import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Order, Profile } from '../lib/types';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '../lib/types';
import { ClipboardList, Clock, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string, data?: Record<string, string>) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  async function fetchDashboardData() {
    if (!profile) return;

    let query = supabase
      .from('orders')
      .select('*')
      .order('updated_at', { ascending: false });

    if (profile.role === 'manager') {
      query = query.eq('manager_id', profile.id);
    } else {
      query = query.eq('developer_id', profile.id);
    }

    const { data } = await query;
    if (data) {
      setOrders(data as Order[]);
      const ids = [...new Set([...data.map((o: Order) => o.manager_id), ...data.map((o: Order) => o.developer_id).filter(Boolean) as string[]])];
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

  const stats = {
    total: orders.length,
    open: orders.filter((o) => o.status === 'open').length,
    inProgress: orders.filter((o) => o.status === 'in_progress').length,
    review: orders.filter((o) => o.status === 'review').length,
    revision: orders.filter((o) => o.status === 'revision').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  };

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
        <h1 className="text-2xl font-bold text-slate-900">
          {profile?.role === 'manager' ? 'Кабинет менеджера' : 'Кабинет разработчика'}
        </h1>
        <p className="text-slate-500 mt-1">
          {profile?.role === 'manager'
            ? 'Управляйте заказами и контролируйте выполнение'
            : 'Просматривайте и выполняйте назначенные заказы'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Всего заказов" value={stats.total} color="slate" />
        <StatCard icon={TrendingUp} label="В работе" value={stats.inProgress} color="yellow" />
        <StatCard icon={AlertCircle} label="На проверке" value={stats.review} color="blue" />
        <StatCard icon={CheckCircle2} label="Выполнено" value={stats.completed} color="emerald" />
      </div>

      {/* Orders list */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {profile?.role === 'manager' ? 'Мои заказы' : 'Мои задания'}
        </h2>
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Заказов пока нет</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => onNavigate('order-detail', { id: order.id })}
                className="w-full bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
                        {PRIORITY_LABELS[order.priority]}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 truncate">{order.title}</h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{order.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span>Клиент: {order.client_name}</span>
                      {order.developer_id && profiles[order.developer_id] && (
                        <span>Разработчик: {profiles[order.developer_id].full_name}</span>
                      )}
                      {order.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.deadline).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof ClipboardList; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
