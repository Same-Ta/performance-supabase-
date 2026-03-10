"""
ProofWork — 메트릭 엔진

WindowTracker의 SessionData를 받아
실제 성과 스코어를 계산하고 Firestore 전송 형식으로 변환합니다.
"""

import hashlib
import time
from datetime import datetime
from tracker import SessionData, PRODUCTIVE_CATEGORIES

# ─── 스코어링 가중치 ──────────────────────────
WEIGHT_OUTPUT = 0.30
WEIGHT_EFFICIENCY = 0.25
WEIGHT_FOCUS = 0.25
WEIGHT_GOAL_ALIGNMENT = 0.20

# Focus 공식 가중치
W_CS = 0.35   # 컨텍스트 전환율 (낮을수록 ↑)
W_DF = 0.40   # 딥포커스 비율
W_ID = 0.25   # 입력 밀도 (활성 비율)
CSR_MAX = 3.0
ID_MAX = 1.0  # 활성 비율 최대

# 리워드 티어
REWARD_TIERS = [
    (95, "legend",    "🏆 레전드",    2.0),
    (85, "master",    "💎 마스터",    1.6),
    (75, "specialist","🔥 스페셜리스트", 1.3),
    (60, "achiever",  "⭐ 어치버",    1.1),
    (0,  "explorer",  "🌱 익스플로러",  1.0),
]


def compute_metrics(session: SessionData) -> dict:
    """
    세션 데이터 → Firestore 전송용 메트릭 딕셔너리

    Returns:
        Firestore performance_metrics 컬렉션에 저장할 문서
    """
    elapsed = (session.end_time or time.time()) - session.start_time
    total_minutes = elapsed / 60
    active_seconds = sum(session.category_seconds.values())
    active_minutes = active_seconds / 60
    deep_focus_minutes = session.deep_focus_total_sec / 60

    # 1) Focus Score
    csr = session.context_switches / max(active_minutes, 1)  # 전환/분
    dfr = deep_focus_minutes / max(active_minutes, 1)         # 딥포커스 비율
    active_ratio = active_seconds / max(elapsed, 1)           # 활성 비율

    focus_score = int(min(100, max(0, (
        W_CS * max(0, 1 - csr / CSR_MAX) +
        W_DF * min(1.0, dfr) +
        W_ID * min(1.0, active_ratio / ID_MAX)
    ) * 100)))

    # 2) Output Score (생산적 카테고리 비율)
    productive_sec = sum(
        v for k, v in session.category_seconds.items()
        if k in PRODUCTIVE_CATEGORIES
    )
    output_score = int(min(100, max(0, (productive_sec / max(active_seconds, 1)) * 100 * 1.1)))

    # 3) Efficiency Score
    efficiency_score = int(min(100, max(0, output_score * active_ratio * 1.2)))

    # 4) Goal Alignment (기본: 생산적 비율 기반)
    goal_alignment_score = int(min(100, max(0, (productive_sec / max(active_seconds, 1)) * 100)))

    # 5) Overall
    overall = int(min(100, max(0, round(
        output_score * WEIGHT_OUTPUT +
        efficiency_score * WEIGHT_EFFICIENCY +
        focus_score * WEIGHT_FOCUS +
        goal_alignment_score * WEIGHT_GOAL_ALIGNMENT
    ))))

    # 6) 리워드 티어
    tier_id, tier_label, tier_mult = "explorer", "🌱 익스플로러", 1.0
    for threshold, tid, tlabel, tmult in REWARD_TIERS:
        if overall >= threshold:
            tier_id, tier_label, tier_mult = tid, tlabel, tmult
            break
    reward_points = int(overall * 10 * tier_mult)

    # 7) 소프트웨어 사용 현황
    total_app = sum(session.app_seconds.values())
    software_usage = []
    for app_name, secs in sorted(session.app_seconds.items(), key=lambda x: x[1], reverse=True)[:10]:
        cat = _app_to_category(app_name)
        software_usage.append({
            "category": cat,
            "appName": app_name,
            "minutes": round(secs / 60, 1),
            "percentage": round((secs / max(total_app, 1)) * 100, 1),
        })

    # 8) 병목 감지
    bottlenecks = _detect_bottlenecks(csr, deep_focus_minutes, active_minutes, session)

    # 9) 개선 제안
    suggestions = _suggest(focus_score, efficiency_score, output_score, goal_alignment_score)

    # 10) AI 요약 텍스트 (구체적 활동 기반)
    top_apps = ", ".join([s["appName"] for s in software_usage[:3]])
    # 타임라인에서 주요 활동 추출 (상위 3개, 분 기준)
    timeline = getattr(session, "timeline", [])
    top_segments = sorted(timeline, key=lambda x: x.get("durationMinutes", 0), reverse=True)[:3]

    # AI 화면 분석 기반 내러티브가 있으면 우선 사용
    work_narrative = getattr(session, "work_narrative", "")
    screen_contexts = getattr(session, "screen_contexts", [])

    if work_narrative:
        # AI 화면 분석으로 생성된 구체적 업무 내러티브 사용
        ai_summary = (
            f"오늘은 총 {active_minutes:.0f}분 활성 작업을 수행했습니다. "
            f"업무 흐름: {work_narrative}. "
            f"딥 포커스 {deep_focus_minutes:.0f}분, 컨텍스트 전환 {session.context_switches}회."
        )
    elif top_segments:
        activity_examples = "・".join(
            f"{seg['description']}" for seg in top_segments
        )
        ai_summary = (
            f"오늘은 총 {active_minutes:.0f}분 활성 작업을 수행했습니다. "
            f"주요 활동: {activity_examples}. "
            f"딥 포커스 {deep_focus_minutes:.0f}분, 컨텍스트 전환 {session.context_switches}회."
        )
    else:
        ai_summary = (
            f"오늘은 총 {active_minutes:.0f}분 활성 작업을 수행했으며, "
            f"주로 {top_apps}을(를) 사용했습니다. "
            f"딥 포커스 시간 {deep_focus_minutes:.0f}분, "
            f"컨텍스트 전환 {session.context_switches}회를 기록했습니다."
        )

    # 주요 성과 자동 생성 (타임라인 기반)
    key_achievements = []
    if deep_focus_minutes >= 20:
        key_achievements.append(f"딥 포커스 {deep_focus_minutes:.0f}분 달성 (20분+ 무중단 집중)")
    if top_segments:
        longest = top_segments[0]
        key_achievements.append(f"가장 긴 집중 작업: {longest['description']}")
    productive_pct = int((productive_sec / max(active_seconds, 1)) * 100)
    if productive_pct >= 70:
        key_achievements.append(f"생산성 도구 활용률 {productive_pct}% 달성")

    # AI 화면 분석 기반 성과 추가
    if screen_contexts:
        unique_inferences = []
        seen = set()
        for sc in screen_contexts:
            inf = sc.get("inference", "")
            if inf and inf not in seen:
                seen.add(inf)
                unique_inferences.append(inf)
        if unique_inferences:
            key_achievements.append(f"AI 분석 감지 업무: {unique_inferences[0]}")

    date_str = datetime.now().strftime("%Y-%m-%d")
    session_start_time = datetime.fromtimestamp(session.start_time).strftime("%H:%M")
    session_end_time = datetime.fromtimestamp(session.end_time or time.time()).strftime("%H:%M")
    metric_id = hashlib.sha256(
        f"{session.user_id}_{date_str}_{session.session_id}".encode()
    ).hexdigest()[:16]

    return {
        "metricId": metric_id,
        "userId": session.user_id,
        "date": date_str,
        "sessionId": session.session_id,
        "status": "pending_review",

        "totalWorkMinutes": round(total_minutes, 1),
        "activeWorkMinutes": round(active_minutes, 1),
        "focusScore": focus_score,
        "efficiencyScore": efficiency_score,
        "goalAlignmentScore": goal_alignment_score,
        "outputScore": output_score,
        "overallScore": overall,

        "contextSwitchCount": session.context_switches,
        "contextSwitchRate": round(csr, 2),
        "inputDensity": round(active_ratio * 100, 1),
        "deepFocusMinutes": round(deep_focus_minutes, 1),

        "softwareUsage": software_usage,
        "aiSummary": ai_summary,
        "keyAchievements": key_achievements,
        "suggestedImprovements": suggestions,
        "bottlenecks": bottlenecks,
        "timeline": timeline,
        "sessionStartTime": session_start_time,
        "sessionEndTime": session_end_time,

        # AI 화면 분석 컨텍스트
        "workNarrative": work_narrative,
        "screenContexts": screen_contexts[-20:] if screen_contexts else [],  # 최근 20개
        "screenAnalysisCount": len(screen_contexts),

        "reward": {
            "tier": tier_id,
            "label": tier_label,
            "points": reward_points,
        },

        "dataIntegrityHash": hashlib.sha256(
            f"{metric_id}|{session.user_id}|{date_str}|{overall}".encode()
        ).hexdigest(),
        "createdAt": datetime.now().isoformat(),
    }


