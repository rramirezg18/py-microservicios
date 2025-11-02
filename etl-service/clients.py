from __future__ import annotations
import os
from typing import Any, Optional
import httpx

TEAMS_API_BASE   = os.getenv("TEAMS_API_BASE", "http://teams-service:8082").rstrip("/")
PLAYERS_API_BASE = os.getenv("PLAYERS_API_BASE", "http://players-service:3000").rstrip("/")
MATCHES_API_BASE = os.getenv("MATCHES_API_BASE", "http://matches-service:8081").rstrip("/")

TEAMS_API_TOKEN   = (os.getenv("TEAMS_API_TOKEN", "") or "").strip()
PLAYERS_API_TOKEN = (os.getenv("PLAYERS_API_TOKEN", "") or "").strip()
MATCHES_API_TOKEN = (os.getenv("MATCHES_API_TOKEN", "") or "").strip()

PAGE_SIZE = int(os.getenv("PAGE_SIZE", "200"))
MAX_AUTOPAGES = int(os.getenv("MAX_AUTOPAGES", "20"))

def _hdr(tok: str) -> dict[str, str]:
    if not tok:
        return {}
    return {"Authorization": tok if tok.lower().startswith("bearer ") else f"Bearer {tok}"}

def _as_list_items(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list): return data
    if isinstance(data, dict):
        for k in ("content","items","results"):
            v = data.get(k)
            if isinstance(v, list): return v
        v = data.get("data")
        if isinstance(v, list): return v
        if isinstance(v, dict):
            for k in ("content","items","results"):
                vv = v.get(k)
                if isinstance(vv, list): return vv
    return []

async def _get_all_pages(url: str, headers: dict, params_flat: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    acc: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=15) as cx:

        page = 0
        while True:
            params = {"page": page, "size": PAGE_SIZE}
            if params_flat: params.update(params_flat)
            r = await cx.get(url, headers=headers, params=params)
            if r.status_code == 404:

                rr = await cx.get(url, headers=headers, params=params_flat or {})
                rr.raise_for_status()
                return _as_list_items(rr.json())
            r.raise_for_status()
            data = r.json()
            chunk = _as_list_items(data)
            if not chunk:
                break
            acc.extend(chunk)
            if isinstance(data, dict):
                if data.get("last") is True: break
                number = data.get("number"); total_pages = data.get("totalPages")
                if isinstance(number, int) and isinstance(total_pages, int) and number >= (total_pages - 1):
                    break
            if len(chunk) < PAGE_SIZE: break
            page += 1
            if page >= MAX_AUTOPAGES: break
    return acc


async def fetch_teams() -> list[dict[str, Any]]:
    return await _get_all_pages(f"{TEAMS_API_BASE}/api/teams", _hdr(TEAMS_API_TOKEN))

async def fetch_players(team_id: Optional[str] = None) -> list[dict[str, Any]]:
    q = {"teamId": team_id} if team_id else None
    return await _get_all_pages(f"{PLAYERS_API_BASE}/api/players", _hdr(PLAYERS_API_TOKEN), q)

async def fetch_matches(from_: Optional[str] = None, to: Optional[str] = None) -> list[dict[str, Any]]:
    q: dict[str, Any] = {}
    if from_: q["from"] = from_
    if to:    q["to"]   = to
    return await _get_all_pages(f"{MATCHES_API_BASE}/api/matches", _hdr(MATCHES_API_TOKEN), q)
