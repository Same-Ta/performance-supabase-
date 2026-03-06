# ProofWork — 코드 리뷰용 프로젝트 구조 문서

> **최종 갱신**: 2026-03-06  
> **저장소**: https://github.com/Same-Ta/performance

---

## 1. 프로젝트 개요

**ProofWork**는 On-Device AI 기반 자율 성과 증명 및 관리 솔루션입니다.

| 항목 | 내용 |
|------|------|
| 목적 | 직원의 업무 활동을 로컬에서 분석하여 성과 메트릭을 자동 산출하고, 사용자 승인 후 클라우드에 동기화 |
| 핵심 가치 | Privacy-by-Design (로컬 분석 → 사용자 승인 → 최소 전송) |
| 대상 사용자 | Employee, Manager, HR Admin, Super Admin (4 역할 RBAC) |

### 기술 스택 요약

| 레이어 | 기술 | 버전 |
|--------|------|------|
| Frontend | React 19 + Vite 6 + TypeScript 5.7 | `react@19`, `vite@6` |
| Styling | Tailwind CSS 3.4 + Pretendard 폰트 | |
| 차트 | Recharts 2.15 | |
| Backend | Firebase (Auth, Firestore, Cloud Functions v2) | `firebase-functions@6+` |
| AI (Cloud) | Gemini 2.0 Flash (`@google/generative-ai`) | |
| AI (On-Device) | ONNX Runtime (MobileNetV3-Small) | Python 3.10+ |
| Agent | Python + win32gui + mss + structlog | Windows 전용 |
| 로컬 API | Flask + flask-cors | 포트 5001 |

---

## 2. 디렉토리 구조

