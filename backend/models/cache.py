import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class ScrapeCache(Base):
    __tablename__ = "scrape_cache"

    cache_key: Mapped[str] = mapped_column(String, primary_key=True)
    data_type: Mapped[str] = mapped_column(
        Enum(
            "race_list", "race_detail", "startlist", "stages", "stage_winners", "stage_detail",
            name="scrape_data_type",
        ),
        nullable=False,
    )
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    etag: Mapped[str | None] = mapped_column(String(256), nullable=True)
    is_immutable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
