from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple, Literal, Any

from .models import (
    ContentModuleRenderProfileV0,
    SurfacePlanV0,
)
from .models.surface_plan import (
    Intent,
    DeviceContext,
    ModuleRef,
    Placement,
    PlacementInteraction,
    PlacementOverrides,
    VerificationRefs,
    AuditRefs,
    Ref,
)

Surface = Literal["liquid_ui", "embed", "drawer", "overlay"]
Density = Literal["micro", "compact", "standard", "expanded", "full"]

LADDER: List[Surface] = ["liquid_ui", "embed", "drawer", "overlay"]
DENSITY_ORDER: List[Density] = ["micro", "compact", "standard", "expanded", "full"]


def _clamp_density(d: Density, dmin: Density, dmax: Density) -> Density:
    di = DENSITY_ORDER.index(d)
    mini = DENSITY_ORDER.index(dmin)
    maxi = DENSITY_ORDER.index(dmax)
    return DENSITY_ORDER[max(min(di, maxi), mini)]


def _pick_density(profile: ContentModuleRenderProfileV0, device: DeviceContext) -> Tuple[Density, Density, Density]:
    dc = profile.profile.density_constraints
    dmin, pref, dmax = dc.min, dc.preferred, dc.max

    overrides = dc.per_device_overrides or []
    match = None
    for o in overrides:
        if o.device != device.device_class:
            continue
        if o.orientation is None or o.orientation == device.orientation or o.orientation == "any":
            match = o
            break

    if match:
        dmin, pref, dmax = match.min, match.preferred, match.max

    # tiny real estate nudges
    if device.real_estate == "xs":
        dmax = _clamp_density(dmax, "micro", "standard")
        pref = _clamp_density(pref, dmin, dmax)

    return dmin, pref, dmax


def _choose_surface(profile: ContentModuleRenderProfileV0, device: DeviceContext, intent: Intent) -> Surface:
    preferred = profile.profile.preferred_surfaces
    allowed: Set[Surface] = set(profile.profile.allowed_surfaces)
    disallowed: Set[Surface] = set(profile.profile.disallowed_surfaces or [])

    candidates = [s for s in preferred if s in allowed and s not in disallowed]

    bias_up = intent.mode in ("make", "play")
    bias_share = intent.mode == "share"

    if device.device_class in ("mobile", "tablet"):
        device_bias: List[Surface] = ["embed", "drawer", "overlay", "liquid_ui"]
    else:
        device_bias = ["embed", "drawer", "liquid_ui", "overlay"]

    base: Optional[Surface] = candidates[0] if candidates else None
    if base is None:
        for s in device_bias:
            if s in allowed and s not in disallowed:
                base = s
                break
    if base is None:
        base = "embed"

    def can_use(s: Surface) -> bool:
        return s in allowed and s not in disallowed

    if bias_share and can_use("drawer"):
        base = "drawer"

    if bias_up:
        idx = min(LADDER.index(base) + 1, len(LADDER) - 1)
        nxt = LADDER[idx]
        if can_use(nxt):
            base = nxt

    if device.device_class == "mobile" and base == "overlay" and "overlay" not in preferred:
        if can_use("drawer"):
            base = "drawer"

    return base


def _region_for(surface: Surface) -> Literal["primary", "secondary", "footer", "header", "sidebar", "canvas"]:
    if surface == "overlay":
        return "canvas"
    if surface == "drawer":
        return "secondary"
    if surface == "embed":
        return "primary"
    return "header"


def _ladder_opens(surface: Surface, allowed: Set[Surface]) -> Optional[Surface]:
    idx = LADDER.index(surface)
    nxt = LADDER[min(idx + 1, len(LADDER) - 1)]
    if nxt != surface and nxt in allowed:
        return nxt
    return None


