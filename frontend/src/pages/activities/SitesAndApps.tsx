/**
 * 컴퓨터 활동 > 사이트 및 앱
 * 사용한 앱/사이트 전체 목록 — 시간, 카테고리, 생산성 여부, 추이
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser } from '../../services/firestoreService';
import type { PerformanceMetrics } from '../../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Search, ArrowUpDown } from 'lucide-react';
import clsx from 'clsx';

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

const PRODUCTIVE_CATS = new Set(['development', 'documentation', 'design', 'project_mgmt', 'research', 'meeting']);

interface AggApp {
  appName: string;
  category: string;
  categoryLabel: string;
  color: string;
  totalMinutes: number;
  days: number;
  avgMinutes: number;
  isProductive: boolean;
}

function fmtH(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

type SortKey = 'totalMinutes' | 'days' | 'appName';

export default function SitesAndApps() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalMinutes');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterCat, setFilterCat] = useState<string>('all');

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

  // 앱별 집계
  const apps = useMemo(() => {
    const map: Record<string, { cat: string; minutes: number; dates: Set<string> }> = {};
    metrics.forEach(m => {
      m.softwareUsage.forEach(su => {
        if (!map[su.appName]) map[su.appName] = { cat: su.category, minutes: 0, dates: new Set() };
        map[su.appName].minutes += su.minutes;
        map[su.appName].dates.add(m.date);
      });
    });
    return Object.entries(map).map<AggApp>(([appName, d]) => ({
      appName,
      category: d.cat,
      categoryLabel: CATEGORY_LABELS[d.cat] || d.cat,
      color: CATEGORY_COLORS[d.cat] || '#9CA3AF',
      totalMinutes: d.minutes,
      days: d.dates.size,
      avgMinutes: d.dates.size > 0 ? d.minutes / d.dates.size : 0,
      isProductive: PRODUCTIVE_CATS.has(d.cat),
    }));
  }, [metrics]);

  // 필터 + 정렬
  const filtered = useMemo(() => {
    let list = apps;
    if (filterCat !== 'all') list = list.filter(a => a.category === filterCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.appName.toLowerCase().includes(q) || a.categoryLabel.includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'appName') cmp = a.appName.localeCompare(b.appName);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [apps, filterCat, search, sortKey, sortDir]);

  const cats = useMemo(() => {
    const set = new Set(apps.map(a => a.category));
    return [...set].sort();
  }, [apps]);

  const maxMinutes = filtered.length > 0 ? filtered[0].totalMinutes : 1;

  // 차트 데이터 (Top 10)
  const chartData = filtered.slice(0, 10).map(a => ({
    name: a.appName.length > 12 ? a.appName.slice(0, 12) + '…' : a.appName,
    minutes: Math.round(a.totalMinutes),
    color: a.color,
  }));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

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
        <h1 className="text-2xl font-bold text-gray-900">사이트 및 앱</h1>
        <p className="text-sm text-gray-500 mt-1">최근 30일간 사용한 앱과 사이트를 확인합니다.</p>
      </div>

      {apps.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">앱 사용 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Top 10 차트 */}
          <div className="card">
            <h3 className="section-title mb-4">상위 사용 앱 (Top 10)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#999' }} unit="분" />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#555' }} />
                <Tooltip formatter={(v: number) => [`${fmtH(v)}`, '사용 시간']} />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]} barSize={18}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 검색 & 필터 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="앱 이름 검색..."
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="all">전체 카테고리</option>
              {cats.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
            </select>
          </div>

          {/* 앱 테이블 */}
          <div className="card !p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">#</th>
                  <ThSort label="앱 이름" col="appName" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">카테고리</th>
                  <ThSort label="총 시간" col="totalMinutes" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <ThSort label="사용 일수" col="days" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">일 평균</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">비율</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">생산성</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app, i) => (
                  <tr key={app.appName} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{app.appName}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: app.color }}>
                        {app.categoryLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(app.totalMinutes / maxMinutes) * 100}%`, backgroundColor: app.color }} />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-16">{fmtH(app.totalMinutes)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">{app.days}일</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">{fmtH(app.avgMinutes)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden mx-auto">
                        <div className="h-full rounded-full" style={{ width: `${(app.totalMinutes / maxMinutes) * 100}%`, backgroundColor: app.color }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', app.isProductive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {app.isProductive ? '생산적' : '비생산적'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 text-right">{filtered.length}개 앱 · 전체 {apps.length}개</p>
        </>
      )}
    </div>
  );
}

function ThSort({ label, col, sortKey, sortDir, onClick }: { label: string; col: SortKey; sortKey: SortKey; sortDir: string; onClick: (k: SortKey) => void }) {
  const isActive = sortKey === col;
  return (
    <th onClick={() => onClick(col)} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors">
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <ArrowUpDown className={clsx('w-3 h-3', sortDir === 'asc' ? 'rotate-180' : '')} />}
      </span>
    </th>
  );
}
