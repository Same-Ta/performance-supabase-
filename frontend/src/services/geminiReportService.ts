/**
 * ProofWork — Gemini AI 기반 상세 업무 리포트 생성기
 *
 * 실제 앱 사용 데이터와 작업 내용을 Gemini에 전달하여
 * 구체적이고 실무적인 상세 리포트를 생성합니다.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { DetailedAnalysis } from './workAnalysisService';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

// ─── 출력 타입 ──────────────────────────────────────────────

export interface AIDetailedReport {
  /** 3-5문장의 구체적 업무 내용 요약 (앱·작업 기반) */
  workNarrative: string;

  /** 앱별 실질 작업 분석 (무엇을 했는지 추론) */
  appWorkAnalysis: AppWorkInsight[];

  /** 시간대별 업무 흐름 서술 */
  timeflowNarrative: string;

  /** 생산성 심층 분석 */
  productivityAnalysis: {
    strengths: string[];
    weaknesses: string[];
    comparison: string;       // 일반적 개발자 대비 비교
  };

  /** 구체적·실행 가능한 개선 제안 */
  actionableRecommendations: ActionableRecommendation[];

  /** 연봉 협상/성과 어필용 데이터 포인트 */
  performanceHighlights: string[];
}

export interface AppWorkInsight {
  appName: string;
  workDescription: string;    // "VS Code에서 프론트엔드 컴포넌트 개발"
  estimatedOutput: string;    // "약 3-4개 파일 수정 추정"
  productivityNote: string;   // "집중도 높은 개발 세션"
}

export interface ActionableRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
}

// ─── 리포트 생성 ────────────────────────────────────────────

