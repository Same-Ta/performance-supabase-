import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Play, Square, Wifi, WifiOff, Activity, Clock, Brain, RefreshCw, ChevronDown, Globe, Pencil } from 'lucide-react';
import { browserTracker } from '../../services/browserTracker';
import type { BrowserLiveStats } from '../../services/browserTracker';
import { submitMetrics } from '../../services/firestoreService';
import type { ActivitySegment } from '../../types';

const AGENT_URL = 'http://localhost:5001';
const POLL_INTERVAL = 3000;

type AgentState = 'offline' | 'idle' | 'running';
type TrackMode = 'agent' | 'browser';

const TASK_TYPES = [
  { value: 'general', label: '일반 업무', color: 'bg-gray-100 text-gray-700' },
  { value: 'frontend', label: '프론트엔드 개발', color: 'bg-blue-100 text-blue-700' },
  { value: 'backend', label: '백엔드 개발', color: 'bg-green-100 text-green-700' },
  { value: 'design', label: '디자인', color: 'bg-pink-100 text-pink-700' },
  { value: 'documentation', label: '문서 작업', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'meeting', label: '회의', color: 'bg-purple-100 text-purple-700' },
  { value: 'planning', label: '기획/계획', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'review', label: '코드 리뷰', color: 'bg-orange-100 text-orange-700' },
  { value: 'research', label: '리서치/조사', color: 'bg-teal-100 text-teal-700' },
  { value: 'bug_fix', label: '버그 수정', color: 'bg-red-100 text-red-700' },
] as const;

// ── 브라우저 모드: 업무 유형 → 활동 카테고리 매핑 ──────────
const BROWSER_CATEGORY_MAP: Record<string, string> = {
  general: 'other',
  frontend: 'development',
  backend: 'development',
  design: 'design',
  documentation: 'documentation',
  meeting: 'meeting',
  planning: 'project_mgmt',
  review: 'development',
  research: 'research',
  bug_fix: 'development',
};

