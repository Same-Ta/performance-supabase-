import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEmployeeDashboard, useGoalAlignment } from '../hooks/usePerformance';
import GoalAlignmentChart from '../components/charts/GoalAlignmentChart';
import EfficiencyChart from '../components/charts/EfficiencyChart';
import AgentControlPanel from '../components/agent/AgentControlPanel';
import ActivityTimeline from '../components/dashboard/ActivityTimeline';
import WorkContextTimeline from '../components/dashboard/WorkContextTimeline';
import ProductivityOverview from '../components/dashboard/ProductivityOverview';

function NoDataCard() {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center py-16 text-center px-4">
      <p className="text-sm font-semibold text-gray-700 mb-1">아직 성과 데이터가 없어요</p>
      <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
        위 에이전트를 시작하면 업무 활동이 분석되어 이 화면에 데이터가 표시됩니다.
      </p>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { profile, user } = useAuth();
  const userId = profile?.uid ?? '';
  const { todayMetrics, averages, loading, hasData, refetch } = useEmployeeDashboard(userId);
  const { alignments } = useGoalAlignment();

  const handleSessionEnd = useCallback(() => {
    // 세션 종료 후 5초 뒤 데이터 갱신
    setTimeout(() => refetch?.(), 5000);
  }, [refetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }



  const today = !hasData ? null : todayMetrics;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 에이전트 컨트롤 패널 */}
      {user && <AgentControlPanel onSessionEnd={handleSessionEnd} />}

      {!hasData && <NoDataCard />}

      {hasData && (<>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            안녕하세요, {profile?.displayName || '사용자'}님 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            오늘의 업무 성과를 한눈에 확인하세요.
          </p>
        </div>

      </div>

      {/* 차트 영역: 왼쪽에 오늘의 AI 요약, 오른쪽에 목표 정렬 차트 */}
      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        {today && (
          <div className="flex flex-col">
            <div className="card flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="section-title">오늘의 AI 업무 요약</h3>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                {today.aiSummary}
              </p>

              <div className="mb-4">
                <p className="text-xs font-semibold text-success-700 mb-2">✓ 주요 성과</p>
                <ul className="space-y-1">
                  {today.keyAchievements.map((a, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-success-500">•</span> {a}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-warning-700 mb-2">💡 개선 제안</p>
                <ul className="space-y-1">
                  {today.suggestedImprovements.map((s, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-warning-500">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 세부 지표 */}
              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-500">컨텍스트 전환</p>
                  <p className="text-sm font-bold">{today.contextSwitchCount}회</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">입력 밀도</p>
                  <p className="text-sm font-bold">{today.inputDensity}/분</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">활성 시간</p>
                  <p className="text-sm font-bold">{(today.activeWorkMinutes / 60).toFixed(1)}h</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <GoalAlignmentChart data={alignments} />
      </div>

      {/* 하단 영역 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ProductivityOverview
          softwareData={today?.softwareUsage || []}
          focusScore={today?.focusScore || averages.avgFocus}
          efficiencyScore={today?.efficiencyScore || averages.avgEfficiency}
          activeMinutes={today?.activeWorkMinutes || 0}
          totalMinutes={today?.totalWorkMinutes || 0}
        />
        <EfficiencyChart
          softwareData={today?.softwareUsage || []}
        />
      </div>

      {/* AI 업무 컨텍스트 타임라인 (화면 분석 기반) */}
      <WorkContextTimeline
        timeline={today?.timeline ?? []}
        isLive={!!user}
      />

      {/* 오늘 하루 전체 활동 타임라인 */}
      <ActivityTimeline
        segments={today?.timeline ?? []}
        date={today?.date}
      />

      </>)}
    </div>
  );
}
