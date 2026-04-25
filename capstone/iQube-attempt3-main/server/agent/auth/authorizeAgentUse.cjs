const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isEthAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeAddress(value) {
  return String(value || "").toLowerCase();
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function querySupabase(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "GET",
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase query failed (${response.status}): ${details}`);
  }
  return response.json();
}

async function fetchIqube(tokenId) {
  const rows = await querySupabase(
    `iqubes?token_id=eq.${tokenId}&select=token_id,owner_address,iqube_type,access_policy,visibility,allowed_addresses&limit=1`
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function hasAccessListGrant(tokenId, walletAddress) {
  const rows = await querySupabase(
    `iqube_access_list?token_id=eq.${tokenId}&address=eq.${walletAddress}&select=address&limit=1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function authorizeAgentUse(input) {
  const walletAddress = normalizeAddress(input.walletAddress);
  const agentTokenId = input.agentTokenId;

  if (!isEthAddress(walletAddress)) {
    return { allowed: false, status: 400, reason: "Invalid wallet address." };
  }

  if (agentTokenId === undefined || agentTokenId === null) {
    return { allowed: true, status: 200, reason: "No agent token bound to request." };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      allowed: true,
      status: 200,
      reason: "Supabase service role not configured; skipping token-based authz in local mode.",
    };
  }

  let iqube;
  try {
    iqube = await fetchIqube(agentTokenId);
  } catch (error) {
    return {
      allowed: false,
      status: 502,
      reason: error instanceof Error ? error.message : "Failed to query Supabase.",
    };
  }

  if (!iqube) {
    return { allowed: false, status: 404, reason: "Agent token not found." };
  }

  if (iqube.iqube_type !== "AgentQube" && iqube.iqube_type !== "ModelQube") {
    return {
      allowed: false,
      status: 400,
      reason: "Token is not an AgentQube or ModelQube.",
    };
  }

  if (normalizeAddress(iqube.owner_address) === walletAddress) {
    return { allowed: true, status: 200, reason: "Wallet owns this iQube.", iqube };
  }

  if (iqube.access_policy === "specific") {
    const allowedAddresses = Array.isArray(iqube.allowed_addresses)
      ? iqube.allowed_addresses.map(normalizeAddress)
      : [];

    if (allowedAddresses.includes(walletAddress)) {
      return { allowed: true, status: 200, reason: "Wallet is in allowed_addresses list.", iqube };
    }

    try {
      const accessGranted = await hasAccessListGrant(agentTokenId, walletAddress);
      if (accessGranted) {
        return {
          allowed: true,
          status: 200,
          reason: "Wallet is in iqube_access_list.",
          iqube,
        };
      }
    } catch (error) {
      return {
        allowed: false,
        status: 502,
        reason: error instanceof Error ? error.message : "Failed to query access list.",
      };
    }

    return { allowed: false, status: 403, reason: "Wallet does not have specific access." };
  }

  if (iqube.access_policy === "requirements") {
    return { allowed: true, status: 200, reason: "Token is publicly usable via requirements policy.", iqube };
  }

  return { allowed: false, status: 403, reason: "Token is private to owner." };
}

module.exports = {
  authorizeAgentUse,
};
