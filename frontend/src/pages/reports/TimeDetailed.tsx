/**
 * 리포트 > 시간 > 상세
 * 기존 PerformanceReport 페이지를 재활용 — 상세 업무 분석 + 기본 리포트
 */
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePerformanceReport, useDetailedReport } from '../../hooks/usePerformance';
import ReportPreview from '../../components/report/ReportPreview';
import DetailedWorkReport from '../../components/report/DetailedWorkReport';
import { FileBarChart, Sparkles, LayoutList } from 'lucide-react';
import clsx from 'clsx';

type TabKey = 'detailed' | 'overview';

export default function TimeDetailed() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const userName = profile?.displayName ?? '사용자';
  const { report, loading } = usePerformanceReport(userId, userName);
  const {
    analysis,
    aiReport,
    loading: detailedLoading,
    aiLoading,
    generateAIReport,
  } = useDetailedReport(userId, userName);

  const [activeTab, setActiveTab] = useState<TabKey>('detailed');

  if (loading && detailedLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  const hasReport = !!report;
  const hasAnalysis = !!analysis;

  if (!hasReport && !hasAnalysis) {
    return (
      <div className="card text-center py-12">
        <FileBarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">생성된 리포트가 없습니다.</p>
        <p className="text-xs text-gray-400 mt-1">충분한 데이터가 쌓이면 자동으로 리포트가 생성됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">상세 시간 리포트</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI가 실제 사용한 앱과 작업 내용을 분석하여 상세 성과 리포트를 생성합니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <TabBtn active={activeTab === 'detailed'} onClick={() => setActiveTab('detailed')} icon={<Sparkles className="w-4 h-4" />} label="상세 업무 분석" />
        {hasReport && (
          <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutList className="w-4 h-4" />} label="기본 리포트" />
        )}
      </div>

      {activeTab === 'detailed' ? (
        analysis ? (
          <DetailedWorkReport analysis={analysis} aiReport={aiReport} aiLoading={aiLoading} onGenerateAI={generateAIReport} />
        ) : detailedLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="card text-center py-12">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">상세 분석 데이터가 없습니다.</p>
          </div>
        )
      ) : (
        report && (
          <ReportPreview
            report={report}
            onExport={() => alert('PDF 내보내기 준비 중입니다.')}
            onShare={() => alert('관리자에게 공유되었습니다. (데모)')}
          />
        )
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
        active ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700',
      )}
    >
      {icon}{label}
    </button>
  );
}
