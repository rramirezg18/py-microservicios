from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from datetime import datetime, timezone
import httpx

from .config import (
    TEAMS_API_BASE, PLAYERS_API_BASE, MATCHES_API_BASE,
    TEAMS_API_TOKEN, PLAYERS_API_TOKEN, MATCHES_API_TOKEN,
    choose_header,
)

def _as_list_items(data: Any) -> list[dict[str, Any]]:
    """
    Normaliza formatos:
      - {content:[...], ...} (Spring)
      - {items:[...]} / {results:[...]}
      - {data:[...]} o {data:{content:[...]}}
      - lista directa
    """
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ("items", "content", "results"):
            v = data.get(k)
            if isinstance(v, list):
                return v
        v = data.get("data")
        if isinstance(v, list):
            return v
        if isinstance(v, dict):
            for k in ("items", "content", "results"):
                vv = v.get(k)
                if isinstance(vv, list):
                    return vv
        return []
    return []

def _parse_iso(d: str | None) -> datetime | None:
    """
    Devuelve SIEMPRE un datetime naive en UTC (sin tzinfo),
    para evitar TypeError al comparar aware vs naive.
    """
    if not d:
        return None
    s = str(d).strip()

    candidates = [s, s.replace("Z", "+00:00")]
    if "T" in s:
        candidates.append(s.split(".", 1)[0])

    for cand in candidates:
        try:
            dt = datetime.fromisoformat(cand)
            # Si trae tz, pasamos a UTC y quitamos tzinfo para dejarlo naive
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            continue
    return None


# -------------------------
# Teams-service
# -------------------------
async def fetch_teams(
    x_api_auth: str | None = None, x_teams_auth: str | None = None
) -> list[dict[str, Any]]:
    """
    Paginación Spring (0-based): page/size
    Itera hasta last=true o number>=totalPages-1
    """
    url = f"{TEAMS_API_BASE}/api/teams"
    headers = choose_header(x_teams_auth, x_api_auth, TEAMS_API_TOKEN)
    page, size = 0, 100
    acc: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=30) as cx:
        while True:
            params = {"page": page, "size": size}
            r = await cx.get(url, headers=headers, params=params)
            if r.status_code >= 400:
                break
            data = r.json()
            items = _as_list_items(data)
            if not items:
                break
            acc.extend(items)

            if isinstance(data, dict):
                if data.get("last") is True:
                    break
                number = data.get("number")
                total_pages = data.get("totalPages")
                if isinstance(number, int) and isinstance(total_pages, int):
                    if number >= (total_pages - 1):
                        break
            page += 1

    if acc:
        return acc

    # Fallback sin paginación
    async with httpx.AsyncClient(timeout=30) as cx:
        r = await cx.get(url, headers=headers)
        r.raise_for_status()
        return _as_list_items(r.json())

async def fetch_team_by_id(
    team_id: str, x_api_auth: str | None = None, x_teams_auth: str | None = None
) -> dict[str, Any] | None:
    url = f"{TEAMS_API_BASE}/api/teams/{team_id}"
    headers = choose_header(x_teams_auth, x_api_auth, TEAMS_API_TOKEN)
    async with httpx.AsyncClient(timeout=30) as cx:
        r = await cx.get(url, headers=headers)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()

async def fetch_teams_map(
    x_api_auth: str | None = None, x_teams_auth: str | None = None
) -> dict[str, str]:
    teams = await fetch_teams(x_api_auth, x_teams_auth)
    mapping: dict[str, str] = {}
    for t in teams:
        tid = str(t.get("id") or t.get("Id") or "")
        name = t.get("name") or t.get("Name") or t.get("teamName") or t.get("TeamName") or tid
        if tid:
            mapping[tid] = str(name)
    return mapping

