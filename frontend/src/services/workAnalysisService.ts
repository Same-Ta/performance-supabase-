/**
 * ProofWork — 업무 활동 심층 분석 서비스
 *
 * 성과 메트릭 데이터(softwareUsage, timeline, scores 등)를 기반으로
 * 실제 사용 앱·작업 내용을 구조적으로 분석하여 상세 리포트 데이터를 생성합니다.
 */

import type {
  PerformanceMetrics,
  SoftwareUsageEntry,
  ActivitySegment,
} from '../types';

// ─── 분석 결과 타입 ────────────────────────────────────────

/** 앱별 상세 분석 */
export interface AppAnalysis {
  appName: string;
  category: string;
  categoryLabel: string;
  totalMinutes: number;
  percentage: number;
  sessions: number;           // 해당 앱으로 전환한 횟수
  avgSessionMinutes: number;  // 평균 사용 시간
  longestSessionMinutes: number;
  isProductive: boolean;
  trend: 'up' | 'down' | 'stable'; // 전일 대비
}

/** 시간대별 생산성 분석 */
export interface HourlyProductivity {
  hour: number;        // 0-23
  label: string;       // "09:00"
  activeMinutes: number;
  productiveMinutes: number;
  productivityRate: number; // 0-100
  dominantCategory: string;
  dominantCategoryLabel: string;
}

/** 작업 패턴 분석 */
export interface WorkPattern {
  peakHour: string;          // "14:00~15:00"
  peakProductivity: number;  // 해당 시간대 생산성
  avgSessionLength: number;  // 평균 연속 작업 분
  longestStreak: number;     // 최장 연속 작업 분
  focusBlocks: number;       // 20분+ 집중 블록 수
  switchFrequency: string;   // "분당 0.5회"
  workStyle: string;         // "딥워커" | "멀티태스커" | "밸런서"
  workStyleDescription: string;
}

/** 카테고리별 요약 */
export interface CategorySummary {
  category: string;
  label: string;
  color: string;
  totalMinutes: number;
  percentage: number;
  appCount: number;
  topApp: string;
}

/** 작업 내용 분석 (타임라인 세그먼트 기반) */
export interface WorkContentItem {
  timeRange: string;
  app: string;
  category: string;
  categoryLabel: string;
  description: string;
  durationMinutes: number;
  isDeepFocus: boolean;
}

/** 전체 상세 분석 결과 */
export interface DetailedAnalysis {
  // 기본 요약
  totalWorkMinutes: number;
  activeWorkMinutes: number;
  productiveMinutes: number;
  productivityRate: number;
  date: string;

  // 앱별 분석
  appAnalyses: AppAnalysis[];

  // 카테고리별 요약
  categorySummaries: CategorySummary[];

  // 시간대별 생산성
  hourlyProductivity: HourlyProductivity[];

  // 작업 패턴
  workPattern: WorkPattern;

  // 구체적 작업 내용 목록
  workContents: WorkContentItem[];

  // 핵심 인사이트 (AI 리포트 입력용)
  insights: string[];
}

// ─── 상수 ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  development: '개발',
  communication: '커뮤니케이션',
  documentation: '문서 작업',
  design: '디자인',
  project_mgmt: '프로젝트 관리',
  browser: '웹 브라우징',
  research: '리서치',
  meeting: '회의',
  idle: '자리비움',
  other: '기타',
};

const CATEGORY_COLORS: Record<string, string> = {
  development: '#3B82F6',
  communication: '#A855F7',
  documentation: '#10B981',
  design: '#EC4899',
  project_mgmt: '#F59E0B',
  browser: '#0EA5E9',
  research: '#14B8A6',
  meeting: '#F97316',
  idle: '#D1D5DB',
  other: '#9CA3AF',
};

const PRODUCTIVE_CATEGORIES = new Set([
  'development', 'documentation', 'design', 'project_mgmt', 'research',
]);

// ─── 메인 분석 함수 ────────────────────────────────────────

/**
 * 단일 날짜 메트릭 데이터를 심층 분석한다.
 */