```
Performance/
├── .vscode/                        # VS Code 실행/태스크 설정
│   ├── launch.json
│   └── tasks.json
│
├── frontend/                       # ── React 프론트엔드 ──
│   ├── index.html                  # SPA 진입점 (Pretendard 폰트 로드)
│   ├── package.json                # 의존성 (react, firebase, recharts, gemini 등)
│   ├── vite.config.ts              # Vite 설정 (포트 3000, @/ alias)
│   ├── tsconfig.json               # TypeScript 설정 (bundler moduleResolution)
│   ├── tailwind.config.js          # Tailwind 커스텀 색상 (brand, success, warning, danger)
│   ├── postcss.config.js
│   └── src/
│       ├── main.tsx                # ReactDOM.createRoot 진입점
│       ├── App.tsx                 # 라우팅 (BrowserRouter, ProtectedRoute, PublicRoute)
│       ├── vite-env.d.ts
│       │
│       ├── config/
│       │   └── firebase.ts         # Firebase 초기화 (Auth, Firestore, Functions)
│       │
│       ├── contexts/
│       │   └── AuthContext.tsx      # 인증 컨텍스트 (Firebase Auth + 데모 모드)
│       │
│       ├── types/
│       │   └── index.ts            # 전체 TypeScript 타입 정의 (45+ 인터페이스)
│       │
│       ├── hooks/
│       │   └── usePerformance.ts   # 커스텀 훅 6개 (Dashboard, GoalAlignment, DataReview, Report, Team, Reward)
│       │
│       ├── services/
│       │   ├── analyticsService.ts # 성과 분석 공식 (Focus, Efficiency, GoalAlignment, 보상 티어)
│       │   ├── browserTracker.ts   # 브라우저 기반 업무 추적기 (에이전트 미설치 시 대체)
│       │   ├── firestoreService.ts # Firestore CRUD (메트릭, 리포트, 리뷰, 팀, 워크스페이스 등)
│       │   ├── geminiService.ts    # Gemini 2.0 Flash API (일일 요약, 성과 리뷰, 팀 병목 분석)
│       │   └── seedService.ts      # 개발용 시드 데이터 생성기
│       │
│       ├── components/
│       │   ├── Layout.tsx          # 사이드바 + 메인 콘텐츠 레이아웃 (RBAC 기반 네비게이션)
│       │   ├── agent/
│       │   │   └── AgentControlPanel.tsx  # Python Agent 연결/시작/종료 + 브라우저 추적
│       │   ├── charts/
│       │   │   ├── EfficiencyChart.tsx    # 효율성 트렌드 (Recharts BarChart)
│       │   │   ├── FocusChart.tsx         # 몰입도 트렌드 (Recharts AreaChart)
│       │   │   └── GoalAlignmentChart.tsx # 목표 정렬도 (RadarChart)
│       │   ├── dashboard/
│       │   │   ├── ActivityTimeline.tsx    # 활동 타임라인 (TimeDoctor 스타일)
│       │   │   ├── BottleneckAlert.tsx    # 병목 알림 카드
│       │   │   ├── ManualTimeEntry.tsx    # 수동 시간 입력
│       │   │   ├── MetricCard.tsx         # 개별 메트릭 카드
│       │   │   ├── ProductivityOverview.tsx# 생산성 오버뷰
│       │   │   ├── TeamOverview.tsx       # 팀 오버뷰 (상위 퍼포머, 월간 비교)
│       │   │   └── WorkspaceTimeline.tsx  # 워크스페이스 타임라인
│       │   ├── report/
│       │   │   └── ReportPreview.tsx      # 성과 리포트 미리보기
│       │   └── review/
│       │       └── DataReviewCard.tsx     # 데이터 검토/승인 카드
│       │
│       ├── pages/
│       │   ├── Login.tsx              # 로그인/회원가입 + 데모 모드 (4역할)
│       │   ├── EmployeeDashboard.tsx   # 직원 대시보드 (메트릭, 타임라인, 에이전트 패널)
│       │   ├── ManagerDashboard.tsx    # 매니저 대시보드 (팀 오버뷰, 병목 분석)
│       │   ├── ReviewApproval.tsx     # 데이터 검토/승인 페이지
│       │   ├── PerformanceReport.tsx  # 성과 리포트 페이지 (AI 생성)
│       │   ├── RewardCenter.tsx       # 리워드 센터 (티어, 포인트, 혜택)
│       │   ├── TeamManagement.tsx     # 워크스페이스 생성/관리/멤버 초대
│       │   ├── TeamInvite.tsx         # (TeamManagement로 리다이렉트)
│       │   └── Settings.tsx           # 설정 (프로필 편집, 시드 데이터 생성)
│       │
│       └── styles/
│           └── globals.css            # Tailwind + 커스텀 유틸리티 클래스 (card, btn, badge 등)
│
├── backend/                        # ── Firebase 백엔드 ──
│   ├── firebase.json               # 에뮬레이터 설정 (functions:5002, ui:4001)
│   ├── firestore.rules             # Firestore 보안 규칙 (RBAC 기반)
│   ├── firestore.indexes.json      # 복합 인덱스 (4개)
│   └── functions/
│       ├── package.json            # firebase-functions, firebase-admin, axios
│       ├── tsconfig.json           # CommonJS, ES2020, strict
│       └── src/
│           └── index.ts            # Cloud Functions 5개 (아래 상세)
│
├── on-device-agent/                # ── Python Agent (Windows) ──
│   ├── main.py                     # CLI 엔트리포인트 (로그인 → 추적 → 메트릭 → 전송)
│   ├── server.py                   # Flask HTTP API (localhost:5001) — 대시보드 연동
│   ├── config.py                   # 전역 설정 (Pydantic BaseModel)
│   ├── tracker.py                  # WindowTracker (win32gui 활성 윈도우 추적)
│   ├── metrics_engine.py           # 메트릭 계산기 (세션 → 스코어 → Firestore 형식)
│   ├── firebase_client.py          # Firebase REST API 클라이언트 (인증 + CRUD)
│   ├── requirements.txt            # Python 의존성
│   ├── pyrightconfig.json
│   ├── analyzer/                   # 비전/컨텍스트 분석 (ONNX 기반, 현재 보조적)
│   │   ├── __init__.py
│   │   ├── vision_engine.py        # ONNX Runtime 비전 추론 (MobileNetV3)
│   │   ├── context_analyzer.py     # 프레임 기반 컨텍스트 분석
│   │   └── metrics_calculator.py   # 성과 메트릭 정식 계산기
│   ├── capture/
│   │   ├── __init__.py
│   │   └── screen_capture.py       # mss 기반 화면 캡처
│   ├── models/
│   │   └── README.md               # ONNX 모델 배치 가이드
│   ├── privacy/
│   │   ├── __init__.py
│   │   └── data_sanitizer.py       # PII 마스킹, 민감 키워드 필터링, 감사 로그
│   └── sync/
│       ├── __init__.py
│       └── firebase_sync.py        # 큐 기반 Firebase Admin SDK 동기화
│
└── docs/
    ├── ARCHITECTURE.md             # 아키텍처 개요 (Mermaid 다이어그램)
    └── PROJECT_REVIEW.md           # 이 문서
```

