from __future__ import annotations
import os
from pymongo import MongoClient, ASCENDING

MONGO_URL  = os.getenv("MONGO_URL", "mongodb://mongo:27017")
REPORTS_DB = os.getenv("REPORTS_DB", "reports")
READ_FROM_CACHE = os.getenv("READ_FROM_CACHE", "false").lower() == "true"

_client = None
_db = None

def _get_db():
    global _client, _db
    if _db is None:
        _client = MongoClient(MONGO_URL)
        _db = _client[REPORTS_DB]
        _db.teams.create_index([("id", ASCENDING)], unique=True)
        _db.players.create_index([("id", ASCENDING)], unique=True)
        _db.players.create_index([("teamId", ASCENDING)])
        _db.team_stats.create_index([("teamId", ASCENDING)], unique=True)
    return _db

def get_teams():
    return list(_get_db().teams.find({}, {"_id": 0}))

def get_players_all():
    return list(_get_db().players.find({}, {"_id": 0}))

def get_players_by_team(team_id: str):
    return list(_get_db().players.find({"teamId": str(team_id)}, {"_id": 0}))

def get_matches_all():
    return list(_get_db().matches.find({}, {"_id": 0}))

def get_standings_rows():
    stats = list(_get_db().team_stats.find({}, {"_id": 0}))
    stats.sort(key=lambda s: (-int(s.get("wins", 0)), s.get("teamName","")))
    return [{"id": s["teamId"], "name": s.get("teamName",""), "wins": int(s.get("wins", 0))} for s in stats]
