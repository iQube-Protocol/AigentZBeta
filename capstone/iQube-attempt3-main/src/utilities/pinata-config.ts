import { PinataSDK } from "pinata";

export const pinata = new PinataSDK({
 pinataJwt: `${import.meta.env.VITE_PINATA_JWT}`,
 pinataGateway: `${import.meta.env.VITE_GATEWAY_URL}`,
});
/**
 * for reference
 * 
1. metaQube Identifier: Name/Unique ID
2. metaQube Creator: Creator/Designer DID
3. iQube Schema: Records included in iQube
4. iQube Key: Token ID/ NFT URI
5. metaQube location: IPFS Address
6. Record Changeability: Static/Fluid/Mixed
7. Owner Type: Person/Org/Thing
8. Subject Identifiability: Ident/Semi-Ident/Anon/Semi-Anon
9. Accuracy Score: 1-10 
10. Veracity Score: 1-10 
11. Sensitivity Score: 1-10 
12. Intrinsic Risk Score: 1-10 
13. Transaction Data: Date, Timestamp
14. blakQube Identifier: Filename (Secret?)
15. blakQube location: URI (Secret?)
16. blakQube Key: Encrypted Pay-load hash (Secret)
17. blakQube Type: Restricted/Open
*/