export function analyzeWorkDay(
  metrics: PerformanceMetrics,
  previousMetrics?: PerformanceMetrics | null,
): DetailedAnalysis {
  const softwareUsage = metrics.softwareUsage || [];
  const timeline = metrics.timeline || [];

  // 1) 앱별 분석
  const appAnalyses = analyzeApps(softwareUsage, timeline, previousMetrics?.softwareUsage);

  // 2) 카테고리별 요약
  const categorySummaries = analyzCategories(softwareUsage);

  // 3) 시간대별 생산성
  const hourlyProductivity = analyzeHourlyProductivity(timeline);

  // 4) 작업 패턴
  const workPattern = analyzeWorkPattern(metrics, timeline);

  // 5) 구체적 작업 내용
  const workContents = extractWorkContents(timeline);

  // 6) 생산적 시간 계산
  const productiveMinutes = softwareUsage
    .filter(s => PRODUCTIVE_CATEGORIES.has(s.category))
    .reduce((sum, s) => sum + s.minutes, 0);

  const productivityRate = metrics.activeWorkMinutes > 0
    ? Math.round((productiveMinutes / metrics.activeWorkMinutes) * 100)
    : 0;

  // 7) 인사이트 생성
  const insights = generateInsights(metrics, appAnalyses, workPattern, categorySummaries);

  return {
    totalWorkMinutes: metrics.totalWorkMinutes,
    activeWorkMinutes: metrics.activeWorkMinutes,
    productiveMinutes,
    productivityRate,
    date: metrics.date,
    appAnalyses,
    categorySummaries,
    hourlyProductivity,
    workPattern,
    workContents,
    insights,
  };
}

/**
 * 여러 날짜의 메트릭을 종합 분석한다 (기간 리포트용).
 */
