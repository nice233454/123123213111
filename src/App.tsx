import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { LoginPage, RegisterPage } from './components/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { OrdersFeed } from './components/OrdersFeed';
import { CreateOrder } from './components/CreateOrder';
import { OrderDetail } from './components/OrderDetail';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';

type Page = 'dashboard' | 'orders' | 'order-detail' | 'chats' | 'chat-room' | 'create-order';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [pageData, setPageData] = useState<Record<string, string>>({});
  const [showRegister, setShowRegister] = useState(false);

  const handleNavigate = (page: string, data?: Record<string, string>) => {
    setCurrentPage(page as Page);
    setPageData(data || {});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    if (showRegister) {
      return (
        <div>
          <RegisterPage />
          <div className="text-center -mt-4 pb-8">
            <button
              onClick={() => setShowRegister(false)}
              className="text-emerald-400 hover:text-emerald-300 text-sm underline"
            >
              Уже есть аккаунт? Войти
            </button>
          </div>
        </div>
      );
    }
    return (
      <div>
        <LoginPage />
        <div className="text-center -mt-4 pb-8">
          <button
            onClick={() => setShowRegister(true)}
            className="text-emerald-400 hover:text-emerald-300 text-sm underline"
          >
            Нет аккаунта? Зарегистрироваться
          </button>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'orders':
        return <OrdersFeed onNavigate={handleNavigate} />;
      case 'create-order':
        return <CreateOrder onNavigate={handleNavigate} />;
      case 'order-detail':
        return pageData.id ? (
          <OrderDetail orderId={pageData.id} onNavigate={handleNavigate} />
        ) : null;
      case 'chats':
        return <ChatList onNavigate={handleNavigate} />;
      case 'chat-room':
        return pageData.id ? (
          <ChatRoom chatId={pageData.id} onNavigate={handleNavigate} />
        ) : null;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