---

## 3. 데이터 흐름 (Data Flow)

```
[사용자 PC]                          [Firebase Cloud]              [웹 대시보드]
    │                                       │                           │
    ├── WindowTracker (win32gui)             │                           │
    │   활성 윈도우 타이틀 3초 간격 폴링      │                           │
    │                                       │                           │
    ├── metrics_engine.compute_metrics()    │                           │
    │   Focus/Efficiency/Output/GoalAlign    │                           │
    │                                       │                           │
    ├── firebase_client.submit_metrics() ──→ Firestore                  │
    │   (REST API, ID Token 인증)           (performance_metrics)       │
    │                                       │                           │
    │                          onPerformanceSubmit ──→ rewards 업데이트   │
    │                          aggregateTeamDashboard (매일 00:30)      │
    │                                       │                           │
    │                                       ├──────────────────→ firestoreService.ts
    │                                       │                   usePerformance.ts
    │                                       │                   geminiService.ts (AI 요약)
    │                                       │                           │
    └── server.py (localhost:5001) ←───────────────────── AgentControlPanel.tsx
        /start, /stop, /status              │               (실시간 제어)
```

---

## 4. 프론트엔드 상세

### 4.1 라우팅 구조

| 경로 | 페이지 | 접근 권한 |
|------|--------|-----------|
| `/login` | Login.tsx | 비인증 |
| `/dashboard` | EmployeeDashboard.tsx | 모든 역할 |
| `/manager` | ManagerDashboard.tsx | Manager+ |
| `/review` | ReviewApproval.tsx | 모든 역할 |
| `/report` | PerformanceReport.tsx | 모든 역할 |
| `/team-invite`, `/team` | TeamManagement.tsx | 모든 역할 |
| `/settings` | Settings.tsx | 모든 역할 |

### 4.2 인증 흐름

- **Firebase Auth**: 이메일/비밀번호 로그인, 회원가입
- **데모 모드**: `demoLogin(role)` — Firebase 연결 없이 4가지 역할로 즉시 체험
- 인증 상태는 `AuthContext`에서 관리, `onAuthStateChanged` 구독
- Firebase 미연결 시 3초 타임아웃 후 자동 데모 모드 전환

### 4.3 핵심 서비스

#### `analyticsService.ts` — 스코어링 공식
```
종합 점수 = 산출물(30%) + 효율성(25%) + 몰입도(25%) + 목표정렬도(20%)

몰입도(Focus) = 0.35×(1-CSR/3.0) + 0.40×DFR + 0.25×(ID/120)
  CSR: 컨텍스트 전환율(회/분)
  DFR: 딥포커스비율 = 딥포커스시간/활성시간
  ID: 입력밀도(actions/min)

효율성(Efficiency) = OutputScore × (ActiveMin/TotalMin) × AlignmentBonus

등급: S(90+), A(80+), B(70+), C(60+), D(60 미만)
```