function padHHMM(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

/** 브라우저 추적 데이터로 합성 ActivitySegment 배열 생성 */
function generateBrowserTimeline(
  sessionStartMs: number,
  activeMinutes: number,
  idleMinutes: number,
  contextSwitches: number,
  deepFocusMinutes: number,
  taskType: string,
  taskLabel: string,
): ActivitySegment[] {
  if (activeMinutes <= 0) return [];

  const category = (BROWSER_CATEGORY_MAP[taskType] || 'other') as ActivitySegment['category'];
  const numActiveBlocks = contextSwitches + 1;
  const activePerBlock = Math.max(1, Math.round(activeMinutes / numActiveBlocks));
  const idlePerBlock = contextSwitches > 0 ? Math.max(1, Math.round(idleMinutes / contextSwitches)) : 0;
  let deepFocusLeft = deepFocusMinutes;
  let currentMs = sessionStartMs;

  // 블록별 구체적인 설명 생성
  const WORK_DESCRIPTIONS: Record<string, string[]> = {
    frontend: ['UI 컴포넌트 구현', '스타일링 및 레이아웃', '프론트엔드 로직 작성', '화면 인터랙션 개발', '상태 관리 작업'],
    backend: ['API 엔드포인트 개발', '서버 로직 구현', '데이터베이스 쿼리 작업', '백엔드 비즈니스 로직', '서버 설정 작업'],
    design: ['UI/UX 디자인 작업', '와이어프레임 작성', '디자인 시스템 정리', '프로토타입 제작', '비주얼 에셋 작업'],
    documentation: ['기술 문서 작성', 'API 문서 업데이트', '프로젝트 문서화', '가이드 작성', '회의록 정리'],
    meeting: ['팀 회의 참석', '화상 미팅', '프로젝트 논의', '스크럼 미팅', '1:1 미팅'],
    planning: ['스프린트 계획 수립', '태스크 분배 및 정리', '로드맵 검토', '요구사항 분석', '우선순위 조정'],
    review: ['코드 리뷰 수행', 'PR 확인 및 피드백', '코드 품질 검토', '리뷰 코멘트 작성', '머지 및 승인'],
    research: ['기술 조사 및 리서치', '레퍼런스 분석', '라이브러리 비교 검토', '사례 연구', '기술 스택 조사'],
    bug_fix: ['버그 원인 분석', '디버깅 및 수정', '에러 로그 확인', '재현 테스트', '핫픽스 적용'],
    general: ['업무 진행', '태스크 수행', '작업 처리', '일반 업무 수행', '프로젝트 작업'],
  };
  const descList = WORK_DESCRIPTIONS[taskType] ?? WORK_DESCRIPTIONS['general'];

  const segs: ActivitySegment[] = [];

  for (let i = 0; i < numActiveBlocks; i++) {
    const dur = activePerBlock;
    const isDeep = deepFocusLeft >= dur && dur >= 10;
    if (isDeep) deepFocusLeft -= dur;
    const desc = isDeep
      ? `딥포커스 — ${descList[i % descList.length]}`
      : descList[i % descList.length];
    segs.push({
      startTime: padHHMM(new Date(currentMs)),
      endTime: padHHMM(new Date(currentMs + dur * 60000)),
      app: 'Browser Tracker',
      windowTitle: taskLabel,
      category,
      durationMinutes: dur,
      description: desc,
    });
    currentMs += dur * 60000;

    if (i < contextSwitches && idlePerBlock >= 1) {
      segs.push({
        startTime: padHHMM(new Date(currentMs)),
        endTime: padHHMM(new Date(currentMs + idlePerBlock * 60000)),
        app: '',
        windowTitle: '',
        category: 'idle',
        durationMinutes: idlePerBlock,
        description: '잠시 자리비움',
      });
      currentMs += idlePerBlock * 60000;
    }
  }
  return segs;
}

interface AgentLiveStats {
  elapsedMinutes: number;
  activeMinutes: number;
  idleMinutes: number;
  contextSwitches: number;
  deepFocusMinutes: number;
  topCategory: string;
  categoryBreakdown: Record<string, number>;
}

interface SessionSummary {
  score: number;
  focusScore: number;
  efficiencyScore: number;
  activeMinutes: number;
  deepFocusMinutes: number;
  contextSwitches: number;
  topCategory: string;
}

interface Props {
  onSessionEnd?: () => void;
}

export default function AgentControlPanel({ onSessionEnd }: Props) {
  const { user } = useAuth();
  const [agentState, setAgentState] = useState<AgentState>('offline');
  const [trackMode, setTrackMode] = useState<TrackMode>('browser');
  const [liveStats, setLiveStats] = useState<AgentLiveStats | BrowserLiveStats | null>(null);
  const [lastSession, setLastSession] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState('general');
  const [customTaskInput, setCustomTaskInput] = useState('');
  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false);
  const [browserRunning, setBrowserRunning] = useState(() => browserTracker.isRunning);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // ── 마운트 시 이미 추적 중이면 UI 동기화 (페이지 이동 후 복귀 대응) ──
  useEffect(() => {
    if (browserTracker.isRunning) {
      setBrowserRunning(true);
      setLiveStats(browserTracker.getLiveStats());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/status`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return;
      const data = await res.json();
      setAgentState(data.running ? 'running' : 'idle');
      if (data.running && data.stats && Object.keys(data.stats).length > 0) {
        setLiveStats(data.stats as AgentLiveStats);
      } else if (!data.running) {
        setLiveStats(null);
      }
      setError(null);
    } catch {
      setAgentState('offline');
      if (!browserTracker.isRunning) setLiveStats(null);
    }
  }, []);

  useEffect(() => {
    pollStatus();
    const id = setInterval(pollStatus, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [pollStatus]);

  // ── 브라우저 모드 실시간 stats 업데이트 ───────────────────
  useEffect(() => {
    if (!browserRunning) return;
    const id = setInterval(() => {
      setLiveStats(browserTracker.getLiveStats());
    }, 2000);
    return () => clearInterval(id);
  }, [browserRunning]);

  // ── 드롭다운 외부 클릭 닫기 ───────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTaskDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── 시작 ──────────────────────────────────────────────────
  const handleStart = async () => {
    if (!user) { setError('로그인이 필요합니다.'); return; }
    setLoading(true);
    setError(null);

    // 브라우저 모드
    if (trackMode === 'browser' || agentState === 'offline') {
      try {
        browserTracker.start(effectiveTask);
        setBrowserRunning(true);
        setLiveStats(browserTracker.getLiveStats());
        setLastSession(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '브라우저 추적 시작 실패');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 로컬 에이전트 모드
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch(`${AGENT_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, idToken, taskType: effectiveTask }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '에이전트 시작 실패');
      setAgentState('running');
      setLastSession(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setError(msg.includes('fetch') ? '에이전트 서버를 찾을 수 없습니다. 브라우저 모드를 사용해주세요.' : msg);
    } finally {
      setLoading(false);
    }
  };

  // ── 중지 ──────────────────────────────────────────────────
  const handleStop = async () => {
    setLoading(true);
    setError(null);

    // 브라우저 모드 종료
    if (browserRunning) {
      try {
        const result = browserTracker.stop();
        setBrowserRunning(false);
        setLiveStats(null);
        setLastSession({
          score: result.score,
          focusScore: result.focusScore,
          efficiencyScore: result.efficiencyScore,
          activeMinutes: result.activeMinutes,
          deepFocusMinutes: result.deepFocusMinutes,
          contextSwitches: result.contextSwitches,
          topCategory: result.topCategory,
        });
        if (user) {
          const now = new Date();
          // UTC 대신 로컬 날짜 사용 (한국 시간대 자정 부근 날짜 불일치 방지)
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const sessionId = `browser_${now.getTime()}`;
          const sessionStartMs = now.getTime() - result.totalMinutes * 60000;
          const sessionStartTime = new Date(sessionStartMs).toTimeString().slice(0, 5);
          const sessionEndTime = now.toTimeString().slice(0, 5);
          const taskLabel = TASK_TYPES.find(t => t.value === effectiveTask)?.label ?? effectiveTask;
          const idleMinutes = result.totalMinutes - result.activeMinutes;
          const deepFocusRatio = result.activeMinutes > 0
            ? Math.round((result.deepFocusMinutes / result.activeMinutes) * 100)
            : 0;
          const switchLevel = result.contextSwitches < 5
            ? '매우 안정적인'
            : result.contextSwitches < 15 ? '보통 수준의' : '높은';

          const aiSummary =
            `${sessionStartTime}~${sessionEndTime}(총 ${result.totalMinutes}분) 동안 ${taskLabel} 업무를 수행했습니다. ` +
            `활성 작업 시간 ${result.activeMinutes}분 중 방해 없는 딥포커스 구간이 ${result.deepFocusMinutes}분(${deepFocusRatio}%)이었으며, ` +
            `컨텍스트 전환 ${result.contextSwitches}회로 ${switchLevel} 집중 흐름을 보였습니다. ` +
            `유휴 시간은 ${idleMinutes}분이었습니다.`;

          const keyAchievements: string[] = [];
          if (result.deepFocusMinutes >= 20)
            keyAchievements.push(`${result.deepFocusMinutes}분간 딥포커스 달성 — 높은 몰입도로 ${taskLabel} 집중 수행`);
          if (result.focusScore >= 70)
            keyAchievements.push(`집중도 ${result.focusScore}점 — 평균 이상의 집중력 유지`);
          if (result.activeMinutes >= 60)
            keyAchievements.push(`${(result.activeMinutes / 60).toFixed(1)}시간 동안 ${taskLabel} 연속 작업 완료`);
          if (result.contextSwitches < 5 && result.activeMinutes > 10)
            keyAchievements.push(`컨텍스트 전환 ${result.contextSwitches}회 — 안정적인 작업 흐름 유지`);
          if (keyAchievements.length === 0)
            keyAchievements.push(`${taskLabel} ${result.activeMinutes}분 수행 완료`);

          const suggestedImprovements: string[] = [];
          if (result.contextSwitches > 15)
            suggestedImprovements.push('잦은 전환이 감지됨 — 포모도로 기법으로 집중 구간을 구조화해보세요');
          if (deepFocusRatio < 30 && result.activeMinutes > 20)
            suggestedImprovements.push('딥포커스 비율이 낮습니다 — 알림 차단 후 전용 집중 시간을 늘려보세요');
          if (idleMinutes > result.activeMinutes)
            suggestedImprovements.push('유휴 시간이 활성 시간보다 길었습니다 — 작업 환경·에너지 관리를 점검해보세요');

          const timeline = generateBrowserTimeline(
            sessionStartMs,
            result.activeMinutes,
            idleMinutes,
            result.contextSwitches,
            result.deepFocusMinutes,
            effectiveTask,
            taskLabel,
          );

          await submitMetrics({
            id: `${user.uid}_${dateStr}_${sessionId}`,
            userId: user.uid,
            date: dateStr,
            sessionId,
            status: 'submitted',
            totalWorkMinutes: result.totalMinutes,
            activeWorkMinutes: result.activeMinutes,
            focusScore: result.focusScore,
            efficiencyScore: result.efficiencyScore,
            goalAlignmentScore: 70,
            outputScore: Math.round((result.focusScore + result.efficiencyScore) / 2),
            contextSwitchCount: result.contextSwitches,
            contextSwitchRate: result.activeMinutes > 0
              ? parseFloat((result.contextSwitches / result.activeMinutes).toFixed(2))
              : 0,
            inputDensity: 0,
            deepFocusMinutes: result.deepFocusMinutes,
            softwareUsage: [{
              category: (BROWSER_CATEGORY_MAP[effectiveTask] || 'other') as never,
              appName: taskLabel,
              minutes: result.activeMinutes,
              percentage: 100,
            }],
            aiSummary,
            keyAchievements,
            suggestedImprovements,
            taskType: effectiveTask,
            sessionStartTime,
            sessionEndTime,
            timeline,
            createdAt: now.toISOString(),
          });
        }
        onSessionEnd?.();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '세션 저장 실패');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 로컬 에이전트 모드 종료
    try {
      const res = await fetch(`${AGENT_URL}/stop`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '에이전트 종료 실패');
      setAgentState('idle');
      setLiveStats(null);
      if (data.summary) setLastSession(data.summary as SessionSummary);
      onSessionEnd?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const isTracking = browserRunning || agentState === 'running';
  const isCustom = selectedTask === '__custom__';
  // 실제로 사용할 task 값 (직접입력 시 customTaskInput 사용)
  const effectiveTask = isCustom
    ? (customTaskInput.trim() || '직접 입력')
    : selectedTask;
  const currentTask = isCustom
    ? { value: '__custom__', label: customTaskInput.trim() || '직접 입력', color: 'bg-violet-100 text-violet-700' }
    : TASK_TYPES.find(t => t.value === selectedTask);

  const stateColor = browserRunning
    ? 'text-green-500'
    : { offline: 'text-gray-400', idle: 'text-yellow-500', running: 'text-green-500' }[agentState];

  const stateLabel = browserRunning
    ? '추적 중 (브라우저)'
    : { offline: '오프라인', idle: '대기 중', running: '추적 중' }[agentState];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-brand-500" />
          <span className="font-semibold text-gray-800">업무 추적 에이전트</span>
        </div>
        <div className="flex items-center gap-1.5">
          {browserRunning ? (
            <Globe className={`w-4 h-4 ${stateColor}`} />
          ) : agentState === 'offline' ? (
            <WifiOff className={`w-4 h-4 ${stateColor}`} />
          ) : (
            <Wifi className={`w-4 h-4 ${stateColor}`} />
          )}
          <span className={`text-xs font-medium ${stateColor}`}>{stateLabel}</span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* 추적 모드 선택 (에이전트 연결됐을 때만) */}
        {agentState !== 'offline' && !isTracking && (
          <div className="flex gap-2">
            <button
              onClick={() => setTrackMode('browser')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                trackMode === 'browser'
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              브라우저 모드
            </button>
            <button
              onClick={() => setTrackMode('agent')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                trackMode === 'agent'
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              로컬 에이전트
            </button>
          </div>
        )}

        {/* 에이전트 오프라인 시 브라우저 모드 안내 */}
        {agentState === 'offline' && !browserRunning && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-0.5">브라우저 추적 모드</p>
            <p className="text-xs text-blue-500">
              로컬 에이전트 없이도 마우스·키보드 입력으로 업무 시간을 즉시 추적합니다.
            </p>
          </div>
        )}

        {/* 실시간 통계 */}
        {isTracking && liveStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBadge icon={<Clock className="w-4 h-4 text-blue-500" />} label="경과" value={`${liveStats.elapsedMinutes}분`} />
            <StatBadge icon={<Activity className="w-4 h-4 text-green-500" />} label="활성" value={`${liveStats.activeMinutes}분`} />
            <StatBadge icon={<Brain className="w-4 h-4 text-purple-500" />} label="딥포커스" value={`${liveStats.deepFocusMinutes}분`} />
            <StatBadge icon={<RefreshCw className="w-4 h-4 text-orange-400" />} label="전환" value={`${liveStats.contextSwitches}회`} />
          </div>
        )}

        {/* 직전 세션 결과 */}
        {lastSession && (
          <div className="bg-brand-50 rounded-xl px-4 py-3 border border-brand-100">
            <p className="text-xs font-semibold text-brand-600 mb-2">방금 세션 결과</p>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-2xl font-bold text-brand-700">{lastSession.score}점</span>
              <div className="text-xs text-brand-600 space-y-0.5">
                <p>집중 {lastSession.deepFocusMinutes}분 · 활성 {lastSession.activeMinutes}분</p>
                <p>컨텍스트 전환 {lastSession.contextSwitches}회 · <span className="capitalize">{lastSession.topCategory}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* 업무 유형 선택 + 시작/중지 버튼 */}
        <div className="flex items-center justify-between gap-3">
          {/* 업무 유형 드롭다운 */}
          {!isTracking && (
            <div className="relative flex-1 max-w-xs" ref={dropdownRef}>
              <button
                onClick={() => setTaskDropdownOpen(!taskDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm hover:bg-gray-100 transition-colors"
              >
                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${currentTask?.color || ''}`}>
                  {isCustom
                    ? (customTaskInput.trim() || '직접 입력…')
                    : (currentTask?.label || '일반 업무')}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${taskDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {taskDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 max-h-60 overflow-y-auto">
                  {TASK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => { setSelectedTask(t.value); setTaskDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${selectedTask === t.value ? 'bg-brand-50' : ''}`}
                    >
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${t.color}`}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                  {/* 직접 입력 항목 */}
                  <button
                    onClick={() => {
                      setSelectedTask('__custom__');
                      setTaskDropdownOpen(false);
                      setTimeout(() => customInputRef.current?.focus(), 50);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${selectedTask === '__custom__' ? 'bg-brand-50' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-violet-100 text-violet-700">
                      <Pencil className="w-3 h-3" />
                      직접 입력
                    </span>
                  </button>
                </div>
              )}
              {/* 직접 입력 필드 */}
              {isCustom && (
                <input
                  ref={customInputRef}
                  type="text"
                  value={customTaskInput}
                  onChange={(e) => setCustomTaskInput(e.target.value)}
                  placeholder="업무 이름 입력 (예: 신규 기능 설계)"
                  className="mt-2 w-full px-3 py-2 border border-violet-200 rounded-xl text-sm bg-violet-50 placeholder-violet-300 text-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  maxLength={40}
                />
              )}
            </div>
          )}

          {/* 추적 중일 때 현재 업무 유형 표시 */}
          {isTracking && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">현재 업무:</span>
              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${currentTask?.color || 'bg-gray-100 text-gray-700'}`}>
                {effectiveTask}
              </span>
            </div>
          )}

          {/* 시작/중지 버튼 */}
          {isTracking ? (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Square className="w-4 h-4 fill-white" />
              {loading ? '종료 중…' : '추적 중지'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading || !user}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Play className="w-4 h-4 fill-white" />
              {loading ? '시작 중…' : '추적 시작'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
      {icon}
      <div>
        <p className="text-[10px] text-gray-400 leading-none">{label}</p>
        <p className="text-sm font-semibold text-gray-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
