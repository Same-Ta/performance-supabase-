"""
업무 컨텍스트 분석기 (Context Analyzer)

프레임별 분류 결과를 종합하여:
1. 소프트웨어 사용 시간 집계
2. 컨텍스트 전환 횟수/비율 계산
3. 딥 포커스 구간 탐지
4. 입력 밀도 추정
5. 업무 목표 정렬도 산출
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional
import structlog

from config import config

logger = structlog.get_logger(__name__)


@dataclass
class FrameAnalysis:
    """단일 프레임 분석 결과"""
    timestamp: float
    scene_label: str
    scene_confidence: float
    category: str
    window_title: str
    detected_app: str
    text_context: list[str] = field(default_factory=list)


@dataclass
class SessionMetrics:
    """세션(하루) 단위 종합 메트릭"""
    session_id: str
    start_time: float
    end_time: float = 0.0

    # 시간 기반
    total_frames: int = 0
    active_frames: int = 0         # idle 제외 프레임

    # 소프트웨어 사용 시간 (카테고리 → 초)
    category_seconds: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    # 앱별 사용 시간 (앱명 → 초)
    app_seconds: dict[str, float] = field(default_factory=lambda: defaultdict(float))

    # 컨텍스트 전환
    context_switches: int = 0
    last_category: str = ""

    # 딥 포커스
    deep_focus_seconds: float = 0.0
    _current_focus_start: float = 0.0
    _current_focus_category: str = ""
    _deep_focus_threshold: float = 1200.0  # 20분 = 1200초

    # 입력 밀도 (프레임간 변화량 기반 추정)
    estimated_input_events: int = 0

    # 프레임 분석 이력 (최근 N개만 유지)
    _recent_analyses: list[FrameAnalysis] = field(default_factory=list)
    _max_history: int = 100


class ContextAnalyzer:
    """실시간 업무 컨텍스트 분석기"""

    def __init__(self):
        self._current_session: Optional[SessionMetrics] = None
        self._capture_interval = config.capture_interval_sec

    def start_session(self, session_id: str) -> SessionMetrics:
        """새 분석 세션 시작"""
        self._current_session = SessionMetrics(
            session_id=session_id,
            start_time=time.time(),
        )
        logger.info("analysis_session_started", session_id=session_id)
        return self._current_session

    def process_frame_result(
        self,
        scene_label: str,
        scene_confidence: float,
        category: str,
        window_title: str,
        text_context: list[str],
        prev_frame=None,
        curr_frame=None,
    ) -> None:
        """
        프레임 분석 결과를 세션 메트릭에 반영

        Args:
            scene_label: 비전 엔진 분류 라벨
            scene_confidence: 분류 신뢰도
            category: 소프트웨어 카테고리
            window_title: 활성 윈도우 타이틀
            text_context: OCR로 추출된 텍스트
            prev_frame: 이전 프레임 (입력 밀도 추정용)
            curr_frame: 현재 프레임
        """
        if not self._current_session:
            return

        session = self._current_session
        now = time.time()

        # 앱 이름 추출
        detected_app = self._extract_app_name(window_title)

        # 프레임 기록
        analysis = FrameAnalysis(
            timestamp=now,
            scene_label=scene_label,
            scene_confidence=scene_confidence,
            category=category,
            window_title=window_title,
            detected_app=detected_app,
            text_context=text_context,
        )

        session._recent_analyses.append(analysis)
        if len(session._recent_analyses) > session._max_history:
            session._recent_analyses.pop(0)

        session.total_frames += 1

        # 유휴 상태 체크
        is_idle = scene_label in ("idle_lockscreen", "other") and scene_confidence > 0.7
        if not is_idle:
            session.active_frames += 1

        # 카테고리/앱 시간 누적
        time_delta = self._capture_interval
        if not is_idle:
            session.category_seconds[category] += time_delta
            session.app_seconds[detected_app] += time_delta

        # 컨텍스트 전환 감지
        if category != session.last_category and session.last_category:
            session.context_switches += 1
        session.last_category = category

        # 딥 포커스 추적
        self._track_deep_focus(session, category, now, is_idle)

        # 입력 밀도 추정 (프레임 차분 기반)
        if prev_frame is not None and curr_frame is not None:
            self._estimate_input_density(session, prev_frame, curr_frame)

    def finalize_session(self) -> Optional[dict]:
        """
        세션 종료 및 최종 메트릭 산출

        Returns:
            서버 전송용 메트릭 딕셔너리
        """
        if not self._current_session:
            return None

        session = self._current_session
        session.end_time = time.time()
        elapsed = session.end_time - session.start_time

        # === 핵심 지표 계산 ===

        total_minutes = elapsed / 60
        active_minutes = (session.active_frames * self._capture_interval) / 60
        deep_focus_minutes = session.deep_focus_seconds / 60

        # 몰입도 (Focus Score)
        focus_score = self._calculate_focus_score(
            context_switch_rate=session.context_switches / max(active_minutes, 1),
            deep_focus_ratio=deep_focus_minutes / max(active_minutes, 1),
            input_density=session.estimated_input_events / max(active_minutes, 1),
        )

        # 소프트웨어 사용 현황
        software_usage = self._compile_software_usage(session)

        # 출력 점수 (Output Score) - 활성 작업 비율 기반
        output_score = self._estimate_output_score(session)

        # 효율성 (Efficiency Score)
        active_ratio = active_minutes / max(total_minutes, 1)
        efficiency_score = min(100, int(output_score * active_ratio * 1.2))

        result = {
            "sessionId": session.session_id,
            "totalWorkMinutes": round(total_minutes, 1),
            "activeWorkMinutes": round(active_minutes, 1),
            "focusScore": focus_score,
            "efficiencyScore": efficiency_score,
            "outputScore": output_score,
            "contextSwitchCount": session.context_switches,
            "contextSwitchRate": round(
                session.context_switches / max(active_minutes, 1), 2
            ),
            "inputDensity": round(
                session.estimated_input_events / max(active_minutes, 1), 1
            ),
            "deepFocusMinutes": round(deep_focus_minutes, 1),
            "softwareUsage": software_usage,
        }

        logger.info(
            "session_finalized",
            session_id=session.session_id,
            focus=focus_score,
            efficiency=efficiency_score,
        )

        self._current_session = None
        return result

    # ─── Private Methods ────────────────────────

    def _track_deep_focus(
        self, session: SessionMetrics, category: str, now: float, is_idle: bool
    ):
        """딥 포커스 구간 추적 (20분+ 동일 카테고리 무중단)"""
        if is_idle or category != session._current_focus_category:
            # 카테고리 변경 또는 유휴 → 현재 포커스 구간 종료 판정
            if session._current_focus_start > 0:
                duration = now - session._current_focus_start
                if duration >= session._deep_focus_threshold:
                    session.deep_focus_seconds += duration

            # 새 구간 시작
            session._current_focus_start = now
            session._current_focus_category = category
        # 동일 카테고리 유지 중 → 계속 추적

    def _estimate_input_density(
        self, session: SessionMetrics, prev_frame, curr_frame
    ):
        """프레임 차분 기반 입력 활동 추정"""
        import cv2
        import numpy as np

        try:
            # 그레이스케일 변환
            prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
            curr_gray = cv2.cvtColor(curr_frame, cv2.COLOR_BGR2GRAY)

            # 절대 차분
            diff = cv2.absdiff(prev_gray, curr_gray)
            change_ratio = float(np.sum(diff > 20)) / diff.size

            # 변화율이 높으면 입력 이벤트로 추정
            if change_ratio > 0.01:  # 1% 이상 변화
                estimated_events = int(change_ratio * 50)
                session.estimated_input_events += estimated_events

        except Exception:
            pass

    @staticmethod
    def _calculate_focus_score(
        context_switch_rate: float,
        deep_focus_ratio: float,
        input_density: float,
    ) -> int:
        """
        몰입도 점수 계산

        Focus = w1·(1 - CSR/CSR_max) + w2·DFR + w3·(ID/ID_max)

        가중치: 컨텍스트 전환(35%), 딥 포커스(40%), 입력 밀도(25%)
        """
        W_CS, W_DF, W_ID = 0.35, 0.40, 0.25
        CSR_MAX, ID_MAX = 3.0, 120.0

        cs_component = W_CS * max(0, 1 - context_switch_rate / CSR_MAX)
        df_component = W_DF * min(1.0, deep_focus_ratio)
        id_component = W_ID * min(1.0, input_density / ID_MAX)

        raw = (cs_component + df_component + id_component) * 100
        return int(min(100, max(0, raw)))

    @staticmethod
    def _estimate_output_score(session: SessionMetrics) -> int:
        """산출물 점수 추정 (개발/문서/관리 활동 비율 기반)"""
        productive_categories = {"development", "documentation", "design", "project_mgmt"}
        total = sum(session.category_seconds.values())
        if total == 0:
            return 50

        productive = sum(
            v for k, v in session.category_seconds.items() if k in productive_categories
        )
        ratio = productive / total
        return int(min(100, max(0, ratio * 100 * 1.1)))

    @staticmethod
    def _compile_software_usage(session: SessionMetrics) -> list[dict]:
        """소프트웨어 사용 현황 컴파일"""
        total = sum(session.app_seconds.values())
        if total == 0:
            return []

        # 카테고리 역매핑
        app_to_category = {}
        for cat, apps in config.software_categories.items():
            for app in apps:
                app_to_category[app.lower()] = cat

        result = []
        for app_name, seconds in sorted(
            session.app_seconds.items(), key=lambda x: x[1], reverse=True
        ):
            # 카테고리 매칭
            category = "other"
            for known_app, cat in app_to_category.items():
                if known_app in app_name.lower():
                    category = cat
                    break

            result.append({
                "category": category,
                "appName": app_name,
                "minutes": round(seconds / 60, 1),
                "percentage": round((seconds / total) * 100, 1),
            })

        return result[:10]  # 상위 10개

    @staticmethod
    def _extract_app_name(window_title: str) -> str:
        """윈도우 타이틀에서 앱 이름 추출"""
        if not window_title:
            return "Unknown"

        # 일반적인 패턴: "파일명 - 앱 이름" 또는 "앱 이름"
        parts = window_title.split(" - ")
        if len(parts) >= 2:
            return parts[-1].strip()

        parts = window_title.split(" — ")
        if len(parts) >= 2:
            return parts[-1].strip()

        return window_title[:50]
