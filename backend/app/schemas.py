# app/schemas.py
from pydantic import BaseModel, Field

class VoteInput(BaseModel):
    # For SINGLE polls: send one optionId in rankedChoices (length 1)
    # For RANKED polls: send ordered optionIds (rank 1..N)
    rankedChoices: list[str] = Field(min_length=1)
    idempotencyKey: str | None = Field(default=None, max_length=128)
    turnstileToken: str | None = Field(default=None, description="Cloudflare Turnstile verification token")
