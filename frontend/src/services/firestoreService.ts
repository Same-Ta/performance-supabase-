import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  UserProfile,
  PerformanceMetrics,
  PerformanceReport,
  GoalDefinition,
  DataReviewItem,
  TeamDashboardData,
  EmployeeRewardStatus,
  IntegrationConfig,
  Notification,
} from '../types';

// ─── Collections ──────────────────────────────────────────
const USERS = 'users';
const METRICS = 'performance_metrics';
const REPORTS = 'performance_reports';
const GOALS = 'goals';
const REWARDS = 'rewards';
const INTEGRATIONS = 'integrations';
const NOTIFICATIONS = 'notifications';
const TEAM_INVITES = 'team_invites';

// ─── User Profile ─────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, USERS, uid), data);
}

// ─── Performance Metrics ──────────────────────────────────
export async function getMetricsByUser(
  userId: string,
  days: number = 30
): Promise<PerformanceMetrics[]> {
  // NOTE: where(userId) + where(date range) + orderBy(date) requires composite index.
  // Instead: fetch all userId docs, filter & sort in memory.
  const q = query(
    collection(db, METRICS),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as PerformanceMetrics)
    .filter((m) => m.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function submitMetrics(metrics: PerformanceMetrics): Promise<void> {
  await setDoc(doc(db, METRICS, metrics.id), {
    ...metrics,
    submittedAt: Timestamp.now().toDate().toISOString(),
    status: 'submitted',
  });
}

export async function getLatestMetrics(userId: string): Promise<PerformanceMetrics | null> {
  const q = query(
    collection(db, METRICS),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as PerformanceMetrics)
    .sort((a, b) => b.date.localeCompare(a.date));
  return docs[0];
}

// ─── Reports ──────────────────────────────────────────────
export async function getReports(userId: string): Promise<PerformanceReport[]> {
  const q = query(
    collection(db, REPORTS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PerformanceReport);
}

export async function saveReport(report: PerformanceReport): Promise<void> {
  await setDoc(doc(db, REPORTS, report.id), report);
}

// ─── Goals (OKR/KPI) ─────────────────────────────────────
export async function getActiveGoals(orgId: string): Promise<GoalDefinition[]> {
  const q = query(
    collection(db, GOALS),
    where('organizationId', '==', orgId),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GoalDefinition);
}

export async function saveGoal(goal: GoalDefinition): Promise<void> {
  await setDoc(doc(db, GOALS, goal.id), goal);
}

// ─── Data Review Items ────────────────────────────────────
// performance_metrics의 status를 기준으로 리뷰 항목 구성
// (data_reviews 콜렉션 별도 생성 불필요)
export async function getPendingReviews(userId: string): Promise<DataReviewItem[]> {
  const q = query(
    collection(db, METRICS),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  const metrics = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as PerformanceMetrics)
    .sort((a, b) => b.date.localeCompare(a.date));

  // pending_review / approved / edited / rejected 모두 항목으로 변환
  const decisionMap: Record<string, DataReviewItem['decision']> = {
    pending_review: 'pending',
    submitted: 'pending',
    approved: 'approved',
    rejected: 'rejected',
  };
  return metrics.map((m): DataReviewItem => ({
    id: m.id,
    metricsId: m.id,
    userId: m.userId,
    date: m.date,
    metrics: m,
    decision: decisionMap[m.status] ?? 'pending',
    reviewedAt: m.approvedAt,
  }));
}

export async function updateReviewDecision(
  reviewId: string,
  decision: 'approved' | 'rejected' | 'edited',
  notes?: string
): Promise<void> {
  // performance_metrics 문서의 status를 직접 업데이트
  const statusMap = { approved: 'approved', rejected: 'rejected', edited: 'approved' };
  await updateDoc(doc(db, METRICS, reviewId), {
    status: statusMap[decision],
    approvedAt: new Date().toISOString(),
    ...(notes ? { userNotes: notes } : {}),
  });
}

export async function deleteMetrics(metricId: string): Promise<void> {
  await deleteDoc(doc(db, METRICS, metricId));
}

// ─── Team Dashboard ───────────────────────────────────────
export async function getTeamDashboard(teamId: string): Promise<TeamDashboardData | null> {
  const snap = await getDoc(doc(db, 'team_dashboards', teamId));
  return snap.exists() ? (snap.data() as TeamDashboardData) : null;
}

// ─── Rewards ──────────────────────────────────────────────
export async function getRewardStatus(userId: string): Promise<EmployeeRewardStatus | null> {
  const snap = await getDoc(doc(db, REWARDS, userId));
  return snap.exists() ? (snap.data() as EmployeeRewardStatus) : null;
}

// ─── Integrations ─────────────────────────────────────────
export async function getIntegrations(orgId: string): Promise<IntegrationConfig[]> {
  const q = query(collection(db, INTEGRATIONS), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IntegrationConfig);
}

export async function saveIntegration(config: IntegrationConfig): Promise<void> {
  await setDoc(doc(db, INTEGRATIONS, config.id), config);
}

// ─── Notifications ────────────────────────────────────────
export async function getNotifications(userId: string): Promise<Notification[]> {
  const q = query(
    collection(db, NOTIFICATIONS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification);
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS, notifId), { read: true });
}

// ─── Team Invites ──────────────────────────────────────────
export interface TeamInvite {
  id: string;
  inviterUid: string;
  inviterName: string;
  inviterEmail: string;
  teamId: string;
  teamName: string;
  email: string;              // 초대받을 상대방 이메일
  role: 'employee' | 'manager';
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt?: string;
}

export async function sendTeamInvite(
  inviterUid: string,
  inviterName: string,
  inviterEmail: string,
  teamId: string,
  teamName: string,
  email: string,
  role: 'employee' | 'manager' = 'employee'
): Promise<string> {
  // 중복 초대 확인 (단일 where + JS 필터 — 복합 인덱스 불필요)
  const existingSnap = await getDocs(
    query(collection(db, TEAM_INVITES), where('email', '==', email))
  );
  const hasPending = existingSnap.docs.some(d => {
    const data = d.data();
    return data.teamId === teamId && data.status === 'pending';
  });
  if (hasPending) {
    throw new Error('이미 초대를 보낸 이메일입니다.');
  }
  const invite: Omit<TeamInvite, 'id'> = {
    inviterUid,
    inviterName,
    inviterEmail,
    teamId,
    teamName,
    email,
    role,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, TEAM_INVITES), invite);
  return ref.id;
}

export async function getMyInvites(inviterUid: string): Promise<TeamInvite[]> {
  const snap = await getDocs(
    query(collection(db, TEAM_INVITES), where('inviterUid', '==', inviterUid))
  );
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }) as TeamInvite);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function cancelInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, TEAM_INVITES, inviteId), { status: 'declined' });
}

