"""
ProofWork On-Device Agent 설정
"""
import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent


class AgentConfig(BaseModel):
    """On-Device Agent 전역 설정"""

    # ─── 캡처 설정 ──────────────────────────
    capture_interval_sec: float = 5.0       # 화면 캡처 간격 (초)
    capture_resize_width: int = 640         # 전처리 시 리사이즈 너비 (리소스 절감)
    capture_resize_height: int = 360        # 전처리 시 리사이즈 높이
    capture_monitor_index: int = 1          # 캡처 대상 모니터 (1=기본)

    # ─── AI 모델 설정 ───────────────────────
    model_path: str = str(BASE_DIR / "models" / "scene_classifier.onnx")
    ocr_model_path: str = str(BASE_DIR / "models" / "ocr_lite.onnx")
    model_input_size: tuple[int, int] = (224, 224)
    confidence_threshold: float = 0.6
    use_gpu: bool = False                   # TensorRT/CUDA 사용 여부

    # ─── 리소스 제한 ────────────────────────
    max_cpu_percent: float = 10.0           # 최대 CPU 점유율
    max_gpu_percent: float = 10.0           # 최대 GPU 점유율
    analysis_batch_size: int = 4            # 프레임 배치 분석 크기
    worker_processes: int = 2               # multiprocessing 워커 수

    # ─── 프라이버시 ─────────────────────────
    privacy_mode: str = "strict"            # "strict" | "balanced"
    frame_retention_sec: int = 0            # 프레임 보존 시간 (0=즉시파기)
    secure_delete: bool = True              # 메모리 제로화 파기
    sensitive_apps: list[str] = [           # 자동 감지 시 캡처 스킵 앱
        "KeePass", "1Password", "Bitwarden",
        "은행", "banking", "카드",
    ]

    # ─── Firebase 동기화 ────────────────────
    firebase_credentials_path: str = str(BASE_DIR / "service-account-key.json")
    firebase_project_id: str = os.getenv("FIREBASE_PROJECT_ID", "")
    sync_interval_sec: float = 300.0        # 서버 동기화 간격 (5분)

    # ─── 소프트웨어 분류 맵 ─────────────────
    software_categories: dict[str, list[str]] = {
        "development": [
            "Visual Studio Code", "VS Code", "IntelliJ", "PyCharm",
            "WebStorm", "Terminal", "Windows Terminal", "PowerShell",
            "Git", "GitHub Desktop", "Sublime Text", "Vim",
        ],
        "communication": [
            "Slack", "Microsoft Teams", "Discord", "Outlook",
            "Gmail", "Thunderbird", "KakaoTalk", "카카오톡",
        ],
        "documentation": [
            "Notion", "Confluence", "Google Docs", "Word",
            "HackMD", "Obsidian", "Typora",
        ],
        "design": [
            "Figma", "Sketch", "Adobe Photoshop", "Adobe Illustrator",
            "Adobe XD", "Canva",
        ],
        "project_mgmt": [
            "Jira", "Asana", "Trello", "Linear",
            "Monday", "ClickUp",
        ],
        "research": [
            "Chrome", "Firefox", "Edge", "Safari", "Opera",
        ],
        "meeting": [
            "Zoom", "Google Meet", "Microsoft Teams",
            "Webex", "Skype",
        ],
    }


# 전역 설정 인스턴스
config = AgentConfig()
