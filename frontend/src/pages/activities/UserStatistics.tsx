/**
 * 컴퓨터 활동 > 사용자 통계
 * 종합 통계: 총 근무일, 누적 시간, 평균 점수, 등급 분포, 연속 기록, 보상 현황
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser } from '../../services/firestoreService';
import { scoreToGrade, getRewardTier } from '../../services/analyticsService';
import type { PerformanceMetrics } from '../../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const GRADE_COLORS: Record<string, string> = {
  S: '#7C3AED', A: '#2563EB', B: '#10B981', C: '#F59E0B', D: '#EF4444', F: '#6B7280',
};
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D', 'F'];

function fmtH(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}시간 ${min}분` : `${min}분`;
}

export default function UserStatistics() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getMetricsByUser(userId, 90);
        if (!cancelled) setMetrics(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!userId) { setLoading(false); return; }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const sorted = useMemo(
    () => [...metrics].sort((a, b) => a.date.localeCompare(b.date)),
    [metrics],
  );

  const stats = useMemo(() => {
    if (sorted.length === 0) return null;

    const totalDays = sorted.length;
    const totalWork = sorted.reduce((s, m) => s + m.totalWorkMinutes, 0);
    const totalActive = sorted.reduce((s, m) => s + m.activeWorkMinutes, 0);
    const totalDeep = sorted.reduce((s, m) => s + m.deepFocusMinutes, 0);
    const avgFocus = sorted.reduce((s, m) => s + m.focusScore, 0) / totalDays;
    const avgEff = sorted.reduce((s, m) => s + m.efficiencyScore, 0) / totalDays;
    const avgGrade = scoreToGrade(avgEff);

    // 등급 분포
    const gradeDist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    sorted.forEach(m => { gradeDist[scoreToGrade(m.efficiencyScore)] += 1; });

    // 연속 기록 (streak)
    let streak = 0;
    let maxStreak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const expected = new Date();
      expected.setDate(expected.getDate() - (sorted.length - 1 - i));
      const actual = new Date(sorted[i].date);
      const diff = Math.abs(expected.getTime() - actual.getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 2) { streak++; maxStreak = Math.max(maxStreak, streak); }
      else streak = 0;
    }

    // 보상 티어
    const tier = getRewardTier(avgEff);

    // 월별 추이 (최근 3개월)
    const monthMap: Record<string, { days: number; eff: number; work: number }> = {};
    sorted.forEach(m => {
      const mon = m.date.slice(0, 7);
      if (!monthMap[mon]) monthMap[mon] = { days: 0, eff: 0, work: 0 };
      monthMap[mon].days += 1;
      monthMap[mon].eff += m.efficiencyScore;
      monthMap[mon].work += m.totalWorkMinutes;
    });
    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        avgEff: Math.round(d.eff / d.days),
        totalHours: Math.round(d.work / 60),
        days: d.days,
      }));

    // 상위 앱 Top 5
    const appMap: Record<string, number> = {};
    sorted.forEach(m => m.softwareUsage.forEach(su => {
      appMap[su.appName] = (appMap[su.appName] || 0) + su.minutes;
    }));
    const topApps = Object.entries(appMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, min]) => ({ name, minutes: min }));

    return {
      totalDays, totalWork, totalActive, totalDeep,
      avgFocus, avgEff, avgGrade, gradeDist, streak, maxStreak,
      tier, monthlyTrend, topApps,
    };
  }, [sorted]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card text-center py-16">
        <p className="text-gray-500">사용자 통계 데이터가 없습니다.</p>
      </div>
    );
  }

  const gradeData = GRADE_ORDER.map(g => ({
    grade: g,
    count: stats.gradeDist[g] || 0,
    color: GRADE_COLORS[g],
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">사용자 통계</h1>
        <p className="text-sm text-gray-500 mt-1">최근 90일간의 종합 활동 통계입니다.</p>
      </div>

      {/* 대표 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="총 근무일" value={`${stats.totalDays}일`} color="#3B82F6" />
        <StatCard label="누적 근무 시간" value={fmtH(stats.totalWork)} color="#10B981" />
        <StatCard label="평균 효율" value={`${Math.round(stats.avgEff)}점`}
          sub={`등급 ${stats.avgGrade}`} color={GRADE_COLORS[stats.avgGrade]} />
        <StatCard label="평균 집중" value={`${Math.round(stats.avgFocus)}점`} color="#6366F1" />
        <StatCard label="현재 연속"
          value={`${stats.streak}일`} sub={`최대 ${stats.maxStreak}일`} color="#F59E0B" />
        <StatCard label="보상 티어"
          value={stats.tier.name} sub={`${stats.tier.minScore}~${stats.tier.maxScore}점`} color={stats.tier.color} />
      </div>

      {/* 누적 시간 분해 */}
      <div className="card">
        <h3 className="section-title mb-4">활동 시간 분해</h3>
        <div className="grid grid-cols-3 gap-6">
          <TimeBlock label="총 근무 시간" minutes={stats.totalWork} color="#3B82F6" total={stats.totalWork} />
          <TimeBlock label="활성 시간" minutes={stats.totalActive} color="#10B981" total={stats.totalWork} />
          <TimeBlock label="딥 포커스" minutes={stats.totalDeep} color="#7C3AED" total={stats.totalWork} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 등급 분포 */}
        <div className="card">
          <h3 className="section-title mb-4">등급 분포</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gradeData}>
              <XAxis dataKey="grade" tick={{ fontSize: 14, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 10, fill: '#999' }} />
              <Tooltip formatter={(v: number) => `${v}일`} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                {gradeData.map((g, i) => <Cell key={i} fill={g.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 상위 앱 Top 5 */}
        <div className="card">
          <h3 className="section-title mb-4">가장 많이 사용한 앱</h3>
          <div className="space-y-3">
            {stats.topApps.map((app, i) => {
              const maxMin = stats.topApps[0]?.minutes || 1;
              const colors = ['#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EC4899'];
              return (
                <div key={app.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-gray-400">{i + 1}</span>
                  <span className="text-sm font-semibold text-gray-800 w-32 truncate">{app.name}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(app.minutes / maxMin) * 100}%`, backgroundColor: colors[i] }} />
                  </div>
                  <span className="text-xs text-gray-500 w-20 text-right">{fmtH(app.minutes)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 월별 추이 */}
      {stats.monthlyTrend.length > 1 && (
        <div className="card">
          <h3 className="section-title mb-4">월별 추이</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">월</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">근무 일수</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">총 시간</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">평균 효율</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">등급</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyTrend.map(mt => {
                  const g = scoreToGrade(mt.avgEff);
                  return (
                    <tr key={mt.month} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-2 font-semibold">{mt.month}</td>
                      <td className="px-4 py-2 text-center">{mt.days}일</td>
                      <td className="px-4 py-2 text-center">{mt.totalHours}h</td>
                      <td className="px-4 py-2 text-center font-bold" style={{ color: GRADE_COLORS[g] }}>{mt.avgEff}점</td>
                      <td className="px-4 py-2 text-center">
                        <span className="font-bold text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: GRADE_COLORS[g] + '20', color: GRADE_COLORS[g] }}>{g}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="card text-center space-y-1.5">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function TimeBlock({ label, minutes, color, total }: {
  label: string; minutes: number; color: string; total: number;
}) {
  const pct = total > 0 ? (minutes / total) * 100 : 0;
  return (
    <div className="text-center space-y-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{fmtH(minutes)}</p>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[10px] text-gray-400">{pct.toFixed(1)}%</p>
    </div>
  );
}
