/**
 * 개발/테스트용 시드 데이터 생성기
 * Firestore에 샘플 성과 데이터를 직접 심어줍니다.
 * Settings 페이지에서만 호출할 것.
 */
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { PerformanceMetrics, DataReviewItem } from '../types';

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function rand(min: number, max: number) {
  return Math.round(Math.random() * (max - min) + min);
}

function makeMetrics(userId: string, daysAgo: number): PerformanceMetrics {
  const date = dateStr(daysAgo);
  const id = `${userId}-${date}`;
  const focus = rand(62, 92);
  const efficiency = rand(58, 88);
  const goal = rand(65, 95);
  const deep = rand(70, 160);
  const active = rand(280, 420);

  return {
    id,
    userId,
    date,
    sessionId: `session-${id}`,
    status: 'submitted',
    totalWorkMinutes: active + rand(20, 60),
    activeWorkMinutes: active,
    focusScore: focus,
    efficiencyScore: efficiency,
    goalAlignmentScore: goal,
    outputScore: Math.round((focus * 0.35 + efficiency * 0.35 + goal * 0.3)),
    contextSwitchCount: rand(8, 28),
    contextSwitchRate: parseFloat((rand(15, 45) / 60).toFixed(2)),
    inputDensity: rand(22, 55),
    deepFocusMinutes: deep,
    softwareUsage: [
      { category: 'development', appName: 'VS Code', minutes: rand(90, 180), percentage: rand(30, 45) },
      { category: 'communication', appName: 'Slack', minutes: rand(30, 60), percentage: rand(10, 20) },
      { category: 'research', appName: 'Chrome', minutes: rand(40, 80), percentage: rand(12, 22) },
      { category: 'documentation', appName: 'Notion', minutes: rand(20, 50), percentage: rand(8, 15) },
      { category: 'project_mgmt', appName: 'Jira', minutes: rand(10, 30), percentage: rand(4, 10) },
    ],
    aiSummary: `${date} 세션: 집중도 ${focus}점의 업무 세션입니다. 딥포커스 ${Math.round(deep / 60 * 10) / 10}시간을 기록했고 코딩 작업 비중이 가장 높았습니다.`,
    keyAchievements: [
      '주요 기능 구현 완료',
      `딥포커스 ${Math.round(deep / 60 * 10) / 10}시간 달성`,
      '코드 리뷰 2건 완료',
    ],
    suggestedImprovements: [
      '오후 이후 컨텍스트 전환 빈도가 증가했습니다.',
      '커뮤니케이션 도구 사용 시간 분산을 고려해보세요.',
    ],
    createdAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
  };
}

function makeReview(metrics: PerformanceMetrics): DataReviewItem {
  return {
    id: `review-${metrics.id}`,
    metricsId: metrics.id,
    userId: metrics.userId,
    date: metrics.date,
    metrics,
    decision: 'pending',
  };
}

export async function seedTestData(userId: string): Promise<{ metrics: number; reviews: number }> {
  const days = [0, 1, 2, 3, 4, 5, 6];
  const metricsList = days.map((d) => makeMetrics(userId, d));

  // 최근 3일은 검토 대기 상태로 review 생성
  const reviewDays = [0, 1, 2];
  const reviewList = reviewDays.map((d) => makeReview(metricsList[d]));

  await Promise.all([
    ...metricsList.map((m) =>
      setDoc(doc(db, 'performance_metrics', m.id), m)
    ),
    ...reviewList.map((r) =>
      setDoc(doc(db, 'data_reviews', r.id), r)
    ),
  ]);

  return { metrics: metricsList.length, reviews: reviewList.length };
}
