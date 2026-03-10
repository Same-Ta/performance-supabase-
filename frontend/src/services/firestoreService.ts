import { supabase } from '../config/supabase';
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

//  User Profile 
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', uid)
    .single();
  if (error || !data) return null;
  return data as UserProfile;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await supabase.from('profiles').update(data).eq('uid', uid);
}

//  Performance Metrics 
export async function getMetricsByUser(
  userId: string,
  days: number = 30
): Promise<PerformanceMetrics[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('performance_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('date', cutoffStr)
    .order('date', { ascending: false });

  if (error || !data) return [];
  return data.map(fromDbMetrics);
}

export async function submitMetrics(metrics: PerformanceMetrics): Promise<void> {
  await supabase.from('performance_metrics').upsert({
    ...toDbMetrics(metrics),
    submitted_at: new Date().toISOString(),
    status: 'submitted',
  });
}

export async function getLatestMetrics(userId: string): Promise<PerformanceMetrics | null> {
  const { data, error } = await supabase
    .from('performance_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return fromDbMetrics(data);
}

//  Reports 
export async function getReports(userId: string): Promise<PerformanceReport[]> {
  const { data, error } = await supabase
    .from('performance_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as PerformanceReport[];
}

export async function saveReport(report: PerformanceReport): Promise<void> {
  await supabase.from('performance_reports').upsert(report);
}

//  Goals (OKR/KPI) 
export async function getActiveGoals(orgId: string): Promise<GoalDefinition[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'active');
  if (error || !data) return [];
  return data as GoalDefinition[];
}

export async function saveGoal(goal: GoalDefinition): Promise<void> {
  await supabase.from('goals').upsert(goal);
}

//  Data Review Items 
export async function getPendingReviews(userId: string): Promise<DataReviewItem[]> {
  const { data, error } = await supabase
    .from('performance_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error || !data) return [];

  const decisionMap: Record<string, DataReviewItem['decision']> = {
    pending_review: 'pending',
    submitted: 'pending',
    approved: 'approved',
    rejected: 'rejected',
  };

  return data.map((row): DataReviewItem => {
    const m = fromDbMetrics(row);
    return {
      id: m.id,
      metricsId: m.id,
      userId: m.userId,
      date: m.date,
      metrics: m,
      decision: decisionMap[m.status] ?? 'pending',
      reviewedAt: m.approvedAt,
    };
  });
}

export async function updateReviewDecision(
  reviewId: string,
  decision: 'approved' | 'rejected' | 'edited',
  notes?: string
): Promise<void> {
  const statusMap = { approved: 'approved', rejected: 'rejected', edited: 'approved' };
  await supabase
    .from('performance_metrics')
    .update({
      status: statusMap[decision],
      approved_at: new Date().toISOString(),
      ...(notes ? { user_notes: notes } : {}),
    })
    .eq('id', reviewId);
}

export async function deleteMetrics(metricId: string): Promise<void> {
  await supabase.from('performance_metrics').delete().eq('id', metricId);
}

//  Team Dashboard 
export async function getTeamDashboard(teamId: string): Promise<TeamDashboardData | null> {
  const { data, error } = await supabase
    .from('team_dashboards')
    .select('*')
    .eq('team_id', teamId)
    .single();
  if (error || !data) return null;
  return data as TeamDashboardData;
}

//  Rewards 
export async function getRewardStatus(userId: string): Promise<EmployeeRewardStatus | null> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as EmployeeRewardStatus;
}

//  Integrations 
export async function getIntegrations(orgId: string): Promise<IntegrationConfig[]> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('organization_id', orgId);
  if (error || !data) return [];
  return data as IntegrationConfig[];
}

export async function saveIntegration(config: IntegrationConfig): Promise<void> {
  await supabase.from('integrations').upsert(config);
}

//  Notifications 
export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data as Notification[];
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', notifId);
}

//  Team Invites 
export interface TeamInvite {
  id: string;
  inviterUid: string;
  inviterName: string;
  inviterEmail: string;
  teamId: string;
  teamName: string;
  email: string;
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
  const { data: existing } = await supabase
    .from('team_invites')
    .select('id')
    .eq('email', email)
    .eq('team_id', teamId)
    .eq('status', 'pending');

  if (existing && existing.length > 0) {
    throw new Error('이미 초대를 보낸 이메일입니다.');
  }

  const { data, error } = await supabase
    .from('team_invites')
    .insert({
      inviter_uid: inviterUid,
      inviter_name: inviterName,
      inviter_email: inviterEmail,
      team_id: teamId,
      team_name: teamName,
      email,
      role,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) throw error;
  return data.id;
}

export async function getMyInvites(inviterUid: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('*')
    .eq('inviter_uid', inviterUid)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    inviterUid: row.inviter_uid,
    inviterName: row.inviter_name,
    inviterEmail: row.inviter_email,
    teamId: row.team_id,
    teamName: row.team_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  }));
}

export async function cancelInvite(inviteId: string): Promise<void> {
  await supabase.from('team_invites').update({ status: 'declined' }).eq('id', inviteId);
}

//  Workspaces 
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
  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      name,
      description,
      owner_id: ownerId,
      owner_name: ownerName,
      member_ids: [ownerId],
      members: [{ uid: ownerId, email: ownerEmail, displayName: ownerName, role: 'owner', joinedAt: new Date().toISOString() }],
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw error;
  return data.id;
}

