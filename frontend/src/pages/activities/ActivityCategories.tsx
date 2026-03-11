/**
 * 컴퓨터 활동 > 활동 카테고리
 * 카테고리별 시간 분포, 트렌드, 상위 앱 표시
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser } from '../../services/firestoreService';
import type { PerformanceMetrics } from '../../types';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';


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

interface CatAgg {
  category: string;
  label: string;
  color: string;
  totalMinutes: number;
  pct: number;
  topApps: { appName: string; minutes: number }[];
}

interface TrendPoint { date: string; [cat: string]: number | string; }

function fmtH(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export default function ActivityCategories() {
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

  /* 카테고리별 집계 */
  const { categories, totalMinutes } = useMemo(() => {
    const map: Record<string, { minutes: number; apps: Record<string, number> }> = {};
    let total = 0;
    metrics.forEach(m => {
      m.softwareUsage.forEach(su => {
        if (!map[su.category]) map[su.category] = { minutes: 0, apps: {} };
        map[su.category].minutes += su.minutes;
        map[su.category].apps[su.appName] = (map[su.category].apps[su.appName] || 0) + su.minutes;
        total += su.minutes;
      });
    });
    const cats: CatAgg[] = Object.entries(map)
      .map(([category, d]) => ({
        category,
        label: CATEGORY_LABELS[category] || category,
        color: CATEGORY_COLORS[category] || '#9CA3AF',
        totalMinutes: d.minutes,
        pct: total > 0 ? (d.minutes / total) * 100 : 0,
        topApps: Object.entries(d.apps)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([appName, minutes]) => ({ appName, minutes })),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
    return { categories: cats, totalMinutes: total };
  }, [metrics]);

  /* 일별 트렌드 데이터 */
  const trend = useMemo<TrendPoint[]>(() => {
    const dateMap: Record<string, Record<string, number>> = {};
    metrics.forEach(m => {
      if (!dateMap[m.date]) dateMap[m.date] = {};
      m.softwareUsage.forEach(su => {
        dateMap[m.date][su.category] = (dateMap[m.date][su.category] || 0) + su.minutes;
      });
    });
    const allCats = categories.map(c => c.category);
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cats]) => {
        const point: TrendPoint = { date: date.slice(5) };
        allCats.forEach(c => { point[c] = Math.round(cats[c] || 0); });
        return point;
      });
  }, [metrics, categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">활동 카테고리</h1>
        <p className="text-sm text-gray-500 mt-1">최근 30일간 카테고리별 시간 분포를 분석합니다.</p>
      </div>

      {categories.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">활동 카테고리 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 상단: 파이 차트 + 요약 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card flex flex-col items-center">
              <h3 className="section-title w-full mb-2">카테고리 비율</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categories} dataKey="totalMinutes" nameKey="label"
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    paddingAngle={2} stroke="none">
                    {categories.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtH(v)} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-1">총 {fmtH(totalMinutes)}</p>
            </div>

            {/* 카테고리 리스트 */}
            <div className="card space-y-3 overflow-y-auto max-h-[340px]">
              <h3 className="section-title">카테고리 목록</h3>
              {categories.map(c => (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">{c.label}</span>
                      <span className="text-xs text-gray-500">{c.pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtH(c.totalMinutes)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 일별 추이 (스택 에어리어) */}
          {trend.length > 1 && (
            <div className="card">
              <h3 className="section-title mb-4">일별 카테고리 추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#999' }} unit="분" />
                  <Tooltip formatter={(v: number) => fmtH(v)} />
                  {categories.slice(0, 6).reverse().map(c => (
                    <Area key={c.category} type="monotone" dataKey={c.category}
                      stackId="1" fill={c.color} stroke={c.color} fillOpacity={0.7}
                      name={c.label} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 카테고리별 상위 앱 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {categories.map(c => (
              <div key={c.category} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <h4 className="text-sm font-bold text-gray-800">{c.label}</h4>
                  <span className="ml-auto text-xs text-gray-400">{fmtH(c.totalMinutes)}</span>
                </div>
                <div className="space-y-2">
                  {c.topApps.map(app => {
                    const pct = c.totalMinutes > 0 ? (app.minutes / c.totalMinutes) * 100 : 0;
                    return (
                      <div key={app.appName}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 truncate max-w-[60%]">{app.appName}</span>
                          <span className="text-gray-500">{fmtH(app.minutes)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                        </div>
                      </div>
                    );
                  })}
                  {c.topApps.length === 0 && <p className="text-xs text-gray-400">앱 데이터 없음</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
