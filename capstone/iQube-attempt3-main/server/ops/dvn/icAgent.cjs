const { idlFactory } = require("./idl/cross_chain_service.cjs");

function resolveCanisterId() {
  return process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID || "";
}

async function createDvnActor() {
  const canisterId = resolveCanisterId();
  if (!canisterId) {
    return { actor: null, error: "CROSS_CHAIN_SERVICE_CANISTER_ID not configured" };
  }

  let HttpAgent;
  let Actor;
  try {
    ({ HttpAgent, Actor } = require("@dfinity/agent"));
  } catch {
    return { actor: null, error: "@dfinity/agent not installed in this runtime" };
  }

  const host =
    process.env.ICP_HOST ||
    process.env.NEXT_PUBLIC_ICP_HOST ||
    (process.env.DFX_NETWORK === "local" ? "http://127.0.0.1:4943" : "https://icp0.io");

  try {
    const agent = new HttpAgent({ host });
    if (process.env.DFX_NETWORK === "local" && typeof agent.fetchRootKey === "function") {
      try {
        await agent.fetchRootKey();
      } catch {
        // Local ICP may not be reachable; route layer will handle fallback.
      }
    }

    const actor = Actor.createActor(idlFactory, {
      canisterId,
      agent,
    });

    return { actor, error: null };
  } catch (error) {
    return {
      actor: null,
      error: error && typeof error === "object" && "message" in error ? String(error.message) : String(error),
    };
  }
}

module.exports = {
  createDvnActor,
  resolveCanisterId,
};