#### `browserTracker.ts` — 브라우저 기반 추적
- Python Agent 미설치 시 대안으로 브라우저 내 활동 추적
- `mousemove`, `keydown`, `scroll`, `visibilitychange` 이벤트 리스너
- 2분 유휴 감지, 10분+ 연속 활성 = 딥포커스
- 싱글톤 `browserTracker` 인스턴스

#### `geminiService.ts` — AI 분석
- `generateDailySummary()`: 일일 업무 요약 (2-3문장 + 성과 + 개선점)
- `generatePerformanceReview()`: 기간별 종합 평가 + 연봉 협상 포인트
- `analyzeTeamBottlenecks()`: 팀 병목 진단 (5가지 유형)
- 모두 JSON 형식 반환, 파싱 실패 시 fallback 제공

#### `firestoreService.ts` — 데이터 접근 계층
- 13개 Firestore 컬렉션 CRUD 함수
- 팀 초대, 워크스페이스, 알림, 연동 설정 지원
- `getMetricsByUser()`, `submitMetrics()`, `getPendingReviews()` 등

### 4.4 커스텀 훅

| 훅 | 용도 | 데이터 소스 |
|----|------|-------------|
| `useEmployeeDashboard(userId)` | 직원 대시보드 메트릭, 트렌드, 평균 | Firestore |
| `useGoalAlignment()` | 목표 정렬도 (현재 하드코딩 TODO) | 로컬 |
| `useDataReview(userId)` | 데이터 검토 항목 CRUD | Firestore |
| `usePerformanceReport(userId, userName)` | 성과 리포트 생성 | Firestore + 계산 |
| `useTeamDashboard(teamId)` | 팀 대시보드 데이터 | Firestore |
| `useRewardStatus(userId)` | 보상 티어/포인트 상태 | Firestore |

### 4.5 리워드 티어 시스템

| 티어 | 점수 | 아이콘 | 혜택 |
|------|------|--------|------|
| Explorer | 0–59 | 🌱 | 기본 근무 |
| Achiever | 60–74 | ⭐ | 유연 출근±1h, 월1 재택 |
| Specialist | 75–84 | 💎 | 유연 출근±2h, 주2 재택, 교육비 50% |
| Master | 85–94 | 🏆 | 완전 유연, 주3 재택, 교육비 전액, 성과급 |
| Legend | 95–100 | 👑 | 완전 자율, 무제한 재택, 스톡옵션 |

---

## 5. 백엔드 상세

### 5.1 Cloud Functions (5개)

| 함수 | 트리거 | 리전 | 설명 |
|------|--------|------|------|
| `onPerformanceSubmit` | Firestore `performance_metrics/{id}` 문서 변경 | us-central1 | 성과 제출 → 30일 평균 계산 → 보상 티어 업데이트 → 알림 생성 |
| `aggregateTeamDashboard` | 매일 00:30 KST (Scheduler) | asia-northeast3 | 팀별 전일 평균 (Focus, Efficiency, GoalAlignment) 집계 |
| `syncJira` | HTTP POST | asia-northeast3 | Jira 프로젝트에 성과 데이터 동기화 |
| `sendSlackNotification` | HTTP POST | asia-northeast3 | Slack 채널에 일일 성과 요약 전송 |
| `mapMetricsToGoals` | HTTP POST | asia-northeast3 | 메트릭 → OKR/KPI 자동 매핑 (앱+키워드 기반) |

### 5.2 Firestore 컬렉션

