import type { PerformanceReport } from '../../types';
import { Download, Share2, TrendingUp, Target, Brain, Clock } from 'lucide-react';
import clsx from 'clsx';

interface ReportPreviewProps {
  report: PerformanceReport;
  onExport: () => void;
  onShare: () => void;
}

const gradeColors: Record<string, string> = {
  S: 'from-brand-500 to-purple-600',
  A: 'from-success-500 to-emerald-600',
  B: 'from-warning-500 to-yellow-600',
  C: 'from-orange-500 to-orange-600',
  D: 'from-gray-400 to-gray-500',
};

export default function ReportPreview({ report, onExport, onShare }: ReportPreviewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 리포트 헤더 */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{report.userName} 성과 리포트</h2>
            <p className="text-sm text-gray-500 mt-1">
              {report.startDate} ~ {report.endDate} |{' '}
              {report.period === 'weekly' ? '주간' : report.period === 'monthly' ? '월간' : report.period === 'quarterly' ? '분기' : '연간'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onExport} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              PDF 내보내기
            </button>
            <button onClick={onShare} className="btn-primary flex items-center gap-2 text-sm">
              <Share2 className="w-4 h-4" />
              공유하기
            </button>
          </div>
        </div>
      </div>

      {/* 종합 등급 */}
      <div className="card text-center py-10">
        <p className="text-sm text-gray-500 mb-3">종합 성과 등급</p>
        <div
          className={clsx(
            'w-24 h-24 rounded-2xl mx-auto flex items-center justify-center bg-gradient-to-br text-white text-4xl font-black shadow-lg',
            gradeColors[report.overallGrade]
          )}
        >
          {report.overallGrade}
        </div>
        <p className="text-3xl font-bold text-gray-900 mt-4">{report.overallScore}점</p>
        <p className="text-sm text-gray-500 mt-1">100점 만점 기준</p>
      </div>

      {/* 핵심 지표 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <Brain className="w-6 h-6 text-brand-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500">평균 몰입도</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{report.avgFocusScore}</p>
        </div>
        <div className="card text-center">
          <TrendingUp className="w-6 h-6 text-success-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500">평균 효율성</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{report.avgEfficiencyScore}</p>
        </div>
        <div className="card text-center">
          <Target className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500">목표 정렬도</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{report.avgGoalAlignment}%</p>
        </div>
        <div className="card text-center">
          <Clock className="w-6 h-6 text-warning-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500">총 딥포커스</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{report.totalDeepFocusHours}h</p>
        </div>
      </div>

      {/* AI 총평 */}
      <div className="card">
        <h3 className="section-title mb-4">🤖 AI 종합 평가</h3>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {report.executiveSummary}
        </p>
      </div>

      {/* 강점 & 성장 영역 */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-bold text-success-700 mb-3">💪 강점</h3>
          <ul className="space-y-2">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-success-500 mt-0.5">●</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 className="text-sm font-bold text-warning-700 mb-3">🌱 성장 영역</h3>
          <ul className="space-y-2">
            {report.areasForGrowth.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-warning-500 mt-0.5">●</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 연봉 협상용 핵심 포인트 */}
      <div className="card border-2 border-brand-200 bg-brand-50/30">
        <h3 className="text-sm font-bold text-brand-800 mb-3">
          📊 데이터 기반 성과 협상 포인트
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          아래 포인트는 AI가 객관적 데이터를 기반으로 생성한 성과 어필 자료입니다.
        </p>
        <ul className="space-y-3">
          {report.salaryNegotiationPoints.map((point, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-3 bg-white rounded-xl border border-brand-100"
            >
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-gray-800">{point}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
