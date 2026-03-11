"""
ProofWork On-Device Agent — 단일 실행파일(.exe) 빌드 스크립트

사용법:
    python build.py                  # 기본 빌드 (경량 모드)
    python build.py --full           # 화면 분석(numpy/cv2/mss) 포함 빌드
    python build.py --console=false  # 콘솔창 숨김 빌드

결과물:
    dist/ProofWorkAgent.exe          (단일 파일, ~40–80 MB 예상)

주요 제외 라이브러리 (경량 모드):
    flask, flask-cors  — server.py 전용, main.py 에서 불필요
    google-generativeai — AI 화면분석 (선택 기능)
    numpy, cv2, mss, Pillow — 화면 캡처 처리 (선택 기능)
    pystray — 시스템 트레이 (미사용)
    matplotlib, scipy, sklearn, pandas — 데이터 분석 라이브러리
    tkinter — GUI 툴킷
    IPython, jupyter — 개발 도구
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# Windows 콘솔 cp949 인코딩 문제 해결
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except AttributeError:
    pass


def _find_python() -> str:
    """pip 가 동작하는 Python 실행파일을 반환합니다.

    MSYS64 등 pip 없는 Python이 PATH 우선순위에 있을 때,
    Windows py launcher(py.exe) 또는 Program Files 경로에서
    pip 가 있는 Python을 찾아 반환합니다.
    """
    # 1. 현재 인터프리터가 pip를 가지면 그대로 사용
    result = subprocess.run(
        [sys.executable, "-m", "pip", "--version"],
        capture_output=True,
    )
    if result.returncode == 0:
        return sys.executable

    # 2. Windows py launcher 시도 (설치된 버전 중 pip 있는 것 선택)
    py_launcher = shutil.which("py")
    if py_launcher:
        versions_result = subprocess.run(
            [py_launcher, "-0"],
            capture_output=True,
            text=True,
        )
        for line in versions_result.stdout.splitlines():
            # 예: " -V:3.11 *        Python 3.11 (64-bit)"
            parts = line.strip().split()
            if not parts:
                continue
            ver_flag = parts[0]  # e.g. "-V:3.11"
            test = subprocess.run(
                [py_launcher, ver_flag, "-m", "pip", "--version"],
                capture_output=True,
            )
            if test.returncode == 0:
                # 실제 실행파일 경로를 반환
                exe_result = subprocess.run(
                    [py_launcher, ver_flag, "-c", "import sys; print(sys.executable)"],
                    capture_output=True,
                    text=True,
                )
                exe = exe_result.stdout.strip()
                if exe:
                    return exe

    # 3. 흔한 설치 경로 직접 탐색
    for candidate in [
        Path.home() / "AppData/Local/Programs/Python/Python311/python.exe",
        Path.home() / "AppData/Local/Programs/Python/Python312/python.exe",
        Path.home() / "AppData/Local/Programs/Python/Python310/python.exe",
        Path("C:/Python311/python.exe"),
        Path("C:/Python312/python.exe"),
    ]:
        if candidate.exists():
            test = subprocess.run(
                [str(candidate), "-m", "pip", "--version"],
                capture_output=True,
            )
            if test.returncode == 0:
                return str(candidate)

    # 4. 찾지 못한 경우 현재 인터프리터 반환 (이후 단계에서 오류 메시지 출력됨)
    return sys.executable


# 빌드 전체에서 사용할 Python 실행파일
PYTHON = _find_python()

# ─── 설정 ─────────────────────────────────────────────
OUTPUT_NAME = "ProofWorkAgent"
ENTRY_POINT = "server.py"   # HTTP 서버 모드 — 웹 프론튴에서 제어
ICON_FILE = "icon.ico"  # 없으면 자동 무시

# PyInstaller 가 놓치기 쉬운 숨은 임포트
HIDDEN_IMPORTS = [
    # pywin32 (동적 로드로 자동 감지 안 됨)
    "win32gui",
    "win32con",
    "win32api",
    "win32process",
    "win32security",
    "pywintypes",
    "winreg",      # PC 시작 프로그램 등록
    # Flask 피와 의존성
    "flask",
    "flask_cors",
    "werkzeug",
    "werkzeug.serving",
    "werkzeug.debug",
    "jinja2",
    "click",
    "itsdangerous",
    # 내부 모듈
    "supabase_client",
    "tracker",
    "metrics_engine",
    "config",
    "privacy.data_sanitizer",
    "sync.supabase_sync",
    # pydantic v2 내부
    "pydantic.v1",
    "pydantic_core",
    # requests SSL
    "requests.packages.urllib3",
    "requests.packages.urllib3.util.ssl_",
    "certifi",
    # structlog
    "structlog._frames",
    "structlog._log_levels",
    # psutil Windows 백엔드
    "psutil._pswindows",
    "psutil._psutil_windows",
]

# 경량 모드에서 반드시 제외할 무거운 라이브러리
EXCLUDES_BASE = [
    # AI / 화면 분석 (선택 기능 — tracker.py 에서 ImportError 로 graceful fallback)
    "google.generativeai",
    "google.ai",
    "google.protobuf",
    "grpc",
    "grpcio",
    "googleapis_common_protos",
    # 화면 캡처 처리
    "numpy",
    "cv2",
    "mss",
    "PIL",
    "Pillow",
    # 시스템 트레이
    "pystray",
    # 데이터 분석 (미사용)
    "matplotlib",
    "scipy",
    "sklearn",
    "pandas",
    "seaborn",
    # GUI
    "tkinter",
    "wx",
    "PyQt5",
    "PyQt6",
    "PySide2",
    "PySide6",
    # 개발 도구
    "IPython",
    "jupyter",
    "notebook",
    "pytest",
    "setuptools",
    "distutils",
    "docutils",
    # 기타 무거운 라이브러리
    "cryptography",
    "Crypto",
    "lxml",
    "xml.etree.ElementTree",  # 필요 없으면
    "email",
    "html.parser",
    "http.server",
    "xmlrpc",
    "unittest",
    "test",
]

# 화면 분석 포함 빌드 시 제외 목록에서 뺄 항목
SCREEN_ANALYSIS_MODULES = {"numpy", "cv2", "mss", "PIL", "Pillow"}

# 화면 분석 포함 시 추가로 필요한 hiddenimport
SCREEN_ANALYSIS_HIDDEN = [
    "analyzer.context_analyzer",
    "analyzer.metrics_calculator",
    "analyzer.screen_analyzer",
    "analyzer.vision_engine",
    "analyzer.work_context",
    "capture.screen_capture",
]


def check_pyinstaller() -> None:
    print(f"  Python: {PYTHON}")
    result = subprocess.run(
        [PYTHON, "-c", "import PyInstaller; print(PyInstaller.__version__)"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"  ✓ PyInstaller {result.stdout.strip()} 확인됨")
    else:
        print("  PyInstaller 설치 중...")
        subprocess.check_call([PYTHON, "-m", "pip", "install", "pyinstaller", "--quiet"])
        print("  ✓ PyInstaller 설치 완료")


def clean_previous_build() -> None:
    for d in ["build", "dist"]:
        p = Path(d)
        if p.exists():
            shutil.rmtree(p)
            print(f"  ✓ {d}/ 삭제됨")
    # PyInstaller 자동 생성 .spec 파일 제거
    spec = Path(f"{OUTPUT_NAME}.spec")
    if spec.exists():
        spec.unlink()
        print(f"  ✓ {spec} 삭제됨")


def build(full_mode: bool, console: bool) -> None:
    excludes = list(EXCLUDES_BASE)
    hidden = list(HIDDEN_IMPORTS)

    if full_mode:
        # 화면 분석 모듈 제외 목록에서 제거
        excludes = [e for e in excludes if e not in SCREEN_ANALYSIS_MODULES]
        hidden.extend(SCREEN_ANALYSIS_HIDDEN)
        print("  모드: 화면 분석 포함 (full)")
    else:
        print("  모드: 경량 (화면 분석 제외)")

    cmd = [
        PYTHON, "-m", "PyInstaller",
        ENTRY_POINT,
        "--onefile",                        # 단일 .exe 생성
        "--clean",                          # 캐시 없이 깨끗하게 빌드
        "--noconfirm",                      # 덮어쓰기 자동 확인
        f"--name={OUTPUT_NAME}",
        f"--console" if console else "--noconsole",
        # UPX 압축 활성화 (설치돼 있으면 자동 적용 — 없으면 무시됨)
        "--upx-dir=.",
        # 데이터 파일: .env 가 존재하면 포함 (없어도 실행은 됨)
        # "--add-data=.env;.",  # .env 를 배포에 포함하려면 주석 해제
    ]

    # hiddenimports 추가
    for h in hidden:
        cmd += ["--hidden-import", h]

    # excludes 추가
    for e in excludes:
        cmd += ["--exclude-module", e]

    # 아이콘 설정 (파일이 있을 때만)
    if Path(ICON_FILE).exists():
        cmd += ["--icon", ICON_FILE]

    print()
    print("  실행 명령:")
    print("  " + " ".join(cmd[:6]) + " ...")  # 명령어 일부만 출력
    print()

    subprocess.check_call(cmd)


def report_result() -> None:
    exe = Path(f"dist/{OUTPUT_NAME}.exe")
    if exe.exists():
        size_mb = exe.stat().st_size / (1024 ** 2)
        print()
        print("=" * 56)
        print("  빌드 성공!")
        print("=" * 56)
        print(f"  파일: {exe.absolute()}")
        print(f"  크기: {size_mb:.1f} MB")
        print()
        print("  실행 방법:")
        print(f"    {exe}                        # 인터랙티브")
        print(f"    {exe} --email xxx --password xxx")
        print(f"    {exe} --duration 60           # 60분 뒤 자동 종료")
        print()
        print("  배포:")
        print("    dist/ 폴더를 ZIP 압축 후 GitHub Releases에 업로드")
        print()
    else:
        print(f"  ✗ {exe} 파일을 찾을 수 없습니다.")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="ProofWork Agent 빌드 스크립트")
    parser.add_argument(
        "--full",
        action="store_true",
        help="화면 분석(numpy/cv2/mss) 포함 빌드 (파일 크기 증가)",
    )
    parser.add_argument(
        "--console",
        type=lambda v: v.lower() != "false",
        default=True,
        metavar="true|false",
        help="콘솔 창 표시 여부 (기본: true)",
    )
    args = parser.parse_args()

    print()
    print("=" * 56)
    print("  ProofWork On-Device Agent - 빌드 시작")
    print("=" * 56)
    print()

    print("[1/4] PyInstaller 확인...")
    check_pyinstaller()
    print()

    print("[2/4] 이전 빌드 정리...")
    clean_previous_build()
    print()

    print("[3/4] PyInstaller 빌드 중... (2–5분 소요)")
    build(full_mode=args.full, console=args.console)

    print("[4/4] 결과 확인...")
    report_result()


if __name__ == "__main__":
    main()
