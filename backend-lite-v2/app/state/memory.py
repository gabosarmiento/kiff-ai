from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional
import time
import threading


@dataclass
class FileInfo:
    path: str
    content: str
    language: str


@dataclass
class JobResult:
    id: str
    tenant_id: str
    status: str  # "completed" | "running" | "pending" | "error"
    created_at: float
    files: List[FileInfo]
    error: Optional[str] = None


class _MemoryStore:
    def __init__(self) -> None:
        self._jobs: Dict[str, JobResult] = {}
        self._lock = threading.Lock()

    def save_job(self, job: JobResult) -> None:
        with self._lock:
            self._jobs[job.id] = job

    def get_job(self, job_id: str) -> Optional[JobResult]:
        with self._lock:
            return self._jobs.get(job_id)

    def clear_tenant(self, tenant_id: str) -> int:
        with self._lock:
            to_del = [k for k, v in self._jobs.items() if v.tenant_id == tenant_id]
            for k in to_del:
                del self._jobs[k]
            return len(to_del)


STORE = _MemoryStore()


def now_ts() -> float:
    return time.time()
