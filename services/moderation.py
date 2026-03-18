from fastapi import HTTPException
from better_profanity import profanity


def check_public_content(text: str | None) -> None:
    """Raise HTTP 400 if text contains profanity. Safe to call with None or empty string."""
    if not text:
        return
    if profanity.contains_profanity(text):
        raise HTTPException(
            status_code=400,
            detail="Il testo contiene linguaggio non consentito.",
        )
