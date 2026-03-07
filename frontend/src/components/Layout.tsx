import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Settings,
  LogOut,
  Shield,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserPlus,
  Clock,
  BarChart3,
  CalendarDays,
  Table2,
  Monitor,
  AppWindow,
  Layers,
  GanttChartSquare,
  Target,
  Zap,
  UserCircle,
  FileBarChart,
  User,
  CreditCard,
  CheckSquare,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

// ─── 타입 정의 ───────────────────────────────────────────

interface NavLeaf {
  kind: 'leaf';
  to: string;
  icon: LucideIcon;
  label: string;
  roles: string[];
}

interface NavGroup {
  kind: 'group';
  id: string;
  icon: LucideIcon;
  label: string;
  roles: string[];
  children: NavLeaf[] | NavSubGroup[];
}

interface NavSubGroup {
  kind: 'subgroup';
  id: string;
  icon: LucideIcon;
  label: string;
  children: NavLeaf[];
}

type NavItem = NavLeaf | NavGroup;

// ─── 메뉴 정의 ──────────────────────────────────────────

const allRoles = ['employee', 'manager', 'hr_admin', 'super_admin'];
const managerUp = ['manager', 'hr_admin', 'super_admin'];

const navItems: NavItem[] = [
  // ── 리포트 ─────────────────────
  {
    kind: 'group',
    id: 'reports',
    icon: FileBarChart,
    label: '리포트',
    roles: allRoles,
    children: [
      {
        kind: 'subgroup',
        id: 'reports-time',
        icon: Clock,
        label: '시간',
        children: [
          { kind: 'leaf', to: '/reports/time/summary', icon: BarChart3, label: '요약', roles: allRoles },
          { kind: 'leaf', to: '/reports/time/detailed', icon: FileBarChart, label: '상세', roles: allRoles },
          { kind: 'leaf', to: '/reports/time/by-days', icon: CalendarDays, label: '일별', roles: allRoles },
          { kind: 'leaf', to: '/reports/time/pivot', icon: Table2, label: '피벗 테이블', roles: allRoles },
        ],
      },
    ],
  },

  // ── 컴퓨터 활동 ────────────────
  {
    kind: 'group',
    id: 'activities',
    icon: Monitor,
    label: '컴퓨터 활동',
    roles: allRoles,
    children: [
      { kind: 'leaf', to: '/activities/dashboard', icon: LayoutDashboard, label: '대시보드', roles: allRoles },
      { kind: 'leaf', to: '/activities/apps', icon: AppWindow, label: '사이트 및 앱', roles: allRoles },
      { kind: 'leaf', to: '/activities/categories', icon: Layers, label: '활동 카테고리', roles: allRoles },
      { kind: 'leaf', to: '/activities/timeline', icon: GanttChartSquare, label: '타임라인', roles: allRoles },
      { kind: 'leaf', to: '/activities/goals', icon: Target, label: '목표', roles: allRoles },
      { kind: 'leaf', to: '/activities/efficiency', icon: Zap, label: '효율성', roles: allRoles },
      { kind: 'leaf', to: '/activities/user-stats', icon: UserCircle, label: '사용자 통계', roles: allRoles },
    ],
  },

  // ── 팀 ──────────────────────
  {
    kind: 'group',
    id: 'team',
    icon: Users,
    label: 'Team',
    roles: allRoles,
    children: [
      { kind: 'leaf', to: '/team/users', icon: Users, label: 'Users', roles: allRoles },
      { kind: 'leaf', to: '/team/timesheet-approvals', icon: CheckSquare, label: 'Timesheet Approvals', roles: allRoles },
    ],
  },

  // ── Notion 연동 ──────────────
  { kind: 'leaf', to: '/notion/tasks', icon: CheckSquare, label: 'Notion 태스크', roles: allRoles },

  // ── 기타 ───────────────────
  { kind: 'leaf', to: '/manager', icon: Users, label: '팀 관리 (매니저)', roles: managerUp },
  { kind: 'leaf', to: '/review', icon: ClipboardCheck, label: '데이터 검토', roles: allRoles },
  { kind: 'leaf', to: '/workspace', icon: UserPlus, label: '워크스페이스', roles: allRoles },
];

// ─── 컴포넌트 ────────────────────────────────────────────

