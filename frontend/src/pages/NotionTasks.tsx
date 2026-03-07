import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  CheckCircle2,
  Circle,
  ExternalLink,
  Sparkles,
  UploadCloud,
  Settings,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import { getNotionSettings } from '../services/firestoreService';
import { getLatestMetrics } from '../services/firestoreService';
import { fetchDoingTasks, analyzeTaskWithAI, updateTaskProgress } from '../services/notionService';
import type { NotionTask, NotionSettings } from '../types';

export default function NotionTasks() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<NotionSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [tasks, setTasks] = useState<NotionTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [tasksHint, setTasksHint] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateResults, setUpdateResults] = useState<Record<string, 'success' | 'error'>>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Notion 설정 로드
  useEffect(() => {
    if (!profile?.uid) return;
    setSettingsLoading(true);
    getNotionSettings(profile.uid)
      .then((s) => setSettings(s))
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, [profile?.uid]);

  // 태스크 목록 로드
  const loadTasks = async () => {
    if (!settings) return;
    setTasksLoading(true);
    setTasksError('');
    setTasksHint('');
    try {
      const result = await fetchDoingTasks(settings, profile?.displayName);
      setTasks(result.tasks.map((t) => ({ ...t, aiAnalysis: undefined })));
      if (result.hint) setTasksHint(result.hint);
    } catch (e) {
      setTasksError(
        e instanceof Error
          ? e.message
          : 'Notion 태스크를 불러오는 중 오류가 발생했습니다. API 키와 DB ID를 확인해주세요.'
      );
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    if (settings?.enabled) {
      loadTasks();
    }
  }, [settings]);

  // AI로 전체 태스크 분석
  const handleAnalyzeAll = async () => {
    if (!profile?.uid || tasks.length === 0) return;
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
    if (!geminiKey) {
      setAnalyzeError('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
      return;
    }

    setAnalyzing(true);
    setAnalyzeError('');

    try {
      // 최신 AI 리포트 로드
      const latestMetrics = await getLatestMetrics(profile.uid);
      if (!latestMetrics) {
        setAnalyzeError('분석할 성과 데이터가 없습니다. 먼저 활동 데이터를 제출해주세요.');
        setAnalyzing(false);
        return;
      }

      const aiReport = {
        aiSummary: latestMetrics.aiSummary || '업무 데이터 없음',
        keyAchievements: latestMetrics.keyAchievements || [],
        timeline: latestMetrics.timeline
          ?.map((t) => `${t.startTime}-${t.endTime} ${t.app}: ${t.description}`)
          .join('\n'),
      };

      // 각 태스크 AI 분석 (병렬 처리)
      const analyses = await Promise.all(
        tasks.map((task) => analyzeTaskWithAI(task, aiReport, geminiKey))
      );

      setTasks((prev) =>
        prev.map((task, idx) => ({ ...task, aiAnalysis: analyses[idx] }))
      );
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  // 단일 태스크 Notion 업데이트
  const handleUpdateTask = async (task: NotionTask) => {
    if (!settings || !task.aiAnalysis) return;
    setUpdatingId(task.id);
    try {
      await updateTaskProgress(
        settings,
        task.id,
        task.aiAnalysis.estimatedProgress,
        task.aiAnalysis.isDone
      );
      setUpdateResults((prev) => ({ ...prev, [task.id]: 'success' }));
      // 완료된 태스크는 목록에서 제거 (isDone이면)
      if (task.aiAnalysis.isDone) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, progress: task.aiAnalysis!.estimatedProgress }
              : t
          )
        );
      }
    } catch {
      setUpdateResults((prev) => ({ ...prev, [task.id]: 'error' }));
    } finally {
      setUpdatingId(null);
    }
  };

  // 설정 로딩 중
  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Notion 설정 미완료
  if (!settings?.enabled || !settings.apiKey || !settings.databaseId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notion 태스크</h1>
          <p className="text-sm text-gray-500 mt-1">
            진행 중인 Notion 태스크를 조회하고 AI 성과 리포트를 기반으로 달성률을 업데이트합니다.
          </p>
        </div>
        <div className="card flex flex-col items-center py-12 gap-4 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl">
            📝
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Notion 연동 설정이 필요합니다</p>
            <p className="text-xs text-gray-500 mt-1">
              설정 → 연동 관리에서 Notion API 키와 데이터베이스 ID를 입력해주세요.
            </p>
          </div>
          <button
            onClick={() => navigate('/settings?tab=integrations')}
            className="btn-primary flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            연동 설정으로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notion 태스크</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{profile?.displayName}</span>님의 진행 중 태스크 —{' '}
            <span className="text-brand-600 font-medium">{tasks.length}개</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            disabled={tasksLoading}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <RefreshCw className={clsx('w-4 h-4', tasksLoading && 'animate-spin')} />
            새로고침
          </button>
          <button
            onClick={handleAnalyzeAll}
            disabled={analyzing || tasks.length === 0}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Sparkles className={clsx('w-4 h-4', analyzing && 'animate-pulse')} />
            {analyzing ? 'AI 분석 중...' : 'AI 전체 분석'}
          </button>
        </div>
      </div>

      {/* 분석 안내 배너 */}
      {!tasks.some((t) => t.aiAnalysis) && tasks.length > 0 && !analyzing && (
        <div className="p-4 bg-brand-50 border border-brand-200 rounded-xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-brand-800">AI 분석을 실행해보세요</p>
            <p className="text-xs text-gray-600 mt-0.5">
              오늘의 AI 성과 리포트를 기반으로 각 태스크의 달성 여부와 달성률을 자동으로 분석합니다.
            </p>
          </div>
        </div>
      )}

      {/* 에러 */}
      {(tasksError || analyzeError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">오류 발생</p>
            <p className="text-xs text-red-600 mt-0.5">{tasksError || analyzeError}</p>
          </div>
        </div>
      )}

      {/* 태스크 로딩 */}
      {tasksLoading && (
        <div className="card flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-3 text-sm text-gray-500">Notion에서 태스크를 불러오는 중...</span>
        </div>
      )}

      {/* 태스크 없음 */}
      {!tasksLoading && tasks.length === 0 && !tasksError && (
        <div className="card flex flex-col items-center py-12 gap-3 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400" />
          <p className="text-sm font-semibold text-gray-700">진행 중인 태스크가 없습니다</p>
          {tasksHint ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 max-w-sm">
              {tasksHint}
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              Notion DB의 <strong>"{settings.doingValue}"</strong> 상태 태스크가 없거나,<br />
              담당자 필터에 해당하는 태스크가 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 태스크 목록 */}
      {!tasksLoading && tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isExpanded = expandedId === task.id;
            const analysis = task.aiAnalysis;
            const updateResult = updateResults[task.id];

            return (
              <div
                key={task.id}
                className={clsx(
                  'card transition-all',
                  analysis?.isDone && 'border-green-200 bg-green-50/30',
                  updateResult === 'success' && 'border-green-300',
                  updateResult === 'error' && 'border-red-200'
                )}
              >
                {/* 태스크 헤더 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {analysis ? (
                      analysis.isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                      )
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{task.title}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {task.assignee && (
                          <span className="text-xs text-gray-400">👤 {task.assignee}</span>
                        )}
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                          {task.status}
                        </span>
                        {task.progress !== undefined && (
                          <span className="text-xs text-gray-500">{task.progress}% 달성</span>
                        )}
                        {task.lastEdited && (
                          <span className="text-xs text-gray-400">
                            {new Date(task.lastEdited).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {analysis && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : task.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* 달성률 바 (AI 분석 후) */}
                {analysis && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">AI 추정 달성률</span>
                      <span
                        className={clsx(
                          'text-xs font-bold',
                          analysis.isDone ? 'text-green-600' : 'text-brand-600'
                        )}
                      >
                        {analysis.estimatedProgress}%{analysis.isDone && ' · 완료'}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-500',
                          analysis.isDone ? 'bg-green-500' : 'bg-brand-500'
                        )}
                        style={{ width: `${analysis.estimatedProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* AI 분석 상세 (펼침) */}
                {analysis && isExpanded && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-gray-600 leading-relaxed">
                    <p className="font-semibold text-gray-700 mb-1">🤖 AI 판단 근거</p>
                    <p>{analysis.reason}</p>
                  </div>
                )}

                {/* 업데이트 버튼 */}
                {analysis && (
                  <div className="mt-3 flex items-center justify-between">
                    {updateResult === 'success' && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Notion 업데이트 완료
                      </span>
                    )}
                    {updateResult === 'error' && (
                      <span className="text-xs text-red-500">업데이트 실패. 다시 시도해주세요.</span>
                    )}
                    {!updateResult && <span />}

                    <button
                      onClick={() => handleUpdateTask(task)}
                      disabled={updatingId === task.id || updateResult === 'success'}
                      className={clsx(
                        'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                        updateResult === 'success'
                          ? 'bg-gray-100 text-gray-400 cursor-default'
                          : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60'
                      )}
                    >
                      {updatingId === task.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5" />
                      )}
                      {updatingId === task.id
                        ? '업데이트 중...'
                        : updateResult === 'success'
                        ? '완료됨'
                        : 'Notion 업데이트'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Notion 설정 바로가기 */}
      <div className="text-center">
        <button
          onClick={() => navigate('/settings?tab=integrations')}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
        >
          <Settings className="w-3 h-3" />
          Notion 연동 설정 변경
        </button>
      </div>
    </div>
  );
}
