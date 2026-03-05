"""
On-Device 비전 AI 추론 엔진

핵심 모델 스택:
1. MobileNetV3-Small (Scene Classifier) - 장면/소프트웨어 분류
2. OCR-Lite (텍스트 인식) - 타이틀바/메뉴 텍스트 추출
3. Activity Classifier - 업무 행동 패턴 분류

모든 추론은 ONNX Runtime 기반으로 CPU/GPU 모두 지원.
TensorRT 가속은 NVIDIA GPU가 있을 때 자동 활성화.
"""

import numpy as np
import cv2
from typing import Optional
import structlog

try:
    import onnxruntime as ort
except ImportError:
    ort = None

from config import config

logger = structlog.get_logger(__name__)


# ─── 소프트웨어 분류 라벨 ─────────────────────────
SCENE_LABELS = [
    "ide_coding",           # IDE에서 코딩 중
    "terminal_cli",         # 터미널/CLI 작업
    "browser_research",     # 브라우저 리서치
    "documentation",        # 문서 작성
    "communication_chat",   # 메신저/채팅
    "communication_email",  # 이메일
    "video_meeting",        # 화상 회의
    "design_tool",          # 디자인 도구
    "project_management",   # 프로젝트 관리 도구
    "spreadsheet",          # 스프레드시트
    "file_manager",         # 파일 관리
    "idle_lockscreen",      # 잠금/유휴 상태
    "other",                # 기타
]


