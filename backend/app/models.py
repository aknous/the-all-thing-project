# app/models.py
from __future__ import annotations

from datetime import date
from typing import Optional, Literal, List

from sqlalchemy import (
    String,
    Integer,
    Boolean,
    Date,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

PollType = Literal["SINGLE", "RANKED"]
Audience = Literal["PUBLIC", "USER_ONLY"]

# -----------------------------
# Categories
# -----------------------------

class PollCategory(Base):
    __tablename__ = "pollCategories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    sortOrder: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    templates: Mapped[List["PollTemplate"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
    )


# -----------------------------
# Templates (recurring definitions)
# -----------------------------

class PollTemplate(Base):
    __tablename__ = "pollTemplates"
    __table_args__ = (
        UniqueConstraint("categoryId", "key", name="uq_pollTemplates_category_key"),
        Index("ix_pollTemplates_category_active", "categoryId", "isActive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    categoryId: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pollCategories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    key: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    question: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    pollType: Mapped[str] = mapped_column(String(16), nullable=False)   # "SINGLE" | "RANKED"
    maxRank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    audience: Mapped[str] = mapped_column(String(16), nullable=False, default="PUBLIC")

    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    category: Mapped["PollCategory"] = relationship(back_populates="templates")

    defaultOptions: Mapped[List["PollTemplateOption"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="PollTemplateOption.sortOrder",
    )

    plans: Mapped[List["PollPlan"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
    )

    instances: Mapped[List["PollInstance"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
    )


class PollTemplateOption(Base):
    __tablename__ = "pollTemplateOptions"
    __table_args__ = (
        UniqueConstraint("templateId", "sortOrder", name="uq_templateOptions_template_sort"),
        Index("ix_templateOptions_template", "templateId"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    templateId: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pollTemplates.id", ondelete="CASCADE"),
        nullable=False,
    )

    label: Mapped[str] = mapped_column(String(256), nullable=False)
    sortOrder: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    template: Mapped["PollTemplate"] = relationship(back_populates="defaultOptions")


# -----------------------------
# Plans (per-date overrides)
# -----------------------------

class PollPlan(Base):
    __tablename__ = "pollPlans"
    __table_args__ = (
        UniqueConstraint("templateId", "pollDate", name="uq_pollPlans_template_date"),
        Index("ix_pollPlans_date", "pollDate"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    templateId: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pollTemplates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    pollDate: Mapped[date] = mapped_column(Date, nullable=False)
    isEnabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    questionOverride: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    template: Mapped["PollTemplate"] = relationship(back_populates="plans")

    options: Mapped[List["PollPlanOption"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PollPlanOption.sortOrder",
    )


class PollPlanOption(Base):
    __tablename__ = "pollPlanOptions"
    __table_args__ = (
        UniqueConstraint("planId", "sortOrder", name="uq_planOptions_plan_sort"),
        Index("ix_planOptions_plan", "planId"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    planId: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pollPlans.id", ondelete="CASCADE"),
        nullable=False,
    )

    label: Mapped[str] = mapped_column(String(256), nullable=False)
    sortOrder: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    plan: Mapped["PollPlan"] = relationship(back_populates="options")


# -----------------------------
# Instances (daily snapshots)
# -----------------------------

class PollInstance(Base):
    __tablename__ = "pollInstances"
    __table_args__ = (
        UniqueConstraint("templateId", "pollDate", name="uq_pollInstances_template_date"),
        Index("ix_pollInstances_date", "pollDate"),
        Index("ix_pollInstances_category_date", "categoryId", "pollDate"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    templateId: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pollTemplates.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    categoryId: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pollCategories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    pollDate: Mapped[date] = mapped_column(Date, nullable=False)

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    question: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    pollType: Mapped[str] = mapped_column(String(16), nullable=False)
    maxRank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    audience: Mapped[str] = mapped_column(String(16), nullable=False, default="PUBLIC")

    status: Mapped[str] = mapped_column(String(16), nullable=False, default="OPEN")  # OPEN|CLOSED

    template: Mapped["PollTemplate"] = relationship(back_populates="instances")
    options: Mapped[List["PollInstanceOption"]] = relationship(
        back_populates="instance",
        cascade="all, delete-orphan",
        order_by="PollInstanceOption.sortOrder",
    )


class PollInstanceOption(Base):
    __tablename__ = "pollInstanceOptions"
    __table_args__ = (
        UniqueConstraint("instanceId", "sortOrder", name="uq_instanceOptions_instance_sort"),
        Index("ix_instanceOptions_instance", "instanceId"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    instanceId: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pollInstances.id", ondelete="CASCADE"),
        nullable=False,
    )

    label: Mapped[str] = mapped_column(String(256), nullable=False)
    sortOrder: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    instance: Mapped["PollInstance"] = relationship(back_populates="options")
