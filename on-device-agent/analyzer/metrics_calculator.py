"""
성과 메트릭 계산기 (Metrics Calculator)

세션 분석 결과를 KPI/OKR 매핑 가능한 표준 메트릭으로 변환합니다.

스코어링 공식:
  overall = output × 0.30 + efficiency × 0.25 + focus × 0.25 + goalAlignment × 0.20
"""

import hashlib
import time
from dataclasses import dataclass, field
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)

# ─── 글로벌 가중치 ─────────────────────────────
WEIGHT_OUTPUT = 0.30
WEIGHT_EFFICIENCY = 0.25
WEIGHT_FOCUS = 0.25
WEIGHT_GOAL_ALIGNMENT = 0.20

# ─── 리워드 티어 기준 ──────────────────────────
REWARD_TIERS = [
    (95, "legend",    "🏆 레전드"),
    (85, "master",    "💎 마스터"),
    (75, "specialist","🔥 스페셜리스트"),
    (60, "achiever",  "⭐ 어치버"),
    (0,  "explorer",  "🌱 익스플로러"),
]


@dataclass
class GoalMapping:
    """목표(OKR/KPI) 매핑 정보"""
    goal_id: str
    goal_title: str
    key_results: list[str] = field(default_factory=list)
    target_categories: list[str] = field(default_factory=list)
    target_apps: list[str] = field(default_factory=list)
    weight: float = 1.0


@dataclass
class PerformanceMetrics:
    """최종 성과 메트릭 (서버 동기화 및 리포트용)"""
    metric_id: str
    user_id: str
    date: str
    period_type: str = "daily"           # daily | weekly | monthly

    # 4대 핵심 스코어 (0–100)
    output_score: int = 0                # 산출물
    efficiency_score: int = 0            # 효율성
    focus_score: int = 0                 # 몰입도
    goal_alignment_score: int = 0        # 목표 정렬도
    overall_score: int = 0               # 종합 점수

    # 세부 데이터
    total_work_minutes: float = 0
    active_work_minutes: float = 0
    deep_focus_minutes: float = 0
    context_switch_count: int = 0
    context_switch_rate: float = 0
    input_density: float = 0

    # 소프트웨어 사용
    software_usage: list[dict] = field(default_factory=list)

    # 리워드
    reward_tier: str = "explorer"
    reward_label: str = "🌱 익스플로러"
    reward_points: int = 0

    # AI 분석
    ai_summary: str = ""
    bottlenecks: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)

    # 메타
    data_integrity_hash: str = ""
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        """Firestore 전송용 딕셔너리 변환"""
        return {
            "metricId": self.metric_id,
            "userId": self.user_id,
            "date": self.date,
            "periodType": self.period_type,
            "scores": {
                "output": self.output_score,
                "efficiency": self.efficiency_score,
                "focus": self.focus_score,
                "goalAlignment": self.goal_alignment_score,
                "overall": self.overall_score,
            },
            "details": {
                "totalWorkMinutes": self.total_work_minutes,
                "activeWorkMinutes": self.active_work_minutes,
                "deepFocusMinutes": self.deep_focus_minutes,
                "contextSwitchCount": self.context_switch_count,
                "contextSwitchRate": self.context_switch_rate,
                "inputDensity": self.input_density,
            },
            "softwareUsage": self.software_usage,
            "reward": {
                "tier": self.reward_tier,
                "label": self.reward_label,
                "points": self.reward_points,
            },
            "ai": {
                "summary": self.ai_summary,
                "bottlenecks": self.bottlenecks,
                "suggestions": self.suggestions,
            },
            "dataIntegrityHash": self.data_integrity_hash,
            "createdAt": self.created_at,
        }


