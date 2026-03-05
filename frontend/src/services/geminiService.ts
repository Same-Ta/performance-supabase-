import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

/**
 * 일일 업무 메트릭을 기반으로 AI 요약을 생성한다.
 */
export async function generateDailySummary(metricsData: {
  activeMinutes: number;
  focusScore: number;
  efficiencyScore: number;
  goalAlignment: number;
  topApps: string[];
  contextSwitches: number;
  deepFocusMinutes: number;
  keyActivities: string[];
}): Promise<{
  summary: string;
  achievements: string[];
  improvements: string[];
}> {
  const prompt = `당신은 HR-Tech AI 어시스턴트입니다. 아래 업무 데이터를 분석해서 한국어로 일일 업무 요약을 작성해주세요.

데이터:
- 활성 업무 시간: ${metricsData.activeMinutes}분
- 몰입도: ${metricsData.focusScore}/100
- 효율성: ${metricsData.efficiencyScore}/100
- 목표 정렬도: ${metricsData.goalAlignment}%
- 주요 사용 소프트웨어: ${metricsData.topApps.join(', ')}
- 컨텍스트 전환: ${metricsData.contextSwitches}회
- 딥 포커스 시간: ${metricsData.deepFocusMinutes}분
- 주요 활동: ${metricsData.keyActivities.join(', ')}

다음 JSON 형식으로 응답해주세요:
{
  "summary": "2-3문장의 일일 업무 요약",
  "achievements": ["성과 1", "성과 2", "성과 3"],
  "improvements": ["개선점 1", "개선점 2"]
}

주의: JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 응답하세요.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      summary: `오늘 ${(metricsData.activeMinutes / 60).toFixed(1)}시간 업무를 수행했으며, 몰입도 ${metricsData.focusScore}점, 효율성 ${metricsData.efficiencyScore}점을 기록했습니다.`,
      achievements: ['업무 분석이 완료되었습니다.'],
      improvements: ['AI 분석 서비스 연결을 확인해주세요.'],
    };
  }
}

/**
 * 기간별 성과 리포트의 종합 평가를 생성한다.
 */
export async function generatePerformanceReview(data: {
  userName: string;
  period: string;
  avgFocus: number;
  avgEfficiency: number;
  avgGoalAlignment: number;
  totalActiveHours: number;
  totalDeepFocusHours: number;
  topStrengths: string[];
  weeklyTrends: string;
}): Promise<{
  executiveSummary: string;
  strengths: string[];
  areasForGrowth: string[];
  salaryNegotiationPoints: string[];
}> {
  const prompt = `당신은 전문 HR 컨설턴트이자 AI 성과 분석가입니다.
아래 ${data.userName}님의 ${data.period} 성과 데이터를 기반으로 종합 성과 평가를 작성해주세요.

직원 데이터:
- 평균 몰입도: ${data.avgFocus}/100
- 평균 효율성: ${data.avgEfficiency}/100
- 평균 목표 정렬도: ${data.avgGoalAlignment}%
- 총 활성 업무 시간: ${data.totalActiveHours}시간
- 총 딥 포커스 시간: ${data.totalDeepFocusHours}시간
- 기존 강점: ${data.topStrengths.join(', ')}
- 주간 추이: ${data.weeklyTrends}

다음 JSON 형식으로 응답해주세요:
{
  "executiveSummary": "5-7문장의 전문적인 종합 평가 (구체적인 수치로 뒷받침)",
  "strengths": ["구체적 데이터를 포함한 강점 1", "강점 2", "강점 3"],
  "areasForGrowth": ["개선 영역 1", "개선 영역 2"],
  "salaryNegotiationPoints": [
    "연봉 협상 시 활용 가능한 데이터 기반 포인트 1",
    "포인트 2",
    "포인트 3",
    "포인트 4"
  ]
}

중요: 연봉 협상 포인트는 구체적인 수치와 업계 벤치마크 비교를 포함해주세요.
JSON만 반환하세요.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      executiveSummary: `${data.userName}님은 해당 기간 동안 평균 몰입도 ${data.avgFocus}점, 효율성 ${data.avgEfficiency}점을 기록했습니다.`,
      strengths: ['데이터 분석 중 오류가 발생했습니다.'],
      areasForGrowth: ['AI 서비스 연결을 확인해주세요.'],
      salaryNegotiationPoints: ['상세 분석을 위해 재시도해주세요.'],
    };
  }
}

/**
 * 조직 병목 현상을 분석한다.
 */
export async function analyzeTeamBottlenecks(teamData: {
  teamName: string;
  memberCount: number;
  avgFocus: number;
  avgEfficiency: number;
  highContextSwitchUsers: number;
  lowAlignmentUsers: number;
  overworkUsers: number;
}): Promise<{
  bottlenecks: Array<{
    type: string;
    severity: string;
    message: string;
    suggestion: string;
    affectedUsers: number;
  }>;
}> {
  const prompt = `당신은 조직 효율성 컨설턴트입니다. 아래 팀 데이터를 분석하여 병목 현상을 진단해주세요.

팀 데이터:
- 팀명: ${teamData.teamName}
- 인원: ${teamData.memberCount}명
- 평균 몰입도: ${teamData.avgFocus}
- 평균 효율성: ${teamData.avgEfficiency}
- 높은 컨텍스트 전환 인원: ${teamData.highContextSwitchUsers}명
- 낮은 목표 정렬 인원: ${teamData.lowAlignmentUsers}명
- 과로 의심 인원: ${teamData.overworkUsers}명

JSON 형식으로 병목 분석 결과를 응답해주세요:
{
  "bottlenecks": [
    {
      "type": "low_focus|high_context_switch|low_alignment|overwork|underutilized",
      "severity": "critical|warning|info",
      "message": "구체적 문제 설명",
      "suggestion": "구체적 해결 방안",
      "affectedUsers": 숫자
    }
  ]
}

JSON만 반환하세요.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Gemini API error:', error);
    return { bottlenecks: [] };
  }
}
