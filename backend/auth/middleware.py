import os
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "dev-secret-change-in-production")
SUPABASE_JWT_AUDIENCE = "authenticated"

_bearer = HTTPBearer(auto_error=False)


async def verify_jwt(token: str) -> uuid.UUID:
    """Verify a Supabase JWT and return the user's UUID."""
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
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
