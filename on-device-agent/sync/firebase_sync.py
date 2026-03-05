"""
Firebase 동기화 모듈 (Firebase Sync)

사용자가 승인한 메트릭 데이터만 Firestore에 전송합니다.

Privacy 원칙:
- 사용자 명시적 승인 없이 절대 서버 전송 안 함
- 전송 전 DataSanitizer를 통한 최종 필터링
- 전송 데이터 임시 큐잉 → 사용자 리뷰 → 승인 → 전송
- 실패 시 자동 재시도 (최대 3회)
"""

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)


class SyncStatus(Enum):
    PENDING = "pending"          # 사용자 승인 대기
    APPROVED = "approved"        # 승인됨
    SYNCING = "syncing"          # 동기화 중
    SYNCED = "synced"            # 동기화 완료
    FAILED = "failed"            # 실패
    REJECTED = "rejected"        # 사용자 거부


@dataclass
class SyncItem:
    """동기화 대기 항목"""
    item_id: str
    data: dict
    status: SyncStatus = SyncStatus.PENDING
    created_at: float = field(default_factory=time.time)
    synced_at: Optional[float] = None
    retry_count: int = 0
    max_retries: int = 3
    error_message: str = ""


class FirebaseSync:
    """
    Firebase Firestore 동기화 관리자

    사용자 승인 기반 데이터 동기화를 담당합니다.
    """

    def __init__(
        self,
        service_account_path: Optional[str] = None,
        project_id: str = "proofwork-performance",
    ):
        self._project_id = project_id
        self._service_account_path = service_account_path
        self._db = None
        self._initialized = False
        self._sync_queue: dict[str, SyncItem] = {}
        self._queue_file = Path.home() / ".proofwork" / "sync_queue.json"

        # 로컬 큐 복원
        self._restore_queue()

    def initialize(self) -> bool:
        """Firebase Admin SDK 초기화"""
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            if not firebase_admin._apps:
                if self._service_account_path and os.path.exists(self._service_account_path):
                    cred = credentials.Certificate(self._service_account_path)
                else:
                    # GCP 환경이면 기본 자격 증명 사용
                    cred = credentials.ApplicationDefault()

                firebase_admin.initialize_app(cred, {
                    "projectId": self._project_id,
                })

            self._db = firestore.client()
            self._initialized = True
            logger.info("firebase_initialized", project=self._project_id)
            return True

        except Exception as e:
            logger.error("firebase_init_failed", error=str(e))
            return False

    def enqueue(self, metric_id: str, data: dict) -> SyncItem:
        """
        메트릭 데이터를 동기화 큐에 추가 (사용자 승인 대기 상태)

        Args:
            metric_id: 메트릭 고유 ID
            data: sanitized 메트릭 딕셔너리

        Returns:
            SyncItem 인스턴스
        """
        item = SyncItem(item_id=metric_id, data=data)
        self._sync_queue[metric_id] = item
        self._persist_queue()

        logger.info("metric_enqueued", metric_id=metric_id)
        return item

    def get_pending_items(self) -> list[dict]:
        """사용자 리뷰 대기 중인 항목 목록"""
        return [
            {
                "itemId": item.item_id,
                "date": item.data.get("date", ""),
                "scores": item.data.get("scores", {}),
                "status": item.status.value,
                "createdAt": item.created_at,
            }
            for item in self._sync_queue.values()
            if item.status == SyncStatus.PENDING
        ]

    def approve_item(self, metric_id: str) -> bool:
        """사용자가 동기화를 승인"""
        if metric_id not in self._sync_queue:
            return False

        self._sync_queue[metric_id].status = SyncStatus.APPROVED
        self._persist_queue()
        logger.info("metric_approved", metric_id=metric_id)
        return True

    def reject_item(self, metric_id: str) -> bool:
        """사용자가 동기화를 거부"""
        if metric_id not in self._sync_queue:
            return False

        self._sync_queue[metric_id].status = SyncStatus.REJECTED
        self._persist_queue()
        logger.info("metric_rejected", metric_id=metric_id)
        return True

    def approve_all_pending(self) -> int:
        """모든 대기 중 항목 일괄 승인"""
        count = 0
        for item in self._sync_queue.values():
            if item.status == SyncStatus.PENDING:
                item.status = SyncStatus.APPROVED
                count += 1
        self._persist_queue()
        logger.info("all_pending_approved", count=count)
        return count

    async def sync_approved(self) -> dict:
        """
        승인된 항목 Firestore에 동기화

        Returns:
            {"synced": int, "failed": int, "errors": list[str]}
        """
        if not self._initialized:
            if not self.initialize():
                return {"synced": 0, "failed": 0, "errors": ["Firebase 초기화 실패"]}

        synced = 0
        failed = 0
        errors = []

        approved = [
            item for item in self._sync_queue.values()
            if item.status == SyncStatus.APPROVED
        ]

        for item in approved:
            try:
                item.status = SyncStatus.SYNCING
                await self._upload_to_firestore(item)
                item.status = SyncStatus.SYNCED
                item.synced_at = time.time()
                synced += 1

            except Exception as e:
                item.retry_count += 1
                item.error_message = str(e)

                if item.retry_count >= item.max_retries:
                    item.status = SyncStatus.FAILED
                    failed += 1
                    errors.append(f"{item.item_id}: {str(e)}")
                else:
                    item.status = SyncStatus.APPROVED  # 재시도 대기

                logger.error(
                    "sync_failed",
                    metric_id=item.item_id,
                    retry=item.retry_count,
                    error=str(e),
                )

        self._persist_queue()

        logger.info("sync_complete", synced=synced, failed=failed)
        return {"synced": synced, "failed": failed, "errors": errors}

    def sync_approved_blocking(self) -> dict:
        """동기화 (동기 버전)"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, self.sync_approved())
                    return future.result()
            return asyncio.run(self.sync_approved())
        except RuntimeError:
            return asyncio.run(self.sync_approved())

    def cleanup_synced(self, older_than_hours: int = 24) -> int:
        """동기화 완료/거부 항목 정리"""
        cutoff = time.time() - (older_than_hours * 3600)
        to_remove = [
            k for k, v in self._sync_queue.items()
            if v.status in (SyncStatus.SYNCED, SyncStatus.REJECTED)
            and v.created_at < cutoff
        ]
        for k in to_remove:
            del self._sync_queue[k]

        self._persist_queue()
        return len(to_remove)

    # ─── Private ────────────────────────────────

    async def _upload_to_firestore(self, item: SyncItem):
        """Firestore에 메트릭 업로드"""
        from firebase_admin import firestore as fs

        user_id = item.data.get("userId", "unknown")
        date = item.data.get("date", "unknown")

        doc_ref = (
            self._db
            .collection("users")
            .document(user_id)
            .collection("performance")
            .document(f"{date}_{item.item_id[:8]}")
        )

        # Firestore는 동기 API이므로 executor로 오프로드
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            doc_ref.set,
            {
                **item.data,
                "syncedAt": fs.SERVER_TIMESTAMP,
            },
        )

        logger.info(
            "metric_uploaded",
            metric_id=item.item_id,
            user_id=user_id,
            date=date,
        )

    def _persist_queue(self):
        """큐를 로컬에 영구 저장"""
        try:
            self._queue_file.parent.mkdir(parents=True, exist_ok=True)
            serializable = {}
            for k, v in self._sync_queue.items():
                serializable[k] = {
                    "item_id": v.item_id,
                    "data": v.data,
                    "status": v.status.value,
                    "created_at": v.created_at,
                    "synced_at": v.synced_at,
                    "retry_count": v.retry_count,
                    "error_message": v.error_message,
                }
            self._queue_file.write_text(
                json.dumps(serializable, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as e:
            logger.warning("queue_persist_failed", error=str(e))

    def _restore_queue(self):
        """로컬에서 큐 복원"""
        try:
            if not self._queue_file.exists():
                return

            raw = json.loads(self._queue_file.read_text(encoding="utf-8"))
            for k, v in raw.items():
                self._sync_queue[k] = SyncItem(
                    item_id=v["item_id"],
                    data=v["data"],
                    status=SyncStatus(v["status"]),
                    created_at=v["created_at"],
                    synced_at=v.get("synced_at"),
                    retry_count=v.get("retry_count", 0),
                    error_message=v.get("error_message", ""),
                )
            logger.info("queue_restored", count=len(self._sync_queue))
        except Exception as e:
            logger.warning("queue_restore_failed", error=str(e))
