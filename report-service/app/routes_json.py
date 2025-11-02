
from __future__ import annotations

import httpx
from fastapi import APIRouter, Header, HTTPException, Depends

from . import clients
from .aggregators import aggregate_stats_from_matches
from .deps_auth import require_admin


async def _admin_dep(
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    # valida JWT del auth-service y rol Admin
    await require_admin(authorization)


router = APIRouter(
    tags=["reports-json"],
    dependencies=[Depends(_admin_dep)],
)

def _upstream_502(e: httpx.HTTPStatusError) -> HTTPException:
    req = e.request
    resp = e.response
    return HTTPException(
        status_code=502,
        detail={
            "upstream_url": str(req.url),
            "status_code": resp.status_code,
            "body": (resp.text or "")[:200],
        },
    )

@router.get("/standings")
async def standings_json(
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_matches_authorization: str | None = Header(default=None, alias="X-Matches-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    """
    Devuelve posiciones agregadas:
    {
      "total": N,
      "data": [{ teamId, team, played, wins, losses, pf, pa, diff }, ...]
    }
    """
    try:
        matches = await clients.fetch_matches(None, None, x_api_authorization, x_matches_authorization)
        tmap = await clients.fetch_teams_map(x_api_authorization, x_teams_authorization)
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)

    agg = aggregate_stats_from_matches(matches, tmap)

    ordered = sorted(agg.values(), key=lambda s: (-int(s["wins"]), s["team"]))
    data = [
        {
            "teamId": int(s["teamId"]),
            "team": s["team"],
            "played": int(s["played"]),
            "wins": int(s["wins"]),
            "losses": int(s["losses"]),
            "pf": int(s["pf"]),
            "pa": int(s["pa"]),
            "diff": int(s["pf"]) - int(s["pa"]),
        }
        for s in ordered
    ]

    return {"total": len(data), "data": data}

@router.get("/stats/summary")
async def stats_summary_json(
    x_api_authorization: str | None = Header(default=None, alias="X-Api-Authorization"),
    x_matches_authorization: str | None = Header(default=None, alias="X-Matches-Authorization"),
    x_teams_authorization: str | None = Header(default=None, alias="X-Teams-Authorization"),
):
    """
    Devuelve rankings útiles para la tarjeta 'Resumen Estadístico'.
    {
      "topWins": [...],
      "topPF": [...],
      "minPF": [...],
      "minLosses": [...]
    }
    """
    try:
        matches = await clients.fetch_matches(None, None, x_api_authorization, x_matches_authorization)
        tmap = await clients.fetch_teams_map(x_api_authorization, x_teams_authorization)
    except httpx.HTTPStatusError as e:
        raise _upstream_502(e)

    agg = aggregate_stats_from_matches(matches, tmap)
    values = list(agg.values())

    def row(s: dict) -> dict:
        return {
            "teamId": int(s["teamId"]),
            "team": s["team"],
            "played": int(s["played"]),
            "wins": int(s["wins"]),
            "losses": int(s["losses"]),
            "pf": int(s["pf"]),
            "pa": int(s["pa"]),
            "diff": int(s["pf"]) - int(s["pa"]),
        }

    top_wins     = [row(s) for s in sorted(values, key=lambda s: (-int(s["wins"]), s["team"]))[:10]]
    top_pf       = [row(s) for s in sorted(values, key=lambda s: (-int(s["pf"]), s["team"]))[:10]]
    min_pf       = [row(s) for s in sorted(values, key=lambda s: ( int(s["pf"]), s["team"]))[:10]]
    min_losses   = [row(s) for s in sorted(values, key=lambda s: ( int(s["losses"]), -int(s["wins"]), s["team"]))[:10]]

    return {
        "topWins": top_wins,
        "topPF": top_pf,
        "minPF": min_pf,
        "minLosses": min_losses,
    }
