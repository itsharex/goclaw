import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ChannelList from './components/ChannelList';
import SessionList from './components/SessionList';
import CronManager from './components/CronManager';
import AcpManager from './components/AcpManager';
import ChatPanel from './components/ChatPanel';
import LogsViewer from './components/LogsViewer';

type Page = 'dashboard' | 'channels' | 'sessions' | 'cron' | 'acp' | 'chat' | 'logs';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'channels':
        return <ChannelList />;
      case 'sessions':
        return <SessionList />;
      case 'cron':
        return <CronManager />;
      case 'acp':
        return <AcpManager />;
      case 'chat':
        return <ChatPanel />;
      case 'logs':
        return <LogsViewer />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        }`}
      >
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;