export function analyzeWorkPeriod(
  metricsList: PerformanceMetrics[],
): DetailedAnalysis {
  if (metricsList.length === 0) {
    return emptyAnalysis();
  }

  if (metricsList.length === 1) {
    return analyzeWorkDay(metricsList[0]);
  }

  // 모든 소프트웨어 사용 합산
  const allSoftware: SoftwareUsageEntry[] = [];
  const allTimeline: ActivitySegment[] = [];
  let totalWork = 0;
  let totalActive = 0;

  for (const m of metricsList) {
    totalWork += m.totalWorkMinutes;
    totalActive += m.activeWorkMinutes;
    if (m.softwareUsage) allSoftware.push(...m.softwareUsage);
    if (m.timeline) allTimeline.push(...m.timeline);
  }

  // 앱별 합산
  const appMap = new Map<string, { minutes: number; category: string }>();
  for (const s of allSoftware) {
    const existing = appMap.get(s.appName);
    if (existing) {
      existing.minutes += s.minutes;
    } else {
      appMap.set(s.appName, { minutes: s.minutes, category: s.category });
    }
  }

  const totalAppMinutes = Array.from(appMap.values()).reduce((s, a) => s + a.minutes, 0);
  const mergedSoftware: SoftwareUsageEntry[] = Array.from(appMap.entries())
    .map(([appName, data]) => ({
      appName,
      category: data.category as SoftwareUsageEntry['category'],
      minutes: Math.round(data.minutes * 10) / 10,
      percentage: totalAppMinutes > 0 ? Math.round((data.minutes / totalAppMinutes) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // 최근 vs 이전 비교
  const sorted = [...metricsList].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];

  const appAnalyses = analyzeApps(mergedSoftware, allTimeline);
  const categorySummaries = analyzCategories(mergedSoftware);
  const hourlyProductivity = analyzeHourlyProductivity(allTimeline);
  const workPattern = analyzeWorkPatternFromMultiple(metricsList, allTimeline);
  const workContents = extractWorkContents(allTimeline);

  const productiveMinutes = mergedSoftware
    .filter(s => PRODUCTIVE_CATEGORIES.has(s.category))
    .reduce((sum, s) => sum + s.minutes, 0);

  const productivityRate = totalActive > 0
    ? Math.round((productiveMinutes / totalActive) * 100)
    : 0;

  const insights = generateInsights(latest, appAnalyses, workPattern, categorySummaries);

  return {
    totalWorkMinutes: totalWork,
    activeWorkMinutes: totalActive,
    productiveMinutes,
    productivityRate,
    date: `${sorted[sorted.length - 1]?.date} ~ ${sorted[0]?.date}`,
    appAnalyses,
    categorySummaries,
    hourlyProductivity,
    workPattern,
    workContents,
    insights,
  };
}

// ─── 세부 분석 함수 ────────────────────────────────────────

function analyzeApps(
  software: SoftwareUsageEntry[],
  timeline: ActivitySegment[],
  previousSoftware?: SoftwareUsageEntry[],
): AppAnalysis[] {
  const prevMap = new Map<string, number>();
  if (previousSoftware) {
    for (const s of previousSoftware) {
      prevMap.set(s.appName, s.minutes);
    }
  }

  // 타임라인에서 앱별 세션 수와 최장 세션 추출
  const appSessions = new Map<string, { count: number; maxDuration: number; durations: number[] }>();
  for (const seg of timeline) {
    if (!seg.app || seg.category === 'idle') continue;
    const existing = appSessions.get(seg.app) || { count: 0, maxDuration: 0, durations: [] };
    existing.count++;
    existing.maxDuration = Math.max(existing.maxDuration, seg.durationMinutes);
    existing.durations.push(seg.durationMinutes);
    appSessions.set(seg.app, existing);
  }

  return software.slice(0, 15).map(s => {
    const session = appSessions.get(s.appName);
    const sessions = session?.count || 1;
    const avgSessionMinutes = session
      ? Math.round((session.durations.reduce((a, b) => a + b, 0) / sessions) * 10) / 10
      : s.minutes;
    const longestSessionMinutes = session?.maxDuration || s.minutes;

    // 전일 대비 트렌드
    const prevMinutes = prevMap.get(s.appName);
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (prevMinutes !== undefined) {
      const diff = s.minutes - prevMinutes;
      if (diff > 5) trend = 'up';
      else if (diff < -5) trend = 'down';
    }

    return {
      appName: s.appName,
      category: s.category,
      categoryLabel: CATEGORY_LABELS[s.category] || '기타',
      totalMinutes: s.minutes,
      percentage: s.percentage,
      sessions,
      avgSessionMinutes,
      longestSessionMinutes,
      isProductive: PRODUCTIVE_CATEGORIES.has(s.category),
      trend,
    };
  });
}

function analyzCategories(software: SoftwareUsageEntry[]): CategorySummary[] {
  const catMap = new Map<string, { minutes: number; apps: Set<string>; topApp: string; topMinutes: number }>();

  for (const s of software) {
    const existing = catMap.get(s.category) || {
      minutes: 0, apps: new Set<string>(), topApp: '', topMinutes: 0,
    };
    existing.minutes += s.minutes;
    existing.apps.add(s.appName);
    if (s.minutes > existing.topMinutes) {
      existing.topApp = s.appName;
      existing.topMinutes = s.minutes;
    }
    catMap.set(s.category, existing);
  }

  const totalMinutes = Array.from(catMap.values()).reduce((s, c) => s + c.minutes, 0);

  return Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      color: CATEGORY_COLORS[category] || '#9CA3AF',
      totalMinutes: Math.round(data.minutes * 10) / 10,
      percentage: totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0,
      appCount: data.apps.size,
      topApp: data.topApp,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

function analyzeHourlyProductivity(timeline: ActivitySegment[]): HourlyProductivity[] {
  const hourMap = new Map<number, { active: number; productive: number; cats: Map<string, number> }>();

  for (const seg of timeline) {
    if (seg.category === 'idle') continue;
    const hour = parseInt(seg.startTime.split(':')[0], 10);
    if (isNaN(hour)) continue;

    const data = hourMap.get(hour) || { active: 0, productive: 0, cats: new Map() };
    data.active += seg.durationMinutes;
    if (PRODUCTIVE_CATEGORIES.has(seg.category)) {
      data.productive += seg.durationMinutes;
    }
    const catCount = data.cats.get(seg.category) || 0;
    data.cats.set(seg.category, catCount + seg.durationMinutes);
    hourMap.set(hour, data);
  }

  const result: HourlyProductivity[] = [];
  for (let h = 0; h < 24; h++) {
    const data = hourMap.get(h);
    if (!data) continue;

    let dominantCategory = 'other';
    let maxCatMin = 0;
    for (const [cat, min] of data.cats.entries()) {
      if (min > maxCatMin) {
        maxCatMin = min;
        dominantCategory = cat;
      }
    }

    result.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      activeMinutes: Math.round(data.active),
      productiveMinutes: Math.round(data.productive),
      productivityRate: data.active > 0 ? Math.round((data.productive / data.active) * 100) : 0,
      dominantCategory,
      dominantCategoryLabel: CATEGORY_LABELS[dominantCategory] || '기타',
    });
  }

  return result;
}

function analyzeWorkPattern(
  metrics: PerformanceMetrics,
  timeline: ActivitySegment[],
): WorkPattern {
  const hourly = analyzeHourlyProductivity(timeline);

  // 피크 시간대
  let peakHour = '09:00~10:00';
  let peakProductivity = 0;
  for (const h of hourly) {
    if (h.productiveMinutes > peakProductivity) {
      peakProductivity = h.productiveMinutes;
      peakHour = `${h.label}~${String(h.hour + 1).padStart(2, '0')}:00`;
    }
  }

  // 연속 작업 시간 분석
  const sessionLengths: number[] = [];
  let currentStreak = 0;
  let longestStreak = 0;

  for (const seg of timeline) {
    if (seg.category !== 'idle') {
      currentStreak += seg.durationMinutes;
    } else {
      if (currentStreak > 0) {
        sessionLengths.push(currentStreak);
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 0;
      }
    }
  }
  if (currentStreak > 0) {
    sessionLengths.push(currentStreak);
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  const avgSessionLength = sessionLengths.length > 0
    ? Math.round(sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length)
    : 0;

  // 20분+ 집중 블록 수
  const focusBlocks = sessionLengths.filter(l => l >= 20).length;

  // 전환 빈도
  const switchRate = metrics.activeWorkMinutes > 0
    ? (metrics.contextSwitchCount / metrics.activeWorkMinutes).toFixed(1)
    : '0';

  // 작업 스타일 판정
  const { workStyle, workStyleDescription } = classifyWorkStyle(
    metrics.deepFocusMinutes,
    metrics.activeWorkMinutes,
    metrics.contextSwitchCount,
    focusBlocks,
  );

  return {
    peakHour,
    peakProductivity: Math.round(peakProductivity),
    avgSessionLength,
    longestStreak,
    focusBlocks,
    switchFrequency: `분당 ${switchRate}회`,
    workStyle,
    workStyleDescription,
  };
}

function analyzeWorkPatternFromMultiple(
  metricsList: PerformanceMetrics[],
  timeline: ActivitySegment[],
): WorkPattern {
  // 전체 기간 평균을 사용
  const avgMetrics: PerformanceMetrics = {
    ...metricsList[0],
    activeWorkMinutes: metricsList.reduce((s, m) => s + m.activeWorkMinutes, 0) / metricsList.length,
    deepFocusMinutes: metricsList.reduce((s, m) => s + m.deepFocusMinutes, 0) / metricsList.length,
    contextSwitchCount: Math.round(metricsList.reduce((s, m) => s + m.contextSwitchCount, 0) / metricsList.length),
    totalWorkMinutes: metricsList.reduce((s, m) => s + m.totalWorkMinutes, 0) / metricsList.length,
  };
  return analyzeWorkPattern(avgMetrics, timeline);
}

function extractWorkContents(timeline: ActivitySegment[]): WorkContentItem[] {
  return timeline
    .filter(seg => seg.category !== 'idle' && seg.durationMinutes >= 1)
    .map(seg => ({
      timeRange: `${seg.startTime} ~ ${seg.endTime}`,
      app: seg.app,
      category: seg.category,
      categoryLabel: CATEGORY_LABELS[seg.category] || '기타',
      description: seg.description || `${seg.app} 사용`,
      durationMinutes: seg.durationMinutes,
      isDeepFocus: seg.durationMinutes >= 20,
    }))
    .sort((a, b) => b.durationMinutes - a.durationMinutes);
}

function classifyWorkStyle(
  deepFocusMinutes: number,
  activeMinutes: number,
  contextSwitches: number,
  focusBlocks: number,
): { workStyle: string; workStyleDescription: string } {
  const deepFocusRatio = activeMinutes > 0 ? deepFocusMinutes / activeMinutes : 0;
  const switchRate = activeMinutes > 0 ? contextSwitches / activeMinutes : 0;

  if (deepFocusRatio >= 0.4 && switchRate < 0.3) {
    return {
      workStyle: '🧘 딥워커',
      workStyleDescription: '장시간 집중하여 하나의 작업에 몰입하는 스타일입니다. 딥포커스 비율이 높고 컨텍스트 전환이 적어 복잡한 문제 해결에 강점을 보입니다.',
    };
  }

  if (switchRate >= 0.5 && focusBlocks <= 2) {
    return {
      workStyle: '🔀 멀티태스커',
      workStyleDescription: '여러 작업을 빠르게 전환하며 동시에 처리하는 스타일입니다. 다양한 업무를 병렬로 수행하지만, 깊은 집중이 필요한 작업에서는 전략적 시간 확보가 필요합니다.',
    };
  }

  if (deepFocusRatio >= 0.2 && switchRate < 0.5) {
    return {
      workStyle: '⚖️ 밸런서',
      workStyleDescription: '집중 작업과 커뮤니케이션을 균형 있게 배분하는 스타일입니다. 적절한 딥포커스와 협업을 병행하여 안정적인 생산성을 유지합니다.',
    };
  }

  return {
    workStyle: '🚀 스프린터',
    workStyleDescription: '짧은 시간 안에 집중적으로 작업을 완수하는 스타일입니다. 버스트 형태의 높은 생산성을 보이며, 쉬는 시간과 작업 시간의 구분이 명확합니다.',
  };
}

function generateInsights(
  metrics: PerformanceMetrics,
  apps: AppAnalysis[],
  pattern: WorkPattern,
  categories: CategorySummary[],
): string[] {
  const insights: string[] = [];

  // 가장 많이 사용한 앱
  if (apps.length > 0) {
    const top = apps[0];
    insights.push(
      `가장 많이 사용한 앱은 ${top.appName}(${top.categoryLabel})으로 총 ${formatMinutes(top.totalMinutes)}을 사용했습니다.`
    );
  }

  // 생산적 카테고리 비율
  const productiveCats = categories.filter(c => PRODUCTIVE_CATEGORIES.has(c.category));
  const productivePct = productiveCats.reduce((s, c) => s + c.percentage, 0);
  if (productivePct > 0) {
    insights.push(
      `생산적 도구(개발·문서·디자인 등) 사용 비율은 ${productivePct}%입니다.`
    );
  }

  // 피크 시간대
  insights.push(
    `가장 생산적인 시간대는 ${pattern.peakHour}이며, 이 시간에 ${pattern.peakProductivity}분의 생산적 작업을 수행했습니다.`
  );

  // 작업 스타일
  insights.push(
    `작업 스타일: ${pattern.workStyle} — ${pattern.workStyleDescription.split('.')[0]}.`
  );

  // 딥포커스
  if (metrics.deepFocusMinutes > 0) {
    insights.push(
      `총 ${formatMinutes(metrics.deepFocusMinutes)}의 딥포커스(20분+ 무중단 집중)를 달성했으며, ${pattern.focusBlocks}개의 집중 블록이 감지되었습니다.`
    );
  }

  // 커뮤니케이션 비율 경고
  const commCat = categories.find(c => c.category === 'communication');
  if (commCat && commCat.percentage > 30) {
    insights.push(
      `⚠️ 커뮤니케이션 도구 사용이 ${commCat.percentage}%로 높습니다. 집중 시간대에는 알림을 무음 처리하는 것을 권장합니다.`
    );
  }

  return insights;
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  }
  return `${Math.round(minutes)}분`;
}

function emptyAnalysis(): DetailedAnalysis {
  return {
    totalWorkMinutes: 0,
    activeWorkMinutes: 0,
    productiveMinutes: 0,
    productivityRate: 0,
    date: '',
    appAnalyses: [],
    categorySummaries: [],
    hourlyProductivity: [],
    workPattern: {
      peakHour: '-',
      peakProductivity: 0,
      avgSessionLength: 0,
      longestStreak: 0,
      focusBlocks: 0,
      switchFrequency: '0회/분',
      workStyle: '-',
      workStyleDescription: '',
    },
    workContents: [],
    insights: [],
  };
}
