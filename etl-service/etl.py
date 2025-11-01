from __future__ import annotations
import os, asyncio
from typing import Any
from pymongo import MongoClient, UpdateOne, ASCENDING
from clients import fetch_teams, fetch_players, fetch_matches
from transforms import normalize_team, normalize_player, normalize_match, compute_team_stats

MONGO_URL  = os.getenv("MONGO_URL", "mongodb://localhost:27017")
REPORTS_DB = os.getenv("REPORTS_DB", "reports")
INTERVAL   = int(os.getenv("ETL_INTERVAL_SECONDS", "120"))
RUN_ONCE   = os.getenv("RUN_ONCE", "0") == "1"

def upsert_many(col, docs: list[dict], key: str):
    if not docs: return 0
    ops = [UpdateOne({key: d[key]}, {"$set": d}, upsert=True) for d in docs if d.get(key)]
    if not ops: return 0
    res = col.bulk_write(ops, ordered=False)
    return (res.upserted_count or 0) + (res.modified_count or 0)

def ensure_indexes(db):
    db.teams.create_index([("id", ASCENDING)], unique=True)
    db.players.create_index([("id", ASCENDING)], unique=True)
    db.players.create_index([("teamId", ASCENDING)])
    db.matches.create_index([("id", ASCENDING)], unique=True)
    db.team_stats.create_index([("teamId", ASCENDING)], unique=True)

async def run_once(db):
    print("[ETL] start run")
    teams_raw = await fetch_teams()
    teams = [normalize_team(t) for t in teams_raw if (t.get("id") or t.get("Id"))]
    team_name_by_id = {t["id"]: t["name"] for t in teams}
    n1 = upsert_many(db.teams, teams, "id")
    print(f"[ETL] teams upserted/updated: {n1}, total fetched: {len(teams)}")

    players_raw = await fetch_players()
    players = [normalize_player(p, team_name_by_id) for p in players_raw if (p.get("id") or p.get("Id"))]
    n2 = upsert_many(db.players, players, "id")
    print(f"[ETL] players upserted/updated: {n2}, total fetched: {len(players)}")

    matches_raw = await fetch_matches()
    matches = [normalize_match(m) for m in matches_raw if (m.get("Id") or m.get("id"))]
    n3 = upsert_many(db.matches, matches, "id")
    print(f"[ETL] matches upserted/updated: {n3}, total fetched: {len(matches)}")

    stats = compute_team_stats(matches)
    stats_docs = []
    for tid, s in stats.items():
        s["teamName"] = team_name_by_id.get(tid, s.get("teamName","") or tid)
        stats_docs.append(s)
    n4 = upsert_many(db.team_stats, stats_docs, "teamId")
    print(f"[ETL] team_stats upserted/updated: {n4}, total computed: {len(stats_docs)}")
    print("[ETL] end run")

async def main():
    client = MongoClient(MONGO_URL)
    db = client[REPORTS_DB]
    ensure_indexes(db)
    if RUN_ONCE:
        await run_once(db)
        return
    while True:
        try:
            await run_once(db)
        except Exception as e:
            print("[ETL] ERROR:", e)
        await asyncio.sleep(INTERVAL)

if __name__ == "__main__":
    asyncio.run(main())
