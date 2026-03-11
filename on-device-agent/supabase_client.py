"""
ProofWork - Supabase REST API 클라이언트

Supabase Auth + PostgREST를 사용하여 인증 및 데이터 CRUD를 수행합니다.
외부 SDK 없이 requests 만으로 동작합니다.
"""

import json
import os
import time
from pathlib import Path
from typing import Optional
import requests
import structlog

logger = structlog.get_logger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Supabase 엔드포인트
AUTH_BASE = f"{SUPABASE_URL}/auth/v1"
REST_BASE = f"{SUPABASE_URL}/rest/v1"

TOKEN_CACHE = Path.home() / ".proofwork" / "auth_token.json"


class SupabaseClient:
    """Supabase REST API 클라이언트"""

    def __init__(self):
        self._access_token: str = ""
        self._refresh_token: str = ""
        self._user_id: str = ""
        self._expires_at: float = 0
        self._load_cached_token()

    @property
    def user_id(self) -> str:
        return self._user_id

    @property
    def is_authenticated(self) -> bool:
        return bool(self._access_token) and time.time() < self._expires_at

    # ─── Auth ────────────────────────────────

    def set_external_token(self, uid: str, access_token: str) -> None:
        """
        프론트엔드에서 이미 로그인된 Supabase 토큰을 직접 주입.
        """
        self._access_token = access_token
        self._user_id = uid
        self._expires_at = time.time() + 3500  # ~58분
        self._save_token()
        logger.info("external_token_set", uid=uid)

    def sign_in(self, email: str, password: str) -> bool:
        """이메일/비밀번호 로그인"""
        try:
            resp = requests.post(
                f"{AUTH_BASE}/token?grant_type=password",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json",
                },
                json={"email": email, "password": password},
                timeout=10,
            )
            if resp.status_code != 200:
                err = resp.json().get("error_description", resp.json().get("msg", "Unknown error"))
                logger.error("sign_in_failed", error=err)
                return False

            data = resp.json()
            self._access_token = data["access_token"]
            self._refresh_token = data["refresh_token"]
            self._user_id = data["user"]["id"]
            self._expires_at = time.time() + data.get("expires_in", 3600)
            self._save_token()
            logger.info("signed_in", user_id=self._user_id)
            return True

        except Exception as e:
            logger.error("sign_in_error", error=str(e))
            return False

    def sign_up(self, email: str, password: str, display_name: str = "") -> bool:
        """회원가입"""
        try:
            body: dict = {"email": email, "password": password}
            if display_name:
                body["data"] = {"display_name": display_name}

            resp = requests.post(
                f"{AUTH_BASE}/signup",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=10,
            )
            if resp.status_code not in (200, 201):
                err = resp.json().get("error_description", resp.json().get("msg", "Unknown error"))
                logger.error("sign_up_failed", error=err)
                return False

            data = resp.json()
            # Supabase는 이메일 확인 설정에 따라 access_token이 바로 나올 수도 있음
            if "access_token" in data:
                self._access_token = data["access_token"]
                self._refresh_token = data.get("refresh_token", "")
                self._user_id = data["user"]["id"]
                self._expires_at = time.time() + data.get("expires_in", 3600)
                self._save_token()

            logger.info("signed_up", user_id=self._user_id)
            return True

        except Exception as e:
            logger.error("sign_up_error", error=str(e))
            return False

    def _refresh_access_token(self) -> bool:
        """토큰 갱신"""
        if not self._refresh_token:
            return False
        try:
            resp = requests.post(
                f"{AUTH_BASE}/token?grant_type=refresh_token",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json",
                },
                json={"refresh_token": self._refresh_token},
                timeout=10,
            )
            if resp.status_code != 200:
                return False
            data = resp.json()
            self._access_token = data["access_token"]
            self._refresh_token = data["refresh_token"]
            self._user_id = data["user"]["id"]
            self._expires_at = time.time() + data.get("expires_in", 3600)
            self._save_token()
            return True
        except Exception:
            return False

    def _ensure_token(self) -> bool:
        if self.is_authenticated:
            return True
        return self._refresh_access_token()

    # ─── PostgREST CRUD ──────────────────────

    def _headers(self) -> dict:
        return {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    def upsert(self, table: str, data: dict) -> bool:
        """테이블에 행 upsert (INSERT ... ON CONFLICT DO UPDATE)"""
        if not self._ensure_token():
            logger.error("not_authenticated")
            return False

        url = f"{REST_BASE}/{table}"
        headers = self._headers()
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"

        try:
            resp = requests.post(url, headers=headers, json=data, timeout=15)
            if resp.status_code in (200, 201, 204):
                logger.info("upsert_ok", table=table)
                return True
            else:
                logger.error("upsert_failed", table=table, status=resp.status_code, body=resp.text[:200])
                return False
        except Exception as e:
            logger.error("upsert_error", table=table, error=str(e))
            return False

    def select(self, table: str, filters: str = "") -> Optional[list]:
        """테이블에서 행 조회. filters 예: 'uid=eq.abc123'"""
        if not self._ensure_token():
            return None

        url = f"{REST_BASE}/{table}"
        if filters:
            url += f"?{filters}"

        headers = self._headers()
        headers["Prefer"] = "return=representation"

        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception:
            return None

    def submit_metrics(self, metrics: dict) -> bool:
        """성과 메트릭을 Supabase performance_metrics 테이블에 전송"""
        user_id = metrics.get("userId", self._user_id)
        date = metrics.get("date", "unknown")
        session_id = metrics.get("sessionId", "unknown")

        row = {
            "id": f"{date}_{session_id}",
            "user_id": user_id,
            "date": date,
            "session_id": session_id,
            "status": "pending_review",
            "total_work_minutes": metrics.get("totalWorkMinutes", 0),
            "active_work_minutes": metrics.get("activeWorkMinutes", 0),
            "focus_score": metrics.get("focusScore", 0),
            "efficiency_score": metrics.get("efficiencyScore", 0),
            "goal_alignment_score": metrics.get("goalAlignmentScore", 0),
            "output_score": metrics.get("outputScore", 0),
            "context_switch_count": metrics.get("contextSwitchCount", 0),
            "context_switch_rate": metrics.get("contextSwitchRate", 0),
            "input_density": metrics.get("inputDensity", 0),
            "deep_focus_minutes": metrics.get("deepFocusMinutes", 0),
            "software_usage": json.dumps(metrics.get("softwareUsage", [])),
            "timeline": json.dumps(metrics.get("timeline", [])),
            "ai_summary": metrics.get("aiSummary", ""),
            "key_achievements": json.dumps(metrics.get("keyAchievements", [])),
            "suggested_improvements": json.dumps(metrics.get("suggestedImprovements", [])),
            "task_type": metrics.get("taskType", "general"),
            "session_start_time": metrics.get("sessionStartTime", ""),
            "session_end_time": metrics.get("sessionEndTime", ""),
            "work_narrative": metrics.get("workNarrative", ""),
            "screen_contexts": json.dumps(metrics.get("screenContexts", [])),
            "screen_analysis_count": metrics.get("screenAnalysisCount", 0),
        }

        success = self.upsert("performance_metrics", row)

        if success:
            # profiles 테이블의 agentConnected / lastAgentSync 업데이트
            self.upsert("profiles", {
                "uid": user_id,
                "agentConnected": True,
                "lastAgentSync": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            })

        return success

    # ─── Token Cache ─────────────────────────

    def _save_token(self) -> None:
        TOKEN_CACHE.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_CACHE.write_text(json.dumps({
            "access_token": self._access_token,
            "refresh_token": self._refresh_token,
            "user_id": self._user_id,
            "expires_at": self._expires_at,
        }))

    def _load_cached_token(self) -> None:
        if not TOKEN_CACHE.exists():
            return
        try:
            data = json.loads(TOKEN_CACHE.read_text())
            self._access_token = data.get("access_token", "")
            self._refresh_token = data.get("refresh_token", "")
            self._user_id = data.get("user_id", "")
            self._expires_at = data.get("expires_at", 0)
            if self.is_authenticated:
                logger.info("cached_token_loaded", user_id=self._user_id)
            elif self._refresh_token:
                self._refresh_access_token()
        except (json.JSONDecodeError, KeyError):
            pass
