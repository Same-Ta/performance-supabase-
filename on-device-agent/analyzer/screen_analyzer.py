"""
AI 기반 화면 분석 엔진 (Screen Analyzer)

Google ScreenAI / Apple Ferret-UI의 핵심 아이디어를 Gemini Vision으로 구현:
1. 화면 요약(Screen Summarization) — 1~2문장으로 현재 화면 맥락 설명
2. 기능 추론(Function Inference) — 사용자가 수행 중인 업무 목적 유추
3. 임의 해상도 처리(Any-resolution) — 종횡비에 따라 서브이미지 분할
4. 동적 패칭(Pix2struct patching) — 비율에 맞는 그리드로 텍스트 손실 방지

Privacy-by-Design:
- 이미지는 메모리에서만 처리, 디스크 저장 없음
- API 전송 시 PII 마스킹 프롬프트 포함
- 분석 결과만 텍스트로 보존, 원본 이미지 즉시 파기
"""

import base64
import io
import time
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np
import structlog

try:
    import google.generativeai as genai
except ImportError:
    genai = None

from config import config

logger = structlog.get_logger(__name__)


@dataclass
class ScreenContext:
    """단일 화면 분석 결과"""
    timestamp: float
    screen_summary: str           # 화면 요약 (1-2문장)
    work_inference: str           # 업무 추론 (무엇을 하고 있는지)
    detected_elements: list[str]  # 감지된 UI 요소들
    work_category: str            # 업무 카테고리
    confidence: float             # 분석 신뢰도 (0-1)
    window_title: str             # 활성 윈도우 타이틀
    app_name: str                 # 앱 이름
    raw_analysis: str = ""        # 원본 AI 응답 (디버그용)


@dataclass
class SubImage:
    """분할된 서브이미지"""
    image: np.ndarray
    region: str        # "left", "right", "top", "bottom", "full"
    x_offset: int
    y_offset: int
    width: int
    height: int


# ─── 분석 프롬프트 ───────────────────────────────────────
SCREEN_ANALYSIS_PROMPT = """당신은 업무 화면 분석 AI입니다. 아래 스크린샷을 보고 JSON 형식으로 답하세요.

**중요 규칙:**
- 비밀번호, 개인정보, 금융정보 등 민감 정보는 절대 포함하지 마세요
- "[마스킹됨]"으로 대체하세요
- 코드 내용이 보이면 파일명과 작업 맥락만 설명하세요 (코드 자체를 복사하지 마세요)

다음 JSON으로 답하세요:
{
  "screen_summary": "현재 화면의 내용을 1-2문장으로 요약 (예: 'VS Code에서 React 컴포넌트의 상태 관리 로직을 수정하고 있다')",
  "work_inference": "사용자가 수행 중인 업무의 목적과 맥락 추론 (예: '사용자 인증 플로우의 에러 핸들링을 개선하는 작업을 진행 중이다')",
  "detected_elements": ["감지된 주요 UI 요소 목록 (예: 'VS Code 에디터', '터미널 출력', 'Git diff 뷰')"],
  "work_category": "development|documentation|communication|design|project_mgmt|research|meeting|other 중 하나",
  "confidence": 0.0~1.0
}

화면이 잠금 화면이거나 데스크톱이면 confidence를 0.1 이하로, work_category를 "other"로 설정하세요."""

MULTI_REGION_PROMPT = """이 이미지들은 하나의 넓은 화면을 영역별로 나눈 것입니다.
모든 영역을 종합적으로 분석하여 사용자가 전체 화면에서 무엇을 하고 있는지 파악해주세요.

""" + SCREEN_ANALYSIS_PROMPT