| 컬렉션 | 주요 필드 | 접근 규칙 |
|--------|-----------|-----------|
| `users` | uid, role, department, teamId, agentConnected | 인증된 사용자 읽기, 본인만 생성/수정 |
| `performance_metrics` | userId, date, focusScore, efficiencyScore, ... | 본인+매니저+ 읽기, 본인만 쓰기/삭제 |
| `data_reviews` | userId, metricsId, decision | 본인만 접근 |
| `performance_reports` | userId, period, overallScore, overallGrade | 본인+매니저+ 읽기 |
| `goals` | organizationId, type(okr/kpi), keywords | 인증된 사용자 읽기, 매니저+ 쓰기 |
| `team_dashboards` | teamId, avgFocusScore, avgEfficiency | 같은 팀+매니저+ 읽기, Functions만 쓰기 |
| `rewards` | userId, currentTier, currentScore, streakDays | 본인+매니저+ 읽기, Functions만 쓰기 |
| `integrations` | organizationId, type(jira/slack/...) | 인증된 사용자 읽기, 매니저+ 쓰기 |
| `notifications` | userId, type, read | 본인만 접근, Functions만 생성 |
| `activity_logs` | userId, action, timestamp | super_admin만 읽기, Functions만 쓰기 |
| `team_invites` | inviterUid, email, status | 초대/수락 흐름 |
| `workspaces` | ownerId, members[], memberIds[] | 멤버십 기반 |

### 5.3 Firestore 인덱스 (4개)

1. `performance_metrics` — userId ASC, date DESC
2. `performance_reports` — userId ASC, createdAt DESC
3. `data_reviews` — userId ASC, decision ASC, date DESC
4. `notifications` — userId ASC, createdAt DESC

---

## 6. On-Device Agent 상세

### 6.1 실행 모드

| 모드 | 명령어 | 설명 |
|------|--------|------|
| CLI 인터랙티브 | `python main.py` | 터미널에서 직접 로그인 → 추적 → 리포트 |
| CLI 자동화 | `python main.py --email x --password y --duration 60` | 자동 로그인, 60분 후 종료 |
| HTTP Server | `python server.py` | localhost:5001 API 서버 (대시보드 연동) |

### 6.2 HTTP API (server.py)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/health` | GET | 서버 상태 확인 |
| `/status` | GET | 추적 상태 + 실시간 통계 |
| `/start` | POST | 추적 시작 (uid, idToken, taskType) |
| `/stop` | POST | 추적 종료 + 메트릭 계산 + Firebase 전송 |

### 6.3 WindowTracker (tracker.py)

- `ctypes.windll.user32.GetForegroundWindow()` — 활성 윈도우 타이틀 읽기
- 소프트웨어 카테고리 7종: development, communication, documentation, design, project_mgmt, browser, meeting
- 생산적 카테고리: development, documentation, design, project_mgmt
- 딥포커스: 동일 카테고리 20분+ 연속 유지
- 유휴 감지: 잠금화면, 로그인 패턴
- 타임라인 세그먼트 자동 생성 (앱/카테고리 변경 시 저장, 1분 미만 무시)

### 6.4 메트릭 계산 (metrics_engine.py)

```
Focus  = 0.35×(1 - CSR/3.0) + 0.40×min(1, DFR) + 0.25×min(1, activeRatio)
Output = min(100, productive_sec/active_sec × 100 × 1.1)
Efficiency = min(100, output × activeRatio × 1.2)
GoalAlignment = productive_sec/active_sec × 100
Overall = Output×0.30 + Efficiency×0.25 + Focus×0.25 + GoalAlignment×0.20

리워드 포인트 = overall × 10 × tier_multiplier
```

### 6.5 Firebase 클라이언트 (firebase_client.py)

- **인증**: REST API (`identitytoolkit.googleapis.com`)
- **Firestore CRUD**: REST API (`firestore.googleapis.com`)
- **토큰 캐싱**: `~/.proofwork/auth_token.json` (자동 갱신)
- `set_external_token()`: 프론트엔드 Firebase Auth 토큰 주입 지원
- Firestore JSON 직렬화/역직렬화 자체 구현

### 6.6 프라이버시 (data_sanitizer.py)

- 4단계 동의 수준: None, Basic, Standard(기본), Full
- PII 자동 탐지: 이메일, 전화번호, 주민등록번호, 카드번호, IP, URL 토큰
- 민감 키워드 필터링: password, 비밀번호, 급여, 연봉, 계좌 등
- 프레임 보안 삭제: `secure_delete_frame()` (메모리 제로화)
- 감사 로그 (최대 10,000건)

---

## 7. 환경 변수