def _apply_responsive_rules(
    profile: ContentModuleRenderProfileV0,
    device: DeviceContext,
    surface: Surface,
    density: Density,
) -> Tuple[Surface, Density, Optional[PlacementOverrides]]:
    s, d = surface, density
    overrides: Optional[PlacementOverrides] = None

    for rule in profile.profile.responsive_rules or []:
        w = rule.when
        match = True
        if w is not None:
            if w.device is not None and w.device != device.device_class:
                match = False
            if w.orientation is not None and not (w.orientation == device.orientation or w.orientation == "any"):
                match = False
            if w.surface is not None and w.surface != s:
                match = False
            if w.density is not None and w.density != d:
                match = False

        if not match:
            continue

        action = rule.then.action
        params: Dict[str, Any] = rule.then.params or {}

        if action == "truncate_text":
            max_lines = params.get("max_lines", 6)
            overrides = overrides or PlacementOverrides()
            overrides.max_lines = int(max_lines)
        elif action == "collapse_sections":
            overrides = overrides or PlacementOverrides()
            overrides.collapse_sections = True
        elif action == "hide_media":
            overrides = overrides or PlacementOverrides()
            overrides.hide_media = True
        elif action == "promote_to_drawer":
            s = "drawer"
        elif action == "promote_to_overlay":
            s = "overlay"
        elif action == "demote_to_embed":
            s = "embed"
        elif action == "demote_to_liquid_ui":
            s = "liquid_ui"
        elif action == "reduce_density":
            d = "compact"
        elif action == "increase_density":
            d = "expanded"
        elif action == "swap_to_carousel":
            # UI hint; represent as collapse_sections for now
            overrides = overrides or PlacementOverrides()
            overrides.collapse_sections = True

    return s, d, overrides


def build_surface_plan_v0(
    *,
    plan_id: str,
    session_id: str,
    cartridge: str,
    intent: Intent,
    device_context: DeviceContext,
    modules: List[Dict[str, Any]],
    verification: VerificationRefs,
    audit: Optional[AuditRefs] = None,
    codex_id: Optional[str] = None,
    capsule_id: Optional[str] = None,
    thread_id: Optional[str] = None,
) -> SurfacePlanV0:
    """
    modules: list of dicts:
      {
        "module_id": "...",
        "module_type": "...",
        "render_profile": ContentModuleRenderProfileV0,
        "source_refs": [Ref, ...] (optional)
      }
    """

    module_refs: List[ModuleRef] = []
    placements: List[Placement] = []
    order = 0

    for m in modules:
        profile: ContentModuleRenderProfileV0 = m["render_profile"]
        module_id: str = m["module_id"]
        module_type: str = m["module_type"]
        source_refs: Optional[List[Ref]] = m.get("source_refs")

        module_refs.append(
            ModuleRef(
                module_id=module_id,
                module_type=module_type,
                render_profile_ref=Ref(kind="schema_ref", id=f"render_profile:{module_type}"),
                source_refs=source_refs or [],
            )
        )

        surface0 = _choose_surface(profile, device_context, intent)
        dmin, pref, dmax = _pick_density(profile, device_context)
        density0 = _clamp_density(pref, dmin, dmax)

        allowed: Set[Surface] = set(profile.profile.allowed_surfaces)
        s, d, overrides = _apply_responsive_rules(profile, device_context, surface0, density0)

        # re-clamp after rule changes
        d = _clamp_density(d, dmin, dmax)

        opens = _ladder_opens(s, allowed)

        interaction = None
        if opens is not None:
            interaction = PlacementInteraction(
                opens=opens,
                open_density="full" if opens == "overlay" else d,
            )

        placements.append(
            Placement(
                module_id=module_id,
                surface=s,
                density=d,
                region=_region_for(s),
                order=order,
                interaction=interaction,
                overrides=overrides,
                reasoning_tags=[
                    f"preferred:{profile.profile.preferred_surfaces[0] if profile.profile.preferred_surfaces else 'n/a'}",
                    f"surface:{surface0}->{s}",
                    f"density:{pref}->{d}",
                    f"mode:{intent.mode}",
                    f"device:{device_context.device_class}/{device_context.orientation}/{device_context.real_estate}",
                ],
            )
        )
        order += 1

    return SurfacePlanV0(
        plan_id=plan_id,
        session_id=session_id,
        cartridge=cartridge,
        codex_id=codex_id,
        capsule_id=capsule_id,
        thread_id=thread_id,
        intent=intent,
        device_context=device_context,
        modules=module_refs,
        placements=placements,
        navigation={"entry_surface": "liquid_ui", "progression": LADDER},
        verification=verification,
        audit=audit,
    )
