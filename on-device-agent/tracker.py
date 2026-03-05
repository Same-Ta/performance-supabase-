"""
ProofWork — 실시간 윈도우 활동 추적기

win32gui로 활성 윈도우 타이틀을 읽어서
앱별/카테고리별 사용시간을 실시간 집계합니다.
"""

import time
import ctypes
import ctypes.wintypes
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
import structlog

logger = structlog.get_logger(__name__)

# ─── 소프트웨어 카테고리 맵 ───────────────────────────
SOFTWARE_CATEGORIES: dict[str, list[str]] = {
    "development": [
        "visual studio code", "vs code", "code -", "intellij", "pycharm",
        "webstorm", "android studio", "eclipse", "sublime text",
        "windows terminal", "powershell", "cmd.exe", "git bash",
        "windows powershell", "terminal",
    ],
    "communication": [
        "slack", "microsoft teams", "teams", "discord", "outlook",
        "gmail", "thunderbird", "kakaotalk", "카카오톡", "zoom",
        "google meet", "webex", "skype", "line",
    ],
    "documentation": [
        "notion", "confluence", "google docs", "word",
        "hackmd", "obsidian", "typora", "onenote", "한글",
        "google sheets", "excel",
    ],
    "design": [
        "figma", "sketch", "photoshop", "illustrator",
        "adobe xd", "canva", "blender",
    ],
    "project_mgmt": [
        "jira", "asana", "trello", "linear",
        "monday", "clickup", "github issues",
    ],
    "browser": [
        "chrome", "firefox", "edge", "safari", "opera", "brave",
        "google chrome", "mozilla firefox", "microsoft edge",
    ],
    "meeting": [
        "zoom meeting", "google meet", "teams 모임",
        "webex meeting",
    ],
}

# 생산적 카테고리
PRODUCTIVE_CATEGORIES = {"development", "documentation", "design", "project_mgmt"}


@dataclass
class ActivityRecord:
    """단일 활동 기록"""
    timestamp: float
    window_title: str
    app_name: str
    category: str
    duration_sec: float = 0.0


@dataclass
class SessionData:
    """세션 전체 데이터"""
    session_id: str
    user_id: str
    start_time: float = field(default_factory=time.time)
    end_time: float = 0.0

    # 카테고리별 누적 초
    category_seconds: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    # 앱별 누적 초
    app_seconds: dict[str, float] = field(default_factory=lambda: defaultdict(float))

    # 컨텍스트 전환
    context_switches: int = 0
    _last_category: str = ""

    # 딥포커스 추적
    deep_focus_total_sec: float = 0.0
    _focus_start: float = 0.0
    _focus_category: str = ""
    _DEEP_FOCUS_THRESHOLD: float = 1200.0  # 20분

    # 기록
    total_records: int = 0
    idle_seconds: float = 0.0

    # 타임라인 세그먼트 (TimeDoctor 스타일 구체적 활동 기록)
    timeline: list = field(default_factory=list)
    _seg_start: float = 0.0       # 현재 세그먼트 시작 타임스탬프
    _seg_title: str = ""           # 현재 세그먼트 윈도우 타이틀
    _seg_app: str = ""             # 현재 세그먼트 앱 이름
    _seg_category: str = ""        # 현재 세그먼트 카테고리