### 프론트엔드 (.env)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_GEMINI_API_KEY=
```

### On-Device Agent (.env)

```
FIREBASE_API_KEY=  # 기본값 하드코딩됨
FIREBASE_PROJECT_ID=performance-23a03                         # 기본값 하드코딩됨
```

---

## 8. 의존성 목록

### 프론트엔드 (frontend/package.json)

**Runtime**:
| 패키지 | 버전 | 용도 |
|--------|------|------|
| `react` | ^19.0.0 | UI 프레임워크 |
| `react-dom` | ^19.0.0 | DOM 렌더링 |
| `react-router-dom` | ^7.1.0 | SPA 라우팅 |
| `firebase` | ^11.1.0 | Firebase SDK (Auth, Firestore, Functions) |
| `@google/generative-ai` | ^0.21.0 | Gemini AI API |
| `recharts` | ^2.15.0 | 데이터 시각화 차트 |
| `lucide-react` | ^0.468.0 | 아이콘 |
| `date-fns` | ^4.1.0 | 날짜 유틸리티 |
| `clsx` | ^2.1.1 | 조건부 CSS 클래스 |

**Dev**:
| 패키지 | 버전 | 용도 |
|--------|------|------|
| `vite` | ^6.0.0 | 빌드 도구 |
| `typescript` | ^5.7.0 | 타입 시스템 |
| `@vitejs/plugin-react` | ^4.3.4 | Vite React 플러그인 |
| `tailwindcss` | ^3.4.17 | 유틸리티 CSS |
| `postcss` | ^8.4.49 | CSS 처리 |
| `autoprefixer` | ^10.4.20 | 브라우저 호환 |
| `@types/react` | ^19.0.0 | React 타입 |
| `@types/react-dom` | ^19.0.0 | ReactDOM 타입 |

### 백엔드 (backend/functions/package.json)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `firebase-admin` | ^12.0.0+ | Firebase Admin SDK |
| `firebase-functions` | ^6.0.0+ | Cloud Functions v2 |
| `axios` | ^1.7.0 | HTTP 클라이언트 (Jira/Slack 연동) |
| `typescript` | ^5.7.0 | (dev) |

### On-Device Agent (requirements.txt)

| 패키지 | 용도 |
|--------|------|
| `psutil` | 시스템 리소스 모니터링 |
| `python-dotenv` | .env 파일 로드 |
| `pydantic` | 설정 모델 (타입 안전) |
| `structlog` | 구조화된 로깅 |
| `schedule` | 주기적 태스크 |
| `pywin32` | Windows 활성 윈도우 API |
| `mss` | 화면 캡처 (선택) |
| `Pillow` | 이미지 처리 (선택) |
| `requests` | Firebase REST API |
| `pystray` | 시스템 트레이 아이콘 (선택) |
| `flask` | 로컬 HTTP 서버 (server.py용, requirements.txt에 미포함) |
| `flask-cors` | CORS 처리 (server.py용, requirements.txt에 미포함) |

---

## 9. 실행 가이드

### 프론트엔드

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000 (Vite 개발 서버)
```

- Firebase 환경 변수 없이도 **데모 모드**로 동작 (로그인 페이지에서 역할 선택)
- Gemini API 없으면 AI 요약에 fallback 텍스트 표시

### 백엔드 (Firebase Functions 에뮬레이터)

```bash
cd backend/functions
npm install
npm run build                              # TypeScript → JavaScript 빌드

cd ..
firebase emulators:start --only functions  # 에뮬레이터 시작 (포트 5002)
```

- `firebase login` 없이도 `--only functions`로 기본 실행 가능
- Firestore 에뮬레이터 없으면 `onPerformanceSubmit`(Firestore trigger) 무시
- PubSub 에뮬레이터 없으면 `aggregateTeamDashboard`(Scheduler) 무시
- HTTP 함수 3개(`syncJira`, `sendSlackNotification`, `mapMetricsToGoals`)는 정상 작동

### On-Device Agent

