import { useAuth } from '../contexts/AuthContext';
import { usePerformanceReport } from '../hooks/usePerformance';
import ReportPreview from '../components/report/ReportPreview';
import { FileBarChart } from 'lucide-react';

export default function PerformanceReport() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const userName = profile?.displayName ?? '사용자';
  const { report, loading } = usePerformanceReport(userId, userName);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="card text-center py-12">
        <FileBarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">생성된 리포트가 없습니다.</p>
        <p className="text-xs text-gray-400 mt-1">
          충분한 데이터가 쌓이면 자동으로 리포트가 생성됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">성과 리포트</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI가 생성한 데이터 기반 성과 리포트를 확인하고 공유하세요.
        </p>
      </div>

      <ReportPreview
        report={report}
        onExport={() => {
          alert('PDF 내보내기가 준비 중입니다. (추후 구현)');
        }}
        onShare={() => {
          alert('관리자에게 리포트가 공유되었습니다. (데모)');
        }}
      />
    </div>
  );
}
