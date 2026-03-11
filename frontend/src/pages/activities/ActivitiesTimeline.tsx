/**
 * 컴퓨터 활동 > 타임라인
 * 일별 활동 타임라인 전체 화면 — 날짜 선택, 기존 ActivityTimeline 재사용 + 상세 정보
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser } from '../../services/firestoreService';
import type { PerformanceMetrics, ActivitySegment } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const ACT_COLORS: Record<string, string> = {
  development: '#3B82F6', research: '#0EA5E9', documentation: '#10B981',
  meeting: '#F59E0B', communication: '#A855F7', idle: '#D1D5DB',
  design: '#EC4899', project_mgmt: '#6366F1', other: '#9CA3AF',
};
const ACT_LABELS: Record<string, string> = {
  development: '개발', research: '리서치', documentation: '문서 작업',
  meeting: '회의', communication: '커뮤니케이션', idle: '자리비움',
  design: '디자인', project_mgmt: '프로젝트 관리', other: '기타',
};

function fmtH(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export default function ActivitiesTimeline() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  // 날짜 선택용 — 최근 30일 중에서 선택
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getMetricsByUser(userId, 30);
        if (!cancelled) {
          setMetrics(data);
          if (data.length > 0) setSelectedDate(data[0].date);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!userId) { setLoading(false); return; }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const dates = useMemo(
    () => metrics.map(m => m.date).sort((a, b) => b.localeCompare(a)),
    [metrics],
  );

  const dayMetrics = useMemo(
    () => metrics.find(m => m.date === selectedDate),
    [metrics, selectedDate],
  );

  const timeline: ActivitySegment[] = dayMetrics?.timeline ?? [];

  // 48 슬롯 (30분 단위)
  const daySlots = useMemo(() => {
    const slots: ({ seg: ActivitySegment | null })[] = Array.from({ length: 48 }, () => ({ seg: null }));
    timeline.forEach(seg => {
      const [h, m] = seg.startTime.split(':').map(Number);
      const idx = Math.min(h * 2 + Math.floor(m / 30), 47);
      slots[idx] = { seg };
    });
    return slots;
  }, [timeline]);

  // 활동 유형별 집계
  const actSummary = useMemo(() => {
    const map: Record<string, number> = {};
    timeline.forEach(s => {
      map[s.category] = (map[s.category] || 0) + s.durationMinutes;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([activity, dur]) => ({ activity, dur, label: ACT_LABELS[activity] || activity, color: ACT_COLORS[activity] || '#9CA3AF' }));
  }, [timeline]);

  const totalDur = actSummary.reduce((s, a) => s + a.dur, 0);

  const navDate = (dir: -1 | 1) => {
    const idx = dates.indexOf(selectedDate);
    const next = idx + dir * -1; // dates는 내림차순
    if (next >= 0 && next < dates.length) setSelectedDate(dates[next]);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">타임라인</h1>
          <p className="text-sm text-gray-500 mt-1">하루 동안의 활동을 시간대별로 확인합니다.</p>
        </div>
        {dates.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={() => navDate(-1)} className="p-1 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300">
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={() => navDate(1)} className="p-1 rounded-lg hover:bg-gray-100">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        )}
      </div>

      {timeline.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">이 날짜의 타임라인 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 활동 요약 */}
          <div className="card">
            <h3 className="section-title mb-3">활동 요약</h3>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {actSummary.map(a => (
                <span key={a.activity} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1"
                  style={{ backgroundColor: a.color + '20', color: a.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                  {a.label} {fmtH(a.dur)}
                </span>
              ))}
            </div>
            {/* 비율 바 */}
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
              {actSummary.map(a => (
                <div key={a.activity} title={`${a.label}: ${fmtH(a.dur)}`}
                  style={{ width: `${(a.dur / totalDur) * 100}%`, backgroundColor: a.color }}
                  className="transition-all" />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-right">총 활동 시간: {fmtH(totalDur)}</p>
          </div>

          {/* 타임라인 그리드 */}
          <div className="card">
            <h3 className="section-title mb-4">시간대별 활동</h3>
            <div className="grid grid-cols-[60px_1fr] gap-y-0.5">
              {daySlots.map((slot, idx) => {
                const hour = Math.floor(idx / 2);
                const half = idx % 2 === 0 ? '00' : '30';
                const label = `${String(hour).padStart(2, '0')}:${half}`;
                const seg = slot.seg;
                return (
                  <div key={idx} className="contents">
                    <span className="text-[10px] text-gray-400 text-right pr-2 py-1">{label}</span>
                    {seg ? (
                      <div className={clsx('rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs')}
                        style={{ backgroundColor: (ACT_COLORS[seg.category] || '#9CA3AF') + '18' }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ACT_COLORS[seg.category] || '#9CA3AF' }} />
                        <span className="font-semibold" style={{ color: ACT_COLORS[seg.category] || '#666' }}>
                          {ACT_LABELS[seg.category] || seg.category}
                        </span>
                        <span className="text-gray-500">{seg.startTime}–{seg.endTime}</span>
                        <span className="text-gray-400 ml-auto">{seg.durationMinutes}분</span>
                        {seg.app && <span className="text-gray-400 text-[10px]">({seg.app})</span>}
                      </div>
                    ) : (
                      <div className="h-7 rounded-lg bg-gray-50" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 상세 세그먼트 목록 */}
          <div className="card">
            <h3 className="section-title mb-3">세그먼트 목록 ({timeline.length}개)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-gray-600">시작</th>
                    <th className="px-3 py-2 text-left text-gray-600">종료</th>
                    <th className="px-3 py-2 text-left text-gray-600">활동</th>
                    <th className="px-3 py-2 text-left text-gray-600">앱</th>
                    <th className="px-3 py-2 text-right text-gray-600">시간</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((seg, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-3 py-2 font-mono">{seg.startTime}</td>
                      <td className="px-3 py-2 font-mono">{seg.endTime}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACT_COLORS[seg.category] || '#9CA3AF' }} />
                          {ACT_LABELS[seg.category] || seg.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{seg.app || '-'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{seg.durationMinutes}분</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
