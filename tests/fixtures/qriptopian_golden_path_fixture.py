import json
from pathlib import Path

from services.metame_runtime.models.surface_plan import Intent, DeviceContext, VerificationRefs, Ref
from services.metame_runtime.models import ContentModuleRenderProfileV0
from services.metame_runtime.surface_selector import build_surface_plan_v0

ROOT = Path(".")
MATRIX_PATH = ROOT / "configs" / "qriptopian" / "surface_decision_matrix.v0.json"
PROFILES_PATH = ROOT / "configs" / "qriptopian" / "module_render_profiles.v0.json"


def load_json(p: Path):
    return json.loads(p.read_text())


def index_profiles(profiles):
    by_type = {}
    for p in profiles:
        obj = ContentModuleRenderProfileV0.model_validate(p)
        by_type[obj.module_type] = obj
    return by_type


def run_fixture():
    print("Running Qriptopian Golden Path Fixture (Python)...\n")
    
    matrix = load_json(MATRIX_PATH)
    profiles_raw = load_json(PROFILES_PATH)
    profile_by_type = index_profiles(profiles_raw)

    modules = [
        {"module_id": "mod_badge_01", "module_type": "KNYT.BadgePortal"},
        {"module_id": "mod_story_01", "module_type": "Qriptopian.StoryCard"},
        {"module_id": "mod_thread_01", "module_type": "KNYT.CanonThread"},
        {"module_id": "mod_quote_01", "module_type": "KNYT.QuotePanel"},
        {"module_id": "mod_share_01", "module_type": "metaMe.ShareGate"},
    ]

    scenarios = [
        {
            "name": "mobile_portrait_make",
            "device_context": DeviceContext(device_class="mobile", orientation="portrait", interaction="touch", real_estate="s"),
            "intent": Intent(user_ask="Build a KNYT capsule thread inside Qriptopian", mode="make", focus="KNYT within Qriptopian"),
        },
        {
            "name": "tablet_portrait_be",
            "device_context": DeviceContext(device_class="tablet", orientation="portrait", interaction="touch", real_estate="m"),
            "intent": Intent(user_ask="Show me today's KNYT highlights", mode="be", focus="KNYT within Qriptopian"),
        },
        {
            "name": "tablet_landscape_play",
            "device_context": DeviceContext(device_class="tablet", orientation="landscape", interaction="touch", real_estate="l"),
            "intent": Intent(user_ask="Run a canon check quiz", mode="play", focus="KNYT within Qriptopian"),
        },
        {
            "name": "desktop_share",
            "device_context": DeviceContext(device_class="desktop", orientation="any", interaction="pointer", real_estate="l"),
            "intent": Intent(user_ask="Share this capsule with my network", mode="share", focus="KNYT within Qriptopian"),
        },
    ]

    for s in scenarios:
        try:
            enriched_modules = []
            for m in modules:
                prof = profile_by_type[m["module_type"]]
                enriched_modules.append(
                    {
                        "module_id": m["module_id"],
                        "module_type": m["module_type"],
                        "render_profile": prof,
                        "source_refs": [],
                    }
                )

            plan = build_surface_plan_v0(
                plan_id=f"plan_{s['name']}",
                session_id="sess_123456",
                cartridge="Qriptopian",
                codex_id="codex_qriptopian_issue_01",
                capsule_id="capsule_knyt_001",
                thread_id="thread_knyt_bridge_001",
                intent=s["intent"],
                device_context=s["device_context"],
                modules=enriched_modules,
                verification=VerificationRefs(
                    dis_ref=Ref(kind="doc_ref", id="dis:qriptopian:v0"),
                    constraint_manifest_ref=Ref(kind="doc_ref", id="constraints:qriptopian:v0"),
                    parity_report_ref=Ref(kind="doc_ref", id="parity:pending"),
                ),
            )

            print("=== Scenario:", s["name"], "===")
            print("Device:", f"{s['device_context'].device_class}/{s['device_context'].orientation}/{s['device_context'].real_estate}")
            print("Intent Mode:", s["intent"].mode)
            print("Placements:")
            
            for p in plan.placements:
                print(f"  {p.module_id}: {p.surface} ({p.density}) - order {p.order}")
            
            print(f"Total placements: {len(plan.placements)}")
            print("Status: ✅ SUCCESS\n")
            
        except Exception as error:
            print("=== Scenario:", s["name"], "===")
            print("Status: ❌ FAILED")
            print("Error:", str(error))
            print("")


if __name__ == "__main__":
    run_fixture()
