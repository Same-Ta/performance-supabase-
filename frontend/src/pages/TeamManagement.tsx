import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createWorkspaceWithMemberIds,
  getMyWorkspaces,
  inviteMemberToWorkspace,
  getWorkspaceMemberMetrics,
  getMyInvites,
  cancelInvite,
} from '../services/firestoreService';
import type { Workspace, WorkspaceMember, TeamInvite } from '../services/firestoreService';
import type { PerformanceMetrics } from '../types';
import WorkspaceTimeline from '../components/dashboard/WorkspaceTimeline';
import {
  Users,
  Plus,
  Mail,
  Send,
  Building2,
  UserPlus,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutList,
  GanttChartSquare,
  Calendar,
} from 'lucide-react';

// ─── 카테고리 색상/라벨 ──────────────────────────────────
const ACTIVITY_COLORS: Record<string, string> = {
  development:   '#3b82f6',
  communication: '#f59e0b',
  documentation: '#10b981',
  design:        '#ec4899',
  project_mgmt:  '#8b5cf6',
  browser:       '#6366f1',
  meeting:       '#a855f7',
  planning:      '#6366f1',
  research:      '#14b8a6',
  bug_fix:       '#ef4444',
  frontend:      '#3b82f6',
  backend:       '#10b981',
  review:        '#f97316',
  idle:          '#e5e7eb',
  other:         '#9ca3af',
};
const ACTIVITY_LABELS: Record<string, string> = {
  development:   '개발', communication: '커뮤니케이션', documentation: '문서화',
  design:        '디자인', project_mgmt: '프로젝트 관리', browser: '브라우저',
  meeting:       '회의', planning: '기획', research: '리서치', bug_fix: '버그수정',
  frontend:      '프론트엔드', backend: '백엔드', review: '코드리뷰',
  idle:          '자리비움', other: '기타',
};

