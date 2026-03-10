/**
 * Notion 연동 서비스
 * Supabase Edge Function의 notion-proxy를 통해 Notion API를 호출합니다.
 */

import { supabase, EDGE_FUNCTIONS_URL } from '../config/supabase';
import type { NotionSettings, NotionTask } from '../types';

async function callNotionProxy(data: Record<string, unknown>): Promise<any> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('로그인이 필요합니다.');
  }

  const response = await fetch(`${EDGE_FUNCTIONS_URL}/notion-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || '요청 실패');
  }

  return response.json();
}

export async function testNotionConnection(
  apiKey: string,
  databaseId: string
): Promise<{ ok: boolean; message: string }> {
  const result = await callNotionProxy({ action: 'testConnection', apiKey, databaseId });
  return { ok: result.ok ?? false, message: result.message ?? '' };
}

/**
 * Notion 데이터베이스에서 "진행 중" 상태인 태스크를 가져옵니다.
 * @param settings Notion 연동 설정
 * @param userName 필터링할 사용자 이름 (지정 시 담당자 기준 필터)
 */
export async function fetchDoingTasks(
  settings: NotionSettings,
  userName?: string
): Promise<{ tasks: NotionTask[]; hint?: string }> {
  const result = await callNotionProxy({
    action: 'getDoingTasks',
    apiKey: settings.apiKey,
    databaseId: settings.databaseId,
    statusProperty: settings.statusProperty,
    doingValue: settings.doingValue,
    progressProperty: settings.progressProperty,
    assigneeProperty: settings.assigneeProperty,
    userName,
  });
  return { tasks: result.tasks ?? [], hint: result.hint };
}

/**
 * Notion 태스크의 달성률과 상태를 업데이트합니다.
 * @param settings Notion 연동 설정
 * @param pageId   업데이트할 Notion 페이지 ID
 * @param progress 달성률 (0-100)
 * @param isDone   완료 여부 (true면 Status를 doneValue로 변경)
 */
export async function updateTaskProgress(
  settings: NotionSettings,
  pageId: string,
  progress: number,
  isDone: boolean
): Promise<void> {
  await callNotionProxy({
    action: 'updateTask',
    apiKey: settings.apiKey,
    pageId,
    statusProperty: settings.statusProperty,
    doneValue: settings.doneValue,
    progressProperty: settings.progressProperty,
    progress,
    isDone,
  });
}

/**
 * Gemini AI를 이용해 태스크 달성 여부를 분석합니다.
 * @param task        Notion 태스크
 * @param aiReport    AI 성과 리포트 텍스트 (aiSummary, keyAchievements 등)
 * @param geminiApiKey Gemini API 키
 */
export async function analyzeTaskWithAI(
  task: NotionTask,
  aiReport: { aiSummary: string; keyAchievements: string[]; timeline?: string },
  geminiApiKey: string
): Promise<{ estimatedProgress: number; isDone: boolean; reason: string }> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `
당신은 업무 성과 분석 전문가입니다.
아래 오늘의 AI 성과 리포트를 바탕으로, Notion 태스크의 달성 여부와 달성률을 판단해주세요.

## Notion 태스크
- 태스크명: ${task.title}
- 현재 상태: ${task.status}
- 현재 달성률: ${task.progress !== undefined ? task.progress + '%' : '미기록'}

## 오늘의 AI 성과 리포트
- AI 요약: ${aiReport.aiSummary}
- 주요 성과: ${aiReport.keyAchievements.join(', ')}
${aiReport.timeline ? `- 활동 타임라인: ${aiReport.timeline}` : ''}

## 판단 기준
1. 태스크명의 키워드가 오늘 업무에 등장했는지 확인하세요.
2. 업무 내용이 해당 태스크와 관련이 있는지 판단하세요.
3. 완료(isDone: true)는 태스크가 명확하게 완료된 경우에만 판단하세요.
4. estimatedProgress는 0-100 사이의 정수로, 오늘 해당 태스크에 기여한 작업량 비율을 나타냅니다.

## 응답 형식 (반드시 JSON으로만 응답)
{
  "estimatedProgress": 숫자(0-100),
  "isDone": true/false,
  "reason": "판단 근거를 2-3문장으로 한국어로 설명"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      estimatedProgress: 0,
      isDone: false,
      reason: 'AI 분석 중 오류가 발생했습니다. 수동으로 입력해주세요.',
    };
  }
}