class ScreenAnalyzer:
    """
    Gemini Vision 기반 화면 분석 엔진

    ScreenAI의 화면 요약 + Ferret-UI의 기능 추론을 결합하여
    "VS Code 3시간 사용" 대신 "프론트엔드 배포 에러 로그 확인 중"과 같은
    구체적인 업무 컨텍스트를 추출합니다.
    """

    def __init__(self):
        self._model = None
        self._initialized = False
        self._last_analysis_time: float = 0
        self._analysis_count: int = 0
        self._error_count: int = 0

    def initialize(self) -> bool:
        """Gemini Vision 모델 초기화"""
        if genai is None:
            logger.warning("google-generativeai 패키지 미설치. pip install google-generativeai")
            return False

        api_key = config.gemini_api_key
        if not api_key:
            logger.warning("GEMINI_API_KEY 미설정. 화면 분석 비활성화.")
            return False

        try:
            genai.configure(api_key=api_key)
            self._model = genai.GenerativeModel(config.gemini_vision_model)
            self._initialized = True
            logger.info(
                "screen_analyzer_initialized",
                model=config.gemini_vision_model,
                interval=config.screen_analysis_interval_sec,
            )
            return True
        except Exception as e:
            logger.error("screen_analyzer_init_failed", error=str(e))
            return False

    @property
    def initialized(self) -> bool:
        return self._initialized

    def should_analyze(self) -> bool:
        """분석 주기 확인 (너무 빈번한 API 호출 방지)"""
        if not self._initialized:
            return False
        elapsed = time.time() - self._last_analysis_time
        return elapsed >= config.screen_analysis_interval_sec

    def analyze_screen(
        self,
        frame: np.ndarray,
        window_title: str = "",
        app_name: str = "",
    ) -> Optional[ScreenContext]:
        """
        화면 캡처 이미지를 분석하여 업무 컨텍스트 추출

        Args:
            frame: BGR numpy 배열 (원본 해상도)
            window_title: 현재 활성 윈도우 타이틀
            app_name: 현재 앱 이름

        Returns:
            ScreenContext 또는 None (실패 시)
        """
        if not self._initialized or self._model is None:
            return None

        try:
            self._last_analysis_time = time.time()

            # 1) 종횡비 기반 서브이미지 분할 (Ferret-UI Any-resolution 방식)
            sub_images = self._split_by_aspect_ratio(frame)

            # 2) 서브이미지를 PIL Image로 변환
            pil_images = []
            for sub in sub_images:
                pil_img = self._numpy_to_pil(sub.image)
                pil_images.append(pil_img)

            # 3) Gemini Vision API 호출
            if len(pil_images) == 1:
                prompt = SCREEN_ANALYSIS_PROMPT
                if window_title:
                    prompt += f"\n\n참고: 현재 활성 윈도우 타이틀은 '{window_title}'입니다."
                content = [prompt, pil_images[0]]
            else:
                prompt = MULTI_REGION_PROMPT
                if window_title:
                    prompt += f"\n\n참고: 현재 활성 윈도우 타이틀은 '{window_title}'입니다."
                content = [prompt] + pil_images

            response = self._model.generate_content(
                content,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=512,
                ),
            )

            # 4) 응답 파싱
            result = self._parse_response(response.text)
            self._analysis_count += 1

            context = ScreenContext(
                timestamp=time.time(),
                screen_summary=result.get("screen_summary", "분석 실패"),
                work_inference=result.get("work_inference", ""),
                detected_elements=result.get("detected_elements", []),
                work_category=result.get("work_category", "other"),
                confidence=min(1.0, max(0.0, result.get("confidence", 0.5))),
                window_title=window_title,
                app_name=app_name,
                raw_analysis=response.text[:500],
            )

            logger.info(
                "screen_analyzed",
                summary=context.screen_summary[:80],
                category=context.work_category,
                confidence=context.confidence,
                regions=len(sub_images),
            )

            return context

        except Exception as e:
            self._error_count += 1
            logger.error("screen_analysis_failed", error=str(e))
            return None

    def _split_by_aspect_ratio(self, frame: np.ndarray) -> list[SubImage]:
        """
        종횡비에 따라 화면을 서브이미지로 분할

        Ferret-UI의 Any-resolution 아이디어:
        - 16:9 이하 → 분할 없이 전체 분석
        - 21:9 이상 (울트라와이드) → 좌/우 2분할
        - 9:16 이상 (세로 모니터) → 상/하 2분할
        - 32:9 이상 (슈퍼 울트라와이드) → 3분할

        각 서브이미지는 분석 모델의 최적 입력 크기로 리사이즈되되,
        Pix2struct 방식으로 패딩 없이 원본 비율을 유지합니다.
        """
        h, w = frame.shape[:2]
        aspect_ratio = w / max(h, 1)

        if aspect_ratio > 3.2:
            # 슈퍼 울트라와이드 (32:9 이상) → 3분할
            third = w // 3
            return [
                SubImage(self._resize_for_analysis(frame[:, :third]),
                         "left", 0, 0, third, h),
                SubImage(self._resize_for_analysis(frame[:, third:2*third]),
                         "center", third, 0, third, h),
                SubImage(self._resize_for_analysis(frame[:, 2*third:]),
                         "right", 2*third, 0, w - 2*third, h),
            ]
        elif aspect_ratio > 2.0:
            # 울트라와이드 (21:9 이상) → 좌/우 2분할
            mid = w // 2
            return [
                SubImage(self._resize_for_analysis(frame[:, :mid]),
                         "left", 0, 0, mid, h),
                SubImage(self._resize_for_analysis(frame[:, mid:]),
                         "right", mid, 0, w - mid, h),
            ]
        elif aspect_ratio < 0.7:
            # 세로 모니터 → 상/하 2분할
            mid = h // 2
            return [
                SubImage(self._resize_for_analysis(frame[:mid, :]),
                         "top", 0, 0, w, mid),
                SubImage(self._resize_for_analysis(frame[mid:, :]),
                         "bottom", 0, mid, w, h - mid),
            ]
        else:
            # 일반 비율 → 전체 이미지
            return [
                SubImage(self._resize_for_analysis(frame),
                         "full", 0, 0, w, h),
            ]

    def _resize_for_analysis(self, image: np.ndarray) -> np.ndarray:
        """
        Pix2struct 동적 패칭 방식 리사이즈

        고정 크기로 억지로 맞추지 않고, 원본 비율을 유지하면서
        최대 치수만 제한합니다. 이를 통해 코드의 작은 텍스트까지
        정확히 읽어낼 수 있습니다.
        """
        h, w = image.shape[:2]
        max_dim = config.screen_analysis_max_dim

        if max(h, w) <= max_dim:
            return image

        if w >= h:
            new_w = max_dim
            new_h = int(h * (max_dim / w))
        else:
            new_h = max_dim
            new_w = int(w * (max_dim / h))

        return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    @staticmethod
    def _numpy_to_pil(frame: np.ndarray):
        """numpy BGR → PIL Image (Gemini API 전송용)"""
        from PIL import Image
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)

    @staticmethod
    def _parse_response(text: str) -> dict:
        """Gemini 응답 JSON 파싱 (마크다운 코드블록 제거 포함)"""
        import json

        # 마크다운 코드블록 제거
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            # 첫 줄 (```json) 과 마지막 줄 (```) 제거
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # JSON 부분만 추출 시도
            start = cleaned.find("{")
            end = cleaned.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(cleaned[start:end])
                except json.JSONDecodeError:
                    pass
            logger.warning("gemini_response_parse_failed", text=text[:200])
            return {
                "screen_summary": "분석 결과 파싱 실패",
                "work_inference": "",
                "detected_elements": [],
                "work_category": "other",
                "confidence": 0.1,
            }

    def get_stats(self) -> dict:
        """분석 통계"""
        return {
            "initialized": self._initialized,
            "analysisCount": self._analysis_count,
            "errorCount": self._error_count,
            "lastAnalysisTime": self._last_analysis_time,
        }
