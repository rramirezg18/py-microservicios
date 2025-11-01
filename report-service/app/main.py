# app/main.py
from __future__ import annotations

import io
import os
from typing import Any, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Query
from fastapi.responses import JSONResponse, StreamingResponse

from . import clients, pdf_utils
from .aggregators import teams_map, match_roster, aggregate_stats_from_matches
from .deps_auth import require_admin  # <- nuevo
from app.routes_json import router as json_router
from typing import Optional
from fastapi import Header, HTTPException, Depends 


app = FastAPI()

INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "")  # para Nginx trusted hop

# ---------- Seguridad ----------
async def admin_dep(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_api_authorization: Optional[str] = Header(default=None, alias="X-Api-Authorization"),
    x_internal_secret: Optional[str] = Header(default=None, alias="X-Internal-Secret"),
):
    # Trusted hop desde Nginx (si usas INTERNAL_SECRET)
    if INTERNAL_SECRET and x_internal_secret == INTERNAL_SECRET:
        return
    # Fallback: usa Authorization o, si Nginx no lo reenvía, usa X-Api-Authorization
    token = authorization or x_api_authorization
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization")
    await require_admin(token)


# ---------- Health ----------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "report-service",
        "port": os.getenv("SERVICE_PORT", "8080"),
    }

# ---------- Helpers ----------
def _upstream_502(e: httpx.HTTPStatusError) -> HTTPException:
    req = e.request
    resp = e.response
    detail = {
        "upstream_url": str(req.url),
        "status_code": resp.status_code,
        "body": (resp.text or "")[:200],
    }
    return HTTPException(status_code=502, detail=detail)

# ---------- Reports ----------
@app.get("/reports/teams.pdf", dependencies=[Depends(admin_dep)])
async def report_teams(
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    try:
        teams = await clients.fetch_teams(x_api_authorization, x_teams_authorization)
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)
    pdf = pdf_utils.build_pdf_teams(teams)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="equipos.pdf"'},
    )

@app.get("/reports/teams/{team_id}/players.pdf", dependencies=[Depends(admin_dep)])
async def report_players_by_team(
    team_id: str,
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_players_authorization: str | None = Header(default=None, alias="X-Players-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    try:
        players = await clients.fetch_players(team_id, x_api_authorization, x_players_authorization)
        tmap = await clients.fetch_teams_map(x_api_authorization, x_teams_authorization)
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)
    team_name = tmap.get(str(team_id))
    pdf = pdf_utils.build_pdf_players_by_team(team_id, players, team_name)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="players_{team_id}.pdf"'},
    )

@app.get("/reports/players/all.pdf", dependencies=[Depends(admin_dep)])
async def report_all_players(
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_players_authorization: str | None = Header(default=None, alias="X-Players-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    try:
        players = await clients.fetch_players(None, x_api_authorization, x_players_authorization)
        tmap = await clients.fetch_teams_map(x_api_authorization, x_teams_authorization)
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)
    pdf = pdf_utils.build_pdf_all_players(players, tmap)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="players_all.pdf"'},
    )

@app.get("/reports/matches/history.pdf", dependencies=[Depends(admin_dep)])
async def report_history(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_matches_authorization: str | None = Header(default=None, alias="X-Matches-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    try:
        matches = await clients.fetch_matches(from_, to, x_api_authorization, x_matches_authorization)
        tmap = await clients.fetch_teams_map(x_api_authorization, x_teams_authorization)
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)
    pdf = pdf_utils.build_pdf_matches_history(matches, from_, to, tmap)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="history.pdf"'},
    )

@app.get("/reports/matches/{match_id}/roster.pdf", dependencies=[Depends(admin_dep)])
async def report_match_roster_pdf(
    match_id: str,
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_matches_authorization: str | None = Header(default=None, alias="X-Matches-Authorization"),
    x_players_authorization: str | None = Header(default=None, alias="X-Players-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    try:
        roster = await match_roster(
            match_id,
            x_api_authorization,
            x_matches_authorization,
            x_players_authorization,
            x_teams_authorization,
        )
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)
    pdf = pdf_utils.build_pdf_match_roster(match_id, roster)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="roster_{match_id}.pdf"'},
    )

