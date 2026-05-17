import { useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  LayoutDashboard,
  ClipboardList,
  MessageCircle,
  LogOut,
  Menu,
  X,
  Briefcase,
  ChevronRight,
} from 'lucide-react';

type Page = 'dashboard' | 'orders' | 'order-detail' | 'chats' | 'chat-room' | 'create-order';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page, data?: Record<string, string>) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Кабинет', icon: LayoutDashboard },
  { page: 'orders', label: 'Заказы', icon: ClipboardList },
  { page: 'chats', label: 'Чаты', icon: MessageCircle },
];

export function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (page: Page) => {
    onNavigate(page);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200 lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TeamFlow</h1>
              <p className="text-xs text-slate-400">Управление командой</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map(({ page, label, icon: Icon }) => (
              <button
                key={page}
                onClick={() => handleNav(page)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  currentPage === page || (page === 'orders' && currentPage === 'order-detail') || (page === 'chats' && currentPage === 'chat-room')
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
                <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100" />
              </button>
            ))}

            {profile?.role === 'manager' && (
              <button
                onClick={() => handleNav('create-order')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  currentPage === 'create-order'
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                Новый заказ
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            )}
          </nav>

          {/* User info */}
          <div className="px-4 py-4 border-t border-slate-800">
            <div className="flex items-center gap-3 px-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-semibold text-sm">
                {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile?.full_name}</p>
                <p className="text-xs text-slate-400">
                  {profile?.role === 'manager' ? 'Менеджер' : 'Разработчик'}
                </p>
              </div>
              <button
                onClick={signOut}
                className="text-slate-400 hover:text-red-400 transition-colors"
                title="Выйти"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 hover:text-slate-900"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">TeamFlow</h1>
        </div>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
