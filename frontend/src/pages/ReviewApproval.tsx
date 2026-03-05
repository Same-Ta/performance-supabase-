import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataReview } from '../hooks/usePerformance';
import DataReviewCard from '../components/review/DataReviewCard';
import { Shield, ClipboardCheck, AlertCircle, Filter, X } from 'lucide-react';

const STATUS_FILTERS = [
  { value: 'all', label: '전체', color: 'bg-gray-100 text-gray-700' },
  { value: 'pending', label: '검토 대기', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'approved', label: '전송됨', color: 'bg-green-100 text-green-700' },
  { value: 'edited', label: '수정됨', color: 'bg-blue-100 text-blue-700' },
] as const;

const TASK_TYPE_FILTERS = [
  { value: 'all', label: '전체 업무' },
  { value: 'general', label: '일반 업무' },
  { value: 'frontend', label: '프론트엔드 개발' },
  { value: 'backend', label: '백엔드 개발' },
  { value: 'design', label: '디자인' },
  { value: 'documentation', label: '문서 작업' },
  { value: 'meeting', label: '회의' },
  { value: 'planning', label: '기획/계획' },
  { value: 'review', label: '코드 리뷰' },
  { value: 'research', label: '리서치/조사' },
  { value: 'bug_fix', label: '버그 수정' },
] as const;

export default function ReviewApproval() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const { reviews, loading, approveReview, deleteReview } = useDataReview(userId);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (statusFilter !== 'all' && r.decision !== statusFilter) return false;
      if (taskFilter !== 'all') {
        const taskType = r.metrics?.taskType || 'general';
        if (taskType !== taskFilter) return false;
      }
      return true;
    });
  }, [reviews, statusFilter, taskFilter]);

  const pendingCount = reviews.filter((r) => r.decision === 'pending').length;
  const sentCount = reviews.filter((r) => r.decision === 'approved' || r.decision === 'edited').length;

  const hasActiveFilter = statusFilter !== 'all' || taskFilter !== 'all';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 검토 및 전송</h1>
        <p className="text-sm text-gray-500 mt-1">
          On-Device AI가 분석한 데이터를 검토 후 팀장에게 전송합니다.
        </p>
      </div>

      {/* Privacy Firewall 안내 */}
      <div className="card bg-brand-50/30 border-brand-200">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-brand-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-brand-800 mb-1">
              Privacy Firewall — 당신의 데이터, 당신의 결정
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              아래 데이터는 모두 귀하의 PC에서 로컬로 분석된 결과입니다. 
              영상 원본은 이미 완전히 파기되었으며, 아래의 <strong>수치 데이터만</strong> 존재합니다.
              <br />
              <strong>팀장에게 전송</strong> 버튼을 누르기 전까지 어떤 데이터도 전송되지 않습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 상태 요약 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2 bg-warning-50 rounded-xl">
          <AlertCircle className="w-4 h-4 text-warning-500" />
          <span className="text-sm font-medium text-warning-700">
            검토 대기: {pendingCount}건
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-success-50 rounded-xl">
          <ClipboardCheck className="w-4 h-4 text-success-500" />
          <span className="text-sm font-medium text-success-700">
            팀장 전송 완료: {sentCount}건
          </span>
        </div>
      </div>

      {/* 필터링 */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">필터</span>
          {hasActiveFilter && (
            <button
              onClick={() => { setStatusFilter('all'); setTaskFilter('all'); }}
              className="ml-auto text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> 필터 초기화
            </button>
          )}
        </div>

        {/* 상태 필터 */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">상태별</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === f.value
                    ? 'bg-brand-600 text-white shadow-sm'
                    : `${f.color} hover:opacity-80`
                }`}
              >
                {f.label}
                {f.value === 'pending' && pendingCount > 0 && (
                  <span className="ml-1.5 bg-white/30 px-1.5 py-0.5 rounded-full text-[10px]">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 업무 유형 필터 */}
        <div>
          <p className="text-xs text-gray-500 mb-2">업무 유형별</p>
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-2 min-w-max">
              {TASK_TYPE_FILTERS.map((f) => {
                const count = f.value === 'all'
                  ? reviews.length
                  : reviews.filter((r) => (r.metrics?.taskType || 'general') === f.value).length;
                if (f.value !== 'all' && count === 0) return null;
                return (
                  <button
                    key={f.value}
                    onClick={() => setTaskFilter(f.value)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      taskFilter === f.value
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                    {count > 0 && (
                      <span className="ml-1.5 opacity-60 text-[10px]">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 필터 결과 개수 */}
      {hasActiveFilter && (
        <p className="text-xs text-gray-500">
          필터 결과: <span className="font-semibold text-gray-700">{filteredReviews.length}건</span> / 전체 {reviews.length}건
        </p>
      )}

      {/* 검토 카드 목록 */}
      <div className="space-y-4">
        {filteredReviews.map((review) => (
          <DataReviewCard
            key={review.id}
            item={review}
            onSubmitToManager={approveReview}
            onDelete={deleteReview}
          />
        ))}
      </div>

      {filteredReviews.length === 0 && reviews.length > 0 && (
        <div className="card text-center py-12">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">필터 조건에 맞는 데이터가 없습니다.</p>
          <button
            onClick={() => { setStatusFilter('all'); setTaskFilter('all'); }}
            className="text-xs text-brand-600 hover:underline mt-2"
          >
            필터 초기화
          </button>
        </div>
      )}

      {reviews.length === 0 && (
        <div className="card text-center py-12">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">검토할 데이터가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">Agent에서 분석이 완료되면 여기에 표시됩니다.</p>
        </div>
      )}
    </div>
  );
}
