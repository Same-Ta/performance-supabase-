import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// 기존 페이지
import ManagerDashboard from './pages/ManagerDashboard';
import ReviewApproval from './pages/ReviewApproval';
import Settings from './pages/Settings';
import TeamManagement from './pages/TeamManagement';
import NotionTasks from './pages/NotionTasks';

// 팀
import TeamUsers from './pages/team/TeamUsers';
import TimesheetApprovals from './pages/team/TimesheetApprovals';

// 리포트 > 시간
import TimeSummary from './pages/reports/TimeSummary';
import TimeDetailed from './pages/reports/TimeDetailed';
import TimeByDays from './pages/reports/TimeByDays';
import TimePivot from './pages/reports/TimePivot';

// 컴퓨터 활동
import ActivitiesDashboard from './pages/activities/ActivitiesDashboard';
import SitesAndApps from './pages/activities/SitesAndApps';
import ActivityCategories from './pages/activities/ActivityCategories';
import ActivitiesTimeline from './pages/activities/ActivitiesTimeline';
import Goals from './pages/activities/Goals';
import Efficiency from './pages/activities/Efficiency';
import UserStatistics from './pages/activities/UserStatistics';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return <Navigate to="/activities/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* 기본 리다이렉트 */}
            <Route index element={<Navigate to="/activities/dashboard" replace />} />

            {/* 리포트 > 시간 */}
            <Route path="reports/time/summary" element={<TimeSummary />} />
            <Route path="reports/time/detailed" element={<TimeDetailed />} />
            <Route path="reports/time/by-days" element={<TimeByDays />} />
            <Route path="reports/time/pivot" element={<TimePivot />} />

            {/* 컴퓨터 활동 */}
            <Route path="activities/dashboard" element={<ActivitiesDashboard />} />
            <Route path="activities/apps" element={<SitesAndApps />} />
            <Route path="activities/categories" element={<ActivityCategories />} />
            <Route path="activities/timeline" element={<ActivitiesTimeline />} />
            <Route path="activities/goals" element={<Goals />} />
            <Route path="activities/efficiency" element={<Efficiency />} />
            <Route path="activities/user-stats" element={<UserStatistics />} />

            {/* 기존 페이지 */}
            <Route path="manager" element={<ManagerDashboard />} />
            <Route path="review" element={<ReviewApproval />} />
            <Route path="workspace" element={<TeamManagement />} />
            <Route path="settings" element={<Settings />} />

            {/* 팀 */}
            <Route path="team/users" element={<TeamUsers />} />
            <Route path="team/timesheet-approvals" element={<TimesheetApprovals />} />

            {/* Notion 연동 */}
            <Route path="notion/tasks" element={<NotionTasks />} />

            {/* 이전 경로 호환 리다이렉트 */}
            <Route path="dashboard" element={<Navigate to="/activities/dashboard" replace />} />
            <Route path="report" element={<Navigate to="/reports/time/summary" replace />} />
            <Route path="team-invite" element={<Navigate to="/team/users" replace />} />
            <Route path="team" element={<Navigate to="/team/users" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
