import { Clock } from 'lucide-react';
import type { ActivitySegment } from '../../types';

interface ActivityTimelineProps {
  segments: ActivitySegment[];
  date?: string;
  /** true 이면 카드 래퍼·헤더 없이 내용만 렌더 (다른 카드 안에 임베드할 때 사용) */
  compact?: boolean;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  development:   { label: '개발',       color: '#3B82F6' },
  communication: { label: '커뮤니케이션', color: '#A855F7' },
  documentation: { label: '문서',       color: '#10B981' },
  design:        { label: '디자인',     color: '#EC4899' },
  project_mgmt:  { label: '프로젝트',   color: '#F59E0B' },
  browser:       { label: '웹',         color: '#0EA5E9' },
  meeting:       { label: '회의',       color: '#F97316' },
  idle:          { label: '자리비움',   color: '#D1D5DB' },
  other:         { label: '기타',       color: '#9CA3AF' },
  research:      { label: '리서치',     color: '#14B8A6' },
};

function getCat(category: string) {
  return CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG['other'];
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export default function ActivityTimeline({ segments, date, compact = false }: ActivityTimelineProps) {
  const hasSeg = segments && segments.length > 0;

  // 전체 시간 범위 계산
  let dayStart = 540; // 09:00
  let dayEnd = 1080;  // 18:00
  if (hasSeg) {
    const starts = segments.map(s => timeToMinutes(s.startTime));
    const ends = segments.map(s => timeToMinutes(s.endTime));
    dayStart = Math.max(0, Math.min(...starts) - 30);
    dayEnd = Math.min(1440, Math.max(...ends) + 30);
  }
  const totalRange = Math.max(dayEnd - dayStart, 60);

  // 시간 레이블
  const hourLabels: string[] = [];
  const startHour = Math.floor(dayStart / 60);
  const endHour = Math.ceil(dayEnd / 60);
  for (let h = startHour; h <= endHour; h++) {
    hourLabels.push(`${String(h).padStart(2, '0')}:00`);
  }

  const totalMinutes = hasSeg ? segments.reduce((sum, s) => sum + s.durationMinutes, 0) : 0;

  return (
    <div className={compact ? 'space-y-3' : 'card space-y-4'}>
      {/* 헤더: compact 모드에서는 숫자 요약만 1줄로 */}
      {compact ? (
        hasSeg && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-600">업무 타임라인</span>
            {date && <span className="text-xs text-gray-400">{date}</span>}
            <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${totalMinutes}분`}
            </span>
          </div>
        )
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-500" />
            <h3 className="section-title">업무 타임라인</h3>
          </div>
          <div className="flex items-center gap-3">
            {date && <span className="text-xs text-gray-400">{date}</span>}
            {hasSeg && (
              <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${totalMinutes}분`}
              </span>
            )}
          </div>
        </div>
      )}

      {!hasSeg && (
        <div className={compact ? 'py-4 text-center' : 'py-10 text-center'}>
          <p className="text-sm text-gray-400">
            {compact ? '타임라인 데이터가 없습니다.' : 'Agent 또는 수동 추적으로 활동을 기록하면 타임라인이 표시됩니다.'}
          </p>
        </div>
      )}

      {hasSeg && (
        <>
          {/* 시간축 헤더 */}
          <div className="relative h-5">
            {hourLabels.map((label) => {
              const mins = parseInt(label) * 60;
              const left = ((mins - dayStart) / totalRange) * 100;
              if (left < -2 || left > 102) return null;
              return (
                <span
                  key={label}
                  className="absolute text-[10px] text-gray-400 -translate-x-1/2"
                  style={{ left: `${Math.max(0, Math.min(100, left))}%` }}
                >
                  {label}
                </span>
              );
            })}
          </div>

          {/* 가로 바 타임라인 (TimeDoctor 스타일) */}
          <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden">
            {segments.map((seg, i) => {
              const cfg = getCat(seg.category);
              const start = timeToMinutes(seg.startTime);
              const end = timeToMinutes(seg.endTime);
              const left = ((start - dayStart) / totalRange) * 100;
              const width = ((end - start) / totalRange) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full group cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    left: `${Math.max(0, left)}%`,
                    width: `${Math.max(0.5, width)}%`,
                    backgroundColor: cfg.color,
                  }}
                  title={`${seg.startTime}~${seg.endTime} ${seg.description}`}
                >
                  {/* 호버 툴팁 */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                      <p className="font-semibold">{seg.startTime} ~ {seg.endTime}</p>
                      <p className="text-gray-300">{seg.description}</p>
                      <p className="text-gray-400">{seg.durationMinutes}분 · {cfg.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 세그먼트 상세 리스트 */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {segments.map((seg, i) => {
              const cfg = getCat(seg.category);
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <div className="w-28 flex-shrink-0">
                    <span className="text-xs font-bold text-gray-700">{seg.startTime}</span>
                    <span className="text-xs text-gray-400 mx-1">→</span>
                    <span className="text-xs font-bold text-gray-700">{seg.endTime}</span>
                  </div>
                  <p className="flex-1 text-sm text-gray-700 truncate">{seg.description}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 w-12 text-right flex-shrink-0">
                    {seg.durationMinutes}분
                  </span>
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-gray-100">
            {Object.entries(CATEGORY_CONFIG)
              .filter(([cat]) => segments.some(s => s.category === cat))
              .map(([cat, cfg]) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg.color }} />
                  <span className="text-[10px] text-gray-500">{cfg.label}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
