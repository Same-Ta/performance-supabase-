import { useState, useEffect, useCallback } from 'react';
import type {
  PerformanceMetrics,
  DailyTrend,
  GoalAlignmentDetail,
  DataReviewItem,
  PerformanceReport,
  TeamDashboardData,
  EmployeeRewardStatus,
} from '../types';
import {
  scoreToGrade,
  metricsToTrends,
  calculatePeriodAverages,
  REWARD_TIERS,
} from '../services/analyticsService';
import {
  getMetricsByUser,
  getPendingReviews,
  updateReviewDecision,
  deleteMetrics,
  getTeamDashboard,
  getRewardStatus as fetchRewardStatus,
} from '../services/firestoreService';

function generateDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ─── Hook: 직원 대시보드 데이터 ────────────────────────────
export function useEmployeeDashboard(userId: string) {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [todayMetrics, setTodayMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = () => setFetchTick(t => t + 1);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const realMetrics = await getMetricsByUser(userId, 30);
        if (cancelled) return;
        setMetrics(realMetrics);
        setTrends(metricsToTrends(realMetrics));
        setTodayMetrics(realMetrics.length > 0 ? realMetrics[0] : null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '데이터 로딩 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [userId, fetchTick]);

  const averages = calculatePeriodAverages(metrics);

  return { metrics, trends, todayMetrics, averages, loading, error, hasData: metrics.length > 0, refetch };
}

// ─── Hook: 목표 정렬도 ────────────────────────────────────
export function useGoalAlignment() {
  const [alignments, setAlignments] = useState<GoalAlignmentDetail[]>([]);

  useEffect(() => {
    // TODO: Firestore goals 컬렉션 연동 후 대체
    setAlignments([
      {
        goalId: 'goal-1',
        goalTitle: '프론트엔드 성능 개선',
        alignmentPercentage: 88,
        timeSpentMinutes: 320,
        evidence: ['번들 사이즈 20% 감소', 'LCP 1.2초 달성'],
      },
      {
        goalId: 'goal-2',
        goalTitle: '사용자 경험 향상',
        alignmentPercentage: 75,
        timeSpentMinutes: 180,
        evidence: ['에러 핸들링 개선', '접근성 ARIA 라벨 추가'],
      },
      {
        goalId: 'goal-3',
        goalTitle: '코드 품질 강화',
        alignmentPercentage: 92,
        timeSpentMinutes: 150,
        evidence: ['테스트 커버리지 85% 달성', '린트 에러 제로'],
      },
      {
        goalId: 'goal-4',
        goalTitle: '팀 협업 프로세스',
        alignmentPercentage: 68,
        timeSpentMinutes: 90,
        evidence: ['코드 리뷰 참여', 'PR 평균 머지 시간 단축'],
      },
      {
        goalId: 'goal-5',
        goalTitle: '기술 문서화',
        alignmentPercentage: 55,
        timeSpentMinutes: 60,
        evidence: ['API 문서 업데이트'],
      },
    ]);
  }, []);

  return { alignments };
}

// ─── Hook: 데이터 검토 ────────────────────────────────────
export function useDataReview(userId: string) {
  const [reviews, setReviews] = useState<DataReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const realReviews = await getPendingReviews(userId);
        if (cancelled) return;
        setReviews(realReviews);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [userId]);

  const approveReview = useCallback(async (id: string, notes?: string) => {
    await updateReviewDecision(id, 'approved', notes).catch(() => {});
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, decision: 'approved' as const, reviewedAt: new Date().toISOString(), ...(notes ? { userNotes: notes } : {}) } : r))
    );
  }, []);

  const rejectReview = useCallback(async (id: string) => {
    await updateReviewDecision(id, 'rejected').catch(() => {});
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, decision: 'rejected' as const, reviewedAt: new Date().toISOString() } : r))
    );
  }, []);

  const editReview = useCallback(async (id: string, notes: string) => {
    await updateReviewDecision(id, 'edited', notes).catch(() => {});
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, decision: 'edited' as const, userNotes: notes, reviewedAt: new Date().toISOString() } : r
      )
    );
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    await deleteMetrics(id).catch(() => {});
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { reviews, loading, approveReview, rejectReview, editReview, deleteReview };
}

// ─── Hook: 성과 리포트 ────────────────────────────────────
export function usePerformanceReport(userId: string, userName: string) {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        // 실제 메트릭이 충분히 있을 때만 리포트 생성
        const realMetrics = await getMetricsByUser(userId, 30);
        if (cancelled) return;

        if (realMetrics.length < 3) {
          // 데이터 부족 → 리포트 없음
          setReport(null);
          return;
        }

        const avgs = calculatePeriodAverages(realMetrics);
        const trendData = metricsToTrends(realMetrics);
        const overall = Math.round(
          avgs.avgOutputScore * 0.3 +
          avgs.avgEfficiency * 0.25 +
          avgs.avgFocus * 0.25 +
          avgs.avgGoalAlignment * 0.2
        );

        setReport({
          id: `report-${userId}-monthly`,
          userId,
          userName,
          period: 'monthly',
          startDate: generateDateStr(30),
          endDate: generateDateStr(0),
          status: 'draft',
          overallScore: overall,
          overallGrade: scoreToGrade(overall),
          avgFocusScore: avgs.avgFocus,
          avgEfficiencyScore: avgs.avgEfficiency,
          avgGoalAlignment: avgs.avgGoalAlignment,
          totalOutputScore: avgs.avgOutputScore,
          totalActiveHours: avgs.totalActiveHours,
          totalDeepFocusHours: avgs.totalDeepFocusHours,
          dailyTrends: trendData,
          goalAlignments: [],
          executiveSummary: `${userName}님은 최근 ${realMetrics.length}일 평균 몰입도 ${avgs.avgFocus}점, 효율성 ${avgs.avgEfficiency}점을 기록했습니다.`,
          strengths: [],
          areasForGrowth: [],
          salaryNegotiationPoints: [
            `몰입도 ${avgs.avgFocus}점 · 효율성 ${avgs.avgEfficiency}점 · 딥포커스 ${avgs.totalDeepFocusHours}시간`,
          ],
          createdAt: new Date().toISOString(),
        });
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [userId, userName]);

  return { report, loading };
}

// ─── Hook: 팀 대시보드 ────────────────────────────────────
export function useTeamDashboard(teamId?: string) {
  const [dashboard, setDashboard] = useState<TeamDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const data = teamId ? await getTeamDashboard(teamId) : null;
        if (!cancelled) setDashboard(data);
      } catch {
        if (!cancelled) setDashboard(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [teamId]);

  return { dashboard, loading };
}

// ─── Hook: 보상 상태 ──────────────────────────────────────
export function useRewardStatus(userId: string) {
  const [rewardStatus, setRewardStatus] = useState<EmployeeRewardStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const data = await fetchRewardStatus(userId);
        if (!cancelled) setRewardStatus(data);
      } catch {
        if (!cancelled) setRewardStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [userId]);

  return { rewardStatus, tiers: REWARD_TIERS, loading };
}
