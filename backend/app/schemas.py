# app/schemas.py
from pydantic import BaseModel, Field

class VoteInput(BaseModel):
    # For SINGLE polls: send one optionId in rankedChoices (length 1)
    # For RANKED polls: send ordered optionIds (rank 1..N)
    rankedChoices: list[str] = Field(min_length=1)
    idempotencyKey: str | None = Field(default=None, max_length=128)
    turnstileToken: str | None = Field(default=None, description="Cloudflare Turnstile verification token")

# Import/Export Schemas
class ImportOptionInput(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=200)
    sortOrder: int = Field(ge=0)

class ImportTemplateInput(BaseModel):
    categoryKey: str = Field(min_length=1, max_length=64)
    key: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    question: str | None = Field(default=None, max_length=500)
    pollType: str = Field(pattern="^(SINGLE|RANKED)$")
    maxRank: int | None = None
    audience: str = Field(default="PUBLIC", pattern="^(PUBLIC|USER_ONLY)$")
    durationDays: int = Field(default=1, ge=1, le=30)
    isActive: bool = Field(default=True)
    featured: bool = Field(default=False)
    options: list[ImportOptionInput] = Field(min_length=2)

class ImportCategoryInput(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=100)
    emoji: str | None = Field(default=None, max_length=10)
    sortOrder: int = Field(ge=0)

class ImportDataInput(BaseModel):
    categories: list[ImportCategoryInput] = Field(default_factory=list)
    templates: list[ImportTemplateInput] = Field(default_factory=list)

class ImportResultItem(BaseModel):
    type: str  # "category" or "template"
    action: str  # "created" or "updated" or "skipped"
    key: str
    name: str
    error: str | None = None

class ImportResult(BaseModel):
    categoriesCreated: int
    templatesCreated: int
    errors: list[str]
    details: list[ImportResultItem]
