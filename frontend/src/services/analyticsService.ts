/**
 * 성과 분석 로직 (프론트엔드용 유틸리티)
 *
 * 핵심 공식:
 *
 * 1) 몰입도(Focus Score) = w1·(1 - CSR/CSR_max) + w2·(DFR) + w3·(ID/ID_max)
 *    - CSR: Context Switch Rate (분당 전환 횟수)
 *    - DFR: Deep Focus Ratio = DeepFocusMinutes / ActiveMinutes
 *    - ID: Input Density (분당 키보드/마우스 이벤트)
 *
 * 2) 효율성(Efficiency) = OutputScore × (ActiveMinutes / TotalMinutes) × GoalAlignmentBonus
 *
 * 3) 목표 정렬도(Goal Alignment) = Σ(GoalWeight_i × MatchScore_i) / Σ(GoalWeight_i)
 */

import type { PerformanceMetrics, DailyTrend, GoalAlignmentDetail } from '../types';

// ─── 가중치 상수 ──────────────────────────────────────────
const FOCUS_WEIGHTS = {
  contextSwitch: 0.35,
  deepFocus: 0.40,
  inputDensity: 0.25,
};

const FOCUS_THRESHOLDS = {
  maxContextSwitchRate: 3.0,  // 분당 3회 이상이면 최저점
  maxInputDensity: 120,       // 분당 120 actions가 최대치
};

// ─── 종합 점수 계산 ───────────────────────────────────────
export function calculateOverallScore(metrics: PerformanceMetrics): number {
  const { focusScore, efficiencyScore, goalAlignmentScore, outputScore } = metrics;

  // 가중 평균 (성과 30%, 효율 25%, 몰입 25%, 목표정렬 20%)
  const overall =
    outputScore * 0.30 +
    efficiencyScore * 0.25 +
    focusScore * 0.25 +
    goalAlignmentScore * 0.20;

  return Math.round(Math.min(100, Math.max(0, overall)));
}

// ─── 등급 산출 ────────────────────────────────────────────
export function scoreToGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

// ─── 몰입도 점수 계산 ─────────────────────────────────────
export function calculateFocusScore(
  contextSwitchRate: number,
  deepFocusMinutes: number,
  activeMinutes: number,
  inputDensity: number
): number {
  if (activeMinutes === 0) return 0;

  const csrComponent =
    FOCUS_WEIGHTS.contextSwitch *
    (1 - Math.min(contextSwitchRate / FOCUS_THRESHOLDS.maxContextSwitchRate, 1));

  const dfrComponent =
    FOCUS_WEIGHTS.deepFocus * (deepFocusMinutes / activeMinutes);

  const idComponent =
    FOCUS_WEIGHTS.inputDensity *
    Math.min(inputDensity / FOCUS_THRESHOLDS.maxInputDensity, 1);

  const raw = (csrComponent + dfrComponent + idComponent) * 100;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

// ─── 효율성 점수 계산 ─────────────────────────────────────
export function calculateEfficiencyScore(
  outputScore: number,
  activeMinutes: number,
  totalMinutes: number,
  goalAlignmentScore: number
): number {
  if (totalMinutes === 0) return 0;

  const activeRatio = activeMinutes / totalMinutes;
  const alignmentBonus = 1 + (goalAlignmentScore - 50) / 200; // 50% 기준으로 보너스/패널티

  const raw = outputScore * activeRatio * alignmentBonus;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

// ─── 목표 정렬도 계산 ─────────────────────────────────────
export function calculateGoalAlignment(
  alignments: GoalAlignmentDetail[]
): number {
  if (alignments.length === 0) return 0;

  // 단순 평균 (실제로는 가중 평균, 여기서는 GoalDefinition weight를 외부에서 적용)
  const sum = alignments.reduce((acc, a) => acc + a.alignmentPercentage, 0);
  return Math.round(sum / alignments.length);
}

// ─── 메트릭 배열 → 트렌드 변환 ───────────────────────────
export function metricsToTrends(metrics: PerformanceMetrics[]): DailyTrend[] {
  return metrics
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({
      date: m.date,
      focusScore: m.focusScore,
      efficiencyScore: m.efficiencyScore,
      goalAlignment: m.goalAlignmentScore,
      activeMinutes: m.activeWorkMinutes,
    }));
}

// ─── 주간/월간 평균 산출 ──────────────────────────────────
export function calculatePeriodAverages(metrics: PerformanceMetrics[]) {
  if (metrics.length === 0) {
    return {
      avgFocus: 0,
      avgEfficiency: 0,
      avgGoalAlignment: 0,
      totalActiveHours: 0,
      totalDeepFocusHours: 0,
      avgOutputScore: 0,
    };
  }

  const count = metrics.length;
  return {
    avgFocus: Math.round(metrics.reduce((s, m) => s + m.focusScore, 0) / count),
    avgEfficiency: Math.round(metrics.reduce((s, m) => s + m.efficiencyScore, 0) / count),
    avgGoalAlignment: Math.round(metrics.reduce((s, m) => s + m.goalAlignmentScore, 0) / count),
    totalActiveHours: parseFloat(
      (metrics.reduce((s, m) => s + m.activeWorkMinutes, 0) / 60).toFixed(1)
    ),
    totalDeepFocusHours: parseFloat(
      (metrics.reduce((s, m) => s + m.deepFocusMinutes, 0) / 60).toFixed(1)
    ),
    avgOutputScore: Math.round(metrics.reduce((s, m) => s + m.outputScore, 0) / count),
  };
}

// ─── 전일 대비 변화율 ─────────────────────────────────────
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── 보상 티어 결정 ───────────────────────────────────────
export const REWARD_TIERS = [
  {
    id: 'explorer',
    name: '탐험가',
    minScore: 0,
    maxScore: 59,
    benefits: ['기본 근무 체계'],
    color: '#adb5bd',
    icon: '🌱',
  },
  {
    id: 'achiever',
    name: '성취자',
    minScore: 60,
    maxScore: 74,
    benefits: ['유연 출근(±1시간)', '월 1회 재택근무'],
    color: '#40c057',
    icon: '⭐',
  },
  {
    id: 'specialist',
    name: '전문가',
    minScore: 75,
    maxScore: 84,
    benefits: ['유연 출근(±2시간)', '주 2회 재택', '교육비 지원 50%'],
    color: '#5c7cfa',
    icon: '💎',
  },
  {
    id: 'master',
    name: '마스터',
    minScore: 85,
    maxScore: 94,
    benefits: ['완전 유연 출근', '주 3회 재택', '교육비 전액 지원', '성과급 보너스 풀 참여'],
    color: '#7950f2',
    icon: '🏆',
  },
  {
    id: 'legend',
    name: '레전드',
    minScore: 95,
    maxScore: 100,
    benefits: ['완전 자율 근무', '무제한 재택', '스톡옵션 우선권', '멘토링 보너스', '특별 안식일'],
    color: '#e64980',
    icon: '👑',
  },
];

export function getRewardTier(score: number) {
  return REWARD_TIERS.find((t) => score >= t.minScore && score <= t.maxScore) || REWARD_TIERS[0];
}
