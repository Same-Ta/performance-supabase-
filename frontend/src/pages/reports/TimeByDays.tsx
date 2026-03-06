/**
 * 리포트 > 시간 > 일별
 * 날짜별 업무 시간 카드 목록 — 각 날짜를 펼쳐 타임라인/상세를 확인
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMetricsByUser } from '../../services/firestoreService';
import type { PerformanceMetrics } from '../../types';
import ActivityTimeline from '../../components/dashboard/ActivityTimeline';
import {
  CalendarDays, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Clock, Zap, Brain, Target, Frown,
} from 'lucide-react';
// clsx removed - unused

function fmtH(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimeByDays() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

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
    if (userId) load();
    return () => { cancelled = true; };
  }, [userId]);

  // 날짜 기준 정렬 (최신순)
  const sorted = useMemo(
    () => [...metrics].sort((a, b) => b.date.localeCompare(a.date)),
    [metrics],
  );

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
        <h1 className="text-2xl font-bold text-gray-900">일별 시간 리포트</h1>
        <p className="text-sm text-gray-500 mt-1">날짜별로 업무 시간 및 활동을 확인할 수 있습니다.</p>
      </div>

      {sorted.length === 0 ? (
        <div className="card text-center py-16">
          <Frown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">아직 기록된 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paged.map(m => {
              const isOpen = expandedDate === m.date + m.id;
              return (
                <div key={m.id} className="card !p-0 overflow-hidden">
                  {/* 헤더 */}
                  <button
                    onClick={() => setExpandedDate(isOpen ? null : m.date + m.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="w-5 h-5 text-brand-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900">{m.date}</p>
                        {m.sessionStartTime && m.sessionEndTime && (
                          <p className="text-xs text-gray-400">{m.sessionStartTime} ~ {m.sessionEndTime}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-5">
                      <MiniStat icon={<Clock className="w-3.5 h-3.5" />} label="총 시간" value={fmtH(m.totalWorkMinutes)} />
                      <MiniStat icon={<Zap className="w-3.5 h-3.5" />} label="활성" value={fmtH(m.activeWorkMinutes)} />
                      <MiniStat icon={<Brain className="w-3.5 h-3.5" />} label="몰입" value={`${m.focusScore}`} />
                      <MiniStat icon={<Target className="w-3.5 h-3.5" />} label="효율" value={`${m.efficiencyScore}`} />
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {/* 상세 내용 */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-5 space-y-4 bg-gray-50/30 animate-fade-in">
                      {/* AI 요약 */}
                      {m.aiSummary && (
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">AI 업무 요약</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{m.aiSummary}</p>
                        </div>
                      )}

                      {/* 주요 성과 */}
                      {m.keyAchievements.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                          <p className="text-xs font-semibold text-green-600 mb-2">주요 성과</p>
                          <ul className="space-y-1">
                            {m.keyAchievements.map((a, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-green-500">●</span>{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 소프트웨어 사용 */}
                      {m.softwareUsage.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-3">소프트웨어 사용</p>
                          <div className="space-y-2">
                            {[...m.softwareUsage].sort((a, b) => b.minutes - a.minutes).slice(0, 8).map((su, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 w-4 text-right">{i + 1}</span>
                                <span className="text-sm text-gray-700 w-28 truncate">{su.appName}</span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${su.percentage}%`,
                                      backgroundColor: CATEGORY_COLORS[su.category] || '#9CA3AF',
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-gray-600 w-14 text-right">{fmtH(su.minutes)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 타임라인 */}
                      <ActivityTimeline segments={m.timeline ?? []} date={m.date} />

                      {/* 세부 점수 */}
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        <ScoreBox label="몰입도" value={m.focusScore} />
                        <ScoreBox label="효율성" value={m.efficiencyScore} />
                        <ScoreBox label="목표 정렬" value={m.goalAlignmentScore} />
                        <ScoreBox label="컨텍스트 전환" value={m.contextSwitchCount} unit="회" />
                        <ScoreBox label="딥 포커스" value={m.deepFocusMinutes} unit="분" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 font-medium">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  development: '#3B82F6', communication: '#A855F7', documentation: '#10B981',
  design: '#EC4899', project_mgmt: '#F59E0B', browser: '#0EA5E9',
  meeting: '#F97316', research: '#14B8A6', idle: '#D1D5DB', other: '#9CA3AF',
};

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center hidden sm:block">
      <div className="flex items-center justify-center gap-1 text-gray-400">{icon}<span className="text-[10px]">{label}</span></div>
      <p className="text-sm font-bold text-gray-700">{value}</p>
    </div>
  );
}

function ScoreBox({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}<span className="text-xs text-gray-400 ml-0.5">{unit}</span></p>
    </div>
  );
}
