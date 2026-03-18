import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class DiaryEntry(Base):
    __tablename__ = "diary_entry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profile.id", ondelete="CASCADE"), nullable=False
    )
    race_url: Mapped[str] = mapped_column(Text, nullable=False)
    race_name: Mapped[str] = mapped_column(String(512), nullable=False)
    race_year: Mapped[int] = mapped_column(Integer, nullable=False)
    race_base_slug: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    key_moment: Mapped[str | None] = mapped_column(Text, nullable=True)
    protagonist: Mapped[str | None] = mapped_column(String(256), nullable=True)
    dominant_emotion: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_token: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, unique=True
    )
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Mention(Base):
    __tablename__ = "mention"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    diary_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diary_entry.id", ondelete="CASCADE"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(
        Enum("rider", "location", "team", name="entity_type_enum"), nullable=False
    )
    entity_name: Mapped[str] = mapped_column(String(512), nullable=False)
    entity_slug: Mapped[str] = mapped_column(Text, nullable=False)
    entity_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    mention_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(nullable=False, default=0.0)
    detection_method: Mapped[str] = mapped_column(
        Enum("fuzzy", "spacy", "llm", "manual", name="detection_method_enum"), nullable=False
    )
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
