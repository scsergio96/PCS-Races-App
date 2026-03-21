import os
import time
import uuid
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwk, jwt, JWTError

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_JWT_AUDIENCE = "authenticated"
_JWKS_TTL = 3600  # refresh JWKS cache every hour

_bearer = HTTPBearer(auto_error=False)

_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    if _jwks_cache is None or (time.time() - _jwks_fetched_at) > _JWKS_TTL:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=10
            )
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_fetched_at = time.time()
    return _jwks_cache


async def verify_jwt(token: str) -> uuid.UUID:
    """Verify a Supabase JWT (RS256 signing keys) and return the user's UUID."""
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        alg = header.get("alg", "RS256")

        jwks = await _get_jwks()
        key_data = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if key_data is None:
            # Unknown kid — force refresh and retry once
            global _jwks_cache
            _jwks_cache = None
            jwks = await _get_jwks()
            key_data = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if key_data is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown signing key")

        public_key = jwk.construct(key_data, algorithm=alg)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            audience=SUPABASE_JWT_AUDIENCE,
            options={"verify_exp": True},
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return uuid.UUID(user_id)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def require_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> uuid.UUID:
    """FastAPI dependency: require valid JWT. Returns user UUID."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
        )
    return await verify_jwt(credentials.credentials)


async def optional_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> uuid.UUID | None:
    """FastAPI dependency: optional JWT. Returns user UUID or None."""
    if not credentials:
        return None
    try:
        return await verify_jwt(credentials.credentials)
    except HTTPException:
        return None