export default function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // 클릭 외부 발생 시 드롭다운 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 열린 그룹/서브그룹
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (location.pathname.startsWith('/reports')) { init['reports'] = true; init['reports-time'] = true; }
    if (location.pathname.startsWith('/activities')) init['activities'] = true;
    if (location.pathname.startsWith('/team')) init['team'] = true;
    return init;
  });

  const toggle = (id: string) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const role = profile?.role ?? 'employee';

  // ── 렌더 헬퍼 ─────

  const renderLeaf = (item: NavLeaf, depth = 0) => {
    if (!item.roles.includes(role)) return null;
    const pl = collapsed ? 'px-3' : depth === 0 ? 'pl-3' : depth === 1 ? 'pl-8' : 'pl-12';
    return (
      <li key={item.to}>
        <NavLink
          to={item.to}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2.5 pr-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150',
              pl,
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )
          }
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      </li>
    );
  };

  const renderSubGroup = (sg: NavSubGroup) => {
    const isOpen = !!openGroups[sg.id];
    const hasActive = sg.children.some(c => location.pathname.startsWith(c.to));
    return (
      <li key={sg.id}>
        <button
          onClick={() => toggle(sg.id)}
          className={clsx(
            'w-full flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-xl text-[13px] font-medium transition-all',
            hasActive ? 'text-brand-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
          )}
        >
          <sg.icon className="w-4 h-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{sg.label}</span>
              <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
            </>
          )}
        </button>
        {isOpen && !collapsed && (
          <ul className="mt-0.5 space-y-0.5">
            {sg.children.map(c => renderLeaf(c, 2))}
          </ul>
        )}
      </li>
    );
  };

  const renderGroup = (g: NavGroup) => {
    if (!g.roles.includes(role)) return null;
    const isOpen = !!openGroups[g.id];
    const hasActive = g.children.some(c => {
      if (c.kind === 'leaf') return location.pathname.startsWith(c.to);
      return (c as NavSubGroup).children.some(sc => location.pathname.startsWith(sc.to));
    });

    return (
      <li key={g.id}>
        {/* 섹션 헤더 (접을 때는 아이콘만) */}
        {collapsed ? (
          <div className="flex justify-center py-2">
            <g.icon className={clsx('w-5 h-5', hasActive ? 'text-brand-600' : 'text-gray-400')} />
          </div>
        ) : (
          <button
            onClick={() => toggle(g.id)}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all',
              hasActive ? 'text-brand-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
            )}
          >
            <g.icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 text-left">{g.label}</span>
            <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
          </button>
        )}
        {isOpen && !collapsed && (
          <ul className="mt-0.5 space-y-0.5">
            {g.children.map(c =>
              c.kind === 'subgroup'
                ? renderSubGroup(c as NavSubGroup)
                : renderLeaf(c as NavLeaf, 1),
            )}
          </ul>
        )}
      </li>
    );
  };

  const renderItem = (item: NavItem) =>
    item.kind === 'group' ? renderGroup(item) : renderLeaf(item, 0);

  // ── 메인 렌더 ─────

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 사이드바 */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-gray-100 transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-64',
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

        {/* 네비게이션 */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <ul className="space-y-0.5 px-2">
            {navItems.map(renderItem)}
          </ul>
        </nav>

        {/* 하단 Agent 상태 (collapsed 시) */}
        {collapsed && (
          <div className="border-t border-gray-100 p-3 flex justify-center">
            {profile?.agentConnected
              ? <Wifi className="w-4 h-4 text-success-500" />
              : <WifiOff className="w-4 h-4 text-gray-400" />}
          </div>
        )}
      </aside>

      {/* 메인 콘텐츠 */}
      <main
        className={clsx(
          'flex-1 flex flex-col transition-all duration-300',
          collapsed ? 'ml-[72px]' : 'ml-64',
        )}
      >
        {/* 헤더 바 */}
        <header className="h-14 flex items-center justify-end gap-3 px-6 border-b border-gray-100 bg-white flex-shrink-0">
          {/* Agent 상태 */}
          <div className="flex items-center gap-1.5 text-xs mr-auto">
            {profile?.agentConnected ? (
              <><Wifi className="w-3.5 h-3.5 text-success-500" /><span className="text-success-700">Agent 연결됨</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-400">Agent 미연결</span></>
            )}
          </div>

          {/* 계정 드롭다운 */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setAccountOpen(p => !p)}
              className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center hover:bg-brand-700 transition-colors"
            >
              {(profile?.displayName ?? 'U')[0].toUpperCase()}
            </button>

            {accountOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 animate-fade-in">
                {/* 프로필 요약 */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-sm">
                      {(profile?.displayName ?? 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{profile?.displayName}</p>
                      <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                    </div>
                  </div>
                </div>

                {/* 메뉴 항목 */}
                <DropdownLink icon={User} label="Profile settings" onClick={() => { setAccountOpen(false); navigate('/settings?tab=profile'); }} />
                <DropdownLink icon={Settings} label="Account Settings" onClick={() => { setAccountOpen(false); navigate('/settings'); }} />
                <DropdownLink icon={CreditCard} label="Subscription" onClick={() => { setAccountOpen(false); navigate('/settings?tab=subscription'); }} />

                <div className="border-t border-gray-100 mt-1 pt-1">
                  <DropdownLink icon={LogOut} label="Log out" danger onClick={() => { setAccountOpen(false); handleSignOut(); }} />
                </div>
              </div>
            )}
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <div className="flex-1 p-8 max-w-[1400px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/** 드롭다운 메뉴 항목 */
function DropdownLink({ icon: Icon, label, onClick, danger }: {
  icon: LucideIcon; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
        danger
          ? 'text-red-500 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-50',
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );
}
