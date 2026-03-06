/**
 * 리포트 > 시간 > 요약
 * 기간별 업무 시간 요약 — 총 시간, 생산적 시간, 카테고리 분포, 일일 추이
 */
import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
// removed unused useEmployeeDashboard
import { getMetricsByUser } from '../../services/firestoreService';
import { useEffect } from 'react';
import type { PerformanceMetrics } from '../../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Clock, TrendingUp, Zap, Brain, CalendarDays } from 'lucide-react';
import clsx from 'clsx';

const PERIOD_OPTIONS = [
  { value: 7, label: '최근 7일' },
  { value: 14, label: '최근 14일' },
  { value: 30, label: '최근 30일' },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  development: '#3B82F6', communication: '#A855F7', documentation: '#10B981',
  design: '#EC4899', project_mgmt: '#F59E0B', browser: '#0EA5E9',
  meeting: '#F97316', research: '#14B8A6', idle: '#D1D5DB', other: '#9CA3AF',
};
const CATEGORY_LABELS: Record<string, string> = {
  development: '개발', communication: '커뮤니케이션', documentation: '문서화',
  design: '디자인', project_mgmt: '프로젝트 관리', browser: '웹 브라우저',
  meeting: '회의', research: '리서치', idle: '자리비움', other: '기타',
};

function fmtH(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default function TimeSummary() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [period, setPeriod] = useState<number>(7);
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getMetricsByUser(userId, period);
        if (!cancelled) setMetrics(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (userId) load();
    return () => { cancelled = true; };
  }, [userId, period]);

  // ── 종합 통계 ──
  const stats = useMemo(() => {
    const totalWork = metrics.reduce((s, m) => s + m.totalWorkMinutes, 0);
    const activeWork = metrics.reduce((s, m) => s + m.activeWorkMinutes, 0);
    const deepFocus = metrics.reduce((s, m) => s + m.deepFocusMinutes, 0);
    const avgFocus = metrics.length > 0 ? Math.round(metrics.reduce((s, m) => s + m.focusScore, 0) / metrics.length) : 0;
    const avgEfficiency = metrics.length > 0 ? Math.round(metrics.reduce((s, m) => s + m.efficiencyScore, 0) / metrics.length) : 0;
    return { totalWork, activeWork, deepFocus, avgFocus, avgEfficiency, days: metrics.length };
  }, [metrics]);

  // ── 일별 차트 데이터 ──
  const dailyChart = useMemo(() => {
    return [...metrics]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(m => ({
        date: m.date.slice(5), // MM-DD
        총시간: +(m.totalWorkMinutes / 60).toFixed(1),
        활성시간: +(m.activeWorkMinutes / 60).toFixed(1),
        딥포커스: +(m.deepFocusMinutes / 60).toFixed(1),
      }));
  }, [metrics]);

  // ── 카테고리 파이 ──
  const categoryPie = useMemo(() => {
    const catMap: Record<string, number> = {};
    metrics.forEach(m => {
      m.softwareUsage.forEach(su => {
        catMap[su.category] = (catMap[su.category] || 0) + su.minutes;
      });
    });
    return Object.entries(catMap)
      .map(([cat, min]) => ({
        name: CATEGORY_LABELS[cat] || cat,
        value: Math.round(min),
        color: CATEGORY_COLORS[cat] || '#9CA3AF',
      }))
      .sort((a, b) => b.value - a.value);
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">시간 요약</h1>
          <p className="text-sm text-gray-500 mt-1">기간별 업무 시간을 한눈에 확인하세요.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                period === opt.value ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="card text-center py-16">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">해당 기간에 기록된 데이터가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">에이전트를 시작하면 데이터가 수집됩니다.</p>
        </div>
      ) : (
        <>
          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard icon={<Clock className="w-5 h-5 text-blue-500" />} label="총 업무 시간" value={fmtH(stats.totalWork)} />
            <SummaryCard icon={<Zap className="w-5 h-5 text-green-500" />} label="활성 시간" value={fmtH(stats.activeWork)} />
            <SummaryCard icon={<Brain className="w-5 h-5 text-purple-500" />} label="딥 포커스" value={fmtH(stats.deepFocus)} />
            <SummaryCard icon={<TrendingUp className="w-5 h-5 text-indigo-500" />} label="평균 몰입도" value={`${stats.avgFocus}점`} />
            <SummaryCard icon={<CalendarDays className="w-5 h-5 text-orange-500" />} label="기록 일수" value={`${stats.days}일`} />
          </div>

          {/* 일별 시간 차트 */}
          <div className="card">
            <h3 className="section-title mb-4">일별 업무 시간 추이</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#999' }} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} unit="h" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }}
                  formatter={(v: number) => [`${v}h`]}
                />
                <Bar dataKey="총시간" fill="#CBD5E1" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="활성시간" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="딥포커스" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-3">
              <Legend2 color="#CBD5E1" label="총 시간" />
              <Legend2 color="#3B82F6" label="활성 시간" />
              <Legend2 color="#8B5CF6" label="딥 포커스" />
            </div>
          </div>

          {/* 카테고리 분포 */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="section-title mb-4">카테고리별 시간 분포</h3>
              {categoryPie.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={55}
                      paddingAngle={2}
                      label={({ name, percent }: { name: string; percent: number }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {categoryPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtH(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">카테고리 데이터 없음</p>
              )}
            </div>

            <div className="card">
              <h3 className="section-title mb-4">카테고리별 상세</h3>
              <div className="space-y-3">
                {categoryPie.map((cat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium text-gray-700 w-24">{cat.name}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${categoryPie.length > 0 ? (cat.value / categoryPie[0].value) * 100 : 0}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 w-20 text-right">{fmtH(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-3 !py-4">
      {icon}
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
