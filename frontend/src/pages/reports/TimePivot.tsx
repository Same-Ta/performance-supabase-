/**
 * 리포트 > 시간 > 피벗 테이블
 * 날짜 × 카테고리(또는 앱) 교차 분석 테이블
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser } from '../../services/firestoreService';
import type { PerformanceMetrics } from '../../types';
import { ArrowUpDown, Download } from 'lucide-react';
import clsx from 'clsx';

type PivotMode = 'category' | 'app';
type SortCol = 'date' | string;
type SortDir = 'asc' | 'desc';

const CATEGORY_LABELS: Record<string, string> = {
  development: '개발', communication: '커뮤니케이션', documentation: '문서화',
  design: '디자인', project_mgmt: '프로젝트 관리', browser: '웹 브라우저',
  meeting: '회의', research: '리서치', idle: '자리비움', other: '기타',
};

function fmtH(minutes: number) {
  if (minutes === 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

export default function TimePivot() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PivotMode>('category');
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  // ── 피벗 데이터 구성 ──
  const { rows, columns, totals } = useMemo(() => {
    const colSet = new Set<string>();
    const map: Record<string, Record<string, number>> = {}; // date → col → minutes
    const colTotals: Record<string, number> = {};

    metrics.forEach(m => {
      if (!map[m.date]) map[m.date] = {};
      m.softwareUsage.forEach(su => {
        const col = mode === 'category' ? su.category : su.appName;
        colSet.add(col);
        map[m.date][col] = (map[m.date][col] || 0) + su.minutes;
        colTotals[col] = (colTotals[col] || 0) + su.minutes;
      });
    });

    const columns = [...colSet].sort((a, b) => (colTotals[b] || 0) - (colTotals[a] || 0)).slice(0, 12);

    let rows = Object.entries(map).map(([date, cols]) => {
      const total = columns.reduce((s, c) => s + (cols[c] || 0), 0);
      return { date, cols, total };
    });

    // 정렬
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else if (sortCol === '_total') {
        cmp = a.total - b.total;
      } else {
        cmp = (a.cols[sortCol] || 0) - (b.cols[sortCol] || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    return { rows, columns, totals: { ...colTotals, _total: grandTotal } as Record<string, number> };
  }, [metrics, mode, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const colLabel = (col: string) =>
    mode === 'category' ? (CATEGORY_LABELS[col] || col) : col;

  // ── CSV 내보내기 ──
  const exportCSV = () => {
    const header = ['날짜', ...columns.map(colLabel), '합계'].join(',');
    const body = rows.map(r =>
      [r.date, ...columns.map(c => Math.round(r.cols[c] || 0)), Math.round(r.total)].join(','),
    );
    const totRow = ['합계', ...columns.map(c => Math.round(totals[c] || 0)), Math.round(totals._total)].join(',');
    const csv = [header, ...body, totRow].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-pivot-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">피벗 테이블</h1>
          <p className="text-sm text-gray-500 mt-1">날짜 × 카테고리(또는 앱)별 교차 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setMode('category')}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', mode === 'category' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500')}
            >
              카테고리
            </button>
            <button
              onClick={() => setMode('app')}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', mode === 'app' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500')}
            >
              앱별
            </button>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg hover:bg-brand-100 transition-colors">
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">데이터가 없습니다.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <SortTh label="날짜" col="date" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} sticky />
                {columns.map(c => (
                  <SortTh key={c} label={colLabel(c)} col={c} sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
                ))}
                <SortTh label="합계" col="_total" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.date} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap sticky left-0 bg-white">{row.date}</td>
                  {columns.map(c => {
                    const val = row.cols[c] || 0;
                    const intensity = totals[c] > 0 ? Math.min(1, val / (totals[c] / rows.length * 2)) : 0;
                    return (
                      <td key={c} className="px-3 py-2.5 text-center whitespace-nowrap" style={{ backgroundColor: val > 0 ? `rgba(59,130,246,${intensity * 0.2})` : undefined }}>
                        <span className={clsx('text-xs font-medium', val > 0 ? 'text-gray-700' : 'text-gray-300')}>
                          {fmtH(val)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center font-bold text-gray-800 whitespace-nowrap">{fmtH(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                <td className="px-4 py-2.5 text-gray-700 sticky left-0 bg-gray-50">합계</td>
                {columns.map(c => (
                  <td key={c} className="px-3 py-2.5 text-center text-gray-800 whitespace-nowrap text-xs">{fmtH(totals[c] || 0)}</td>
                ))}
                <td className="px-3 py-2.5 text-center text-brand-700 whitespace-nowrap">{fmtH(totals._total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function SortTh({
  label, col, sortCol, sortDir, onClick, sticky,
}: {
  label: string; col: string; sortCol: string; sortDir: string; onClick: (c: string) => void; sticky?: boolean;
}) {
  const isActive = sortCol === col;
  return (
    <th
      onClick={() => onClick(col)}
      className={clsx(
        'px-3 py-3 text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 transition-colors',
        sticky && 'sticky left-0 bg-gray-50 z-10',
        col !== 'date' && 'text-center',
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <ArrowUpDown className={clsx('w-3 h-3', sortDir === 'asc' ? 'rotate-180' : '')} />}
      </span>
    </th>
  );
}
