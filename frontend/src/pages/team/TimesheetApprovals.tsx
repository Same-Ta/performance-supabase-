/**
 * Team > Timesheet Approvals
 * 타임시트 승인/반려 — 관리자가 팀원 데이터를 검토하고 승인
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser, getPendingReviews, updateReviewDecision } from '../../services/firestoreService';
import { Check, X, Filter } from 'lucide-react';
import clsx from 'clsx';

/** 통합 행 타입 */
interface Row {
  id: string;
  date: string;
  userId: string;
  totalWorkMinutes: number;
  activeWorkMinutes: number;
  efficiencyScore: number;
  status: string; // pending_review | approved | rejected | submitted
}

type StatusFilter = 'all' | 'pending_review' | 'approved' | 'rejected';

function fmtH(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

const decisionToStatus: Record<string, string> = {
  pending: 'pending_review',
  approved: 'approved',
  rejected: 'rejected',
  edited: 'pending_review',
};

export default function TimesheetApprovals() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [records, setRecords] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let rows: Row[];
        if (profile?.role === 'manager' || profile?.role === 'hr_admin' || profile?.role === 'super_admin') {
          const items = await getPendingReviews(userId);
          rows = items.map(d => ({
            id: d.id,
            date: d.date,
            userId: d.userId,
            totalWorkMinutes: d.metrics.totalWorkMinutes,
            activeWorkMinutes: d.metrics.activeWorkMinutes,
            efficiencyScore: d.metrics.efficiencyScore,
            status: decisionToStatus[d.decision] ?? 'pending_review',
          }));
        } else {
          const metrics = await getMetricsByUser(userId, 30);
          rows = metrics.map(m => ({
            id: m.id,
            date: m.date,
            userId: m.userId,
            totalWorkMinutes: m.totalWorkMinutes,
            activeWorkMinutes: m.activeWorkMinutes,
            efficiencyScore: m.efficiencyScore,
            status: m.status,
          }));
        }
        if (!cancelled) setRecords(rows);
      } catch {
        if (!cancelled) {
          const fallback = await getMetricsByUser(userId, 30);
          setRecords(fallback.map(m => ({
            id: m.id, date: m.date, userId: m.userId,
            totalWorkMinutes: m.totalWorkMinutes, activeWorkMinutes: m.activeWorkMinutes,
            efficiencyScore: m.efficiencyScore, status: m.status,
          })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!userId) { setLoading(false); return; }
    load();
    return () => { cancelled = true; };
  }, [userId, profile?.role]);

  const filtered = useMemo(() => {
    if (filter === 'all') return records;
    return records.filter(r => r.status === filter);
  }, [records, filter]);

  const counts = useMemo(() => {
    const c = { all: records.length, pending_review: 0, approved: 0, rejected: 0 };
    records.forEach(r => {
      if (r.status === 'pending_review') c.pending_review++;
      else if (r.status === 'approved') c.approved++;
      else if (r.status === 'rejected') c.rejected++;
    });
    return c;
  }, [records]);

  const handleAction = async (id: string, decision: 'approved' | 'rejected') => {
    setActionLoading(id);
    try {
      await updateReviewDecision(id, decision);
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: decision } : r));
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Timesheet Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">팀원의 타임시트를 검토하고 승인/반려합니다.</p>
      </div>

      {/* 필터 탭 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {([
          { key: 'all' as StatusFilter, label: '전체', color: 'bg-gray-100 text-gray-700' },
          { key: 'pending_review' as StatusFilter, label: '검토 대기', color: 'bg-yellow-100 text-yellow-700' },
          { key: 'approved' as StatusFilter, label: '승인됨', color: 'bg-green-100 text-green-700' },
          { key: 'rejected' as StatusFilter, label: '반려됨', color: 'bg-red-100 text-red-700' },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              'text-xs font-semibold px-3 py-1.5 rounded-full transition-all',
              filter === f.key ? f.color : 'bg-gray-50 text-gray-400 hover:bg-gray-100',
            )}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">해당하는 타임시트가 없습니다.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">날짜</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">사용자</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">총 시간</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">활성 시간</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">효율</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">상태</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800">{r.date}</td>
                  <td className="px-4 py-3 text-gray-600">{r.userId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-center">{fmtH(r.totalWorkMinutes)}</td>
                  <td className="px-4 py-3 text-center">{fmtH(r.activeWorkMinutes)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'font-bold',
                      r.efficiencyScore >= 80 ? 'text-green-600' : r.efficiencyScore >= 60 ? 'text-yellow-600' : 'text-red-500',
                    )}>
                      {r.efficiencyScore}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.status === 'pending_review' ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleAction(r.id, 'approved')}
                          disabled={actionLoading === r.id}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                          title="승인"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAction(r.id, 'rejected')}
                          disabled={actionLoading === r.id}
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                          title="반려"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending_review: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    submitted: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<string, string> = {
    pending_review: '검토 대기',
    approved: '승인됨',
    rejected: '반려됨',
    submitted: '제출됨',
  };
  return (
    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', styles[status] || 'bg-gray-100 text-gray-500')}>
      {labels[status] || status}
    </span>
  );
}
