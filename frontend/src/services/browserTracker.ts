/**
 * Browser-based Work Tracker
 * 로컬 Python 에이전트 없이 브라우저에서 직접 업무 시간을 추적합니다.
 * - 마우스/키보드 이벤트로 활성/유휴 감지
 * - Page Visibility API로 탭 포커스 감지
 * - 딥포커스: 10분 이상 중단 없이 활성 상태 유지
 * - 컨텍스트 전환: 탭 이탈/복귀 및 유휴→활성 전환
 */

const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // 2분 동안 입력 없으면 유휴
const DEEP_FOCUS_THRESHOLD_MS = 10 * 60 * 1000; // 10분 이상 지속 = 딥포커스

export interface BrowserLiveStats {
  elapsedMinutes: number;
  activeMinutes: number;
  idleMinutes: number;
  contextSwitches: number;
  deepFocusMinutes: number;
  topCategory: string;
  categoryBreakdown: Record<string, number>;
}

export interface BrowserSessionResult {
  score: number;
  focusScore: number;
  efficiencyScore: number;
  activeMinutes: number;
  deepFocusMinutes: number;
  contextSwitches: number;
  topCategory: string;
  totalMinutes: number;
}

type TrackingState = 'stopped' | 'running';

export class BrowserTracker {
  private state: TrackingState = 'stopped';
  private startTime: number = 0;
  private lastActivityTime: number = 0;
  private activeMs: number = 0;
  private idleMs: number = 0;
  private contextSwitches: number = 0;
  private deepFocusMs: number = 0;
  private taskType: string = 'general';

  // 현재 활성 구간 시작
  private currentActiveSegmentStart: number = 0;
  private isCurrentlyIdle: boolean = false;

  // 타이머
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = 0;

  // 이벤트 핸들러 참조 (제거용)
  private handleActivity = this._onActivity.bind(this);
  private handleVisibility = this._onVisibility.bind(this);

  start(taskType: string = 'general') {
    if (this.state === 'running') return;
    this.state = 'running';
    this.taskType = taskType;
    this.startTime = Date.now();
    this.lastActivityTime = Date.now();
    this.activeMs = 0;
    this.idleMs = 0;
    this.contextSwitches = 0;
    this.deepFocusMs = 0;
    this.currentActiveSegmentStart = Date.now();
    this.isCurrentlyIdle = false;
    this.lastTickTime = Date.now();

    // 이벤트 리스너 등록
    window.addEventListener('mousemove', this.handleActivity, { passive: true });
    window.addEventListener('mousedown', this.handleActivity, { passive: true });
    window.addEventListener('keydown', this.handleActivity, { passive: true });
    window.addEventListener('scroll', this.handleActivity, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibility);

    // 1초마다 상태 업데이트 (유휴 감지용)
    this.tickInterval = setInterval(() => this._tick(), 1000);
  }

  private _onActivity() {
    if (this.state !== 'running') return;
    const now = Date.now();

    if (this.isCurrentlyIdle) {
      // 유휴 → 활성 전환
      this.isCurrentlyIdle = false;
      this.contextSwitches++;
      this.currentActiveSegmentStart = now;
    }

    this.lastActivityTime = now;
  }

  private _onVisibility() {
    if (this.state !== 'running') return;
    if (document.hidden) {
      // 탭 이탈: 컨텍스트 전환 기록만 하고, 타이머는 계속 유지
      // (페이지 이동 시에도 추적 지속)
      this.contextSwitches++;
    } else {
      // 탭 복귀 → 활성 재개
      this.lastActivityTime = Date.now();
      if (this.isCurrentlyIdle) {
        this.isCurrentlyIdle = false;
        this.currentActiveSegmentStart = Date.now();
      }
    }
  }

