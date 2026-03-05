"""
ProofWork — Firebase REST API 클라이언트

firebase-admin 없이 REST API로 Firestore에 직접 데이터를 보냅니다.
사용자의 Firebase Auth ID Token을 사용하여 인증합니다.
"""

import json
import os
import time
from pathlib import Path
from typing import Optional
import requests
import structlog

logger = structlog.get_logger(__name__)

FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY", "AIzaSyDVeRqjAHMd5fZ4iQgjCMhJuOBMLFw1Ji0")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "performance-23a03")
FIRESTORE_BASE = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"
AUTH_BASE = "https://identitytoolkit.googleapis.com/v1"

TOKEN_CACHE = Path.home() / ".proofwork" / "auth_token.json"


class FirebaseClient:
    """Firebase REST API 클라이언트"""

    def __init__(self):
        self._id_token: str = ""
        self._refresh_token: str = ""
        self._user_id: str = ""
        self._expires_at: float = 0
        self._load_cached_token()

    @property
    def user_id(self) -> str:
        return self._user_id

    @property
    def is_authenticated(self) -> bool:
        return bool(self._id_token) and time.time() < self._expires_at

    # ─── Auth ────────────────────────────────

    def set_external_token(self, uid: str, id_token: str) -> None:
        """
        프론트엔드 Firebase Auth에서 이미 로그인된 ID 토큰을 직접 주입.
        email/password 없이도 Firestore 인증이 가능해집니다.
        """
        self._id_token = id_token
        self._user_id = uid
        self._expires_at = time.time() + 3500  # ~58분
        self._save_token()
        logger.info("external_token_set", uid=uid)

    def sign_in(self, email: str, password: str) -> bool:
        """이메일/비밀번호 로그인"""
        try:
            resp = requests.post(
                f"{AUTH_BASE}/accounts:signInWithPassword?key={FIREBASE_API_KEY}",
                json={"email": email, "password": password, "returnSecureToken": True},
                timeout=10,
            )
            if resp.status_code != 200:
                err = resp.json().get("error", {}).get("message", "Unknown error")
                logger.error("sign_in_failed", error=err)
                return False

            data = resp.json()
            self._id_token = data["idToken"]
            self._refresh_token = data["refreshToken"]
            self._user_id = data["localId"]
            self._expires_at = time.time() + int(data.get("expiresIn", 3600))
            self._save_token()
            logger.info("signed_in", user_id=self._user_id)
            return True

        except Exception as e:
            logger.error("sign_in_error", error=str(e))
            return False

    def sign_up(self, email: str, password: str, display_name: str = "") -> bool:
        """회원가입"""
        try:
            resp = requests.post(
                f"{AUTH_BASE}/accounts:signUp?key={FIREBASE_API_KEY}",
                json={"email": email, "password": password, "returnSecureToken": True},
                timeout=10,
            )
            if resp.status_code != 200:
                err = resp.json().get("error", {}).get("message", "Unknown error")
                logger.error("sign_up_failed", error=err)
                return False

            data = resp.json()
            self._id_token = data["idToken"]
            self._refresh_token = data["refreshToken"]
            self._user_id = data["localId"]
            self._expires_at = time.time() + int(data.get("expiresIn", 3600))

            # displayName 업데이트
            if display_name:
                requests.post(
                    f"{AUTH_BASE}/accounts:update?key={FIREBASE_API_KEY}",
                    json={"idToken": self._id_token, "displayName": display_name},
                    timeout=10,
                )

            self._save_token()
            logger.info("signed_up", user_id=self._user_id)
            return True

        except Exception as e:
            logger.error("sign_up_error", error=str(e))
            return False

    def _refresh_id_token(self) -> bool:
        """토큰 갱신"""
        if not self._refresh_token:
            return False
        try:
            resp = requests.post(
                f"https://securetoken.googleapis.com/v1/token?key={FIREBASE_API_KEY}",
                json={"grant_type": "refresh_token", "refresh_token": self._refresh_token},
                timeout=10,
            )
            if resp.status_code != 200:
                return False
            data = resp.json()
            self._id_token = data["id_token"]
            self._refresh_token = data["refresh_token"]
            self._user_id = data["user_id"]
            self._expires_at = time.time() + int(data.get("expires_in", 3600))
            self._save_token()
            return True
        except Exception:
            return False

    def _ensure_token(self) -> bool:
        if self.is_authenticated:
            return True
        return self._refresh_id_token()

    # ─── Firestore CRUD ─────────────────────

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._id_token}", "Content-Type": "application/json"}

    def create_document(self, collection: str, doc_id: str, data: dict) -> bool:
        """Firestore에 문서 생성/덮어쓰기"""
        if not self._ensure_token():
            logger.error("not_authenticated")
            return False

        url = f"{FIRESTORE_BASE}/{collection}/{doc_id}"
        firestore_data = self._to_firestore_value(data)

        try:
            resp = requests.patch(
                url,
                headers=self._headers(),
                json={"fields": firestore_data},
                timeout=15,
            )
            if resp.status_code in (200, 201):
                logger.info("document_created", collection=collection, doc_id=doc_id)
                return True
            else:
                logger.error("document_create_failed",
                             status=resp.status_code,
                             body=resp.text[:200])
                return False
        except Exception as e:
            logger.error("document_create_error", error=str(e))
            return False

    def get_document(self, collection: str, doc_id: str) -> Optional[dict]:
        """Firestore 문서 조회"""
        if not self._ensure_token():
            return None

        url = f"{FIRESTORE_BASE}/{collection}/{doc_id}"
        try:
            resp = requests.get(url, headers=self._headers(), timeout=10)
            if resp.status_code == 200:
                return self._from_firestore_doc(resp.json())
            return None
        except Exception:
            return None

    def submit_metrics(self, metrics: dict) -> bool:
        """성과 메트릭을 Firestore에 전송"""
        metric_id = metrics.get("metricId", "unknown")
        user_id = metrics.get("userId", self._user_id)
        date = metrics.get("date", "unknown")
        doc_id = f"{date}_{metric_id}"

        # performance_metrics 컬렉션에 저장
        success = self.create_document("performance_metrics", doc_id, metrics)

        if success:
            # data_reviews 컬렉션에 검토 대기 항목 생성
            review_doc = {
                "id": f"review-{doc_id}",
                "metricsId": doc_id,
                "userId": user_id,
                "date": date,
                "decision": "pending",
                "metrics": metrics,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
            }
            self.create_document("data_reviews", f"review-{doc_id}", review_doc)

            # 유저 문서의 lastAgentSync 업데이트
            self.create_document("users", user_id, {
                "uid": user_id,
                "agentConnected": True,
                "lastAgentSync": time.strftime("%Y-%m-%dT%H:%M:%S"),
            })

        return success

    # ─── Firestore 직렬화 ────────────────────

    @classmethod
    def _to_firestore_value(cls, data: dict) -> dict:
        """Python dict → Firestore REST API fields 형식"""
        fields = {}
        for k, v in data.items():
            fields[k] = cls._python_to_firestore(v)
        return fields

    @classmethod
    def _python_to_firestore(cls, value) -> dict:
        if value is None:
            return {"nullValue": None}
        elif isinstance(value, bool):
            return {"booleanValue": value}
        elif isinstance(value, int):
            return {"integerValue": str(value)}
        elif isinstance(value, float):
            return {"doubleValue": value}
        elif isinstance(value, str):
            return {"stringValue": value}
        elif isinstance(value, list):
            return {"arrayValue": {"values": [cls._python_to_firestore(v) for v in value]}}
        elif isinstance(value, dict):
            return {"mapValue": {"fields": {k: cls._python_to_firestore(v) for k, v in value.items()}}}
        else:
            return {"stringValue": str(value)}

    @classmethod
    def _from_firestore_doc(cls, doc: dict) -> dict:
        """Firestore 문서 → Python dict"""
        fields = doc.get("fields", {})
        result = {}
        for k, v in fields.items():
            result[k] = cls._firestore_to_python(v)
        return result

    @classmethod
    def _firestore_to_python(cls, value: dict):
        if "nullValue" in value:
            return None
        elif "booleanValue" in value:
            return value["booleanValue"]
        elif "integerValue" in value:
            return int(value["integerValue"])
        elif "doubleValue" in value:
            return value["doubleValue"]
        elif "stringValue" in value:
            return value["stringValue"]
        elif "arrayValue" in value:
            return [cls._firestore_to_python(v) for v in value["arrayValue"].get("values", [])]
        elif "mapValue" in value:
            return {k: cls._firestore_to_python(v) for k, v in value["mapValue"].get("fields", {}).items()}
        return None

    # ─── 토큰 캐싱 ──────────────────────────

    def _save_token(self):
        try:
            TOKEN_CACHE.parent.mkdir(parents=True, exist_ok=True)
            TOKEN_CACHE.write_text(json.dumps({
                "id_token": self._id_token,
                "refresh_token": self._refresh_token,
                "user_id": self._user_id,
                "expires_at": self._expires_at,
            }), encoding="utf-8")
        except Exception:
            pass

    def _load_cached_token(self):
        try:
            if TOKEN_CACHE.exists():
                data = json.loads(TOKEN_CACHE.read_text(encoding="utf-8"))
                self._id_token = data.get("id_token", "")
                self._refresh_token = data.get("refresh_token", "")
                self._user_id = data.get("user_id", "")
                self._expires_at = data.get("expires_at", 0)
        except Exception:
            pass
