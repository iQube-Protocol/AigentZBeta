"""
metaMe Runtime Models

This package contains Pydantic models for metaMe Runtime Experience Aigent:
- ContentModuleRenderProfileV0: Module rendering constraints and preferences
- SurfacePlanV0: Runtime surface planning and placement output
"""

from .content_module_render_profile import (
    ContentModuleRenderProfileV0,
    Surface,
    Density,
    DeviceClass,
    Orientation,
    InteractionType,
    RealEstate,
    Modality,
    InteractionStyle,
    ResponsiveRule,
    DensityConstraints,
    AestheticConstraints,
    ExperienceAffinity,
)

from .surface_plan import (
    SurfacePlanV0,
    Ref,
    RefKind,
    DeviceContext,
    Intent,
    ModuleRef,
    Placement,
    PlacementOverrides,
    PlacementInteraction,
    Navigation,
    VerificationRefs,
    AuditRefs,
)

__all__ = [
    # Content module render profile
    "ContentModuleRenderProfileV0",
    "Surface",
    "Density", 
    "DeviceClass",
    "Orientation",
    "InteractionType",
    "RealEstate",
    "Modality",
    "InteractionStyle",
    "ResponsiveRule",
    "DensityConstraints",
    "AestheticConstraints",
    "ExperienceAffinity",
    # Surface plan
    "SurfacePlanV0",
    "Ref",
    "RefKind",
    "DeviceContext",
    "Intent",
    "ModuleRef",
    "Placement",
    "PlacementOverrides",
    "PlacementInteraction",
    "Navigation",
    "VerificationRefs",
    "AuditRefs",
]
