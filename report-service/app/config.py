from __future__ import annotations
import os
from typing import Optional

# Bases por microservicio 
TEAMS_API_BASE   = os.getenv("TEAMS_API_BASE",   "http://teams-service:8082")
PLAYERS_API_BASE = os.getenv("PLAYERS_API_BASE", "http://players-service:3000")
MATCHES_API_BASE = os.getenv("MATCHES_API_BASE", "http://matches-service:8081")

# Tokens por servicio (opcionales). Puedes usar "Bearer x.y.z" o solo el token.
TEAMS_API_TOKEN   = (os.getenv("TEAMS_API_TOKEN",   "") or "").strip()
PLAYERS_API_TOKEN = (os.getenv("PLAYERS_API_TOKEN", "") or "").strip()
MATCHES_API_TOKEN = (os.getenv("MATCHES_API_TOKEN", "") or "").strip()


UPSTREAM_TOKEN = (os.getenv("UPSTREAM_TOKEN", "") or "").strip()

def _bearer_header(value: Optional[str]) -> dict[str, str]:
    if not value:
        return {}
    tok = value.strip()
    if not tok.lower().startswith("bearer "):
        tok = f"Bearer {tok}"
    return {"Authorization": tok}

def choose_header(per_service_header: Optional[str],
                  generic_header: Optional[str],
                  env_token: str) -> dict[str, str]:
    """
    Prioridad:
      1) per_service_header (X-<Service>-Authorization)
      2) generic_header     (X-Api-Authorization)
      3) env_token          (*_API_TOKEN)
      4) UPSTREAM_TOKEN     (compatibilidad)
    """
    if per_service_header:
        return _bearer_header(per_service_header)
    if generic_header:
        return _bearer_header(generic_header)
    if env_token:
        return _bearer_header(env_token)
    if UPSTREAM_TOKEN:
        return _bearer_header(UPSTREAM_TOKEN)
    return {}
