import { createAutoDriveApi } from "@autonomys/auto-drive";
import { NetworkId } from "@autonomys/auto-utils";

const API_KEY = import.meta.env.VITE_AUTO_DRIVE_API_KEY as string | undefined;
const NETWORK = (import.meta.env.VITE_AUTO_DRIVE_NETWORK_ID as NetworkId | undefined) ?? NetworkId.MAINNET;

if (!API_KEY) {
  console.warn("[AutoDrive] VITE_AUTO_DRIVE_API_KEY is not set. Auto-Drive uploads will fail.");
}

const autoDriveApi = API_KEY
  ? createAutoDriveApi({
      apiKey: API_KEY,
      network: NETWORK,
    })
  : null;

export interface AutoDriveUploadResult {
  cid: string;
  url: string;
}

/** Upload a JSON-serializable object to Auto-Drive and return its CID and gateway URL. */
export async function uploadJsonToAutoDrive(data: unknown): Promise<AutoDriveUploadResult> {
  if (!autoDriveApi) {
    throw new Error("Auto-Drive is not configured. Missing VITE_AUTO_DRIVE_API_KEY.");
  }

  const jsonString = JSON.stringify(data);
  const buffer = new TextEncoder().encode(jsonString);

  const upload = await autoDriveApi.uploadBuffer(buffer, {
    fileName: "iqube-metadata.json",
    contentType: "application/json",
    compression: true,
  });

  // The SDK should return a CID; construct a generic gateway-style URL.
  const cid = upload.cid ?? upload.CID ?? upload.hash ?? "";
  if (!cid) {
    throw new Error("Auto-Drive upload did not return a CID.");
  }

  const gatewayBase =
    import.meta.env.VITE_AUTO_DRIVE_GATEWAY_URL ||
    "https://gateway.autonomys.xyz/ipfs";

  const url = `${gatewayBase}/${cid}`;

  return { cid, url };
}

