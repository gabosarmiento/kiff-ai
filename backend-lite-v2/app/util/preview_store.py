from __future__ import annotations
import os
import time
from typing import Optional, Dict, Any

try:
    import boto3  # type: ignore
    from botocore.exceptions import BotoCoreError, ClientError  # type: ignore
except Exception:  # pragma: no cover
    boto3 = None  # allows importing without boto3 for local type checks
    BotoCoreError = ClientError = Exception

DEFAULT_TABLE = os.getenv("DYNAMO_TABLE_PREVIEW_SESSIONS") or os.getenv("PREVIEW_TABLE") or "preview_sessions"
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-west-3"


class PreviewStore:
    """DynamoDB-backed stateless store for preview sessions.

    Partition key: tenant_id (S)
    Sort key: session_id (S)
    Attributes: sandbox_id, preview_url, status, last_seen (N), logs_head (S?), meta (M)
    """

    def __init__(self, table_name: str = DEFAULT_TABLE, *, region_name: Optional[str] = AWS_REGION, endpoint_url: Optional[str] = None):
        self._table_name = table_name
        self._mem: Optional[Dict[str, Dict[str, Any]]] = None
        self._table = None
        # Try to initialize DynamoDB; fallback to in-memory if unavailable
        if boto3 is None:
            self._mem = {}
            return
        try:
            dynamodb = boto3.resource("dynamodb", region_name=region_name, endpoint_url=endpoint_url)
            self._table = dynamodb.Table(self._table_name)
            # Touch table to verify access
            _ = self._table.table_status  # may raise if unreachable
        except Exception:
            # Fallback to in-memory for local/dev
            self._mem = {}

    @staticmethod
    def _now() -> int:
        return int(time.time())

    def get_session(self, tenant_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        if self._mem is not None:
            return (self._mem.get(tenant_id, {}) or {}).get(session_id)
        try:
            resp = self._table.get_item(Key={"tenant_id": tenant_id, "session_id": session_id})
            return resp.get("Item")
        except Exception:
            # Fallback to in-memory on any AWS error
            self._mem = self._mem or {}
            return (self._mem.get(tenant_id, {}) or {}).get(session_id)

    def put_session(self, tenant_id: str, session_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        now = self._now()
        item = {
            "tenant_id": tenant_id,
            "session_id": session_id,
            "last_seen": now,
            **data,
        }
        if self._mem is not None:
            by_tenant = self._mem.setdefault(tenant_id, {})
            by_tenant[session_id] = item
            return item
        try:
            self._table.put_item(Item=item)
            return item
        except Exception:
            # Fallback to in-memory on any AWS error
            self._mem = self._mem or {}
            by_tenant = self._mem.setdefault(tenant_id, {})
            by_tenant[session_id] = item
            return item

    def ensure_session(self, tenant_id: str, session_id: str, defaults: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        existing = self.get_session(tenant_id, session_id)
        if existing:
            # bump last_seen
            self.update_session_fields(tenant_id, session_id, {"last_seen": self._now()})
            return {**existing, "last_seen": self._now()}
        return self.put_session(tenant_id, session_id, defaults or {})

    def update_session_fields(self, tenant_id: str, session_id: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        # Build UpdateExpression dynamically
        names = {}
        values = {}
        sets = []
        for i, (k, v) in enumerate(fields.items()):
            names[f"#n{i}"] = k
            values[f":v{i}"] = v
            sets.append(f"#n{i} = :v{i}")
        # Always update last_seen
        # Avoid duplicating last_seen if caller already passed it
        if "last_seen" not in fields:
            i = len(sets)
            names[f"#n{i}"] = "last_seen"
            values[f":v{i}"] = self._now()
            sets.append(f"#n{i} = :v{i}")
        expr = "SET " + ", ".join(sets)
        if self._mem is not None:
            current = self.get_session(tenant_id, session_id) or {}
            # In-memory: ensure last_seen is refreshed once
            merged = {**current, **{k: v for k, v in fields.items()}}
            merged["last_seen"] = self._now()
            self.put_session(tenant_id, session_id, merged)
        else:
            try:
                self._table.update_item(
                    Key={"tenant_id": tenant_id, "session_id": session_id},
                    UpdateExpression=expr,
                    ExpressionAttributeNames=names,
                    ExpressionAttributeValues=values,
                )
            except Exception:
                # Fallback to in-memory on any AWS error
                self._mem = self._mem or {}
                current = (self._mem.get(tenant_id, {}) or {}).get(session_id) or {}
                merged = {**current, **{k: v for k, v in fields.items()}}
                merged["last_seen"] = self._now()
                by_tenant = self._mem.setdefault(tenant_id, {})
                by_tenant[session_id] = merged
        # Return merged view
        current = self.get_session(tenant_id, session_id) or {}
        return current

    def append_logs(self, tenant_id: str, session_id: str, new_logs: str) -> None:
        # For simplicity, store a rolling head as a string; in production use S3 for large logs
        existing = self.get_session(tenant_id, session_id) or {}
        head = (existing.get("logs_head") or "") + (new_logs or "")
        self.update_session_fields(tenant_id, session_id, {"logs_head": head[-10000:]})
