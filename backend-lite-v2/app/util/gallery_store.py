import os
import json
import uuid
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))

# Filenames
F_PROVIDERS = os.path.join(DATA_DIR, "providers.json")
F_APIS = os.path.join(DATA_DIR, "api_services.json")
F_DOCURLS = os.path.join(DATA_DIR, "doc_urls.json")
F_KB = os.path.join(DATA_DIR, "kb_collections.json")
F_RUNS = os.path.join(DATA_DIR, "extraction_runs.json")


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _load_file(path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f) or []
        except json.JSONDecodeError:
            return []


def _save_file(path: str, items: List[Dict[str, Any]]):
    _ensure_dir()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


# Providers

def list_providers() -> List[Dict[str, Any]]:
    return _load_file(F_PROVIDERS)


def save_providers(items: List[Dict[str, Any]]):
    _save_file(F_PROVIDERS, items)


def upsert_provider(p: Dict[str, Any]) -> Dict[str, Any]:
    items = list_providers()
    if not p.get("id"):
        p["id"] = str(uuid.uuid4())
    p["updated_at"] = _now_iso()
    if not p.get("created_at"):
        p["created_at"] = p["updated_at"]
    found = False
    for i, it in enumerate(items):
        if it.get("id") == p["id"]:
            items[i] = {**it, **p}
            found = True
            break
    if not found:
        items.append(p)
    save_providers(items)
    return p


def delete_provider(pid: str) -> bool:
    items = list_providers()
    new_items = [it for it in items if it.get("id") != pid]
    if len(new_items) == len(items):
        return False
    save_providers(new_items)
    # Optional: cascade delete APIs under provider
    apis = list_api_services()
    apis = [a for a in apis if a.get("provider_id") != pid]
    save_api_services(apis)
    return True


# ApiServices

def list_api_services() -> List[Dict[str, Any]]:
    return _load_file(F_APIS)


def save_api_services(items: List[Dict[str, Any]]):
    _save_file(F_APIS, items)


def upsert_api_service(a: Dict[str, Any]) -> Dict[str, Any]:
    items = list_api_services()
    if not a.get("id"):
        a["id"] = str(uuid.uuid4())
    a["updated_at"] = _now_iso()
    if not a.get("created_at"):
        a["created_at"] = a["updated_at"]
    found = False
    for i, it in enumerate(items):
        if it.get("id") == a["id"]:
            items[i] = {**it, **a}
            found = True
            break
    if not found:
        items.append(a)
    save_api_services(items)
    return a


def delete_api_service(aid: str) -> bool:
    items = list_api_services()
    new_items = [it for it in items if it.get("id") != aid]
    if len(new_items) == len(items):
        return False
    save_api_services(new_items)
    # Optional: cascade doc urls
    doc_urls = list_doc_urls()
    doc_urls = [d for d in doc_urls if d.get("api_service_id") != aid]
    save_doc_urls(doc_urls)
    return True


# DocUrl

def list_doc_urls() -> List[Dict[str, Any]]:
    return _load_file(F_DOCURLS)


def save_doc_urls(items: List[Dict[str, Any]]):
    _save_file(F_DOCURLS, items)


def bulk_upsert_doc_urls(api_service_id: str, urls: List[Tuple[str, Optional[str], Optional[str]]]):
    # urls: List[(url, lastmod_iso, section)]
    items = list_doc_urls()
    by_key = {(it.get("api_service_id"), it.get("url")): i for i, it in enumerate(items)}
    now = _now_iso()
    for url, lastmod, section in urls:
        key = (api_service_id, url)
        if key in by_key:
            i = by_key[key]
            items[i] = {**items[i], "lastmod": lastmod, "section": section, "updated_at": now}
        else:
            items.append({
                "id": str(uuid.uuid4()),
                "api_service_id": api_service_id,
                "url": url,
                "lastmod": lastmod,
                "section": section,
                "first_seen_at": now,
                "updated_at": now,
            })
    save_doc_urls(items)


# KbCollection

def list_kb_collections() -> List[Dict[str, Any]]:
    return _load_file(F_KB)


def save_kb_collections(items: List[Dict[str, Any]]):
    _save_file(F_KB, items)


def create_kb_collection(api_service_id: str, title: str, total_items: int) -> Dict[str, Any]:
    items = list_kb_collections()
    now = _now_iso()
    obj = {
        "id": str(uuid.uuid4()),
        "api_service_id": api_service_id,
        "title": title,
        "total_items": int(total_items),
        "created_at": now,
        "updated_at": now,
    }
    items.append(obj)
    save_kb_collections(items)
    return obj


def provider_stats(pid: str) -> Dict[str, Any]:
    apis = [a for a in list_api_services() if a.get("provider_id") == pid]
    kbs = list_kb_collections()
    added = any(k.get("api_service_id") in {a.get("id") for a in apis} for k in kbs)
    return {
        "api_count": len(apis),
        "added": bool(added),
    }


# Extraction Run

def list_runs() -> List[Dict[str, Any]]:
    return _load_file(F_RUNS)


def save_runs(items: List[Dict[str, Any]]):
    _save_file(F_RUNS, items)


def add_run(base_url: str, mode: str, status: str, total_urls: int, message: Optional[str], api_service_id: Optional[str] = None) -> Dict[str, Any]:
    items = list_runs()
    now = _now_iso()
    obj = {
        "id": str(uuid.uuid4()),
        "api_service_id": api_service_id,
        "base_url": base_url,
        "mode": mode,
        "status": status,
        "total_urls": int(total_urls),
        "message": message,
        "started_at": now,
        "finished_at": now,
    }
    items.append(obj)
    save_runs(items)
    return obj


def mark_api_indexed(api_service_id: str, url_count: int):
    apis = list_api_services()
    for i, a in enumerate(apis):
        if a.get("id") == api_service_id:
            apis[i] = {**a, "url_count": int(url_count), "last_indexed_at": _now_iso()}
            break
    save_api_services(apis)


def get_provider_by_name(name: str) -> Optional[Dict[str, Any]]:
    name_l = name.strip().lower()
    for p in list_providers():
        if str(p.get("name", "")).strip().lower() == name_l:
            return p
    return None


def get_api_by_name(provider_id: str, name: str) -> Optional[Dict[str, Any]]:
    name_l = name.strip().lower()
    for a in list_api_services():
        if a.get("provider_id") == provider_id and str(a.get("name", "")).strip().lower() == name_l:
            return a
    return None
