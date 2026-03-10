"""
업무 컨텍스트 축적기 (Work Context Tracker)

화면 분석 결과를 시간 순으로 축적하여:
1. 연속된 동일 작업을 하나의 의미 있는 '업무 블록'으로 병합
2. 단편적 윈도우 타이틀 대신 AI 기반 구체적 업무 설명 생성
3. 작업 전환 패턴과 업무 흐름을 추적
4. 타임라인에 표시할 풍부한 컨텍스트 제공
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import structlog

from analyzer.screen_analyzer import ScreenContext

logger = structlog.get_logger(__name__)


@dataclass
class WorkBlock:
    """
    하나의 의미 있는 업무 블록

    단순히 "VS Code 3시간" 대신
    "사용자 인증 플로우 에러 핸들링 개선 작업 (45분)" 과 같이
    구체적인 업무 단위로 묶인다.
    """
    start_time: float
    end_time: float = 0.0
    category: str = "other"
    app_name: str = ""

    # AI 분석 기반 컨텍스트
    summaries: list[str] = field(default_factory=list)       # 수집된 화면 요약들
    inferences: list[str] = field(default_factory=list)      # 수집된 업무 추론들
    detected_elements: list[str] = field(default_factory=list)

    # 최종 합성 설명
    description: str = ""
    work_purpose: str = ""         # 이 블록의 업무 목적

    analysis_count: int = 0        # 이 블록에 포함된 분석 횟수

    def duration_minutes(self) -> float:
        end = self.end_time or time.time()
        return (end - self.start_time) / 60

    def to_timeline_segment(self) -> dict:
        """프론트엔드 ActivitySegment 형식으로 변환"""
        start_dt = datetime.fromtimestamp(self.start_time)
        end_dt = datetime.fromtimestamp(self.end_time or time.time())
        dur = self.duration_minutes()

        # AI 기반 설명이 있으면 사용, 없으면 기본 설명
        desc = self.description or self.work_purpose or f"{self.app_name} 사용"

        return {
            "startTime": start_dt.strftime("%H:%M"),
            "endTime": end_dt.strftime("%H:%M"),
            "app": self.app_name,
            "windowTitle": "",
            "category": self.category,
            "durationMinutes": round(dur, 1),
            "description": desc,
            # 확장 필드: 풍부한 컨텍스트
            "screenSummary": self.summaries[-1] if self.summaries else "",
            "workInference": self.inferences[-1] if self.inferences else "",
            "detectedElements": list(set(self.detected_elements))[:10],
            "analysisCount": self.analysis_count,
        }


class WorkContextTracker:
    """
    실시간 업무 컨텍스트 축적기

    ScreenAnalyzer의 개별 분석 결과를 받아서
    의미 있는 '업무 블록' 단위로 병합하고,
    풍부한 업무 내러티브를 구성합니다.
    """

    def __init__(self):
        self._blocks: list[WorkBlock] = []
        self._current_block: Optional[WorkBlock] = None
        self._all_contexts: list[ScreenContext] = []

        # 통계
        self._category_time: dict[str, float] = defaultdict(float)
        self._total_analyses: int = 0

    def process_context(self, ctx: ScreenContext) -> None:
        """
        새로운 화면 분석 결과를 처리하고 업무 블록에 반영

        같은 카테고리+앱이 일정 시간 연속되면 하나의 블록으로 병합.
        카테고리나 앱이 바뀌면 이전 블록을 마감하고 새 블록 시작.
        """
        self._all_contexts.append(ctx)
        self._total_analyses += 1

        # 현재 블록과 같은 업무인지 판단
        if self._current_block and self._is_same_work(self._current_block, ctx):
            # 기존 블록에 컨텍스트 추가
            self._extend_block(self._current_block, ctx)
        else:
            # 이전 블록 마감
            if self._current_block:
                self._finalize_block(self._current_block)
                self._blocks.append(self._current_block)

            # 새 블록 시작
            self._current_block = WorkBlock(
                start_time=ctx.timestamp,
                category=ctx.work_category,
                app_name=ctx.app_name,
            )
            self._extend_block(self._current_block, ctx)

    def finalize_all(self) -> list[dict]:
        """
        세션 종료 시 모든 블록 마감 및 타임라인 반환

        Returns:
            ActivitySegment 형식의 타임라인 리스트
        """
        if self._current_block:
            self._finalize_block(self._current_block)
            self._blocks.append(self._current_block)
            self._current_block = None

        timeline = []
        for block in self._blocks:
            seg = block.to_timeline_segment()
            # 1분 미만 블록 제외 (노이즈)
            if seg["durationMinutes"] >= 1.0:
                timeline.append(seg)

        return timeline

    def get_work_narrative(self) -> str:
        """
        현재까지의 업무 내러티브를 생성

        "오전 9시부터 사용자 인증 플로우 구현 작업을 시작하여,
         10시 30분에 API 문서를 참고한 뒤, 11시부터 테스트 코드
         작성으로 전환했습니다."
        """
        blocks = self._blocks.copy()
        if self._current_block:
            blocks.append(self._current_block)

        if not blocks:
            return "아직 분석된 업무가 없습니다."

        narrative_parts = []
        for block in blocks:
            if block.duration_minutes() < 1:
                continue
            start_str = datetime.fromtimestamp(block.start_time).strftime("%H:%M")
            desc = block.description or block.work_purpose or f"{block.app_name} 사용"
            dur = int(block.duration_minutes())
            narrative_parts.append(f"{start_str}부터 {desc} ({dur}분)")

        if not narrative_parts:
            return "아직 분석된 업무가 없습니다."

        return " → ".join(narrative_parts)

    def get_category_summary(self) -> dict[str, float]:
        """카테고리별 시간 요약 (분 단위)"""
        summary: dict[str, float] = defaultdict(float)
        blocks = self._blocks.copy()
        if self._current_block:
            blocks.append(self._current_block)

        for block in blocks:
            summary[block.category] += block.duration_minutes()

        return dict(summary)

    def get_live_context(self) -> dict:
        """현재 실시간 컨텍스트 (대시보드 폴링용)"""
        current = self._current_block
        if not current:
            return {
                "hasContext": False,
                "currentWork": "",
                "currentCategory": "",
                "totalAnalyses": self._total_analyses,
            }

        return {
            "hasContext": True,
            "currentWork": current.description or current.work_purpose or "",
            "currentSummary": current.summaries[-1] if current.summaries else "",
            "currentInference": current.inferences[-1] if current.inferences else "",
            "currentCategory": current.category,
            "currentApp": current.app_name,
            "blockDurationMinutes": round(current.duration_minutes(), 1),
            "totalAnalyses": self._total_analyses,
            "totalBlocks": len(self._blocks) + (1 if current else 0),
            "narrative": self.get_work_narrative(),
            "categorySummary": self.get_category_summary(),
        }

    # ─── Private Methods ────────────────────────────

    @staticmethod
    def _is_same_work(block: WorkBlock, ctx: ScreenContext) -> bool:
        """
        현재 블록과 새 컨텍스트가 같은 업무인지 판단

        같은 카테고리 + 같은 앱이면 동일 업무로 간주.
        5분 이상 간격이 벌어지면 다른 업무로 판단.
        """
        if ctx.work_category != block.category:
            return False
        if ctx.app_name != block.app_name:
            return False
        # 마지막 분석으로부터 5분 이상 경과하면 새 블록
        if ctx.timestamp - (block.end_time or block.start_time) > 300:
            return False
        return True

    @staticmethod
    def _extend_block(block: WorkBlock, ctx: ScreenContext) -> None:
        """블록에 새 컨텍스트 추가"""
        block.end_time = ctx.timestamp
        block.analysis_count += 1

        if ctx.screen_summary and ctx.confidence > 0.3:
            block.summaries.append(ctx.screen_summary)
            # 최근 10개만 유지
            if len(block.summaries) > 10:
                block.summaries = block.summaries[-10:]

        if ctx.work_inference and ctx.confidence > 0.3:
            block.inferences.append(ctx.work_inference)
            if len(block.inferences) > 10:
                block.inferences = block.inferences[-10:]

        block.detected_elements.extend(ctx.detected_elements)

        # 설명 업데이트 (가장 최근 + 높은 신뢰도 우선)
        if ctx.confidence > 0.5:
            block.description = ctx.screen_summary
            block.work_purpose = ctx.work_inference

    @staticmethod
    def _finalize_block(block: WorkBlock) -> None:
        """블록 마감 시 최종 설명 합성"""
        if not block.end_time:
            block.end_time = time.time()

        # 여러 요약 중 가장 구체적인 것 선택 (길이가 긴 것 = 더 구체적)
        if block.summaries:
            block.description = max(block.summaries, key=len)
        if block.inferences:
            block.work_purpose = max(block.inferences, key=len)
