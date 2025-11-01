from __future__ import annotations
from typing import Any, Iterable

def normalize_team(t: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(t.get("id") or t.get("Id") or ""),
        "name": t.get("name") or t.get("Name") or "",
        "city": t.get("city") or t.get("City") or "",
        "coach": t.get("coach") or t.get("Coach") or "",
    }

def normalize_player(p: dict[str, Any], team_name_by_id: dict[str, str]) -> dict[str, Any]:
    tid = str(p.get("team_id") or p.get("teamId") or p.get("TeamId") or "")
    return {
        "id": str(p.get("id") or p.get("Id") or ""),
        "name": p.get("name") or p.get("Name") or "",
        "age":  int(p.get("age") or p.get("Age") or 0),
        "position": p.get("position") or p.get("Position") or "",
        "teamId": tid,
        "teamName": team_name_by_id.get(tid, tid),
    }

def normalize_match(m: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(m.get("Id") or m.get("id") or ""),
        "date": m.get("DateMatch") or m.get("dateMatch") or m.get("date") or "",
        "status": m.get("Status") or m.get("status") or "",
        "homeTeamId": str(m.get("HomeTeamId") or m.get("homeTeamId") or ""),
        "awayTeamId": str(m.get("AwayTeamId") or m.get("awayTeamId") or ""),
        "homeScore": int(m.get("HomeScore") or m.get("homeScore") or 0),
        "awayScore": int(m.get("AwayScore") or m.get("awayScore") or 0),
        "period": m.get("Period") or m.get("period") or "",
        "quarterDurationSeconds": int(m.get("QuarterDurationSeconds") or 0),
    }

def compute_team_stats(matches: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    stats: dict[str, dict[str, Any]] = {}
    def ensure(tid: str, name: str = ""):
        if tid not in stats:
            stats[tid] = {"teamId": tid, "teamName": name, "played": 0, "wins": 0, "losses": 0, "pf": 0, "pa": 0}
        return stats[tid]
    for m in matches:
        home = str(m["homeTeamId"]); away = str(m["awayTeamId"])
        hs = int(m["homeScore"]); as_ = int(m["awayScore"])
        if not home or not away: continue
        h = ensure(home); a = ensure(away)
        h["played"] += 1; a["played"] += 1
        h["pf"] += hs; h["pa"] += as_; a["pf"] += as_; a["pa"] += hs
        if hs > as_: h["wins"] += 1; a["losses"] += 1
        elif as_ > hs: a["wins"] += 1; h["losses"] += 1
    return stats
