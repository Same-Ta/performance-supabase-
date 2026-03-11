/**
 * 컴퓨터 활동 > 효율성
 * 효율성 점수 추이, 카테고리별/시간대별 효율, 등급 분포
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser } from '../../services/firestoreService';
import { scoreToGrade } from '../../services/analyticsService';
import type { PerformanceMetrics } from '../../types';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import clsx from 'clsx';

const GRADE_COLORS: Record<string, string> = {
  S: '#7C3AED', A: '#2563EB', B: '#10B981', C: '#F59E0B', D: '#EF4444', F: '#6B7280',
};

function fmtH(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export default function Efficiency() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getMetricsByUser(userId, 30);
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

  /* KPI */
  const kpi = useMemo(() => {
    if (sorted.length === 0) return null;
    const eff = sorted.map(m => m.efficiencyScore);
    const avg = eff.reduce((s, v) => s + v, 0) / eff.length;
    const recent7 = sorted.slice(-7);
    const older7 = sorted.slice(-14, -7);
    const rAvg = recent7.reduce((s, m) => s + m.efficiencyScore, 0) / (recent7.length || 1);
    const oAvg = older7.length > 0 ? older7.reduce((s, m) => s + m.efficiencyScore, 0) / older7.length : rAvg;
    const best = sorted.reduce((best, m) => m.efficiencyScore > best.efficiencyScore ? m : best, sorted[0]);
    const worst = sorted.reduce((w, m) => m.efficiencyScore < w.efficiencyScore ? m : w, sorted[0]);
    return { avg, trend: rAvg - oAvg, best, worst, rAvg, grade: scoreToGrade(avg) };
  }, [sorted]);

  /* 일별 효율 추이 */
  const trendData = useMemo(
    () => sorted.map(m => ({
      date: m.date.slice(5),
      efficiency: m.efficiencyScore,
      focus: m.focusScore,
      active: m.activeWorkMinutes,
    })),
    [sorted],
  );

  /* 등급 분포 */
  const gradeDist = useMemo(() => {
    const dist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    sorted.forEach(m => {
      const g = scoreToGrade(m.efficiencyScore);
      dist[g] = (dist[g] || 0) + 1;
    });
    return Object.entries(dist).map(([grade, count]) => ({ grade, count, color: GRADE_COLORS[grade] }));
  }, [sorted]);

  /* 카테고리별 효율 (softwareUsage 기준) */
  const catEfficiency = useMemo(() => {
    const map: Record<string, { productive: number; total: number }> = {};
    const productiveCats = new Set(['development', 'documentation', 'design', 'project_mgmt', 'research']);
    sorted.forEach(m => {
      m.softwareUsage.forEach(su => {
        if (!map[su.category]) map[su.category] = { productive: 0, total: 0 };
        map[su.category].total += su.minutes;
        if (productiveCats.has(su.category)) map[su.category].productive += su.minutes;
      });
    });
    const LABELS: Record<string, string> = {
      development: '개발', communication: '커뮤니케이션', documentation: '문서화',
      design: '디자인', project_mgmt: '프로젝트 관리', browser: '웹 브라우저',
      meeting: '회의', research: '리서치', idle: '자리비움', other: '기타',
    };
    return Object.entries(map)
      .map(([cat, d]) => ({
        category: LABELS[cat] || cat,
        minutes: d.total,
        isProductive: productiveCats.has(cat),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [sorted]);

  /* 시간대별 효율 */
  const hourlyEfficiency = useMemo(() => {
    const hours: Record<number, { sum: number; cnt: number }> = {};
    sorted.forEach(m => {
      (m.timeline ?? []).forEach(seg => {
        const h = parseInt(seg.startTime.split(':')[0]);
        if (!hours[h]) hours[h] = { sum: 0, cnt: 0 };
        hours[h].sum += seg.durationMinutes;
        hours[h].cnt += 1;
      });
    });
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}시`,
      minutes: hours[h] ? Math.round(hours[h].sum / (sorted.length || 1)) : 0,
    }));
  }, [sorted]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!kpi) {
    return (
      <div className="card text-center py-16">
        <p className="text-gray-500">효율성 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">효율성</h1>
        <p className="text-sm text-gray-500 mt-1">최근 30일 효율성 분석 결과입니다.</p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="평균 효율" value={`${Math.round(kpi.avg)}점`} sub={`등급 ${kpi.grade}`}
          color={GRADE_COLORS[kpi.grade]} />
        <KpiCard label="최근 7일" value={`${Math.round(kpi.rAvg)}점`}
          sub={kpi.trend > 0 ? `+${kpi.trend.toFixed(1)}` : kpi.trend.toFixed(1)}
          color={kpi.trend > 0 ? '#10B981' : kpi.trend < 0 ? '#EF4444' : '#6B7280'} />
        <KpiCard label="최고 기록" value={`${kpi.best.efficiencyScore}점`} sub={kpi.best.date} color="#2563EB" />
        <KpiCard label="최저 기록" value={`${kpi.worst.efficiencyScore}점`} sub={kpi.worst.date} color="#EF4444" />
      </div>

      {/* 효율 추이 */}
      <div className="card">
        <h3 className="section-title mb-4">일별 효율 추이</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#999' }} />
            <Tooltip />
            <Line type="monotone" dataKey="efficiency" stroke="#3B82F6" strokeWidth={2} dot={false} name="효율 점수" />
            <Line type="monotone" dataKey="focus" stroke="#10B981" strokeWidth={1.5} dot={false} name="집중 점수" strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 등급 분포 */}
        <div className="card">
          <h3 className="section-title mb-4">등급 분포</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gradeDist}>
              <XAxis dataKey="grade" tick={{ fontSize: 12, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 10, fill: '#999' }} />
              <Tooltip formatter={(v: number) => `${v}일`} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                {gradeDist.map((g, i) => <Cell key={i} fill={g.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 시간대별 활동량 */}
        <div className="card">
          <h3 className="section-title mb-4">시간대별 평균 활동량</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyEfficiency}>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#999' }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#999' }} unit="분" />
              <Tooltip formatter={(v: number) => `${v}분`} />
              <Bar dataKey="minutes" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 카테고리별 시간 */}
      <div className="card">
        <h3 className="section-title mb-4">카테고리별 사용 시간</h3>
        <div className="space-y-3">
          {catEfficiency.map(c => {
            const maxMins = catEfficiency[0]?.minutes || 1;
            return (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-xs w-24 font-semibold text-gray-700 flex-shrink-0">{c.category}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full transition-all', c.isProductive ? 'bg-blue-500' : 'bg-gray-400')}
                    style={{ width: `${(c.minutes / maxMins) * 100}%` }} />
                </div>
                <span className="text-xs w-16 text-right text-gray-500">{fmtH(c.minutes)}</span>
                <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                  c.isProductive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {c.isProductive ? '생산적' : '비생산적'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="card text-center space-y-1">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <div className="inline-flex items-center gap-1 text-xs" style={{ color }}>
        <span>{sub}</span>
      </div>
    </div>
  );
}
