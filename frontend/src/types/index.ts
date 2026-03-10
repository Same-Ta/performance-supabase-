// ============================================================
// ProofWork 전체 타입 정의
// On-Device AI 기반 자율 성과 증명 및 관리 솔루션
// ============================================================

// ─── 사용자 및 인증 ───────────────────────────────────────
export type UserRole = 'employee' | 'manager' | 'hr_admin' | 'super_admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string;
  teamId: string;
  position: string;
  joinDate: string;
  avatarUrl?: string;
  agentConnected: boolean;        // On-Device Agent 연결 상태
  lastAgentSync?: string;         // 마지막 Agent 동기화 시간
}

// ─── On-Device Agent 상태 ────────────────────────────────
export interface AgentStatus {
  isRecording: boolean;
  isAnalyzing: boolean;
  cpuUsage: number;               // 현재 Agent CPU 점유율
  gpuUsage: number;               // 현재 Agent GPU 점유율
  sessionStartTime?: string;
  framesProcessed: number;
  framesDropped: number;
  modelVersion: string;
  privacyMode: 'strict' | 'balanced';
}

// ─── 성과 분석 메트릭 (On-Device → Cloud) ─────────────────
export interface PerformanceMetrics {
  id: string;
  userId: string;
  date: string;                   // YYYY-MM-DD
  sessionId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'submitted';

  // 핵심 지표
  totalWorkMinutes: number;       // 전체 기록 시간(분)
  activeWorkMinutes: number;      // 실제 활성 업무 시간(분)
  focusScore: number;             // 몰입도 점수 (0-100)
  efficiencyScore: number;        // 시간당 효율성 점수 (0-100)
  goalAlignmentScore: number;     // 업무 목표 정렬도 (0-100)
  outputScore: number;            // 실제 성과(Output) 점수 (0-100)

  // 세부 분석
  contextSwitchCount: number;     // 컨텍스트 전환 횟수
  contextSwitchRate: number;      // 분당 컨텍스트 전환비
  inputDensity: number;           // 입력 밀도 (actions/min)
  deepFocusMinutes: number;       // 딥 포커스 시간(분, 20분+ 무중단)

  // 소프트웨어 카테고리별 사용 시간(분)
  softwareUsage: SoftwareUsageEntry[];

  // AI 요약
  aiSummary: string;              // Gemini가 생성한 일일 업무 요약
  keyAchievements: string[];      // 주요 성과 목록
  suggestedImprovements: string[];// 개선 제안

  // 타임라인 (구체적 업무 활동 목록)
  timeline?: ActivitySegment[];   // 시간대별 활동 기록

  // 업무 유형 (에이전트 시작 시 사용자가 선택)
  taskType?: string;

  // 세션 시간 범위
  sessionStartTime?: string;      // 'HH:mm' 형식
  sessionEndTime?: string;        // 'HH:mm' 형식

  // AI 화면 분석 데이터
  workNarrative?: string;         // AI 기반 업무 내러티브
  screenContexts?: ScreenAnalysisContext[]; // 화면 분석 이력
  screenAnalysisCount?: number;   // 총 화면 분석 횟수

  // 메타
  createdAt: string;
  approvedAt?: string;
  submittedAt?: string;
}

export interface SoftwareUsageEntry {
  category: SoftwareCategory;
  appName: string;
  minutes: number;
  percentage: number;
}

// 구체적 활동 세그먼트 (TimeDoctor 스타일 타임라인용)
export interface ActivitySegment {
  startTime: string;              // 'HH:mm' 형식
  endTime: string;                // 'HH:mm' 형식
  app: string;                    // 앱 이름
  windowTitle: string;            // 윈도우 타이틀
  category: SoftwareCategory | 'meeting' | 'idle' | 'other';
  durationMinutes: number;        // 지속 시간(분)
  description: string;            // 구체적 업무 설명 (예: 'VS Code - main.py 편집')

  // AI 화면 분석 확장 필드
  screenSummary?: string;         // AI 화면 요약 (예: 'React 컴포넌트의 상태 관리 로직을 수정하고 있다')
  workInference?: string;         // AI 업무 추론 (예: '사용자 인증 플로우 에러 핸들링 개선 작업 중')
  detectedElements?: string[];    // 감지된 UI 요소들
  analysisCount?: number;         // 이 구간에 수행된 AI 분석 횟수
}

// AI 화면 분석 컨텍스트 (On-Device Agent → Cloud)
export interface ScreenAnalysisContext {
  timestamp: number;
  summary: string;                // 화면 요약
  inference: string;              // 업무 추론
  category: string;               // 업무 카테고리
  confidence: number;             // 분석 신뢰도
  app: string;                    // 앱 이름
}

// 실시간 화면 분석 상태 (Agent /context 엔드포인트)
export interface LiveScreenContext {
  hasContext: boolean;
  currentWork?: string;           // 현재 업무 설명
  currentSummary?: string;        // 현재 화면 요약
  currentInference?: string;      // 현재 업무 추론
  currentCategory?: string;       // 현재 카테고리
  currentApp?: string;            // 현재 앱
  blockDurationMinutes?: number;  // 현재 블록 지속 시간
  totalAnalyses?: number;         // 총 분석 횟수
  totalBlocks?: number;           // 총 업무 블록 수
  narrative?: string;             // 업무 내러티브
  categorySummary?: Record<string, number>; // 카테고리별 시간
}

export type SoftwareCategory =
  | 'development'     // IDE, 터미널, Git
  | 'communication'   // Slack, Teams, Email
  | 'documentation'   // Docs, Notion, Confluence
  | 'design'          // Figma, Sketch, Adobe
  | 'project_mgmt'    // Jira, Asana, Trello
  | 'research'        // 브라우저(업무 관련)
  | 'meeting'         // Zoom, Google Meet
  | 'other';