export async function getMyWorkspaces(userId: string): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .contains('member_ids', [userId]);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    members: row.members ?? [],
    createdAt: row.created_at,
  }));
}

//  DB 매핑 헬퍼 (camelCase <-> snake_case) 
function toDbMetrics(m: PerformanceMetrics): Record<string, unknown> {
  return {
    id: m.id,
    user_id: m.userId,
    date: m.date,
    session_id: m.sessionId,
    status: m.status,
    total_work_minutes: m.totalWorkMinutes,
    active_work_minutes: m.activeWorkMinutes,
    focus_score: m.focusScore,
    efficiency_score: m.efficiencyScore,
    goal_alignment_score: m.goalAlignmentScore,
    output_score: m.outputScore,
    context_switch_count: m.contextSwitchCount,
    context_switch_rate: m.contextSwitchRate,
    input_density: m.inputDensity,
    deep_focus_minutes: m.deepFocusMinutes,
    software_usage: m.softwareUsage,
    timeline: m.timeline ?? [],
    ai_summary: m.aiSummary,
    key_achievements: m.keyAchievements,
    suggested_improvements: m.suggestedImprovements,
    task_type: m.taskType,
    session_start_time: m.sessionStartTime,
    session_end_time: m.sessionEndTime,
    work_narrative: m.workNarrative,
    screen_contexts: m.screenContexts ?? [],
    screen_analysis_count: m.screenAnalysisCount ?? 0,
    created_at: m.createdAt,
    approved_at: m.approvedAt,
    submitted_at: m.submittedAt,
  };
}

function fromDbMetrics(row: Record<string, unknown>): PerformanceMetrics {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: row.date as string,
    sessionId: row.session_id as string,
    status: row.status as PerformanceMetrics['status'],
    totalWorkMinutes: Number(row.total_work_minutes),
    activeWorkMinutes: Number(row.active_work_minutes),
    focusScore: Number(row.focus_score),
    efficiencyScore: Number(row.efficiency_score),
    goalAlignmentScore: Number(row.goal_alignment_score),
    outputScore: Number(row.output_score),
    contextSwitchCount: Number(row.context_switch_count),
    contextSwitchRate: Number(row.context_switch_rate),
    inputDensity: Number(row.input_density),
    deepFocusMinutes: Number(row.deep_focus_minutes),
    softwareUsage: (row.software_usage as PerformanceMetrics['softwareUsage']) ?? [],
    timeline: (row.timeline as PerformanceMetrics['timeline']) ?? [],
    aiSummary: (row.ai_summary as string) ?? '',
    keyAchievements: (row.key_achievements as string[]) ?? [],
    suggestedImprovements: (row.suggested_improvements as string[]) ?? [],
    taskType: row.task_type as string | undefined,
    sessionStartTime: row.session_start_time as string | undefined,
    sessionEndTime: row.session_end_time as string | undefined,
    workNarrative: row.work_narrative as string | undefined,
    screenContexts: (row.screen_contexts as PerformanceMetrics['screenContexts']) ?? [],
    screenAnalysisCount: Number(row.screen_analysis_count ?? 0),
    createdAt: row.created_at as string,
    approvedAt: row.approved_at as string | undefined,
    submittedAt: row.submitted_at as string | undefined,
  };
}

// ─── Notion 설정 ──────────────────────────────────────────────────────────────
import type { NotionSettings } from '../types';

export async function getNotionSettings(uid: string): Promise<NotionSettings | null> {
  const { data } = await supabase
    .from('integrations')
    .select('config')
    .eq('organization_id', uid)
    .eq('type', 'notion')
    .single();
  if (!data?.config) return null;
  return data.config as NotionSettings;
}

export async function saveNotionSettings(uid: string, settings: NotionSettings): Promise<void> {
  await supabase.from('integrations').upsert({
    organization_id: uid,
    type: 'notion',
    enabled: settings.enabled,
    config: settings,
  }, { onConflict: 'organization_id,type' });
}

// ─── Workspace 추가 함수 ──────────────────────────────────────────────────────

/** TeamManagement에서 사용하는 createWorkspace 별칭 */
export const createWorkspaceWithMemberIds = createWorkspace;

/** 워크스페이스 멤버 uid 목록으로 최신 성과 메트릭 조회 (userId 기준으로 그룹화) */
export async function getWorkspaceMemberMetrics(memberUids: string[]): Promise<Record<string, PerformanceMetrics[]>> {
  if (memberUids.length === 0) return {};
  const { data, error } = await supabase
    .from('performance_metrics')
    .select('*')
    .in('user_id', memberUids)
    .order('date', { ascending: false })
    .limit(memberUids.length * 7);
  if (error || !data) return {};
  const result: Record<string, PerformanceMetrics[]> = {};
  for (const row of data) {
    const m = fromDbMetrics(row as Record<string, unknown>);
    if (!result[m.userId]) result[m.userId] = [];
    result[m.userId].push(m);
  }
  return result;
}

/** 워크스페이스에 멤버 초대 (team_invites + workspaces 업데이트) */
export async function inviteMemberToWorkspace(
  workspaceId: string,
  workspace: Workspace,
  inviterUid: string,
  inviterName: string,
  inviterEmail: string,
  email: string
): Promise<void> {
  await sendTeamInvite(
    inviterUid,
    inviterName,
    inviterEmail,
    workspaceId,
    workspace.name,
    email,
    'employee'
  );
}