```bash
cd on-device-agent
pip install -r requirements.txt
pip install flask flask-cors             # server.py 실행 시 추가 필요

python main.py                           # CLI 모드
python server.py                         # HTTP 서버 모드 (localhost:5001)
```

- **Windows 전용** (win32gui 의존)
- Python 3.10+ 필요
- `.env` 파일에 `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID` 설정 권장

---

## 10. 코드 리뷰 체크포인트

### 아키텍처
- [x] 3-티어 구조 (Agent → Backend → Frontend) 명확한 분리
- [x] Privacy-by-Design: 로컬 분석 → 사용자 승인 → 최소 전송
- [x] RBAC 4역할 (employee, manager, hr_admin, super_admin)
- [x] Firestore Rules로 서버사이드 접근 제어
- [x] 데모 모드로 Firebase 인프라 없이 프론트엔드 단독 구동

### 프론트엔드
- [x] TypeScript strict 모드
- [x] 컴포넌트/페이지/서비스/훅 명확한 레이어 분리
- [x] Tailwind CSS 커스텀 디자인 시스템 (brand, success, warning, danger 색상)
- [x] Firebase SDK v11 + Functions v2 API 사용
- [x] Gemini AI 연동 (3가지 분석 기능)
- [x] Browser-based 추적기 (에이전트 대안)
- [ ] 테스트 코드 없음
- [ ] ESLint 설정 파일 없음 (package.json에 lint 스크립트는 존재)
- [ ] `useGoalAlignment` 훅의 목표 정렬도 데이터가 하드코딩 (TODO)
- [ ] Error Boundary 미구현
- [ ] i18n 미지원 (한국어 하드코딩)

### 백엔드
- [x] Cloud Functions v2 API 사용 (onDocumentWritten, onSchedule, onRequest)
- [x] Firestore 보안 규칙 상세 구현
- [x] 복합 인덱스 4개 정의
- [ ] 테스트 코드 없음
- [ ] 환경 변수/시크릿 관리 미구현 (Jira API키 등)
- [ ] Rate limiting 없음
- [ ] CORS 설정이 `cors: true`로 전체 허용

### On-Device Agent
- [x] win32gui 기반 실시간 윈도우 추적
- [x] REST API로 Firebase 직접 통신 (Admin SDK 불필요)
- [x] PII 마스킹 및 프라이버시 관리
- [x] 토큰 캐싱 및 자동 갱신
- [x] 타임라인 세그먼트 자동 생성
- [ ] requirements.txt에 flask/flask-cors 누락 (server.py 실행 시 필요)
- [ ] Linux/macOS 미지원 (Windows 전용)
- [ ] ONNX 모델 파일 미포함 (models/ 디렉토리 비어있음)
- [ ] 단위 테스트 없음

---

## 11. 파일별 라인 수 (규모 참고)

| 영역 | 파일 | 대략적 라인 수 |
|------|------|----------------|
| Frontend Types | types/index.ts | ~230 |
| Frontend Hooks | usePerformance.ts | ~270 |
| Frontend Services | firestoreService.ts | ~350 |
| Frontend Services | browserTracker.ts | ~200 |
| Frontend Services | analyticsService.ts | ~200 |
| Frontend Services | geminiService.ts | ~150 |
| Frontend Pages | TeamManagement.tsx | ~850 |
| Frontend Pages | Login.tsx | ~520 |
| Frontend Pages | EmployeeDashboard.tsx | ~300 |
| Frontend Components | AgentControlPanel.tsx | ~600 |
| Backend Functions | index.ts | ~411 |
| Agent | tracker.py | ~336 |
| Agent | firebase_client.py | ~304 |
| Agent | metrics_engine.py | ~229 |
| Agent | main.py | ~190 |
| Agent | server.py | ~160 |
| Agent | data_sanitizer.py | ~228 |
| Agent | context_analyzer.py | ~349 |
| Agent | metrics_calculator.py | ~372 |
| Agent | vision_engine.py | ~297 |
| Agent | firebase_sync.py | ~314 |