@app.get("/reports/stats/summary.pdf", dependencies=[Depends(admin_dep)])
async def report_stats_summary(
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_matches_authorization: str | None = Header(default=None, alias="X-Matches-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    try:
        matches = await clients.fetch_matches(None, None, x_api_authorization, x_matches_authorization)
        tmap = await teams_map(x_api_authorization, x_teams_authorization)
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)

    agg = aggregate_stats_from_matches(matches, tmap)

    # Top por victorias
    wins_sorted = sorted(agg.values(), key=lambda s: (-int(s["wins"]), s["team"]))
    top_wins = [["#", "Equipo", "ID", "PJ", "PG", "PP", "PF", "PC"]]
    for idx, s in enumerate(wins_sorted[:10], 1):
        top_wins.append([idx, s["team"], s["teamId"], s["played"], s["wins"], s["losses"], s["pf"], s["pa"]])

    # Top por puntos a favor
    pf_sorted = sorted(agg.values(), key=lambda s: (-int(s["pf"]), s["team"]))
    top_pf = [["#", "Equipo", "ID", "PJ", "PG", "PP", "PF", "PC"]]
    for idx, s in enumerate(pf_sorted[:10], 1):
        top_pf.append([idx, s["team"], s["teamId"], s["played"], s["wins"], s["losses"], s["pf"], s["pa"]])

    # Menos puntos a favor
    min_pf_sorted = sorted(agg.values(), key=lambda s: (int(s["pf"]), s["team"]))
    min_pf = [["#", "Equipo", "ID", "PJ", "PG", "PP", "PF", "PC"]]
    for idx, s in enumerate(min_pf_sorted[:10], 1):
        min_pf.append([idx, s["team"], s["teamId"], s["played"], s["wins"], s["losses"], s["pf"], s["pa"]])

    # Menos derrotas
    min_losses_sorted = sorted(agg.values(), key=lambda s: (int(s["losses"]), -int(s["wins"]), s["team"]))
    min_losses = [["#", "Equipo", "ID", "PJ", "PG", "PP", "PF", "PC"]]
    for idx, s in enumerate(min_losses_sorted[:10], 1):
        min_losses.append([idx, s["team"], s["teamId"], s["played"], s["wins"], s["losses"], s["pf"], s["pa"]])

    sections = [
        ("Top por Victorias", top_wins),
        ("Top por Puntos a Favor", top_pf),
        ("Menos Puntos a Favor", min_pf),
        ("Menos Derrotas", min_losses),
    ]
    pdf = pdf_utils.build_pdf_stats_report(sections)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="stats_summary.pdf"'},
    )

@app.get("/reports/standings.pdf", dependencies=[Depends(admin_dep)])
async def report_standings(
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_matches_authorization: str | None = Header(default=None, alias="X-Matches-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    try:
        matches = await clients.fetch_matches(None, None, x_api_authorization, x_matches_authorization)
        tmap = await clients.fetch_teams_map(x_api_authorization, x_teams_authorization)
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)

    agg = aggregate_stats_from_matches(matches, tmap)
    ordered = sorted(agg.values(), key=lambda s: (-int(s["wins"]), s["team"]))
    rows = [{"name": s["team"], "wins": int(s["wins"])} for s in ordered]

    pdf = pdf_utils.build_pdf_standings(rows)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="standings.pdf"'},
    )

# Manejo genérico httpx
@app.exception_handler(httpx.RequestError)
async def httpx_request_error_handler(_req: Request, exc: httpx.RequestError):
    return JSONResponse(status_code=502, content={"detail": {"message": str(exc)}})

# ⬇️ IMPORTANTE: No antepongas /api aquí. Nginx ya mapea /api/reports -> /reports en la app.
from fastapi import Depends
app.include_router(json_router, prefix="/reports", dependencies=[Depends(admin_dep)])