class WindowTracker:
    """Windows 활성 윈도우 제목 추적기"""

    def __init__(self, poll_interval: float = 3.0):
        self.poll_interval = poll_interval
        self._session: SessionData | None = None
        self._running = False
        self._prev_title = ""
        self._idle_threshold = 300  # 5분 동안 같은 타이틀 = idle 의심

    def start_session(self, session_id: str, user_id: str) -> SessionData:
        self._session = SessionData(session_id=session_id, user_id=user_id)
        self._running = True
        self._prev_title = ""
        logger.info("tracking_session_started", session_id=session_id)
        return self._session

    def stop_session(self) -> SessionData | None:
        self._running = False
        if self._session:
            self._session.end_time = time.time()
            # 마지막 딥포커스 구간 마감
            self._close_focus_period()
            # 마지막 타임라인 세기먼트 마감
            self._close_timeline_segment()
        return self._session

    def get_live_stats(self) -> dict:
        """현재 세션 실시간 통계 (대시보드 폴링용)"""
        if not self._session:
            return {}
        s = self._session
        elapsed = time.time() - s.start_time
        cat_secs: dict = dict(s.category_seconds)
        total_active = sum(cat_secs.values())
        top_cat = max(cat_secs, key=lambda k: cat_secs[k]) if cat_secs else "idle"
        return {
            "elapsedMinutes": round(elapsed / 60, 1),
            "activeMinutes": round(total_active / 60, 1),
            "idleMinutes": round(s.idle_seconds / 60, 1),
            "contextSwitches": s.context_switches,
            "deepFocusMinutes": round(s.deep_focus_total_sec / 60, 1),
            "topCategory": top_cat,
            "categoryBreakdown": {
                k: round(v / 60, 1) for k, v in cat_secs.items()
            },
        }

    @property
    def is_running(self) -> bool:
        return self._running

    def poll_once(self) -> ActivityRecord | None:
        """한 번 윈도우 타이틀을 읽고 세션에 기록"""
        if not self._session:
            return None

        title = self._get_foreground_title()
        if not title:
            # 잠금화면 등
            self._session.idle_seconds += self.poll_interval
            return None

        app_name = self._extract_app_name(title)
        category = self._classify(title, app_name)

        # 유휴 감지 (동일 창 5분 이상 + 특정 패턴)
        is_idle = self._check_idle(title)
        if is_idle:
            self._session.idle_seconds += self.poll_interval
            category = "idle"

        record = ActivityRecord(
            timestamp=time.time(),
            window_title=title,
            app_name=app_name,
            category=category,
            duration_sec=self.poll_interval,
        )

        if not is_idle:
            # 시간 누적
            self._session.category_seconds[category] += self.poll_interval
            self._session.app_seconds[app_name] += self.poll_interval

            # 컨텍스트 전환
            if category != self._session._last_category and self._session._last_category:
                self._session.context_switches += 1
            self._session._last_category = category

            # 딥포커스
            self._track_focus(category)
            # 타임라인 세기먼트 관리: 앱이 바뀌면 이전 세기먼트 저장
            if app_name != self._session._seg_app or category != self._session._seg_category:
                self._close_timeline_segment()
                self._session._seg_start = time.time()
                self._session._seg_app = app_name
                self._session._seg_title = title
                self._session._seg_category = category
            else:
                # 동일 앱 계속 중: 타이틀만 업데이트 (변경될 수 있음)
                self._session._seg_title = title
        self._session.total_records += 1
        self._prev_title = title
        return record

    # ─── Private ────────────────────────────

    @staticmethod
    def _get_foreground_title() -> str:
        """활성 윈도우 타이틀 가져오기 (ctypes 직접 호출)"""
        try:
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            if length == 0:
                return ""
            buf = ctypes.create_unicode_buffer(length + 1)
            ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
            return buf.value
        except Exception:
            return ""

    @staticmethod
    def _extract_app_name(title: str) -> str:
        """타이틀에서 앱 이름 추출"""
        if not title:
            return "Unknown"

        # "파일명 - 앱이름" 패턴
        for sep in [" - ", " — ", " | ", " · "]:
            if sep in title:
                parts = title.split(sep)
                return parts[-1].strip()

        return title[:50]

    @staticmethod
    def _classify(title: str, app_name: str) -> str:
        """윈도우 타이틀 → 카테고리 분류"""
        lower_title = title.lower()
        lower_app = app_name.lower()

        for category, keywords in SOFTWARE_CATEGORIES.items():
            for kw in keywords:
                if kw in lower_title or kw in lower_app:
                    return category

        return "other"

    def _check_idle(self, title: str) -> bool:
        """간단한 유휴 감지"""
        idle_patterns = ["잠금 화면", "lock screen", "로그인", "sign in", "screensaver"]
        lower = title.lower()
        return any(p in lower for p in idle_patterns)

    def _track_focus(self, category: str):
        """딥포커스 구간 추적"""
        s = self._session
        if not s:
            return

        now = time.time()
        if category != s._focus_category:
            # 카테고리 변경 → 이전 포커스 구간 종료
            self._close_focus_period()
            s._focus_start = now
            s._focus_category = category
        # 동일 카테고리 유지 → 계속 추적

    def _close_focus_period(self):
        s = self._session
        if not s or s._focus_start == 0:
            return
        duration = time.time() - s._focus_start
        if duration >= s._DEEP_FOCUS_THRESHOLD:
            s.deep_focus_total_sec += duration
        s._focus_start = 0
        s._focus_category = ""

    def _close_timeline_segment(self):
        """현재 진행 중인 타임라인 세그먼트를 닫고 저장"""
        s = self._session
        if not s or s._seg_start == 0 or not s._seg_app:
            return
        now = time.time()
        duration_sec = now - s._seg_start
        duration_min = round(duration_sec / 60, 1)
        # 1분 미만 세그먼트는 노이즈로 제외
        if duration_min < 1.0:
            return
        start_dt = datetime.fromtimestamp(s._seg_start)
        end_dt = datetime.fromtimestamp(now)
        s.timeline.append({
            "startTime": start_dt.strftime("%H:%M"),
            "endTime": end_dt.strftime("%H:%M"),
            "app": s._seg_app,
            "windowTitle": s._seg_title[:100],
            "category": s._seg_category,
            "durationMinutes": duration_min,
            "description": self._make_description(s._seg_app, s._seg_title, s._seg_category, duration_min),
        })
        s._seg_start = 0.0
        s._seg_app = ""
        s._seg_title = ""
        s._seg_category = ""

    @staticmethod
    def _make_description(app: str, title: str, category: str, minutes: float) -> str:
        """타임라인 카드에 표시할 구체적 설명 생성"""
        duration_str = f"{int(minutes)}분"
        # 파일명이나 탭 제목을 추출 (예: "main.py - Visual Studio Code")
        subject = title
        for sep in [" - ", " — ", " | ", " · "]:
            if sep in title:
                subject = title.split(sep)[0].strip()
                break
        subject = subject[:50]

        CAT_LABELS = {
            "development": "개발 작업",
            "communication": "커뮤니케이션",
            "documentation": "문서 작업",
            "design": "디자인 작업",
            "project_mgmt": "프로젝트 관리",
            "browser": "웹 검색",
            "meeting": "회의",
            "idle": "자리 비움",
            "other": "기타",
        }
        cat_label = CAT_LABELS.get(category, "작업")
        if subject and subject.lower() not in app.lower():
            return f"{subject} ({cat_label}, {duration_str})"
        return f"{app} - {cat_label} ({duration_str})"
