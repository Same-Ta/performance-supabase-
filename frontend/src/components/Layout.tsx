import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  FileBarChart,
  Settings,
  LogOut,
  Shield,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '내 대시보드', roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
  { to: '/manager', icon: Users, label: '팀 관리', roles: ['manager', 'hr_admin', 'super_admin'] },
  { to: '/review', icon: ClipboardCheck, label: '데이터 검토', roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
  { to: '/report', icon: FileBarChart, label: '성과 리포트', roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
  { to: '/team-invite', icon: UserPlus, label: '팀 관리', roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
  { to: '/settings', icon: Settings, label: '설정', roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
];

export default function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filteredNav = navItems.filter(
    (item) => item.roles.includes(profile?.role ?? 'employee')
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 사이드바 */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-gray-100 transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {/* 로고 */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Shield className="w-7 h-7 text-brand-600" />
              <span className="font-bold text-lg text-brand-800">ProofWork</span>
            </div>
          )}
          {collapsed && <Shield className="w-7 h-7 text-brand-600 mx-auto" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Agent 상태 */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {profile?.agentConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-success-500" />
                  <span className="text-xs text-success-700 font-medium">Agent 연결됨</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">Agent 미연결</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* 네비게이션 */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {filteredNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* 사용자 정보 */}
        <div className="border-t border-gray-100 p-4">
          {!collapsed && profile && (
            <div className="mb-3">
              <p className="text-sm font-semibold text-gray-900">{profile.displayName}</p>
              <p className="text-xs text-gray-500">{profile.department}</p>
              <p className="text-xs text-gray-400">{profile.position}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className={clsx(
              'flex items-center gap-2 text-sm text-gray-500 hover:text-danger-500 transition-colors',
              collapsed && 'justify-center w-full'
            )}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>로그아웃</span>}
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main
        className={clsx(
          'flex-1 transition-all duration-300',
          collapsed ? 'ml-[72px]' : 'ml-64'
        )}
      >
        <div className="p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
