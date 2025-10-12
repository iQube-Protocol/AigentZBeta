import { IDL } from '@dfinity/candid';

export const solRpcIdlFactory = ({ IDL }: any) => {
  const RpcSource = IDL.Variant({
    'Mainnet': IDL.Null,
    'Testnet': IDL.Null,
    'Devnet': IDL.Null,
    'Custom': IDL.Record({
      url: IDL.Text,
      headers: IDL.Opt(IDL.Vec(IDL.Record({ name: IDL.Text, value: IDL.Text })))
    }),
  });

  const RpcSources = IDL.Variant({
    'Mainnet': IDL.Opt(IDL.Vec(RpcSource)),
    'Testnet': IDL.Opt(IDL.Vec(RpcSource)),
    'Devnet': IDL.Opt(IDL.Vec(RpcSource)),
    'Custom': IDL.Vec(RpcSource),
  });

  const RpcConfig = IDL.Record({
    responseSizeEstimate: IDL.Opt(IDL.Nat64),
  });

  // Account Info
  const AccountInfo = IDL.Record({
    lamports: IDL.Nat64,
    owner: IDL.Text,
    executable: IDL.Bool,
    rentEpoch: IDL.Nat64,
    data: IDL.Vec(IDL.Nat8),
  });

  const GetAccountInfoResult = IDL.Variant({
    'Ok': IDL.Opt(AccountInfo),
    'Err': IDL.Text,
  });

  // Balance
  const GetBalanceResult = IDL.Variant({
    'Ok': IDL.Nat64,
    'Err': IDL.Text,
  });

  // Slot
  const GetSlotResult = IDL.Variant({
    'Ok': IDL.Nat64,
    'Err': IDL.Text,
  });

  // Signature Status
  const TransactionStatus = IDL.Record({
    slot: IDL.Nat64,
    confirmations: IDL.Opt(IDL.Nat64),
    err: IDL.Opt(IDL.Text),
    confirmationStatus: IDL.Opt(IDL.Text),
  });

  const GetSignatureStatusesResult = IDL.Variant({
    'Ok': IDL.Vec(IDL.Opt(TransactionStatus)),
    'Err': IDL.Text,
  });

  return IDL.Service({
    'sol_getAccountInfo': IDL.Func(
      [
        IDL.Record({
          rpcSources: RpcSources,
          address: IDL.Text,
          config: IDL.Opt(RpcConfig),
        })
      ],
      [GetAccountInfoResult],
      []
    ),
    'sol_getBalance': IDL.Func(
      [
        IDL.Record({
          rpcSources: RpcSources,
          address: IDL.Text,
          config: IDL.Opt(RpcConfig),
        })
      ],
      [GetBalanceResult],
      []
    ),
    'sol_getSlot': IDL.Func(
      [
        IDL.Record({
          rpcSources: RpcSources,
          config: IDL.Opt(RpcConfig),
        })
      ],
      [GetSlotResult],
      []
    ),
    'sol_getSignatureStatuses': IDL.Func(
      [
        IDL.Record({
          rpcSources: RpcSources,
          signatures: IDL.Vec(IDL.Text),
          config: IDL.Opt(RpcConfig),
        })
      ],
      [GetSignatureStatusesResult],
      []
    ),
  });
};

export type AccountInfo = {
  lamports: bigint;
  owner: string;
  executable: boolean;
  rentEpoch: bigint;
  data: Uint8Array;
};

export type TransactionStatus = {
  slot: bigint;
  confirmations?: bigint;
  err?: string;
  confirmationStatus?: string;
};

export type GetAccountInfoResult = 
  | { Ok: AccountInfo | null }
  | { Err: string };

export type GetBalanceResult = 
  | { Ok: bigint }
  | { Err: string };

export type GetSlotResult = 
  | { Ok: bigint }
  | { Err: string };

export type GetSignatureStatusesResult = 
  | { Ok: (TransactionStatus | null)[] }
  | { Err: string };