# ─── Helpers ────────────────────────────────

def _app_to_category(app_name: str) -> str:
    from tracker import SOFTWARE_CATEGORIES
    lower = app_name.lower()
    for cat, keywords in SOFTWARE_CATEGORIES.items():
        for kw in keywords:
            if kw in lower:
                return cat
    return "other"


def _detect_bottlenecks(csr, dfm, active_min, session: SessionData) -> list[str]:
    bns = []
    if csr > 2.0:
        bns.append(f"높은 컨텍스트 전환율 ({csr:.1f}회/분) — 멀티태스킹으로 집중력 저하 우려")
    if active_min > 60 and dfm < 20:
        bns.append(f"딥 포커스 부족 ({dfm:.0f}분/{active_min:.0f}분) — 20분+ 연속 집중 시간 확보 필요")
    comm_sec = session.category_seconds.get("communication", 0)
    total_sec = sum(session.category_seconds.values())
    if total_sec > 0 and (comm_sec / total_sec) > 0.35:
        bns.append(f"커뮤니케이션 과다 ({comm_sec/60:.0f}분, {comm_sec/total_sec*100:.0f}%) — 집중시간대 알림 무음 권장")
    return bns


def _suggest(focus, eff, output, align) -> list[str]:
    suggestions = []
    scores = {"몰입도": focus, "효율성": eff, "산출물": output, "목표정렬": align}
    weakest = min(scores, key=scores.get)  # type: ignore

    if weakest == "몰입도" and focus < 70:
        suggestions.append("포모도로 기법 (25분 집중 + 5분 휴식) 활용으로 딥 포커스를 늘려보세요.")
    elif weakest == "효율성" and eff < 70:
        suggestions.append("유휴 시간이 많습니다. 업무 시작 전 명확한 목표를 설정해보세요.")
    elif weakest == "산출물" and output < 70:
        suggestions.append("생산 도구 (IDE, Docs) 사용 비율을 높이고 비생산적 앱 사용을 줄여보세요.")
    elif weakest == "목표정렬" and align < 70:
        suggestions.append("업무 활동이 OKR/KPI 목표와 잘 맞지 않습니다. 목표를 재검토해보세요.")
    return suggestions
