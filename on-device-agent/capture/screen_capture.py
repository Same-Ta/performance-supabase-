"""
화면 캡처 모듈 (mss 기반)

핵심 설계:
- mss를 사용한 고성능 네이티브 스크린샷
- OpenCV를 통한 리사이즈/전처리 → 리소스 절감
- 캡처된 프레임은 메모리에만 존재 → 디스크 저장 없음
"""

import time
import ctypes
import numpy as np
import cv2
import mss
import mss.tools
from typing import Optional
import structlog

from config import config

logger = structlog.get_logger(__name__)


class ScreenCapture:
    """Privacy-by-Design 화면 캡처 엔진"""

    def __init__(self):
        self._sct: Optional[mss.mss] = None
        self._monitor = None
        self._is_running = False
        self._frame_count = 0

    def start(self):
        """캡처 세션 시작"""
        self._sct = mss.mss()
        monitors = self._sct.monitors
        idx = min(config.capture_monitor_index, len(monitors) - 1)
        self._monitor = monitors[idx]
        self._is_running = True
        logger.info(
            "screen_capture_started",
            monitor=idx,
            resolution=f"{self._monitor['width']}x{self._monitor['height']}",
        )

    def stop(self):
        """캡처 세션 종료"""
        self._is_running = False
        if self._sct:
            self._sct.close()
            self._sct = None
        logger.info("screen_capture_stopped", total_frames=self._frame_count)

    def capture_frame(self) -> Optional[np.ndarray]:
        """
        단일 프레임 캡처 → 전처리된 numpy 배열 반환

        Returns:
            np.ndarray: BGR 포맷, config.capture_resize_width x height
            None: 캡처 실패 시
        """
        if not self._is_running or not self._sct:
            return None

        try:
            # mss 네이티브 캡처 (BGRA)
            raw = self._sct.grab(self._monitor)
            frame = np.array(raw, dtype=np.uint8)

            # BGRA → BGR 변환
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

            # 리사이즈 (리소스 절감 핵심)
            frame = cv2.resize(
                frame,
                (config.capture_resize_width, config.capture_resize_height),
                interpolation=cv2.INTER_AREA,
            )

            self._frame_count += 1
            return frame

        except Exception as e:
            logger.error("capture_error", error=str(e))
            return None

    def capture_with_window_info(self) -> tuple[Optional[np.ndarray], str]:
        """
        프레임 캡처 + 현재 활성 윈도우 타이틀 반환

        Returns:
            (frame, window_title) 튜플
        """
        frame = self.capture_frame()
        title = self._get_active_window_title()
        return frame, title

    @staticmethod
    def _get_active_window_title() -> str:
        """현재 활성 윈도우의 타이틀 텍스트 반환 (Windows)"""
        try:
            # Windows API: GetForegroundWindow + GetWindowText
            user32 = ctypes.windll.user32  # type: ignore[attr-defined]
            hwnd = user32.GetForegroundWindow()
            length = user32.GetWindowTextLengthW(hwnd)
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            return buf.value
        except Exception:
            return "Unknown"

    @property
    def is_running(self) -> bool:
        return self._is_running

    @property
    def frame_count(self) -> int:
        return self._frame_count


def secure_delete_frame(frame: np.ndarray) -> None:
    """
    프레임 메모리 보안 파기 (Privacy-by-Design)

    단순 del이 아닌, 메모리를 0으로 덮어쓴 후 해제하여
    메모리 덤프를 통한 영상 복원을 원천 방지한다.
    """
    if frame is not None and isinstance(frame, np.ndarray):
        # 메모리 제로화
        frame[:] = 0
        # numpy 내부 버퍼도 클리어
        if frame.ctypes.data:
            ctypes.memset(frame.ctypes.data, 0, frame.nbytes)


class CaptureThrottler:
    """
    CPU 점유율 기반 캡처 속도 자동 조절기

    현재 시스템 부하가 높으면 캡처 간격을 동적으로 늘려
    사용자 PC에 미치는 영향을 10% 미만으로 유지한다.
    """

    def __init__(self, base_interval: float = None):
        self._base_interval = base_interval or config.capture_interval_sec
        self._current_interval = self._base_interval
        self._min_interval = 1.0
        self._max_interval = 30.0

    def adjust(self, cpu_percent: float, gpu_percent: float) -> float:
        """시스템 부하 기반으로 캡처 간격 조정"""
        max_load = max(cpu_percent, gpu_percent)

        if max_load > config.max_cpu_percent * 0.8:
            # 부하가 한계치의 80% 이상 → 간격 50% 증가
            self._current_interval = min(
                self._current_interval * 1.5, self._max_interval
            )
            logger.debug(
                "throttle_increased",
                interval=self._current_interval,
                load=max_load,
            )
        elif max_load < config.max_cpu_percent * 0.5:
            # 부하가 낮으면 → 간격 점진적 감소
            self._current_interval = max(
                self._current_interval * 0.9, self._min_interval
            )

        return self._current_interval

    @property
    def interval(self) -> float:
        return self._current_interval