# -------------------------
# Players-service
# -------------------------
async def fetch_players(
    team_id: Optional[str] = None,
    x_api_auth: Optional[str] = None,
    x_players_auth: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    GET /api/players?teamId=...  (Node/Express)
    Respuesta esperada: { items: [...], totalCount: N }  (sin last/number/totalPages)
    Cortes de paginación:
      - Si hay totalCount: (page+1)*size >= totalCount
      - Si len(items) < size
      - Límite duro de páginas para evitar loops si el backend ignora 'page'
    """
    url = f"{PLAYERS_API_BASE}/api/players"
    headers = choose_header(x_players_auth, x_api_auth, PLAYERS_API_TOKEN)

    page, size = 0, 100
    MAX_PAGES = 1000
    acc: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=30) as cx:
        while True:
            if page >= MAX_PAGES:
                # Safety break: evita loop infinito si el backend ignora 'page'
                break

            params: dict[str, Any] = {"page": page, "size": size}
            if team_id:
                params["teamId"] = team_id

            r = await cx.get(url, headers=headers, params=params)
            if r.status_code >= 400:
                break

            data = r.json()
            items = _as_list_items(data)

            # Si no hay items -> se acabó
            if not items:
                break

            acc.extend(items)

            # 1) Si viene totalCount, usamos corte matemático
            total_count = None
            if isinstance(data, dict):
                try:
                    tc = data.get("totalCount")
                    if tc is not None:
                        total_count = int(tc)
                except Exception:
                    total_count = None

            if total_count is not None:
                # Si ya cubrimos todo el total -> break
                if (page + 1) * size >= total_count:
                    break
                page += 1
                continue

            # 2) Si NO hay totalCount, usamos el patrón clásico:
            #    si el backend devolvió menos que 'size', asumimos última página.
            if len(items) < size:
                break

            # 3) Si devolvió exactamente 'size' y no tenemos más señales,
            #    avanzamos. Si el backend ignora 'page', se detendrá por MAX_PAGES.
            page += 1

    if acc:
        return acc

    # Fallback sin paginación (por si el backend no soporta page/size realmente)
    async with httpx.AsyncClient(timeout=30) as cx:
        params = {"teamId": team_id} if team_id else {}
        r = await cx.get(url, headers=headers, params=params)
        r.raise_for_status()
        return _as_list_items(r.json())

async def fetch_matches(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    x_api_auth: Optional[str] = None,
    x_matches_auth: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    GET /api/matches
    - Si hay from/to: llamada directa SIN page/size (tu API paginada con page/size te da 500).
    - Si no hay from/to: intentar autopaginación; si falla, fallback simple.
    """
    url = f"{MATCHES_API_BASE}/api/matches"
    headers = choose_header(x_matches_auth, x_api_auth, MATCHES_API_TOKEN)

    async with httpx.AsyncClient(timeout=30) as cx:
        # ---- Caso con rango: NO usar paginación ----
        if from_date or to_date:
            params: dict[str, Any] = {}
            if from_date: params["from"] = from_date
            if to_date:   params["to"]   = to_date

            r = await cx.get(url, headers=headers, params=params)
            r.raise_for_status()
            items = _as_list_items(r.json())

            # Filtro defensivo local por si el backend no filtra correctamente
            f_dt = _parse_iso(from_date); t_dt = _parse_iso(to_date)
            if f_dt or t_dt:
                filtered: list[dict[str, Any]] = []
                for m in items:
                    d = _parse_iso(str(m.get("DateMatch") or m.get("dateMatch") or m.get("date")))
                    if f_dt and (not d or d < f_dt): continue
                    if t_dt and (not d or d > t_dt): continue
                    filtered.append(m)
                return filtered
            return items

        # ---- Sin rango: intentar autopaginación ----
        page, size = 0, 100
        acc: list[dict[str, Any]] = []

        while True:
            params = {"page": page, "size": size}
            r = await cx.get(url, headers=headers, params=params)
            if r.status_code >= 400:
                break
            data = r.json()
            items = _as_list_items(data)
            if not items:
                break
            acc.extend(items)

            if isinstance(data, dict):
                if data.get("last") is True:
                    break
                number = data.get("number")
                total_pages = data.get("totalPages")
                if isinstance(number, int) and isinstance(total_pages, int) and number >= (total_pages - 1):
                    break
            page += 1

        if acc:
            return acc

        # Fallback sin paginación
        r = await cx.get(url, headers=headers)
        r.raise_for_status()
        return _as_list_items(r.json())




async def fetch_match_by_id(
    match_id: str, x_api_auth: Optional[str] = None, x_matches_auth: Optional[str] = None
) -> dict[str, Any] | None:
    url = f"{MATCHES_API_BASE}/api/matches/{match_id}"
    headers = choose_header(x_matches_auth, x_api_auth, MATCHES_API_TOKEN)
    async with httpx.AsyncClient(timeout=30) as cx:
        r = await cx.get(url, headers=headers)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