export async function generateDetailedReport(
  analysis: DetailedAnalysis,
  userName: string,
): Promise<AIDetailedReport> {
  // 앱 사용 데이터 문자열화
  const appDataStr = analysis.appAnalyses
    .slice(0, 10)
    .map(a => `- ${a.appName} (${a.categoryLabel}): ${a.totalMinutes}분, ${a.percentage}%, ${a.sessions}세션, 최장 ${a.longestSessionMinutes}분`)
    .join('\n');

  // 카테고리 데이터
  const catDataStr = analysis.categorySummaries
    .map(c => `- ${c.label}: ${c.totalMinutes}분 (${c.percentage}%), 주요 앱: ${c.topApp}`)
    .join('\n');

  // 타임라인 작업 내용 (상위 10개)
  const workContentStr = analysis.workContents
    .slice(0, 10)
    .map(w => `- [${w.timeRange}] ${w.app}: ${w.description} (${w.durationMinutes}분${w.isDeepFocus ? ', 딥포커스' : ''})`)
    .join('\n');

  // 시간대별 생산성
  const hourlyStr = analysis.hourlyProductivity
    .map(h => `- ${h.label}: 활성 ${h.activeMinutes}분, 생산적 ${h.productiveMinutes}분 (${h.dominantCategoryLabel})`)
    .join('\n');

  const prompt = `당신은 데이터 기반 업무 분석 전문가입니다. 아래 ${userName}님의 실제 업무 활동 데이터를 분석하여 상세한 업무 리포트를 작성해주세요.

## 기본 데이터
- 분석 기간: ${analysis.date}
- 총 업무 시간: ${analysis.totalWorkMinutes}분 (${(analysis.totalWorkMinutes / 60).toFixed(1)}시간)
- 활성 업무 시간: ${analysis.activeWorkMinutes}분
- 생산적 도구 사용: ${analysis.productiveMinutes}분 (${analysis.productivityRate}%)
- 작업 스타일: ${analysis.workPattern.workStyle}
- 피크 생산 시간대: ${analysis.workPattern.peakHour}
- 최장 연속 작업: ${analysis.workPattern.longestStreak}분
- 딥포커스 블록: ${analysis.workPattern.focusBlocks}개
- 컨텍스트 전환: ${analysis.workPattern.switchFrequency}

## 앱별 사용 내역
${appDataStr || '(데이터 없음)'}

## 카테고리별 요약
${catDataStr || '(데이터 없음)'}

## 구체적 작업 내용 (타임라인)
${workContentStr || '(타임라인 데이터 없음)'}

## 시간대별 생산성
${hourlyStr || '(데이터 없음)'}

다음 JSON 형식으로 응답해주세요. 반드시 실제 앱 이름과 데이터 수치를 활용하여 구체적으로 작성하세요:
{
  "workNarrative": "앱 사용 데이터와 타임라인을 기반으로 실제로 무슨 업무를 했는지 3-5문장으로 구체적 서술. 앱 이름, 시간, 작업 내용 포함.",
  "appWorkAnalysis": [
    {
      "appName": "실제 앱 이름",
      "workDescription": "해당 앱에서 수행한 구체적 작업 설명",
      "estimatedOutput": "추정 산출물 (파일 수정, 문서 작성 등)",
      "productivityNote": "생산성 관련 코멘트"
    }
  ],
  "timeflowNarrative": "시간 흐름에 따른 업무 진행 서술 (오전→오후 흐름). 시간대와 활동 내용 포함.",
  "productivityAnalysis": {
    "strengths": ["데이터 기반 강점 1", "강점 2", "강점 3"],
    "weaknesses": ["개선 필요 사항 1", "개선 사항 2"],
    "comparison": "일반적인 개발자/직장인 대비 비교 분석 (구체적 수치 활용)"
  },
  "actionableRecommendations": [
    {
      "title": "제안 제목",
      "description": "구체적 실행 방안",
      "priority": "high|medium|low",
      "expectedImpact": "예상 효과"
    }
  ],
  "performanceHighlights": [
    "연봉 협상/성과 어필에 활용할 수 있는 구체적 데이터 포인트 1",
    "데이터 포인트 2",
    "데이터 포인트 3"
  ]
}

중요 규칙:
1. 실제 앱 이름과 수치를 반드시 포함하세요.
2. 추상적 표현 대신 구체적인 데이터를 인용하세요.
3. appWorkAnalysis는 사용된 앱 수만큼 (최대 5개) 작성하세요.
4. JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 응답하세요.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as AIDetailedReport;
  } catch (error) {
    console.error('Gemini detailed report error:', error);
    return buildFallbackReport(analysis, userName);
  }
}

// ─── Fallback (AI 실패 시) ──────────────────────────────────

function buildFallbackReport(
  analysis: DetailedAnalysis,
  userName: string,
): AIDetailedReport {
  const topApps = analysis.appAnalyses.slice(0, 3);
  const topAppsStr = topApps.map(a => `${a.appName}(${a.totalMinutes}분)`).join(', ');

  return {
    workNarrative: `${userName}님은 총 ${(analysis.totalWorkMinutes / 60).toFixed(1)}시간 동안 업무를 수행했습니다. `
      + `활성 작업 시간은 ${(analysis.activeWorkMinutes / 60).toFixed(1)}시간이며, `
      + `주로 ${topAppsStr}을(를) 사용했습니다. `
      + `생산적 도구 사용 비율은 ${analysis.productivityRate}%입니다.`,

    appWorkAnalysis: topApps.map(a => ({
      appName: a.appName,
      workDescription: `${a.categoryLabel} 카테고리에서 ${a.totalMinutes}분간 ${a.sessions}세션 작업`,
      estimatedOutput: `${a.sessions}건의 작업 세션 수행`,
      productivityNote: a.isProductive ? '생산적 활동' : '지원 활동',
    })),

    timeflowNarrative: analysis.hourlyProductivity.length > 0
      ? `가장 활발한 시간대는 ${analysis.workPattern.peakHour}이며, ` +
        `이 시간에 ${analysis.workPattern.peakProductivity}분의 생산적 작업을 수행했습니다.`
      : '시간대별 상세 데이터가 부족합니다.',

    productivityAnalysis: {
      strengths: analysis.insights.filter(i => !i.startsWith('⚠️')).slice(0, 3),
      weaknesses: analysis.insights.filter(i => i.startsWith('⚠️')).map(i => i.replace('⚠️ ', '')),
      comparison: `생산적 도구 사용 비율 ${analysis.productivityRate}%로, 업무 시간의 상당 부분을 직접적인 업무에 할애했습니다.`,
    },

    actionableRecommendations: [
      {
        title: '딥포커스 시간 확보',
        description: `현재 ${analysis.workPattern.focusBlocks}개의 집중 블록이 감지되었습니다. 오전 집중 시간대를 확보하세요.`,
        priority: 'medium',
        expectedImpact: '딥포커스 20% 향상 기대',
      },
    ],

    performanceHighlights: [
      `일 평균 ${(analysis.activeWorkMinutes / 60).toFixed(1)}시간 활성 업무 수행`,
      `생산적 도구 활용률 ${analysis.productivityRate}%`,
      `${analysis.workPattern.workStyle} 스타일의 안정적 업무 패턴`,
    ],
  };
}
