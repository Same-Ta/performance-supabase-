import type { PerformerSummary } from '../../types';
import { Trophy, TrendingUp, Flame } from 'lucide-react';
import clsx from 'clsx';

interface TeamOverviewProps {
  members: PerformerSummary[];
}

export default function TeamOverview({ members }: TeamOverviewProps) {
  const sorted = [...members].sort((a, b) => b.overallScore - a.overallScore);

  const getGradeBadge = (score: number) => {
    if (score >= 90) return { label: 'S', class: 'bg-brand-600 text-white' };
    if (score >= 80) return { label: 'A', class: 'bg-success-500 text-white' };
    if (score >= 70) return { label: 'B', class: 'bg-warning-500 text-white' };
    if (score >= 60) return { label: 'C', class: 'bg-orange-500 text-white' };
    return { label: 'D', class: 'bg-gray-400 text-white' };
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="section-title">팀 성과 요약</h3>
          <p className="section-subtitle">이번 주 팀원별 핵심 지표</p>
        </div>
        <Trophy className="w-5 h-5 text-warning-500" />
      </div>

      <div className="space-y-3">
        {sorted.map((member, idx) => {
          const badge = getGradeBadge(member.overallScore);
          return (
            <div
              key={member.userId}
              className={clsx(
                'flex items-center gap-4 p-3 rounded-xl transition-colors',
                idx === 0 ? 'bg-brand-50/50' : 'hover:bg-gray-50'
              )}
            >
              {/* 순위 */}
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                  idx === 0
                    ? 'bg-warning-500 text-white'
                    : idx === 1
                    ? 'bg-gray-300 text-white'
                    : idx === 2
                    ? 'bg-orange-400 text-white'
                    : 'bg-gray-100 text-gray-500'
                )}
              >
                {idx + 1}
              </div>

              {/* 이름 및 부서 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {member.displayName}
                </p>
                <p className="text-xs text-gray-400 truncate">{member.department}</p>
              </div>

              {/* 몰입도 */}
              <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>몰입 {member.focusScore}</span>
              </div>

              {/* 연속 스트릭 */}
              {member.streak >= 3 && (
                <div className="hidden md:flex items-center gap-1 text-xs text-orange-500">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{member.streak}일</span>
                </div>
              )}

              {/* 등급 */}
              <span
                className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                  badge.class
                )}
              >
                {badge.label}
              </span>

              {/* 점수 */}
              <span className="text-sm font-bold text-gray-900 w-10 text-right">
                {member.overallScore}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