  private _tick() {
    if (this.state !== 'running') return;
    const now = Date.now();
    const delta = now - this.lastTickTime;
    this.lastTickTime = now;

    const timeSinceActivity = now - this.lastActivityTime;
    // 탭이 숨겨져도 추적을 멈추지 않고 유휴 시간만 기록 (SPA 내 페이지 이동 대응)
    const shouldBeIdle = timeSinceActivity > IDLE_THRESHOLD_MS;

    if (shouldBeIdle && !this.isCurrentlyIdle) {
      // 활성 → 유휴 전환
      this.isCurrentlyIdle = true;
      const segmentDuration = now - this.currentActiveSegmentStart;
      // 딥포커스 누적 (현재 구간이 기준 이상이면 전체 누적)
      if (segmentDuration >= DEEP_FOCUS_THRESHOLD_MS) {
        this.deepFocusMs += segmentDuration;
      }
    }

    if (!this.isCurrentlyIdle) {
      this.activeMs += delta;
    } else {
      this.idleMs += delta;
    }
  }

  getLiveStats(): BrowserLiveStats {
    const now = Date.now();
    const elapsedMs = now - this.startTime;

    // 현재 진행 중인 딥포커스 구간 반영
    let deepFocusMs = this.deepFocusMs;
    if (!this.isCurrentlyIdle) {
      const currentSegmentDuration = now - this.currentActiveSegmentStart;
      if (currentSegmentDuration >= DEEP_FOCUS_THRESHOLD_MS) {
        deepFocusMs += currentSegmentDuration;
      }
    }

    return {
      elapsedMinutes: Math.floor(elapsedMs / 60000),
      activeMinutes: Math.floor(this.activeMs / 60000),
      idleMinutes: Math.floor(this.idleMs / 60000),
      contextSwitches: this.contextSwitches,
      deepFocusMinutes: Math.floor(deepFocusMs / 60000),
      topCategory: this.taskType,
      categoryBreakdown: { [this.taskType]: Math.floor(this.activeMs / 60000) },
    };
  }

  stop(): BrowserSessionResult {
    if (this.state !== 'running') {
      return this._calcResult();
    }

    // 마지막 틱 처리
    this._tick();
    this.state = 'stopped';

    // 이벤트 리스너 제거
    window.removeEventListener('mousemove', this.handleActivity);
    window.removeEventListener('mousedown', this.handleActivity);
    window.removeEventListener('keydown', this.handleActivity);
    window.removeEventListener('scroll', this.handleActivity);
    document.removeEventListener('visibilitychange', this.handleVisibility);

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // 마지막 활성 구간 딥포커스 처리
    if (!this.isCurrentlyIdle) {
      const segmentDuration = Date.now() - this.currentActiveSegmentStart;
      if (segmentDuration >= DEEP_FOCUS_THRESHOLD_MS) {
        this.deepFocusMs += segmentDuration;
      }
    }

    return this._calcResult();
  }

  private _calcResult(): BrowserSessionResult {
    const totalMs = this.activeMs + this.idleMs;
    const totalMinutes = Math.max(1, Math.floor(totalMs / 60000));
    const activeMinutes = Math.floor(this.activeMs / 60000);
    const deepFocusMinutes = Math.floor(this.deepFocusMs / 60000);

    // 집중도: 활성비율 + 딥포커스 보너스 - 컨텍스트 전환 패널티
    const activeRatio = totalMs > 0 ? this.activeMs / totalMs : 0;
    const focusScore = Math.min(
      100,
      Math.round(
        activeRatio * 70 +
        (deepFocusMinutes / Math.max(activeMinutes, 1)) * 30 -
        this.contextSwitches * 0.5
      )
    );

    // 효율성: 활성시간 대비 딥포커스 비율
    const efficiencyScore = Math.min(
      100,
      Math.round(
        activeRatio * 50 +
        (activeMinutes > 0 ? (deepFocusMinutes / activeMinutes) * 50 : 0)
      )
    );

    const score = Math.round((focusScore + efficiencyScore) / 2);

    return {
      score: Math.max(0, score),
      focusScore: Math.max(0, focusScore),
      efficiencyScore: Math.max(0, efficiencyScore),
      activeMinutes,
      deepFocusMinutes,
      contextSwitches: this.contextSwitches,
      topCategory: this.taskType,
      totalMinutes,
    };
  }

  get isRunning() {
    return this.state === 'running';
  }
}

// 싱글톤
export const browserTracker = new BrowserTracker();
