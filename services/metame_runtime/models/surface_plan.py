from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from enum import Enum
from pydantic import BaseModel, Field

from .content_module_render_profile import Surface, Density, DeviceClass, Orientation, InteractionType, RealEstate


class RefKind(str, Enum):
    schema_ref = "schema_ref"
    doc_ref = "doc_ref"
    uri_ref = "uri_ref"


class Ref(BaseModel):
    kind: RefKind
    id: str


class DeviceContext(BaseModel):
    device_class: DeviceClass
    orientation: Orientation
    interaction: InteractionType
    real_estate: RealEstate


class Intent(BaseModel):
    user_ask: str
    mode: Literal["be", "make", "play", "earn", "share"]
    focus: Optional[str] = None


class ModuleRef(BaseModel):
    module_id: str
    module_type: str
    render_profile_ref: Ref
    source_refs: Optional[List[Ref]] = None


class PlacementOverrides(BaseModel):
    max_lines: Optional[int] = None
    collapse_sections: Optional[bool] = None
    hide_media: Optional[bool] = None


class PlacementInteraction(BaseModel):
    opens: Surface
    open_density: Density


class Placement(BaseModel):
    module_id: str
    surface: Surface
    density: Density
    region: Literal["primary", "secondary", "footer", "header", "sidebar", "canvas"]
    order: int
    interaction: Optional[PlacementInteraction] = None
    overrides: Optional[PlacementOverrides] = None
    reasoning_tags: Optional[List[str]] = None


class Navigation(BaseModel):
    entry_surface: Surface
    progression: List[Surface]


class VerificationRefs(BaseModel):
    dis_ref: Ref
    constraint_manifest_ref: Ref
    parity_report_ref: Ref


class AuditRefs(BaseModel):
    trace_id: str
    span_id: str
    actor: str
    event_hashes: List[str]


class SurfacePlanV0(BaseModel):
    schema_version: Literal["0.1.0"]
    plan_id: str
    session_id: str
    cartridge: str
    codex_id: Optional[str] = None
    capsule_id: Optional[str] = None
    thread_id: Optional[str] = None
    intent: Intent
    device_context: DeviceContext
    modules: List[ModuleRef]
    placements: List[Placement]
    navigation: Navigation
    verification: VerificationRefs
    audit: Optional[AuditRefs] = None