class VisionEngine:
    """
    On-Device 비전 AI 추론 엔진

    리소스 최적화 전략:
    - INT8 양자화 모델 사용 (메모리 75% 절감)
    - 배치 추론으로 오버헤드 감소
    - CPU/GPU 부하 모니터링 기반 동적 조절
    - ONNX Runtime의 경량 실행 그래프 활용
    """

    def __init__(self):
        self._session: Optional[object] = None
        self._ocr_session: Optional[object] = None
        self._initialized = False

    def initialize(self) -> bool:
        """모델 로드 및 추론 세션 초기화"""
        if ort is None:
            logger.warning("onnxruntime not installed, using fallback mode")
            self._initialized = False
            return False

        try:
            # 실행 프로바이더 설정
            providers = self._get_providers()

            # 세션 옵션: 리소스 제한
            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            sess_options.intra_op_num_threads = 2      # CPU 스레드 제한
            sess_options.inter_op_num_threads = 1
            sess_options.enable_mem_pattern = True      # 메모리 패턴 최적화
            sess_options.enable_cpu_mem_arena = True

            # 모델 파일 존재 시 로드 (없으면 폴백)
            import os
            if os.path.exists(config.model_path):
                self._session = ort.InferenceSession(
                    config.model_path,
                    sess_options=sess_options,
                    providers=providers,
                )
                logger.info("vision_model_loaded", path=config.model_path)

            if os.path.exists(config.ocr_model_path):
                self._ocr_session = ort.InferenceSession(
                    config.ocr_model_path,
                    sess_options=sess_options,
                    providers=providers,
                )
                logger.info("ocr_model_loaded", path=config.ocr_model_path)

            self._initialized = True
            return True

        except Exception as e:
            logger.error("model_init_failed", error=str(e))
            self._initialized = False
            return False

    def _get_providers(self) -> list[str]:
        """사용 가능한 추론 프로바이더 목록"""
        providers = []

        if config.use_gpu:
            available = ort.get_available_providers() if ort else []

            if "TensorrtExecutionProvider" in available:
                providers.append("TensorrtExecutionProvider")
                logger.info("using_tensorrt_acceleration")
            elif "CUDAExecutionProvider" in available:
                providers.append("CUDAExecutionProvider")
                logger.info("using_cuda_acceleration")

        providers.append("CPUExecutionProvider")
        return providers

    def classify_scene(self, frame: np.ndarray) -> dict:
        """
        프레임으로부터 장면/소프트웨어 분류

        Args:
            frame: BGR numpy 배열

        Returns:
            {
                "label": "ide_coding",
                "confidence": 0.92,
                "category": "development",
                "all_scores": {...}
            }
        """
        if self._session is None:
            return self._fallback_classify(frame)

        # 전처리: resize + normalize
        input_tensor = self._preprocess(frame)

        # 추론
        input_name = self._session.get_inputs()[0].name
        outputs = self._session.run(None, {input_name: input_tensor})

        # 후처리: softmax → 라벨 매핑
        probs = self._softmax(outputs[0][0])
        top_idx = int(np.argmax(probs))
        confidence = float(probs[top_idx])

        label = SCENE_LABELS[top_idx] if top_idx < len(SCENE_LABELS) else "other"

        return {
            "label": label,
            "confidence": confidence,
            "category": self._label_to_category(label),
            "all_scores": {
                SCENE_LABELS[i]: float(probs[i])
                for i in range(min(len(probs), len(SCENE_LABELS)))
            },
        }

    def extract_text_regions(self, frame: np.ndarray) -> list[str]:
        """
        프레임에서 텍스트 영역 추출 (OCR Lite)

        타이틀바, 탭 이름, 메뉴 등에서 컨텍스트 정보를 추출하되
        개인정보(비밀번호 등)는 필터링한다.
        """
        if self._ocr_session is None:
            return []

        try:
            # 상단 10% 영역만 크롭 (타이틀바/탭)
            h = frame.shape[0]
            title_region = frame[: int(h * 0.1), :]

            # 그레이스케일 + 이진화
            gray = cv2.cvtColor(title_region, cv2.COLOR_BGR2GRAY)
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # OCR 추론
            input_tensor = self._preprocess_ocr(binary)
            input_name = self._ocr_session.get_inputs()[0].name
            outputs = self._ocr_session.run(None, {input_name: input_tensor})

            # 텍스트 디코딩 (간단 버전)
            texts = self._decode_ocr_output(outputs)
            return self._filter_sensitive_text(texts)

        except Exception as e:
            logger.debug("ocr_failed", error=str(e))
            return []

    def _fallback_classify(self, frame: np.ndarray) -> dict:
        """
        모델 없을 때의 폴백: 색상 히스토그램 기반 간이 분류

        다크 테마 → IDE 가능성 높음
        밝은 배경 → 문서/브라우저 가능성 높음
        """
        # 평균 밝기 계산
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_brightness = float(np.mean(gray))

        # 색상 분포
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mean_saturation = float(np.mean(hsv[:, :, 1]))

        if mean_brightness < 60:
            label = "ide_coding"
            confidence = 0.5
        elif mean_brightness > 200:
            label = "documentation"
            confidence = 0.4
        elif mean_saturation > 100:
            label = "design_tool"
            confidence = 0.3
        else:
            label = "browser_research"
            confidence = 0.3

        return {
            "label": label,
            "confidence": confidence,
            "category": self._label_to_category(label),
            "all_scores": {label: confidence},
        }

    def _preprocess(self, frame: np.ndarray) -> np.ndarray:
        """모델 입력용 전처리"""
        w, h = config.model_input_size
        resized = cv2.resize(frame, (w, h))
        normalized = resized.astype(np.float32) / 255.0
        # HWC → NCHW
        transposed = np.transpose(normalized, (2, 0, 1))
        return np.expand_dims(transposed, axis=0)

    def _preprocess_ocr(self, gray_frame: np.ndarray) -> np.ndarray:
        """OCR 모델 입력용 전처리"""
        resized = cv2.resize(gray_frame, (320, 32))
        normalized = resized.astype(np.float32) / 255.0
        return np.expand_dims(np.expand_dims(normalized, 0), 0)

    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()

    @staticmethod
    def _decode_ocr_output(outputs) -> list[str]:
        """OCR 추론 결과를 텍스트로 디코딩 (CTC 디코딩 간소화)"""
        # 실제 구현에서는 CTC 디코딩 라이브러리 사용
        return []

    @staticmethod
    def _filter_sensitive_text(texts: list[str]) -> list[str]:
        """민감 텍스트 필터링 (비밀번호 폼, 결제 정보 등)"""
        sensitive_keywords = [
            "password", "비밀번호", "패스워드",
            "credit card", "신용카드", "계좌번호",
            "social security", "주민등록",
        ]
        filtered = []
        for text in texts:
            lower = text.lower()
            if not any(kw in lower for kw in sensitive_keywords):
                filtered.append(text)
        return filtered

    @staticmethod
    def _label_to_category(label: str) -> str:
        """장면 라벨 → 소프트웨어 카테고리 매핑"""
        mapping = {
            "ide_coding": "development",
            "terminal_cli": "development",
            "browser_research": "research",
            "documentation": "documentation",
            "communication_chat": "communication",
            "communication_email": "communication",
            "video_meeting": "meeting",
            "design_tool": "design",
            "project_management": "project_mgmt",
            "spreadsheet": "documentation",
            "file_manager": "other",
            "idle_lockscreen": "other",
            "other": "other",
        }
        return mapping.get(label, "other")

    @property
    def initialized(self) -> bool:
        return self._initialized
