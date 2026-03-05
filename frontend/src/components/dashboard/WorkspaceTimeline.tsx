/**
 * WorkspaceTimeline
 * TimeDoctor 스타일의 팀 타임라인 뷰
 * 워크스페이스 멤버별 오늘(또는 최신) 업무 활동을 시간축 위에 표시합니다.
 */
import type { PerformanceMetrics } from '../../types';
import type { WorkspaceMember } from '../../services/firestoreService';

const TASK_COLORS: Record<string, string> = {
  general:       '#22c55e',
  frontend:      '#3b82f6',
  backend:       '#10b981',
  design:        '#ec4899',
  documentation: '#f59e0b',
  meeting:       '#a855f7',
  planning:      '#6366f1',
  review:        '#f97316',
  research:      '#14b8a6',
  bug_fix:       '#ef4444',
  development:   '#3b82f6',
  communication: '#f59e0b',
  project_mgmt:  '#8b5cf6',
  browser:       '#6366f1',
  idle:          '#e5e7eb',
  other:         '#9ca3af',
};

function getColor(category: string): string {
  return TASK_COLORS[category] ?? TASK_COLORS['other'];
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

interface MemberRow {
  member: WorkspaceMember;
  latestMetrics: PerformanceMetrics | null;
}

interface WorkspaceTimelineProps {
  members: WorkspaceMember[];
  memberMetrics: Record<string, PerformanceMetrics[]>;
  /** 선택된 날짜 (YYYY-MM-DD). 지정하면 해당 날짜 메트릭만 표시 */
  selectedDate?: string;
}

export default function WorkspaceTimeline({ members, memberMetrics, selectedDate }: WorkspaceTimelineProps) {
  // 멤버별 선택 날짜 메트릭 수집 (selectedDate 있으면 해당 날짜, 없으면 최신)
  const rows: MemberRow[] = members.map((m) => {
    const allMetrics = memberMetrics[m.uid] ?? [];
    const matched = selectedDate
      ? allMetrics.find((met) => met.date === selectedDate) ?? null
      : allMetrics[0] ?? null;
    return { member: m, latestMetrics: matched };
  });

  // 전역 시간 범위 계산 (표시용 axis)
  let globalStart = 8 * 60;  // 08:00 기본
  let globalEnd   = 19 * 60; // 19:00 기본

  rows.forEach(({ latestMetrics: lm }) => {
    if (!lm) return;
    if (lm.timeline && lm.timeline.length > 0) {
      lm.timeline.forEach((seg) => {
        const s = timeToMinutes(seg.startTime);
        const e = timeToMinutes(seg.endTime);
        if (s < globalStart) globalStart = Math.max(0, s - 30);
        if (e > globalEnd)   globalEnd   = Math.min(1440, e + 30);
      });
    } else if (lm.sessionStartTime && lm.sessionEndTime) {
      const s = timeToMinutes(lm.sessionStartTime);
      const e = timeToMinutes(lm.sessionEndTime);
      if (s < globalStart) globalStart = Math.max(0, s - 30);
      if (e > globalEnd)   globalEnd   = Math.min(1440, e + 30);
    }
  });

  const totalRange = Math.max(globalEnd - globalStart, 60);

  // 시간 레이블 생성 (2시간 단위)
  const hourLabels: { label: string; pct: number }[] = [];
  const startHour = Math.floor(globalStart / 60);
  const endHour   = Math.ceil(globalEnd / 60);
  for (let h = startHour; h <= endHour; h += 2) {
    const pct = ((h * 60 - globalStart) / totalRange) * 100;
    if (pct >= 0 && pct <= 100) {
      hourLabels.push({ label: `${pad2(h)}:00`, pct });
    }
  }

  const positionPct = (minutes: number) =>
    Math.max(0, Math.min(100, ((minutes - globalStart) / totalRange) * 100));

  const widthPct = (start: number, end: number) =>
    Math.max(0.3, ((end - start) / totalRange) * 100);

  const hasAnyData = rows.some((r) => r.latestMetrics !== null);

  if (!hasAnyData) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-gray-400">
          팀원들이 업무 추적을 시작하면 타임라인이 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 시간 축 헤더 */}
      <div className="flex">
        {/* 멤버 이름 열 너비 맞춤 */}
        <div className="w-40 flex-shrink-0" />
        <div className="relative flex-1 h-5">
          {hourLabels.map(({ label, pct }) => (
            <span
              key={label}
              className="absolute text-[10px] text-gray-400 -translate-x-1/2"
              style={{ left: `${pct}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="flex">
        <div className="w-40 flex-shrink-0" />
        <div className="relative flex-1">
          {/* 세로 눈금선 */}
          {hourLabels.map(({ label, pct }) => (
            <div
              key={label}
              className="absolute top-0 bottom-0 w-px bg-gray-100"
              style={{ left: `${pct}%` }}
            />
          ))}
        </div>
      </div>

      {/* 멤버 행 */}
      <div className="space-y-3">
        {rows.map(({ member, latestMetrics: lm }) => {
          const hasTimeline = lm?.timeline && lm.timeline.length > 0;
          const initials = member.displayName
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <div key={member.uid} className="flex items-center gap-3">
              {/* 멤버 정보 */}
              <div className="w-40 flex-shrink-0 flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-brand-700">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {member.displayName}
                  </p>
                  {lm ? (
                    <p className="text-[11px] text-gray-400">
                      {lm.date.slice(5)} ·{' '}
                      {lm.activeWorkMinutes >= 60
                        ? `${(lm.activeWorkMinutes / 60).toFixed(1)}h`
                        : `${lm.activeWorkMinutes}분`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-300">추적 없음</p>
                  )}
                </div>
              </div>

              {/* 타임라인 바 */}
              <div className="relative flex-1 h-10 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                {!lm && (
                  <span className="absolute inset-0 flex items-center px-4">
                    <span className="text-xs text-gray-300">데이터 없음</span>
                  </span>
                )}

                {lm && hasTimeline &&
                  lm.timeline!.map((seg, i) => {
                    const s = timeToMinutes(seg.startTime);
                    const e = timeToMinutes(seg.endTime);
                    const left = positionPct(s);
                    const width = widthPct(s, e);
                    const color = getColor(seg.category);
                    return (
                      <div
                        key={i}
                        className="absolute top-1.5 bottom-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: color,
                        }}
                        title={`${seg.startTime}~${seg.endTime}  ${seg.description || seg.category}`}
                      />
                    );
                  })}

                {lm && !hasTimeline && lm.sessionStartTime && lm.sessionEndTime && (
                  <div
                    className="absolute top-1.5 bottom-1.5 rounded"
                    style={{
                      left: `${positionPct(timeToMinutes(lm.sessionStartTime))}%`,
                      width: `${widthPct(
                        timeToMinutes(lm.sessionStartTime),
                        timeToMinutes(lm.sessionEndTime)
                      )}%`,
                      backgroundColor: getColor(lm.taskType ?? 'general'),
                    }}
                    title={`${lm.sessionStartTime}~${lm.sessionEndTime}  ${lm.taskType ?? '업무'}`}
                  />
                )}

                {/* 집중 점수 오버레이 (우측) */}
                {lm && (
                  <div className="absolute right-3 top-0 bottom-0 flex items-center">
                    <span className="text-[11px] font-bold text-gray-500">
                      {lm.focusScore}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-50 mt-2">
        {[
          { key: 'frontend',  label: '프론트엔드' },
          { key: 'backend',   label: '백엔드' },
          { key: 'general',   label: '일반 업무' },
          { key: 'meeting',   label: '회의' },
          { key: 'design',    label: '디자인' },
          { key: 'idle',      label: '자리비움' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: getColor(key) }}
            />
            <span className="text-[10px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
