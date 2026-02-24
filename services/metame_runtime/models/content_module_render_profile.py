from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field


class Surface(str, Enum):
    liquid_ui = "liquid_ui"
    embed = "embed"
    drawer = "drawer"
    overlay = "overlay"


class Density(str, Enum):
    micro = "micro"
    compact = "compact"
    standard = "standard"
    expanded = "expanded"
    full = "full"


class DeviceClass(str, Enum):
    mobile = "mobile"
    tablet = "tablet"
    desktop = "desktop"
    large_screen = "large_screen"


class Orientation(str, Enum):
    portrait = "portrait"
    landscape = "landscape"
    any = "any"


class InteractionType(str, Enum):
    touch = "touch"
    pointer = "pointer"
    mixed = "mixed"


class RealEstate(str, Enum):
    xs = "xs"
    s = "s"
    m = "m"
    l = "l"
    xl = "xl"


class Modality(str, Enum):
    text = "text"
    image = "image"
    video = "video"
    audio = "audio"
    interactive = "interactive"
    mixed = "mixed"
    data = "data"
    form = "form"


class InteractionStyle(str, Enum):
    glance = "glance"
    skim = "skim"
    read = "read"
    explore = "explore"
    act = "act"
    transact = "transact"


class ResponsiveRuleAction(str, Enum):
    truncate_text = "truncate_text"
    collapse_sections = "collapse_sections"
    hide_media = "hide_media"
    promote_to_drawer = "promote_to_drawer"
    promote_to_overlay = "promote_to_overlay"
    demote_to_embed = "demote_to_embed"
    demote_to_liquid_ui = "demote_to_liquid_ui"
    reduce_density = "reduce_density"
    increase_density = "increase_density"
    swap_to_carousel = "swap_to_carousel"


class ResponsiveRuleCondition(BaseModel):
    device: Optional[DeviceClass] = None
    orientation: Optional[Orientation] = None
    surface: Optional[Surface] = None
    density: Optional[Density] = None


class ResponsiveRuleActionParams(BaseModel):
    pass


class ResponsiveRule(BaseModel):
    when: Optional[ResponsiveRuleCondition] = None
    then: ResponsiveRuleAction


class DensityConstraintsDeviceOverride(BaseModel):
    device: DeviceClass
    orientation: Optional[Orientation] = None
    min: Density
    preferred: Density
    max: Density


class DensityConstraints(BaseModel):
    min: Density
    preferred: Density
    max: Density
    per_device_overrides: Optional[List[DensityConstraintsDeviceOverride]] = None


class AestheticConstraints(BaseModel):
    color_palette: Optional[List[str]] = None
    typography_scale: Optional[str] = None
    spacing_system: Optional[str] = None
    brand_alignment: Optional[Literal["strict", "flexible", "minimal"]] = None


class ExperienceAffinity(BaseModel):
    best_for: List[str]
    avoid_for: List[str]


class ContentModuleProfile(BaseModel):
    primary_modality: Modality
    interaction_style: InteractionStyle
    preferred_surfaces: List[Surface]
    allowed_surfaces: List[Surface]
    disallowed_surfaces: Optional[List[Surface]] = None
    density_constraints: DensityConstraints
    responsive_rules: Optional[List[ResponsiveRule]] = None
    aesthetic_constraints: Optional[AestheticConstraints] = None
    experience_affinity: Optional[ExperienceAffinity] = None


class ContentModuleRenderProfileV0(BaseModel):
    schema_version: Literal["0.1.0"]
    module_type: str
    display_name: str
    profile: ContentModuleProfile
