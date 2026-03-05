import { useTeamDashboard } from '../hooks/usePerformance';
import MetricCard from '../components/dashboard/MetricCard';
import TeamOverview from '../components/dashboard/TeamOverview';
import BottleneckAlert from '../components/dashboard/BottleneckAlert';
import FocusChart from '../components/charts/FocusChart';
import { Users, Brain, Zap, Target } from 'lucide-react';

export default function ManagerDashboard() {
  const { dashboard, loading } = useTeamDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Users className="w-16 h-16 text-gray-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">팀 데이터가 없어요</h2>
        <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
          팀원들이 On-Device Agent로 데이터를 제출하고,<br />
          Cloud Function이 집계를 완료하면 여기서 팀 현황을 볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {dashboard.teamName} 대시보드
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          팀원 {dashboard.memberCount}명의 성과 지표를 한눈에 관리하세요.
        </p>
      </div>

      {/* 팀 평균 지표 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="팀 인원"
          value={dashboard.memberCount}
          suffix="명"
          icon={<Users className="w-5 h-5" />}
          color="brand"
        />
        <MetricCard
          title="팀 평균 몰입도"
          value={dashboard.avgFocusScore}
          suffix="/100"
          icon={<Brain className="w-5 h-5" />}
          color="brand"
          change={3}
        />
        <MetricCard
          title="팀 평균 효율성"
          value={dashboard.avgEfficiency}
          suffix="/100"
          icon={<Zap className="w-5 h-5" />}
          color="success"
          change={-1}
        />
        <MetricCard
          title="팀 목표 정렬도"
          value={dashboard.avgGoalAlignment}
          suffix="%"
          icon={<Target className="w-5 h-5" />}
          color="warning"
          change={5}
        />
      </div>

      {/* 병목 알림 */}
      <BottleneckAlert alerts={dashboard.bottlenecks} />

      {/* 트렌드 + 팀 순위 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <FocusChart data={dashboard.departmentTrends} title="팀 몰입도 트렌드" />
        <TeamOverview members={dashboard.topPerformers} />
      </div>
    </div>
  );
}
