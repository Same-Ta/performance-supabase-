"""
데이터 프라이버시 관리자 (Data Sanitizer)

Privacy-by-Design 원칙에 따라:
1. PII(개인식별정보) 탐지 및 마스킹
2. 민감한 텍스트 필터링
3. 메트릭 익명화
4. 감사 로깅 (Audit Trail)
5. 사용자 동의 기반 데이터 처리
"""

import hashlib
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)


class ConsentLevel(Enum):
    """사용자 동의 수준"""
    NONE = "none"              # 데이터 수집 불가
    BASIC = "basic"            # 집계 통계만
    STANDARD = "standard"      # 소프트웨어 사용현황 포함 (기본값)
    FULL = "full"              # 상세 분석 포함 (텍스트 컨텍스트 등)


@dataclass
class AuditEntry:
    """감사 로그 엔트리"""
    timestamp: float
    action: str
    data_type: str
    description: str
    user_consent_level: str


class DataSanitizer:
    """데이터 프라이버시 및 위생 관리"""

    # PII 탐지 패턴
    _PII_PATTERNS = {
        "email": re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
        "phone_kr": re.compile(r"01[016789]-?\d{3,4}-?\d{4}"),
        "phone_intl": re.compile(r"\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}"),
        "rrn_kr": re.compile(r"\d{6}-?\d{7}"),           # 주민등록번호
        "card_number": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
        "ip_address": re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),
        "url_with_token": re.compile(r"https?://\S*(?:token|key|secret|password|pwd)\S*", re.IGNORECASE),
    }

    # 민감 키워드 (윈도우 타이틀 등에서 필터링)
    _SENSITIVE_KEYWORDS = {
        "password", "비밀번호", "secret", "token", "private",
        "salary", "급여", "연봉", "account", "계좌",
        "login", "credential", "인증", "개인정보",
    }

    def __init__(self, consent_level: ConsentLevel = ConsentLevel.STANDARD):
        self._consent_level = consent_level
        self._audit_log: list[AuditEntry] = []
        self._max_audit_entries = 10000

    @property
    def consent_level(self) -> ConsentLevel:
        return self._consent_level

    def update_consent(self, level: ConsentLevel) -> None:
        """사용자 동의 수준 업데이트"""
        old = self._consent_level
        self._consent_level = level
        self._log_audit(
            "consent_updated",
            "consent",
            f"동의 수준 변경: {old.value} → {level.value}",
        )
        logger.info("consent_updated", old=old.value, new=level.value)

    def can_process(self) -> bool:
        """현재 동의 수준에서 데이터 처리 가능 여부"""
        return self._consent_level != ConsentLevel.NONE

    def sanitize_text(self, text: str) -> str:
        """텍스트에서 PII 제거"""
        if not text:
            return text

        sanitized = text
        for pii_type, pattern in self._PII_PATTERNS.items():
            matches = pattern.findall(sanitized)
            if matches:
                for match in matches:
                    sanitized = sanitized.replace(match, f"[{pii_type.upper()}_REDACTED]")
                self._log_audit(
                    "pii_redacted",
                    pii_type,
                    f"{len(matches)}개 {pii_type} 마스킹 처리",
                )

        return sanitized

    def sanitize_window_title(self, title: str) -> str:
        """윈도우 타이틀 필터링"""
        if not title:
            return title

        lower = title.lower()

        # 민감 키워드 포함 시 타이틀 마스킹
        for keyword in self._SENSITIVE_KEYWORDS:
            if keyword in lower:
                self._log_audit(
                    "title_redacted",
                    "window_title",
                    f"민감 키워드 '{keyword}' 포함 타이틀 마스킹",
                )
                # 앱 이름만 남기고 나머지 마스킹
                parts = title.split(" - ")
                if len(parts) >= 2:
                    return f"[REDACTED] - {parts[-1]}"
                return "[REDACTED]"

        # 동의 수준이 BASIC이면 앱 이름만 반환
        if self._consent_level == ConsentLevel.BASIC:
            parts = title.split(" - ")
            if len(parts) >= 2:
                return parts[-1].strip()
            return title[:20]

        return title

    def sanitize_text_context(self, texts: list[str]) -> list[str]:
        """OCR 텍스트 목록 필터링"""
        if self._consent_level in (ConsentLevel.NONE, ConsentLevel.BASIC):
            return []  # BASIC 이하에서는 텍스트 컨텍스트 수집 안 함

        return [self.sanitize_text(t) for t in texts if t.strip()]

    def sanitize_metrics(self, metrics_dict: dict) -> Optional[dict]:
        """
        메트릭 데이터 동의 수준에 따른 필터링

        NONE: None 반환 (동기화 불가)
        BASIC: 집계 점수만
        STANDARD: 소프트웨어 상세 포함
        FULL: 전체 데이터
        """
        if self._consent_level == ConsentLevel.NONE:
            self._log_audit("sync_blocked", "metrics", "동의 미획득 — 동기화 차단")
            return None

        if self._consent_level == ConsentLevel.BASIC:
            # 집계 점수만 남기기
            return {
                "metricId": metrics_dict.get("metricId"),
                "userId": metrics_dict.get("userId"),
                "date": metrics_dict.get("date"),
                "periodType": metrics_dict.get("periodType"),
                "scores": metrics_dict.get("scores"),
                "details": {
                    "totalWorkMinutes": metrics_dict.get("details", {}).get("totalWorkMinutes"),
                    "activeWorkMinutes": metrics_dict.get("details", {}).get("activeWorkMinutes"),
                },
                "reward": metrics_dict.get("reward"),
                "dataIntegrityHash": metrics_dict.get("dataIntegrityHash"),
                "createdAt": metrics_dict.get("createdAt"),
            }

        if self._consent_level == ConsentLevel.STANDARD:
            # AI 상세 분석 텍스트 제거
            result = dict(metrics_dict)
            if "ai" in result:
                result["ai"] = {
                    "summary": "",
                    "bottlenecks": result["ai"].get("bottlenecks", []),
                    "suggestions": result["ai"].get("suggestions", []),
                }
            return result

        # FULL — 전체 데이터
        return metrics_dict

    def anonymize_user_id(self, user_id: str) -> str:
        """사용자 ID 익명화 (감사 로그 등에서 사용)"""
        return hashlib.sha256(user_id.encode()).hexdigest()[:12]

    def get_audit_log(self, last_n: int = 50) -> list[dict]:
        """감사 로그 조회"""
        entries = self._audit_log[-last_n:]
        return [
            {
                "timestamp": e.timestamp,
                "action": e.action,
                "dataType": e.data_type,
                "description": e.description,
                "consentLevel": e.user_consent_level,
            }
            for e in entries
        ]

    def clear_all_data(self) -> None:
        """모든 로컬 데이터 삭제 (GDPR 'Right to Erasure')"""
        self._audit_log.clear()
        self._log_audit(
            "data_erased",
            "all",
            "사용자 요청에 의한 전체 로컬 데이터 삭제",
        )
        logger.warning("all_local_data_erased")

    # ─── Private ────────────────────────────────

    def _log_audit(self, action: str, data_type: str, description: str):
        """감사 로그 기록"""
        entry = AuditEntry(
            timestamp=time.time(),
            action=action,
            data_type=data_type,
            description=description,
            user_consent_level=self._consent_level.value,
        )
        self._audit_log.append(entry)
        if len(self._audit_log) > self._max_audit_entries:
            self._audit_log = self._audit_log[-self._max_audit_entries:]
