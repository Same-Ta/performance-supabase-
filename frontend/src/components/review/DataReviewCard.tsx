import type { DataReviewItem } from '../../types';
import { Edit3, Clock, Eye, ChevronDown, ChevronUp, Trash2, Briefcase, Send, CheckCircle, X } from 'lucide-react';
import { useState } from 'react';
import ActivityTimeline from '../dashboard/ActivityTimeline';

const TASK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  general: { label: '일반 업무', color: 'bg-gray-100 text-gray-700' },
  frontend: { label: '프론트엔드 개발', color: 'bg-blue-100 text-blue-700' },
  backend: { label: '백엔드 개발', color: 'bg-green-100 text-green-700' },
  design: { label: '디자인', color: 'bg-pink-100 text-pink-700' },
  documentation: { label: '문서 작업', color: 'bg-yellow-100 text-yellow-700' },
  meeting: { label: '회의', color: 'bg-purple-100 text-purple-700' },
  planning: { label: '기획/계획', color: 'bg-indigo-100 text-indigo-700' },
  review: { label: '코드 리뷰', color: 'bg-orange-100 text-orange-700' },
  research: { label: '리서치/조사', color: 'bg-teal-100 text-teal-700' },
  bug_fix: { label: '버그 수정', color: 'bg-red-100 text-red-700' },
};

interface DataReviewCardProps {
  item: DataReviewItem;
  onSubmitToManager: (id: string, notes: string) => void;
  onDelete?: (id: string) => void;
  // legacy (unused but keep for TS compat)
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function DataReviewCard({
  item,
  onSubmitToManager,
  onDelete,
}: DataReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(item.userNotes || '');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { metrics } = item;

  // 세션 시간 범위 fallback: timeline이 있으면 첫/끝 세그먼트에서 추출
  const sessionStart = metrics.sessionStartTime
    ?? (metrics.timeline && metrics.timeline.length > 0 ? metrics.timeline[0].startTime : null);
  const sessionEnd = metrics.sessionEndTime
    ?? (metrics.timeline && metrics.timeline.length > 0 ? metrics.timeline[metrics.timeline.length - 1].endTime : null);

  const statusConfig = {
    pending: { label: '검토 대기', class: 'badge-warning', icon: Clock },
    approved: { label: '전송됨', class: 'badge-success', icon: CheckCircle },
    rejected: { label: '반려됨', class: 'badge-danger', icon: X },
    edited: { label: '수정됨', class: 'badge-info', icon: Edit3 },
  };

  const status = statusConfig[item.decision];
  const StatusIcon = status.icon;

  return (
    <div className="card animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm font-semibold text-gray-900">{item.date}</div>
          {/* 세션 시간 범위 */}
          {sessionStart && sessionEnd && (
            <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
              <Clock className="w-3 h-3" />
              <span>{sessionStart} ~ {sessionEnd}</span>
            </div>
          )}
          {/* 업무 유형 */}
          {metrics.taskType && TASK_TYPE_LABELS[metrics.taskType] && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${TASK_TYPE_LABELS[metrics.taskType].color}`}>
              <Briefcase className="w-3 h-3" />
              {TASK_TYPE_LABELS[metrics.taskType].label}
            </span>
          )}
          <span className={status.class}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('이 데이터를 영구 삭제하시겠습니까?'))
                  onDelete(item.id);
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
              title="데이터 삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-ghost flex items-center gap-1 text-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            {expanded ? '접기' : '상세 보기'}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 세션 타임라인 */}
      {metrics.timeline && metrics.timeline.length > 0 ? (
        <div className="mb-4">
          <ActivityTimeline segments={metrics.timeline} date={item.date} compact />
        </div>
      ) : (
        /* 타임라인 없으면 숫자 지표 폴백 */
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded-xl">
            <p className="text-[10px] text-gray-400 mb-0.5">몰입도</p>
            <p className="text-lg font-bold text-brand-600">{metrics.focusScore}</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-xl">
            <p className="text-[10px] text-gray-400 mb-0.5">효율성</p>
            <p className="text-lg font-bold text-success-700">{metrics.efficiencyScore}</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-xl">
            <p className="text-[10px] text-gray-400 mb-0.5">목표 정렬</p>
            <p className="text-lg font-bold text-purple-600">{metrics.goalAlignmentScore}%</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-xl">
            <p className="text-[10px] text-gray-400 mb-0.5">활성</p>
            <p className="text-lg font-bold text-gray-900">{(metrics.activeWorkMinutes / 60).toFixed(1)}h</p>
          </div>
        </div>
      )}

      {/* AI 요약 */}
      <div className="p-3 bg-brand-50/40 rounded-xl mb-4">
        <p className="text-xs font-medium text-brand-700 mb-1">🤖 AI 일일 업무 요약</p>
        <p className="text-sm text-gray-700 leading-relaxed">{metrics.aiSummary}</p>
      </div>

      {/* 주요 성과 */}
      {metrics.keyAchievements.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">주요 성과</p>
          <ul className="space-y-1">
            {metrics.keyAchievements.map((ach, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-success-500 mt-0.5">✓</span>
                {ach}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 확장 영역: 상세 데이터 */}
      {expanded && (
        <div className="border-t border-gray-100 pt-4 mt-4 space-y-4 animate-fade-in">
          {/* 소프트웨어 사용 현황 */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">소프트웨어 사용 현황</p>
            <div className="space-y-2">
              {metrics.softwareUsage.map((sw, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600 w-24 truncate">{sw.appName}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-brand-400"
                      style={{ width: `${sw.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-14 text-right">{sw.minutes}분</span>
                </div>
              ))}
            </div>
          </div>

          {/* 컨텍스트 전환 정보 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">컨텍스트 전환</p>
              <p className="text-lg font-bold">{metrics.contextSwitchCount}회</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">입력 밀도</p>
              <p className="text-lg font-bold">{metrics.inputDensity}/min</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">딥 포커스</p>
              <p className="text-lg font-bold">{metrics.deepFocusMinutes}분</p>
            </div>
          </div>

          {/* 개선 제안 */}
          {metrics.suggestedImprovements.length > 0 && (
            <div className="p-3 bg-warning-50 rounded-xl">
              <p className="text-xs font-medium text-warning-700 mb-2">💡 AI 개선 제안</p>
              <ul className="space-y-1">
                {metrics.suggestedImprovements.map((imp, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    • {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 액션 영역 */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        {/* 수정 패널 */}
        {isEditing && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              수정 코멘트 / 메모 (선택사항)
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300"
              rows={3}
              placeholder="수정 내용이나 추가 설명을 입력하세요..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {/* 수정하기 토글 */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              isEditing
                ? 'bg-gray-200 text-gray-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            {isEditing ? '수정 취소' : '수정하기'}
          </button>

          {/* 팀장에게 전송하기 */}
          {item.decision !== 'approved' && (
            <button
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                await onSubmitToManager(item.id, notes);
                setIsEditing(false);
                setSubmitting(false);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? '전송 중…' : '팀장에게 전송하기'}
            </button>
          )}

          {/* 이미 전송됨 표시 */}
          {item.decision === 'approved' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-success-50 rounded-xl text-success-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              팀장에게 전송 완료
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
