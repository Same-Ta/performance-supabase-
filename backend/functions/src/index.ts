/**
 * ProofWork - Firebase Cloud Functions
 *
 * 핵심 서버사이드 로직:
 * 1. 성과 데이터 제출(submit) 시 팀 대시보드 자동 집계
 * 2. 보상 티어 자동 산출 및 업데이트
 * 3. Jira/Slack 연동 웹훅
 * 4. 정기 리포트 생성 트리거
 */

import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

// ─── 보상 티어 정의 ──────────────────────────────────────
const REWARD_TIERS = [
  { id: "explorer", name: "탐험가", minScore: 0, maxScore: 59 },
  { id: "achiever", name: "성취자", minScore: 60, maxScore: 74 },
  { id: "specialist", name: "전문가", minScore: 75, maxScore: 84 },
  { id: "master", name: "마스터", minScore: 85, maxScore: 94 },
  { id: "legend", name: "레전드", minScore: 95, maxScore: 100 },
];

function getRewardTierId(score: number): string {
  const tier = REWARD_TIERS.find((t) => score >= t.minScore && score <= t.maxScore);
  return tier ? tier.id : "explorer";
}

// ============================================================
// 1. 성과 메트릭 제출 시 → 보상 + 팀 집계 업데이트
// ============================================================
export const onPerformanceSubmit = onDocumentWritten(
  "performance_metrics/{metricId}",
  async (event) => {
    const after = event.data?.after?.data();
    if (!after || after.status !== "submitted") return;

    const userId = after.userId as string;
    const date = after.date as string;

    // (a) 활동 로그 기록
    await db.collection("activity_logs").add({
      userId,
      action: "metrics_submitted",
      details: `${date} 일자 성과 데이터 제출됨`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // (b) 최근 30일 평균 계산 → 보상 티어 업데이트
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

    const recentMetrics = await db
      .collection("performance_metrics")
      .where("userId", "==", userId)
      .where("status", "==", "submitted")
      .where("date", ">=", dateStr)
      .get();

    if (!recentMetrics.empty) {
      let totalScore = 0;
      let count = 0;
      let streakDays = 0;

      const docs = recentMetrics.docs.map((d) => d.data());
      docs.sort((a, b) => (b.date as string).localeCompare(a.date as string));

      for (const doc of docs) {
        const score =
          (doc.outputScore as number) * 0.3 +
          (doc.efficiencyScore as number) * 0.25 +
          (doc.focusScore as number) * 0.25 +
          (doc.goalAlignmentScore as number) * 0.2;
        totalScore += score;
        count++;
      }

      // 연속 일수 계산
      const today = new Date();
      for (let i = 0; i < docs.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const expectedStr = expected.toISOString().split("T")[0];
        if (docs[i].date === expectedStr) {
          streakDays++;
        } else {
          break;
        }
      }

      const avgScore = Math.round(totalScore / count);
      const tierId = getRewardTierId(avgScore);
      const tier = REWARD_TIERS.find((t) => t.id === tierId)!;
      const nextTier = REWARD_TIERS.find((t) => t.minScore > tier.maxScore);

      await db.doc(`rewards/${userId}`).set(
        {
          userId,
          currentTier: tierId,
          currentScore: avgScore,
          streakDays,
          unlockedBenefits: [], // frontend에서 tier별로 매핑
          nextTierProgress: nextTier
            ? Math.round(((avgScore - tier.minScore) / (nextTier.minScore - tier.minScore)) * 100)
            : 100,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // (c) 알림 생성
    await db.collection("notifications").add({
      userId,
      type: "review_ready",
      title: "성과 데이터 제출 완료",
      message: `${date} 일자 성과 데이터가 성공적으로 제출되었습니다.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

// ============================================================
// 2. 매일 자정에 팀 대시보드 집계 (Asia/Seoul)
// ============================================================
export const aggregateTeamDashboard = onSchedule(
  {
    schedule: "every day 00:30",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    // 모든 팀 조회
    const usersSnap = await db.collection("users").get();
    const teamMap: Record<string, { teamName: string; members: string[] }> = {};

    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      const teamId = data.teamId as string;
      if (!teamId) return;
      if (!teamMap[teamId]) {
        teamMap[teamId] = { teamName: data.department || teamId, members: [] };
      }
      teamMap[teamId].members.push(doc.id);
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    for (const [teamId, team] of Object.entries(teamMap)) {
      let totalFocus = 0;
      let totalEff = 0;
      let totalAlign = 0;
      let count = 0;

      for (const memberId of team.members) {
        const metricSnap = await db
          .collection("performance_metrics")
          .where("userId", "==", memberId)
          .where("date", "==", yesterdayStr)
          .where("status", "==", "submitted")
          .limit(1)
          .get();

        if (!metricSnap.empty) {
          const m = metricSnap.docs[0].data();
          totalFocus += m.focusScore as number;
          totalEff += m.efficiencyScore as number;
          totalAlign += m.goalAlignmentScore as number;
          count++;
        }
      }

      if (count > 0) {
        await db.doc(`team_dashboards/${teamId}`).set(
          {
            teamId,
            teamName: team.teamName,
            memberCount: team.members.length,
            avgFocusScore: Math.round(totalFocus / count),
            avgEfficiency: Math.round(totalEff / count),
            avgGoalAlignment: Math.round(totalAlign / count),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    console.log(`Team dashboard aggregation completed for ${Object.keys(teamMap).length} teams`);
  }
);

// ============================================================
// 3. Jira 연동 웹훅 (On-Demand)
// ============================================================
export const syncJira = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { userId, metricId, jiraProjectKey } = req.body;

    if (!userId || !metricId) {
      res.status(400).json({ error: "userId and metricId are required" });
      return;
    }

    // 메트릭 조회
    const metricDoc = await db.doc(`performance_metrics/${metricId}`).get();
    if (!metricDoc.exists) {
      res.status(404).json({ error: "Metric not found" });
      return;
    }

    const metric = metricDoc.data()!;

    // 연동 설정 조회
    const integSnap = await db
      .collection("integrations")
      .where("type", "==", "jira")
      .where("enabled", "==", true)
      .limit(1)
      .get();

    if (integSnap.empty) {
      res.status(400).json({ error: "Jira integration not configured" });
      return;
    }

    const integConfig = integSnap.docs[0].data();

    // Jira API 호출 준비 (실제 구현 시 axios 사용)
    const jiraPayload = {
      project: jiraProjectKey || "PERF",
      summary: `[ProofWork] ${metric.date} 일일 성과 데이터`,
      description: `
        *몰입도*: ${metric.focusScore}/100
        *효율성*: ${metric.efficiencyScore}/100
        *목표 정렬도*: ${metric.goalAlignmentScore}%
        *활성 시간*: ${Math.round((metric.activeWorkMinutes as number) / 60)}시간
        *딥 포커스*: ${metric.deepFocusMinutes}분
        
        *AI 요약*: ${metric.aiSummary}
      `,
      issueType: "Task",
      webhookUrl: integConfig.webhookUrl,
    };

    // 활동 로그
    await db.collection("activity_logs").add({
      userId,
      action: "jira_sync",
      details: `${metric.date} 데이터 Jira 동기화 요청`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: "Jira sync payload prepared",
      payload: jiraPayload,
    });
  }
);

// ============================================================
// 4. Slack 알림 웹훅
// ============================================================
export const sendSlackNotification = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { userId, metricId } = req.body;

    const metricDoc = await db.doc(`performance_metrics/${metricId}`).get();
    if (!metricDoc.exists) {
      res.status(404).json({ error: "Metric not found" });
      return;
    }

    const metric = metricDoc.data()!;
    const userDoc = await db.doc(`users/${userId}`).get();
    const userName = userDoc.exists ? userDoc.data()!.displayName : "Unknown";

    // Slack 메시지 포맷
    const slackMessage = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📊 ${userName}님의 일일 성과 요약 (${metric.date})`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*🧠 몰입도:* ${metric.focusScore}/100` },
            { type: "mrkdwn", text: `*⚡ 효율성:* ${metric.efficiencyScore}/100` },
            { type: "mrkdwn", text: `*🎯 목표 정렬:* ${metric.goalAlignmentScore}%` },
            { type: "mrkdwn", text: `*⏱ 활성 시간:* ${Math.round((metric.activeWorkMinutes as number) / 60)}h` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*AI 요약:* ${metric.aiSummary}`,
          },
        },
      ],
    };

    res.json({
      success: true,
      message: "Slack notification prepared",
      payload: slackMessage,
    });
  }
);

// ============================================================
// 5. KPI/OKR 자동 매핑 엔드포인트
// ============================================================
export const mapMetricsToGoals = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { organizationId, metricId } = req.body;

    // 활성 목표 조회
    const goalsSnap = await db
      .collection("goals")
      .where("organizationId", "==", organizationId)
      .where("status", "==", "active")
      .get();

    if (goalsSnap.empty) {
      res.json({ alignments: [] });
      return;
    }

    const metricDoc = await db.doc(`performance_metrics/${metricId}`).get();
    if (!metricDoc.exists) {
      res.status(404).json({ error: "Metric not found" });
      return;
    }

    const metric = metricDoc.data()!;
    const softwareUsage = (metric.softwareUsage || []) as Array<{
      category: string;
      appName: string;
      minutes: number;
    }>;

    // 각 목표에 대한 정렬도 계산 (키워드 + 앱 매칭)
    const alignments = goalsSnap.docs.map((goalDoc) => {
      const goal = goalDoc.data();
      const keywords = (goal.keywords || []) as string[];
      const relatedApps = (goal.relatedApps || []) as string[];

      // 관련 앱 사용 시간 비율로 정렬도 추정
      const totalMinutes = softwareUsage.reduce((s, sw) => s + sw.minutes, 0);
      const relatedMinutes = softwareUsage
        .filter((sw) =>
          relatedApps.some((app) => sw.appName.toLowerCase().includes(app.toLowerCase()))
        )
        .reduce((s, sw) => s + sw.minutes, 0);

      const appAlignment = totalMinutes > 0 ? (relatedMinutes / totalMinutes) * 100 : 0;

      // AI 요약 키워드 매칭
      const summary = (metric.aiSummary || "") as string;
      const keywordHits = keywords.filter((kw) =>
        summary.toLowerCase().includes(kw.toLowerCase())
      ).length;
      const keywordAlignment =
        keywords.length > 0 ? (keywordHits / keywords.length) * 100 : 0;

      const alignment = Math.round(appAlignment * 0.6 + keywordAlignment * 0.4);

      return {
        goalId: goalDoc.id,
        goalTitle: goal.title,
        alignmentPercentage: Math.min(100, alignment),
        timeSpentMinutes: relatedMinutes,
      };
    });

    res.json({ alignments });
  }
);