class MetricsCalculator:
    """세션 분석 결과 → 표준 성과 메트릭 변환기"""

    def __init__(self, goals: Optional[list[GoalMapping]] = None):
        self._goals = goals or []

    def set_goals(self, goals: list[GoalMapping]):
        """목표 매핑 설정 (서버에서 동기화)"""
        self._goals = goals
        logger.info("goals_updated", count=len(goals))

    def calculate(
        self,
        session_result: dict,
        user_id: str,
        date: str,
    ) -> PerformanceMetrics:
        """
        세션 분석 결과로부터 최종 성과 메트릭 계산

        Args:
            session_result: ContextAnalyzer.finalize_session() 결과
            user_id: 사용자 ID
            date: 날짜 (YYYY-MM-DD)

        Returns:
            PerformanceMetrics 인스턴스
        """
        # 기본 메트릭 ID 생성
        metric_id = self._generate_metric_id(user_id, date)

        # 세션에서 기본 스코어 추출
        output_score = session_result.get("outputScore", 50)
        efficiency_score = session_result.get("efficiencyScore", 50)
        focus_score = session_result.get("focusScore", 50)

        # 목표 정렬도 계산
        goal_alignment_score = self._calculate_goal_alignment(
            session_result.get("softwareUsage", [])
        )

        # 종합 점수
        overall_score = self._calculate_overall(
            output_score, efficiency_score, focus_score, goal_alignment_score
        )

        # 리워드 티어 결정
        tier, tier_id, tier_label = self._determine_reward_tier(overall_score)
        reward_points = self._calculate_reward_points(overall_score, tier_id)

        # 병목 현상 감지
        bottlenecks = self._detect_bottlenecks(session_result)

        # 개선 제안
        suggestions = self._generate_suggestions(
            output_score, efficiency_score, focus_score, goal_alignment_score, session_result
        )

        metrics = PerformanceMetrics(
            metric_id=metric_id,
            user_id=user_id,
            date=date,
            output_score=output_score,
            efficiency_score=efficiency_score,
            focus_score=focus_score,
            goal_alignment_score=goal_alignment_score,
            overall_score=overall_score,
            total_work_minutes=session_result.get("totalWorkMinutes", 0),
            active_work_minutes=session_result.get("activeWorkMinutes", 0),
            deep_focus_minutes=session_result.get("deepFocusMinutes", 0),
            context_switch_count=session_result.get("contextSwitchCount", 0),
            context_switch_rate=session_result.get("contextSwitchRate", 0),
            input_density=session_result.get("inputDensity", 0),
            software_usage=session_result.get("softwareUsage", []),
            reward_tier=tier_id,
            reward_label=tier_label,
            reward_points=reward_points,
            bottlenecks=bottlenecks,
            suggestions=suggestions,
        )

        # 데이터 무결성 해시
        metrics.data_integrity_hash = self._compute_integrity_hash(metrics)

        logger.info(
            "metrics_calculated",
            metric_id=metric_id,
            overall=overall_score,
            tier=tier_id,
        )

        return metrics

    # ─── Private Methods ────────────────────────

    @staticmethod
    def _calculate_overall(
        output: int, efficiency: int, focus: int, goal_alignment: int
    ) -> int:
        """종합 점수 = output×0.30 + efficiency×0.25 + focus×0.25 + goalAlignment×0.20"""
        raw = (
            output * WEIGHT_OUTPUT
            + efficiency * WEIGHT_EFFICIENCY
            + focus * WEIGHT_FOCUS
            + goal_alignment * WEIGHT_GOAL_ALIGNMENT
        )
        return int(min(100, max(0, round(raw))))

    def _calculate_goal_alignment(self, software_usage: list[dict]) -> int:
        """
        목표 정렬도 계산

        설정된 OKR/KPI 목표의 target_categories/apps와
        실제 소프트웨어 사용 비율을 비교하여 정렬도 산출
        """
        if not self._goals or not software_usage:
            return 50  # 목표 미설정 시 중립값

        total_alignment = 0.0
        total_weight = 0.0

        for goal in self._goals:
            alignment = self._compute_single_goal_alignment(goal, software_usage)
            total_alignment += alignment * goal.weight
            total_weight += goal.weight

        if total_weight == 0:
            return 50

        return int(min(100, max(0, (total_alignment / total_weight) * 100)))

    @staticmethod
    def _compute_single_goal_alignment(
        goal: GoalMapping, software_usage: list[dict]
    ) -> float:
        """단일 목표에 대한 정렬도 (0.0–1.0)"""
        target_cats = set(c.lower() for c in goal.target_categories)
        target_apps = set(a.lower() for a in goal.target_apps)

        total_pct = 0.0
        aligned_pct = 0.0

        for item in software_usage:
            pct = item.get("percentage", 0)
            total_pct += pct

            cat_match = item.get("category", "").lower() in target_cats
            app_match = item.get("appName", "").lower() in target_apps

            if cat_match or app_match:
                aligned_pct += pct

        if total_pct == 0:
            return 0.0

        return aligned_pct / total_pct

    @staticmethod
    def _determine_reward_tier(overall_score: int) -> tuple[int, str, str]:
        """리워드 티어 결정"""
        for threshold, tier_id, tier_label in REWARD_TIERS:
            if overall_score >= threshold:
                return threshold, tier_id, tier_label
        return 0, "explorer", "🌱 익스플로러"

    @staticmethod
    def _calculate_reward_points(overall_score: int, tier_id: str) -> int:
        """리워드 포인트 계산"""
        base_points = overall_score * 10
        tier_multiplier = {
            "legend": 2.0,
            "master": 1.6,
            "specialist": 1.3,
            "achiever": 1.1,
            "explorer": 1.0,
        }
        return int(base_points * tier_multiplier.get(tier_id, 1.0))

    @staticmethod
    def _detect_bottlenecks(session_result: dict) -> list[str]:
        """병목 현상 감지"""
        bottlenecks = []

        csr = session_result.get("contextSwitchRate", 0)
        if csr > 2.0:
            bottlenecks.append(
                f"높은 컨텍스트 전환율 ({csr:.1f}회/분) - 멀티태스킹으로 인한 집중력 저하 가능"
            )

        dfm = session_result.get("deepFocusMinutes", 0)
        active = session_result.get("activeWorkMinutes", 0)
        if active > 60 and dfm < 20:
            bottlenecks.append(
                f"낮은 딥 포커스 비율 ({dfm:.0f}분/{active:.0f}분) - 20분 이상 연속 집중 구간 부족"
            )

        # 비생산적 소프트웨어 과다 사용 체크
        for item in session_result.get("softwareUsage", []):
            if item.get("category") in ("communication", "other") and item.get("percentage", 0) > 40:
                bottlenecks.append(
                    f"{item['appName']} 과다 사용 ({item['percentage']:.0f}%) - "
                    "커뮤니케이션 도구 사용 시간이 40%를 초과"
                )

        return bottlenecks

    @staticmethod
    def _generate_suggestions(
        output: int, efficiency: int, focus: int, goal_align: int, session: dict
    ) -> list[str]:
        """개선 제안 생성"""
        suggestions = []

        scores = {"산출물": output, "효율성": efficiency, "몰입도": focus, "목표 정렬도": goal_align}
        weakest = min(scores, key=scores.get)  # type: ignore

        if weakest == "몰입도" and focus < 70:
            suggestions.append("포모도로 기법 (25분 집중 + 5분 휴식) 활용으로 딥 포커스 시간을 늘려보세요.")
            csr = session.get("contextSwitchRate", 0)
            if csr > 1.5:
                suggestions.append("알림을 일시 중지하고 배치 처리 방식으로 커뮤니케이션 처리를 권장합니다.")

        elif weakest == "효율성" and efficiency < 70:
            suggestions.append("유휴 시간이 많습니다. 업무 시작 전 목표와 우선순위를 명확히 설정해보세요.")

        elif weakest == "산출물" and output < 70:
            suggestions.append("핵심 생산 도구 사용 비율을 높이세요. 불필요한 회의나 SNS 시간을 줄이는 것이 효과적입니다.")

        elif weakest == "목표 정렬도" and goal_align < 70:
            suggestions.append("현재 업무 활동이 설정된 OKR/KPI 목표와 잘 맞지 않습니다. 목표 재검토를 권장합니다.")

        return suggestions

    @staticmethod
    def _generate_metric_id(user_id: str, date: str) -> str:
        """고유 메트릭 ID 생성"""
        raw = f"{user_id}_{date}_{time.time()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    @staticmethod
    def _compute_integrity_hash(metrics: PerformanceMetrics) -> str:
        """데이터 무결성 해시 (변조 방지)"""
        payload = (
            f"{metrics.metric_id}|{metrics.user_id}|{metrics.date}|"
            f"{metrics.output_score}|{metrics.efficiency_score}|"
            f"{metrics.focus_score}|{metrics.goal_alignment_score}|"
            f"{metrics.overall_score}"
        )
        return hashlib.sha256(payload.encode()).hexdigest()