// ─── 목표 정렬도(Goal Alignment) ──────────────────────────
export interface GoalDefinition {
  id: string;
  organizationId: string;
  teamId?: string;
  type: 'okr' | 'kpi';
  title: string;
  description: string;
  keywords: string[];             // AI 매칭용 키워드
  relatedApps: string[];          // 관련 소프트웨어 목록
  weight: number;                 // 가중치 (0-1)
  targetValue?: number;
  currentValue?: number;
  period: string;                 // 'Q1-2026' 등
  status: 'active' | 'completed' | 'paused';
}

export interface GoalAlignmentDetail {
  goalId: string;
  goalTitle: string;
  alignmentPercentage: number;    // 해당 목표 정렬도
  timeSpentMinutes: number;       // 해당 목표 관련 소요 시간
  evidence: string[];             // AI가 추출한 근거
}

// ─── 리포트(직원 성과 리포트) ─────────────────────────────
export interface PerformanceReport {
  id: string;
  userId: string;
  userName: string;
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  status: 'draft' | 'finalized' | 'shared';

  // 종합 점수
  overallScore: number;
  overallGrade: 'S' | 'A' | 'B' | 'C' | 'D';

  // 핵심 통계
  avgFocusScore: number;
  avgEfficiencyScore: number;
  avgGoalAlignment: number;
  totalOutputScore: number;
  totalActiveHours: number;
  totalDeepFocusHours: number;

  // 트렌드 데이터 (일별)
  dailyTrends: DailyTrend[];

  // 목표별 정렬도
  goalAlignments: GoalAlignmentDetail[];

  // AI 코멘트
  executiveSummary: string;       // Gemini 생성 총평
  strengths: string[];
  areasForGrowth: string[];
  salaryNegotiationPoints: string[]; // 연봉 협상용 핵심 포인트

  createdAt: string;
}

export type ReportPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface DailyTrend {
  date: string;
  focusScore: number;
  efficiencyScore: number;
  goalAlignment: number;
  activeMinutes: number;
}

// ─── 관리자 대시보드 ──────────────────────────────────────
export interface TeamDashboardData {
  teamId: string;
  teamName: string;
  memberCount: number;
  avgFocusScore: number;
  avgEfficiency: number;
  avgGoalAlignment: number;
  bottlenecks: BottleneckAlert[];
  topPerformers: PerformerSummary[];
  departmentTrends: DailyTrend[];
}

export interface BottleneckAlert {
  id: string;
  type: 'low_focus' | 'high_context_switch' | 'low_alignment' | 'overwork' | 'underutilized';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  affectedUsers: number;
  suggestion: string;
}

export interface PerformerSummary {
  userId: string;
  displayName: string;
  department: string;
  overallScore: number;
  focusScore: number;
  streak: number;               // 연속 고성과 일수
}

// ─── 보상 체계 ────────────────────────────────────────────
export interface RewardTier {
  id: string;
  name: string;
  minScore: number;
  maxScore: number;
  benefits: string[];
  color: string;
  icon: string;
}

export interface EmployeeRewardStatus {
  userId: string;
  currentTier: string;
  currentScore: number;
  streakDays: number;
  unlockedBenefits: string[];
  nextTierProgress: number;       // 다음 티어까지 진행률 (0-100)
}

// ─── 데이터 검토/승인 흐름 (Privacy Firewall) ─────────────
export interface DataReviewItem {
  id: string;
  metricsId: string;
  userId: string;
  date: string;
  metrics: PerformanceMetrics;
  userNotes?: string;             // 직원이 남긴 코멘트
  editedFields?: string[];        // 직원이 수정한 필드 목록
  reviewedAt?: string;
  decision: 'pending' | 'approved' | 'rejected' | 'edited';
}

// ─── KPI/OKR 연동 ────────────────────────────────────────
export interface IntegrationConfig {
  id: string;
  organizationId: string;
  type: 'jira' | 'slack' | 'notion' | 'asana' | 'custom_webhook';
  enabled: boolean;
  webhookUrl?: string;
  apiKey?: string;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
  fieldMappings: FieldMapping[];
}

export interface FieldMapping {
  sourceField: string;            // ProofWork 필드명
  targetField: string;            // 외부 시스템 필드명
  transform?: 'none' | 'percentage' | 'hours' | 'grade';
}

// ─── Notion 연동 ──────────────────────────────────────────
export interface NotionSettings {
  apiKey: string;                  // Notion Integration Token
  databaseId: string;              // Notion Database ID
  statusProperty: string;          // Status 속성명 (예: '상태', 'Status')
  doingValue: string;              // Doing 상태 값 (예: '진행 중', 'In Progress')
  doneValue: string;               // Done 상태 값 (예: '완료', 'Done')
  progressProperty: string;        // 달성률 숫자 속성명 (예: '달성률', 'Progress')
  assigneeProperty: string;        // 담당자 속성명 (예: '담당자', 'Assignee')
  enabled: boolean;
}

export interface NotionTask {
  id: string;                      // Notion page ID
  title: string;
  status: string;
  progress?: number;               // 0-100 달성률
  assignee?: string;
  url: string;
  lastEdited?: string;
  aiAnalysis?: {
    estimatedProgress: number;     // AI 추정 달성률 (0-100)
    isDone: boolean;               // 완료 여부
    reason: string;                // 판단 근거
  };
}

// ─── 알림/로그 ────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'review_ready' | 'report_generated' | 'tier_upgrade' | 'goal_achieved' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}
