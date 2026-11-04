import secrets
from typing import Annotated

from fastapi import Header, HTTPException

from app.config import settings


def is_token_valid(candidate: str | None) -> bool:
    """Sem token configurado o acesso é aberto; com token, exige igualdade exata."""
    if not settings.api_token:
        return True
    if not candidate:
        return False
    return secrets.compare_digest(candidate.encode(), settings.api_token.encode())


def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    scheme, _, credentials = (authorization or "").partition(" ")
    candidate = credentials.strip() if scheme.lower() == "bearer" else None
    if not is_token_valid(candidate):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "unauthorized",
                "message": "Token de acesso ausente ou inválido.",
            },
        )
