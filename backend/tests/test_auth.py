import pytest
import uuid
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from auth.middleware import verify_jwt, require_auth, optional_auth


FAKE_USER_ID = uuid.uuid4()


def _mock_decode_valid(token, key, algorithms, audience, options=None):
    return {"sub": str(FAKE_USER_ID)}


def _mock_decode_invalid(token, key, algorithms, audience, options=None):
    from jose import JWTError
    raise JWTError("Invalid token")


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode_valid)
async def test_verify_jwt_valid_token(mock_decode):
    user_id = await verify_jwt("valid.token.here")
    assert user_id == FAKE_USER_ID


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode_invalid)
async def test_verify_jwt_invalid_token(mock_decode):
    with pytest.raises(HTTPException) as exc_info:
        await verify_jwt("bad.token")
    assert exc_info.value.status_code == 401


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode_valid)
async def test_require_auth_with_valid_token(mock_decode):
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid.token.here")
    user_id = await require_auth(creds)
    assert user_id == FAKE_USER_ID


async def test_require_auth_with_no_token():
    with pytest.raises(HTTPException) as exc_info:
        await require_auth(None)
    assert exc_info.value.status_code == 401


@patch("auth.middleware.jwt.decode", side_effect=_mock_decode_valid)
async def test_optional_auth_with_valid_token(mock_decode):
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid.token.here")
    user_id = await optional_auth(creds)
    assert user_id == FAKE_USER_ID


async def test_optional_auth_with_no_token():
    result = await optional_auth(None)
    assert result is None
