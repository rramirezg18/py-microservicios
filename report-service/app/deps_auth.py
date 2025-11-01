# app/deps_auth.py
from __future__ import annotations

import os
from typing import Any, Iterable, Set
from jose import jwt, JWTError
from fastapi import Header, HTTPException

HS_SECRET = os.getenv("AUTH_HS256_SECRET")
PUB_KEY   = os.getenv("AUTH_PUBLIC_KEY_PEM")
AUD       = os.getenv("JWT_AUDIENCE", "py-microservices")
ISS       = os.getenv("JWT_ISSUER", "auth-service")

def _decode(token: str) -> dict[str, Any]:
    if PUB_KEY:
        return jwt.decode(token, PUB_KEY, algorithms=["RS256"], audience=AUD, issuer=ISS)
    if HS_SECRET:
        return jwt.decode(token, HS_SECRET, algorithms=["HS256"], audience=AUD, issuer=ISS)
    raise HTTPException(status_code=500, detail="No JWT key configured (AUTH_PUBLIC_KEY_PEM or AUTH_HS256_SECRET)")

def _roles_from_claims(claims: dict[str, Any]) -> Set[str]:
    bag: Set[str] = set()
    r1 = claims.get("role")
    if isinstance(r1, str): bag.add(r1)
    r2 = claims.get("roles")
    if isinstance(r2, str):
        bag.update([s.strip() for s in r2.split(",") if s.strip()])
    elif isinstance(r2, Iterable):
        bag.update([str(x) for x in r2])
    return set(x.lower() for x in bag)

async def require_admin(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization")
    token = authorization.split(" ", 1)[1]
    try:
        claims = _decode(token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    roles = _roles_from_claims(claims)
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin required")
