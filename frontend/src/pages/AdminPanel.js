import { useState } from 'react';
import { BookOpen, FileText, Package, LogOut, Settings as SettingsIcon, Star } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import TemplateManagement from '@/pages/TemplateManagement';
import AutomationOrders from '@/pages/AutomationOrders';
import Settings from '@/pages/Settings';
import AdminReviews from '@/pages/AdminReviews';

function AdminPanel() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const sections = [
    { id: 'dashboard', name: 'Dashboard', icon: BookOpen },
    { id: 'templates', name: 'Templates', icon: FileText },
    { id: 'orders', name: 'Orders', icon: Package },
    { id: 'reviews', name: 'Reviews', icon: Star },
    { id: 'settings', name: 'Settings', icon: SettingsIcon }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Storybook Vault</h1>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {sections.map(section => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-purple-100 text-purple-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span>{section.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-700 transition-all"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeSection === 'dashboard' && <DashboardContent />}
        {activeSection === 'templates' && <TemplateManagement standalone={false} />}
        {activeSection === 'orders' && <AutomationOrders standalone={false} />}
        {activeSection === 'reviews' && <AdminReviews />}
        {activeSection === 'settings' && <Settings />}
      </div>
    </div>
  );
}

// Wrapper for Dashboard without header
function DashboardContent() {
  return <Dashboard embedded={true} />;
}

export default AdminPanel;