// ─── Workspaces ───────────────────────────────────────────
const WORKSPACES = 'workspaces';

export interface WorkspaceMember {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  members: WorkspaceMember[];
  createdAt: string;
}

export async function createWorkspace(
  ownerId: string,
  ownerName: string,
  ownerEmail: string,
  name: string,
  description: string
): Promise<string> {
  const workspace: Omit<Workspace, 'id'> = {
    name,
    description,
    ownerId,
    ownerName,
    members: [{ uid: ownerId, email: ownerEmail, displayName: ownerName, role: 'owner', joinedAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, WORKSPACES), workspace);
  return ref.id;
}

export async function getMyWorkspaces(userId: string): Promise<Workspace[]> {
  // member uid 기준으로 가져오기: array-contains 사용
  // But members is an array of objects, so we need a different approach.
  // Use ownerId first, then also get workspaces where user is a member via a separate field.
  // Simplest: store memberIds array alongside members for querying
  const q = query(collection(db, WORKSPACES), where('memberIds', 'array-contains', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workspace)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function inviteMemberToWorkspace(
  workspaceId: string,
  workspace: Workspace,
  inviterUid: string,
  inviterName: string,
  inviterEmail: string,
  targetEmail: string,
  role: 'employee' | 'manager' = 'employee'
): Promise<string> {
  // Also send a team invite that includes workspaceId
  const existingSnap = await getDocs(
    query(collection(db, TEAM_INVITES), where('email', '==', targetEmail))
  );
  const hasPending = existingSnap.docs.some(d => {
    const data = d.data();
    return data.workspaceId === workspaceId && data.status === 'pending';
  });
  if (hasPending) throw new Error('이미 초대를 보낸 이메일입니다.');

  const invite = {
    inviterUid,
    inviterName: inviterName || inviterEmail || '사용자',
    inviterEmail: inviterEmail || '',
    teamId: workspaceId,
    teamName: workspace.name || '',
    workspaceId,
    workspaceName: workspace.name || '',
    email: targetEmail,
    role,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, TEAM_INVITES), invite);
  return ref.id;
}

export async function createWorkspaceWithMemberIds(
  ownerId: string,
  ownerName: string,
  ownerEmail: string,
  name: string,
  description: string
): Promise<string> {
  const safeOwnerName = ownerName || ownerEmail || '사용자';
  const safeOwnerEmail = ownerEmail || '';
  const wsRef = await addDoc(collection(db, WORKSPACES), {
    name,
    description: description || '',
    ownerId,
    ownerName: safeOwnerName,
    memberIds: [ownerId],
    members: [{ uid: ownerId, email: safeOwnerEmail, displayName: safeOwnerName, role: 'owner', joinedAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  });
  return wsRef.id;
}

export async function getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  const snap = await getDoc(doc(db, WORKSPACES, workspaceId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Workspace) : null;
}

// 워크스페이스 멤버들의 최신 메트릭 가져오기 (모든 상태 포함)
export async function getWorkspaceMemberMetrics(
  memberIds: string[]
): Promise<Record<string, PerformanceMetrics[]>> {
  const result: Record<string, PerformanceMetrics[]> = {};
  await Promise.all(
    memberIds.map(async (uid) => {
      try {
        const q = query(collection(db, METRICS), where('userId', '==', uid));
        const snap = await getDocs(q);
        const metrics = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PerformanceMetrics)
          // rejected 만 제외, 나머지 모든 상태 포함
          .filter((m) => m.status !== 'rejected')
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 30);
        result[uid] = metrics;
      } catch {
        result[uid] = [];
      }
    })
  );
  return result;
}

