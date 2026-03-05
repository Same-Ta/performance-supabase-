"""
ProofWork On-Device Agent — 실제 구동 버전

Windows에서 활성 윈도우를 추적하여 앱별 사용시간을 측정하고,
성과 메트릭을 계산하여 Firebase에 전송합니다.

사용법:
  python main.py                          # 인터랙티브 모드
  python main.py --email xxx --password xxx  # 자동 로그인
  python main.py --duration 60             # 60분 뒤 자동 종료
"""

import argparse
import signal
import sys
import time
from datetime import datetime
from getpass import getpass

# .env 파일 자동 로드
from dotenv import load_dotenv
load_dotenv()

import structlog

# ─── 로깅 설정 ──────────────────────────────
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(colors=True),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger(__name__)


def main():
    parser = argparse.ArgumentParser(description="ProofWork On-Device Agent")
    parser.add_argument("--email", help="Firebase 로그인 이메일")
    parser.add_argument("--password", help="Firebase 로그인 비밀번호")
    parser.add_argument("--duration", type=int, default=0, help="자동 종료 시간 (분, 0=수동종료)")
    parser.add_argument("--interval", type=float, default=3.0, help="추적 간격 (초, 기본 3)")
    args = parser.parse_args()

    print()
    print("=" * 56)
    print("  🖥️  ProofWork On-Device Agent")
    print("  실시간 업무 활동 추적 및 성과 분석")
    print("=" * 56)
    print()

    # ─── 1단계: Firebase 로그인 ─────────────
    from firebase_client import FirebaseClient
    client = FirebaseClient()

    if client.is_authenticated:
        print(f"  ✅ 기존 세션 유지 (사용자: {client.user_id[:8]}...)")
    else:
        email = args.email or input("  📧 이메일: ")
        password = args.password or getpass("  🔒 비밀번호: ")

        print("  ⏳ 로그인 중...")
        if not client.sign_in(email, password):
            print("  ❌ 로그인 실패. 이메일/비밀번호를 확인해주세요.")
            sys.exit(1)
        print(f"  ✅ 로그인 성공 (UID: {client.user_id[:8]}...)")

    print()

    # ─── 2단계: 추적 시작 ──────────────────
    from tracker import WindowTracker
    from metrics_engine import compute_metrics

    tracker = WindowTracker(poll_interval=args.interval)
    session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    session = tracker.start_session(session_id, client.user_id)

    end_time = 0
    if args.duration > 0:
        end_time = time.time() + args.duration * 60
        print(f"  ⏱  {args.duration}분 후 자동 종료됩니다.")

    print(f"  📊 추적 시작! (간격: {args.interval}초)")
    print(f"  📅 세션: {session_id}")
    print("  종료하려면 Ctrl+C 를 누르세요.")
    print()
    print(f"  {'시간':>8}  {'카테고리':<16}  {'앱':.<30}")
    print("  " + "-" * 56)

    running = True

    def handle_stop(sig, frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    record_count = 0
    last_print = ""

    while running:
        if end_time and time.time() >= end_time:
            break

        record = tracker.poll_once()
        if record and record.category != "idle":
            record_count += 1
            now_str = datetime.now().strftime("%H:%M:%S")
            line = f"  {now_str:>8}  {record.category:<16}  {record.app_name:.30}"
            if line != last_print:
                print(line)
                last_print = line

        # 매 20회마다 요약 출력
        if record_count > 0 and record_count % 20 == 0:
            cat_secs = session.category_seconds
            total = sum(cat_secs.values())
            if total > 0:
                top_cat = max(cat_secs, key=cat_secs.get)  # type: ignore
                print(f"\n  📈 중간현황: {total/60:.0f}분 활성 | "
                      f"전환 {session.context_switches}회 | "
                      f"최다 카테고리: {top_cat}\n")

        time.sleep(args.interval)

    # ─── 3단계: 세션 종료 및 메트릭 계산 ───
    print("\n  ⏹  추적 종료. 메트릭 계산 중...")
    session = tracker.stop_session()
    if not session:
        print("  ❌ 세션 데이터 없음")
        sys.exit(1)

    metrics = compute_metrics(session)

    # ─── 4단계: 결과 출력 ─────────────────
    print()
    print("=" * 56)
    print("  🏅 ProofWork 일일 성과 리포트")
    print(f"  📅 {metrics['date']}")
    print("=" * 56)

    overall = metrics["overallScore"]
    tier = metrics["reward"]
    print(f"\n  종합 점수:   {overall:3d}/100  {tier['label']}")
    print(f"  ├── 산출물:   {metrics['outputScore']:3d}/100")
    print(f"  ├── 효율성:   {metrics['efficiencyScore']:3d}/100")
    print(f"  ├── 몰입도:   {metrics['focusScore']:3d}/100")
    print(f"  └── 목표정렬: {metrics['goalAlignmentScore']:3d}/100")
    print(f"\n  리워드 포인트: +{tier['points']:,}P")

    print(f"\n  ⏱ 총 시간:      {metrics['totalWorkMinutes']:.0f}분")
    print(f"  ⏱ 활성 시간:    {metrics['activeWorkMinutes']:.0f}분")
    print(f"  🧘 딥 포커스:    {metrics['deepFocusMinutes']:.0f}분")
    print(f"  🔄 컨텍스트전환: {metrics['contextSwitchCount']}회")

    if metrics["softwareUsage"]:
        print(f"\n  📱 소프트웨어 사용:")
        for item in metrics["softwareUsage"][:5]:
            bar = "█" * int(item["percentage"] / 5)
            print(f"     {item['appName']:20s} {item['percentage']:5.1f}% {bar}")

    if metrics["bottlenecks"]:
        print(f"\n  ⚠️  병목:")
        for b in metrics["bottlenecks"]:
            print(f"     • {b}")

    if metrics["suggestedImprovements"]:
        print(f"\n  💡 제안:")
        for s in metrics["suggestedImprovements"]:
            print(f"     • {s}")

    print("\n" + "=" * 56)

    # ─── 5단계: Firebase 전송 ─────────────
    print("\n  📤 Firebase에 메트릭 전송 중...")
    if client.submit_metrics(metrics):
        print("  ✅ 전송 완료! 프론트엔드 대시보드에서 확인하세요.")
    else:
        print("  ❌ 전송 실패. 나중에 재시도됩니다.")

    print()


if __name__ == "__main__":
    main()

