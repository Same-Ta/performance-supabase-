"""
ProofWork On-Device Agent — 로컬 HTTP API 서버

대시보드의 [추적 시작] / [종료·저장] 버튼이 이 서버를 통해
Python 에이전트를 실행/종료합니다.

실행: python server.py
포트: http://localhost:5001
"""

import sys
import threading
import time
from datetime import datetime

# Windows 터미널 cp949 인코딩 문제 해결
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass  # Python 3.6 이하 무시

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request
from flask_cors import CORS
import structlog

logger = structlog.get_logger(__name__)

app = Flask(__name__)

# CORS 설정 - 로컬 및 배포 환경 허용
CORS(app, origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    "https://performance-fefc0.web.app",
    "https://performance-fefc0.firebaseapp.com",
    "https://performance-one-plum.vercel.app"
])

# ─── 전역 상태 (thread-safe) ─────────────────────────────────
_lock = threading.Lock()
_state: dict = {
    "running": False,
    "tracker": None,
    "client": None,
}


def _tracking_loop():
    """백그라운드 추적 루프"""
    tracker = _state["tracker"]
    while _state["running"] and tracker:
        tracker.poll_once()
        time.sleep(tracker.poll_interval)


# ─── API 엔드포인트 ────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({"ok": True, "version": "1.0"})


@app.get("/status")
def status():
    with _lock:
        running = _state["running"]
        tracker = _state["tracker"]
    stats = tracker.get_live_stats() if tracker else None
    return jsonify({"running": running, "stats": stats})


@app.get("/context")
def context():
    """현재 AI 화면 분석 컨텍스트 (실시간)"""
    with _lock:
        tracker = _state["tracker"]
    if not tracker:
        return jsonify({"hasContext": False})
    stats = tracker.get_live_stats()
    screen_data = stats.get("screenAnalysis", {"hasContext": False})
    analysis_stats = stats.get("screenAnalysisStats", {})
    return jsonify({**screen_data, "analysisStats": analysis_stats})
def start():
    data = request.get_json(silent=True) or {}
    uid = data.get("uid", "")
    id_token = data.get("idToken", "")
    task_type = data.get("taskType", "general")

    with _lock:
        if _state["running"]:
            return jsonify({"ok": True, "message": "이미 실행 중"})

        from firebase_client import FirebaseClient
        from tracker import WindowTracker

        client = FirebaseClient()
        if id_token and uid:
            # 프론트엔드에서 이미 로그인된 Firebase 토큰 사용
            client.set_external_token(uid, id_token)
        elif not client.is_authenticated:
            return jsonify({"ok": False, "message": "인증 정보 없음. 대시보드에서 로그인 후 시작하세요."}), 401

        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        tracker = WindowTracker(poll_interval=3.0)
        tracker.start_session(session_id, uid or client.user_id)

        _state["running"] = True
        _state["tracker"] = tracker
        _state["client"] = client
        _state["task_type"] = task_type

        t = threading.Thread(target=_tracking_loop, daemon=True)
        t.start()

    logger.info("tracking_started", uid=uid, task_type=task_type)
    return jsonify({"ok": True, "sessionId": session_id})


@app.post("/stop")
def stop():
    with _lock:
        if not _state["running"]:
            return jsonify({"ok": False, "message": "실행 중이 아닙니다"})

        _state["running"] = False
        tracker = _state["tracker"]
        client = _state["client"]
        _state["tracker"] = None

    if not tracker:
        return jsonify({"ok": True})

    session = tracker.stop_session()
    if not session:
        return jsonify({"ok": True, "message": "세션 데이터 없음"})

    task_type = _state.get("task_type", "general")

    from metrics_engine import compute_metrics

    metrics = compute_metrics(session)
    metrics["taskType"] = task_type
    submitted = client.submit_metrics(metrics) if client else False
    logger.info("tracking_stopped", submitted=submitted, score=metrics.get("overallScore"))

    # 프론트엔드에 전달할 요약 메트릭
    summary = {
        "overallScore": metrics.get("overallScore", 0),
        "focusScore": metrics.get("focusScore", 0),
        "efficiencyScore": metrics.get("efficiencyScore", 0),
        "goalAlignmentScore": metrics.get("goalAlignmentScore", 0),
        "outputScore": metrics.get("outputScore", 0),
        "totalWorkMinutes": metrics.get("totalWorkMinutes", 0),
        "activeWorkMinutes": metrics.get("activeWorkMinutes", 0),
        "deepFocusMinutes": metrics.get("deepFocusMinutes", 0),
        "contextSwitchCount": metrics.get("contextSwitchCount", 0),
        "aiSummary": metrics.get("aiSummary", ""),
        "reward": metrics.get("reward", {}),
        "submitted": submitted,
        # AI 화면 분석 컨텍스트
        "workNarrative": metrics.get("workNarrative", ""),
        "screenAnalysisCount": metrics.get("screenAnalysisCount", 0),
        "timeline": metrics.get("timeline", []),
    }
    return jsonify({"ok": True, "metrics": summary})


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5001))
    host = os.environ.get("HOST", "0.0.0.0" if os.environ.get("PORT") else "localhost")
    
    print()
    print("=" * 52)
    print("  ProofWork Agent Server")
    print(f"  http://{host}:{port}")
    print("=" * 52)
    print("  Press [Start Tracking] button in the dashboard.")
    print("  Quit: Ctrl+C")
    print()
    app.run(host=host, port=port, debug=False, use_reloader=False)