// ─── 워크스페이스 멤버 메트릭 미니 카드 ──────────────────
function MemberMetricBar({ metrics }: { metrics: PerformanceMetrics }) {
  const activities = metrics.timeline ?? [];
  // 짧은 idle 제외, 의미있는 활동만
  const significant = activities.filter(
    (seg) => seg.category !== 'idle' && (seg.durationMinutes ?? 0) >= 3
  );

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-3 last:mb-0">
      {/* 날짜 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-600">{metrics.date}</span>
        <div className="flex gap-3 text-[11px] text-gray-500">
          {metrics.sessionStartTime && metrics.sessionEndTime && (
            <span className="text-gray-400">{metrics.sessionStartTime}~{metrics.sessionEndTime}</span>
          )}
          <span>집중 <b className="text-brand-600">{metrics.focusScore}</b></span>
          <span>효율 <b className="text-success-600">{metrics.efficiencyScore}</b></span>
          <span className="text-gray-600 font-medium">{(metrics.activeWorkMinutes / 60).toFixed(1)}h</span>
        </div>
      </div>

      {/* 활동 목록 */}
      {significant.length > 0 ? (
        <div className="divide-y divide-gray-50">
          {significant.map((seg, i) => {
            const color = ACTIVITY_COLORS[seg.category] ?? '#9ca3af';
            const label = ACTIVITY_LABELS[seg.category] ?? seg.category;
            const dur = seg.durationMinutes ?? 0;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 truncate">
                    {seg.description || label}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {seg.startTime}~{seg.endTime}
                    <span
                      className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: color + '22', color }}
                    >
                      {label}
                    </span>
                  </p>
                </div>
                <span className="text-[11px] text-gray-500 flex-shrink-0">
                  {dur >= 60 ? `${(dur / 60).toFixed(1)}h` : `${dur}분`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-3">
          {/* 활동 세그먼트 없으면 진행 바만 표시 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full bg-brand-400"
                style={{ width: `${metrics.focusScore}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-400">활동 데이터 없음</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 멤버 행 컴포넌트 ────────────────────────────────────
function MemberRow({
  member,
  metrics,
}: {
  member: WorkspaceMember;
  metrics: PerformanceMetrics[];
}) {
  const [showOlder, setShowOlder] = useState(false);
  const latest = metrics[0];
  const older = metrics.slice(1);

  // 최신 날짜의 의미있는 활동
  const latestActivities = (latest?.timeline ?? []).filter(
    (seg) => seg.category !== 'idle' && (seg.durationMinutes ?? 0) >= 3
  );

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden mb-3 bg-white">
      {/* 헤더: 아바타 + 이름 + 점수 요약 */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-brand-700">
            {member.displayName.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{member.displayName}</p>
          <p className="text-xs text-gray-400 truncate">{member.email}</p>
        </div>

        {latest ? (
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-center hidden sm:block">
              <p className="text-[10px] text-gray-400">집중</p>
              <p className="text-sm font-bold text-brand-600">{latest.focusScore}</p>
            </div>
            <div className="text-center hidden sm:block">
              <p className="text-[10px] text-gray-400">효율</p>
              <p className="text-sm font-bold text-success-600">{latest.efficiencyScore}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">시간</p>
              <p className="text-sm font-bold text-gray-700">{(latest.activeWorkMinutes / 60).toFixed(1)}h</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 flex-shrink-0">추적 내역 없음</p>
        )}
      </div>

      {/* 오늘 활동 목록 (항상 표시) */}
      {latest ? (
        <div>
          {/* 날짜 서브헤더 */}
          <div className="flex items-center justify-between px-5 py-2 bg-gray-50/60">
            <span className="text-[11px] font-semibold text-gray-500">
              {latest.date}
              {latest.sessionStartTime && latest.sessionEndTime && (
                <span className="ml-2 font-normal text-gray-400">
                  {latest.sessionStartTime}~{latest.sessionEndTime}
                </span>
              )}
            </span>
            {older.length > 0 && (
              <button
                onClick={() => setShowOlder(!showOlder)}
                className="flex items-center gap-1 text-[11px] text-brand-500 hover:text-brand-700"
              >
                이전 {older.length}일
                {showOlder ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* 활동 목록 */}
          {latestActivities.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {latestActivities.map((seg, i) => {
                const color = ACTIVITY_COLORS[seg.category] ?? '#9ca3af';
                const label = ACTIVITY_LABELS[seg.category] ?? seg.category;
                const dur = seg.durationMinutes ?? 0;
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 truncate">
                        {seg.description || label}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {seg.startTime}~{seg.endTime}
                        <span
                          className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: color + '22', color }}
                        >
                          {label}
                        </span>
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-500 flex-shrink-0">
                      {dur >= 60 ? `${(dur / 60).toFixed(1)}h` : `${dur}분`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-brand-400"
                  style={{ width: `${latest.focusScore}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-400 flex-shrink-0">세부 활동 없음</span>
            </div>
          )}
        </div>
      ) : null}

      {/* 이전 날 활동 (펼치기) */}
      {showOlder && older.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/30 space-y-3">
          <p className="text-xs font-semibold text-gray-400">이전 활동 내역</p>
          {older.map((m) => <MemberMetricBar key={m.id} metrics={m} />)}
        </div>
      )}
    </div>
  );
}

// ─── 공통 상태 설정 ──────────────────────────────────────
const STATUS_CONFIG = {
  pending:  { label: '대기 중', color: 'text-amber-600 bg-amber-50',    icon: Clock },
  accepted: { label: '수락됨',  color: 'text-success-700 bg-success-50', icon: CheckCircle2 },
  declined: { label: '취소됨',  color: 'text-red-600 bg-red-50',        icon: XCircle },
} as const;

type WorkspaceView = 'timeline' | 'list';

// ─── 워크스페이스 카드 ────────────────────────────────────
function WorkspaceCard({
  workspace,
  currentUserId,
  invites,
  onCancelInvite,
  onInvited,
}: {
  workspace: Workspace;
  currentUserId: string;
  invites: TeamInvite[];
  onCancelInvite: (id: string) => void;
  onInvited: () => void;
}) {
  const { profile } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isOwner = workspace.ownerId === currentUserId;

  const handleExpand = () => {
    setExpanded(!expanded);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !profile) return;
    setInviting(true);
    setInviteResult(null);
    try {
      await inviteMemberToWorkspace(
        workspace.id,
        workspace,
        profile.uid,
        profile.displayName || profile.email || '사용자',
        profile.email || '',
        inviteEmail.trim()
      );
      setInviteResult({ ok: true, msg: `${inviteEmail.trim()}에게 초대를 발송했습니다.` });
      setInviteEmail('');
      onInvited();
    } catch (err) {
      setInviteResult({ ok: false, msg: err instanceof Error ? err.message : '오류가 발생했습니다.' });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="card space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{workspace.name}</h3>
            {workspace.description && (
              <p className="text-xs text-gray-500">{workspace.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {workspace.members.length}명 · {isOwner ? '내가 만든 워크스페이스' : `${workspace.ownerName}님의 워크스페이스`}
            </p>
          </div>
        </div>
        <button
          onClick={handleExpand}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 px-3 py-2 rounded-xl hover:bg-brand-50 transition-colors"
        >
          <Users className="w-4 h-4" />
          {expanded ? '접기' : '팀원 보기'}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 확장 영역 */}
      {expanded && (
        <div className="space-y-4 animate-fade-in">
          {/* 발송한 초대 목록 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              발송한 초대 목록
            </p>
            {(() => {
              const wsInvites = invites.filter(
                (inv) => inv.teamId === workspace.id || (inv as unknown as Record<string, unknown>).workspaceId === workspace.id
              );
              if (wsInvites.length === 0) {
                return (
                  <p className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-xl">
                    이 워크스페이스에 발송한 초대가 없습니다.
                  </p>
                );
              }
              return wsInvites.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status];
                const Icon = cfg.icon;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{inv.email}</p>
                        <p className="text-xs text-gray-400">{inv.createdAt?.slice(0, 10)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {inv.status === 'pending' && (
                        <button
                          onClick={() => onCancelInvite(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                          title="초대 취소"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* 초대 폼 (소유자 또는 모든 멤버) */}
          <form onSubmit={handleInvite} className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              새 팀원 초대
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
                {inviting ? '발송 중…' : '초대'}
              </button>
            </div>
            {inviteResult && (
              <p className={`text-xs mt-2 font-medium ${inviteResult.ok ? 'text-success-700' : 'text-red-600'}`}>
                {inviteResult.msg}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function TeamManagement() {
  const { profile } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 발송한 초대 목록
  const [invites, setInvites] = useState<Awaited<ReturnType<typeof getMyInvites>>>([]);

  // 타임라인/목록 섹션
  const [timelineWsId, setTimelineWsId] = useState<string>('');
  const [timelineMetrics, setTimelineMetrics] = useState<Record<string, PerformanceMetrics[]>>({});
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineView, setTimelineView] = useState<WorkspaceView>('timeline');
  const [timelineDate, setTimelineDate] = useState(() => {
    const d = new Date();
    // UTC 대신 로컬 날짜 사용 (한국 시간대 날짜 불일치 방지)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // 워크스페이스 상세 보기 (null이면 전체 목록)
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);

  const loadWorkspaces = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const list = await getMyWorkspaces(profile.uid);
      setWorkspaces(list);
      // 타임라인용 기본 워크스페이스 초기화
      if (list.length > 0 && !timelineWsId) setTimelineWsId(list[0].id);
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTimelineMetrics = async (wsId: string, members: Workspace['members']) => {
    if (!wsId || members.length === 0) return;
    setTimelineLoading(true);
    try {
      const data = await getWorkspaceMemberMetrics(members.map((m) => m.uid));
      setTimelineMetrics(data);
    } finally {
      setTimelineLoading(false);
    }
  };

  // timelineWsId 또는 workspaces 변경 시 자동 로드
  // (loadWorkspaces에서 setWorkspaces + setTimelineWsId가 동시에 업데이트되므로
  //  workspaces도 deps에 포함해 경쟁 조건 방지)
  useEffect(() => {
    if (!timelineWsId || workspaces.length === 0) return;
    const ws = workspaces.find((w) => w.id === timelineWsId);
    if (ws) loadTimelineMetrics(ws.id, ws.members);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineWsId, workspaces]);

  const loadInvites = async () => {
    if (!profile?.uid) return;
    try {
      const list = await getMyInvites(profile.uid);
      setInvites(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadWorkspaces();
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !wsName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createWorkspaceWithMemberIds(
        profile.uid,
        profile.displayName || profile.email || '사용자',
        profile.email || '',
        wsName.trim(),
        wsDesc.trim()
      );
      setWsName('');
      setWsDesc('');
      setShowCreateForm(false);
      await loadWorkspaces();
    } catch(err) {
      setCreateError(err instanceof Error ? err.message : '워크스페이스 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    await cancelInvite(inviteId);
    loadInvites();
  };

  // 날짜 이동 헬퍼 (로컬 날짜 기반 — UTC 시간대 불일치 방지)
  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const shiftDate = (days: number) => {
    // "YYYY-MM-DD" 문자열을 UTC로 파싱하면 시간대 오류가 생기므로 직접 파싱
    const [y, mo, day] = timelineDate.split('-').map(Number);
    const d = new Date(y, mo - 1, day);
    d.setDate(d.getDate() + days);
    setTimelineDate(toLocalDateStr(d));
  };
  const todayStr = toLocalDateStr(new Date());

  // 워크스페이스 선택 시 타임라인 데이터 로드 후 상세 모드
  const openWorkspace = (ws: Workspace) => {
    setSelectedWs(ws);
    setTimelineWsId(ws.id);
    loadTimelineMetrics(ws.id, ws.members);
  };

  // ── 워크스페이스 상세 보기 ─────────────────────────────
  if (selectedWs) {
    const wsMembers = selectedWs.members;
    return (
      <div className="space-y-6 animate-fade-in">
        {/* 뒤로가기 + 워크스페이스 이름 */}
        <div>
          <button
            onClick={() => setSelectedWs(null)}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            전체 워크스페이스
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedWs.name}</h2>
              <p className="text-xs text-gray-400">{wsMembers.length}명 · {selectedWs.description || '워크스페이스'}</p>
            </div>
          </div>
        </div>

        {/* 타임라인 & 목록 */}
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <GanttChartSquare className="w-4 h-4 text-gray-500" />
              팀 타임라인 &amp; 성과 목록
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 날짜 선택 */}
              <div className="flex items-center gap-1 bg-gray-50 rounded-xl border border-gray-100 px-1">
                <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <div className="flex items-center gap-1.5 px-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="date"
                    value={timelineDate}
                    max={todayStr}
                    onChange={(e) => setTimelineDate(e.target.value)}
                    className="text-xs font-medium text-gray-700 bg-transparent border-0 focus:outline-none cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => shiftDate(1)}
                  disabled={timelineDate >= todayStr}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </button>
                {timelineDate !== todayStr && (
                  <button
                    onClick={() => setTimelineDate(todayStr)}
                    className="text-[10px] text-brand-600 hover:text-brand-700 font-semibold px-1.5"
                  >
                    오늘
                  </button>
                )}
              </div>
              {/* 뷰 탭 */}
              <div className="flex gap-1 bg-gray-50 rounded-xl p-1">
                <button
                  onClick={() => setTimelineView('timeline')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    timelineView === 'timeline'
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <GanttChartSquare className="w-3.5 h-3.5" />
                  타임라인
                </button>
                <button
                  onClick={() => setTimelineView('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    timelineView === 'list'
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  목록
                </button>
              </div>
              <button
                onClick={() => loadTimelineMetrics(selectedWs.id, wsMembers)}
                className="text-xs text-brand-500 hover:text-brand-700"
              >
                새로고침
              </button>
            </div>
          </div>

          {timelineLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
            </div>
          ) : timelineView === 'timeline' ? (
            <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
              <WorkspaceTimeline
                members={wsMembers}
                memberMetrics={timelineMetrics}
                selectedDate={timelineDate}
              />
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-3">
                <BarChart3 className="w-3.5 h-3.5" />
                팀원별 성과 현황 · {timelineDate}
              </p>
              {wsMembers.map((member) => (
                <MemberRow
                  key={member.uid}
                  member={member}
                  metrics={(timelineMetrics[member.uid] ?? []).filter((m) => m.date === timelineDate)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 팀원 초대/관리 카드 */}
        <WorkspaceCard
          workspace={selectedWs}
          currentUserId={profile?.uid ?? ''}
          invites={invites}
          onCancelInvite={handleCancelInvite}
          onInvited={loadInvites}
        />
      </div>
    );
  }

  // ── 전체 워크스페이스 목록 ─────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-brand-600" />
            팀 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            워크스페이스를 만들고 팀원을 초대해 서로의 성과 데이터를 공유하세요.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          워크스페이스 만들기
        </button>
      </div>

      {/* 워크스페이스 생성 폼 */}
      {showCreateForm && (
        <form onSubmit={handleCreateWorkspace} className="card space-y-4 border-brand-200 bg-brand-50/20 animate-fade-in">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-600" />
            새 워크스페이스 만들기
          </h3>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">워크스페이스 이름 *</label>
            <input
              type="text"
              required
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="예: 프론트엔드 팀, 개발팀 Q1"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">설명 (선택)</label>
            <input
              type="text"
              value={wsDesc}
              onChange={(e) => setWsDesc(e.target.value)}
              placeholder="워크스페이스에 대한 간단한 설명"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          {createError && <p className="text-xs text-red-500">{createError}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating || !wsName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? '생성 중…' : '생성'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 워크스페이스 목록 */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="card text-center py-16">
          <Building2 className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">아직 워크스페이스가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            워크스페이스를 만들면 팀원을 초대하고 서로의 성과를 공유할 수 있습니다.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            첫 번째 워크스페이스 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map((ws) => (
            <div key={ws.id} className="card hover:border-brand-200 cursor-pointer transition-colors"
              onClick={() => openWorkspace(ws)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{ws.name}</h3>
                    {ws.description && (
                      <p className="text-xs text-gray-500">{ws.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ws.members.length}명 · {ws.ownerId === (profile?.uid ?? '') ? '내가 만든 워크스페이스' : `${ws.ownerName}님`}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
