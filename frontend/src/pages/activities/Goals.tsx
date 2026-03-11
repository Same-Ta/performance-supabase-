/**
 * 컴퓨터 활동 > 목표
 * 목표 정렬 현황 — 카테고리 기반 목표 분석, 레이더 차트, 추이
 * PerformanceMetrics.goalAlignmentScore + softwareUsage 카테고리 기반
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser } from '../../services/firestoreService';
import type { PerformanceMetrics } from '../../types';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import clsx from 'clsx';

const CATEGORY_LABELS: Record<string, string> = {
  development: '개발', communication: '커뮤니케이션', documentation: '문서화',
  design: '디자인', project_mgmt: '프로젝트 관리', research: '리서치',
  meeting: '회의', other: '기타',
};
const PRODUCTIVE_CATS = new Set(['development', 'documentation', 'design', 'project_mgmt', 'research']);

interface CatGoal {
  category: string;
  label: string;
  totalMinutes: number;
  pct: number;
  isProductive: boolean;
}

function pctColor(v: number) {
  if (v >= 80) return 'text-green-600';
  if (v >= 60) return 'text-yellow-600';
  return 'text-red-500';
}

export default function Goals() {
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

  /* 전체 KPI */
  const kpi = useMemo(() => {
    if (sorted.length === 0) return null;
    const scores = sorted.map(m => m.goalAlignmentScore);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const recent7 = sorted.slice(-7).map(m => m.goalAlignmentScore);
    const older7 = sorted.slice(-14, -7).map(m => m.goalAlignmentScore);
    const rAvg = recent7.length > 0 ? recent7.reduce((s, v) => s + v, 0) / recent7.length : avg;
    const oAvg = older7.length > 0 ? older7.reduce((s, v) => s + v, 0) / older7.length : rAvg;
    return { avg, trend: rAvg - oAvg, rAvg };
  }, [sorted]);

  /* 카테고리별 목표 (소프트웨어 사용 시간 기반) */
  const catGoals = useMemo<CatGoal[]>(() => {
    const map: Record<string, number> = {};
    let total = 0;
    sorted.forEach(m => {
      m.softwareUsage.forEach(su => {
        map[su.category] = (map[su.category] || 0) + su.minutes;
        total += su.minutes;
      });
    });
    return Object.entries(map)
      .map(([category, totalMinutes]) => ({
        category,
        label: CATEGORY_LABELS[category] || category,
        totalMinutes,
        pct: total > 0 ? (totalMinutes / total) * 100 : 0,
        isProductive: PRODUCTIVE_CATS.has(category),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [sorted]);

  /* 레이더 데이터 — 카테고리 비율 */
  const radarData = catGoals.slice(0, 8).map(c => ({
    name: c.label,
    value: Math.round(c.pct),
  }));

  /* 일별 목표 정렬 추이 */
  const trendData = useMemo(
    () => sorted.map(m => ({
      date: m.date.slice(5),
      goalAlignment: m.goalAlignmentScore,
      efficiency: m.efficiencyScore,
      focus: m.focusScore,
    })),
    [sorted],
  );

  /* 생산적 비율 */
  const productiveMinutes = catGoals.filter(c => c.isProductive).reduce((s, c) => s + c.totalMinutes, 0);
  const totalMinutes = catGoals.reduce((s, c) => s + c.totalMinutes, 0);
  const productivePct = totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#A855F7', '#EF4444', '#14B8A6', '#6366F1'];

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
        <p className="text-gray-500">목표 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">목표</h1>
        <p className="text-sm text-gray-500 mt-1">업무 목표 정렬도와 카테고리별 성과를 확인합니다.</p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500">평균 목표 정렬도</p>
          <p className={clsx('text-3xl font-bold mt-1', pctColor(kpi.avg))}>{Math.round(kpi.avg)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">최근 7일</p>
          <p className={clsx('text-3xl font-bold mt-1', pctColor(kpi.rAvg))}>{Math.round(kpi.rAvg)}</p>
          <div className={clsx('text-xs font-semibold mt-1 inline-flex items-center gap-1',
            kpi.trend > 0 ? 'text-green-600' : kpi.trend < 0 ? 'text-red-500' : 'text-gray-400')}>
            {kpi.trend > 2 ? '▲' : kpi.trend < -2 ? '▼' : '—'}
            {kpi.trend > 0 ? '+' : ''}{kpi.trend.toFixed(1)}p
          </div>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">생산적 활동 비율</p>
          <p className={clsx('text-3xl font-bold mt-1', pctColor(productivePct))}>{Math.round(productivePct)}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">분석 기간</p>
          <p className="text-3xl font-bold mt-1 text-gray-800">{sorted.length}일</p>
        </div>
      </div>

      {/* 레이더 차트 — 카테고리 분포 */}
      {radarData.length > 2 && (
        <div className="card">
          <h3 className="section-title mb-2">카테고리 분포 레이더</h3>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#555' }} />
              <PolarRadiusAxis tick={{ fontSize: 10, fill: '#aaa' }} />
              <Radar name="비율(%)" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} />
              <Tooltip formatter={(v: number) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 카테고리 목표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {catGoals.map((c, i) => (
          <div key={c.category} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-800">{c.label}</h4>
              <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full',
                c.isProductive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                {c.isProductive ? '생산적' : '비생산적'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="3"
                    strokeDasharray={`${c.pct * 0.94} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                  {Math.round(c.pct)}%
                </span>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-gray-800">{Math.round(c.totalMinutes / 60)}h {Math.round(c.totalMinutes % 60)}m</p>
                <p className="text-[10px] text-gray-400">전체 대비 {c.pct.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 일별 목표 정렬도 추이 */}
      {trendData.length > 1 && (
        <div className="card">
          <h3 className="section-title mb-4">일별 목표 정렬도 추이</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#999' }} />
              <Tooltip />
              <Line type="monotone" dataKey="goalAlignment" stroke="#3B82F6" strokeWidth={2} dot={false} name="목표 정렬도" />
              <Line type="monotone" dataKey="efficiency" stroke="#10B981" strokeWidth={1.5} dot={false} name="효율성" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="focus" stroke="#F59E0B" strokeWidth={1.5} dot={false} name="집중도" strokeDasharray="2 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
