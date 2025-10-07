import { IDL } from '@dfinity/candid';

export const evmRpcIdlFactory = ({ IDL }: any) => {
  const BlockTag = IDL.Variant({
    'Latest': IDL.Null,
    'Finalized': IDL.Null,
    'Safe': IDL.Null,
    'Earliest': IDL.Null,
    'Pending': IDL.Null,
    'Number': IDL.Nat,
  });

  const EthSepoliaService = IDL.Variant({
    'Alchemy': IDL.Null,
    'Ankr': IDL.Null,
    'BlockPi': IDL.Null,
    'PublicNode': IDL.Null,
    'Sepolia': IDL.Null,
  });

  const L2MainnetService = IDL.Variant({
    'Alchemy': IDL.Null,
    'Ankr': IDL.Null,
    'BlockPi': IDL.Null,
    'PublicNode': IDL.Null,
    'Llama': IDL.Null,
  });

  const RpcServices = IDL.Variant({
    'EthSepolia': IDL.Opt(IDL.Vec(EthSepoliaService)),
    'ArbitrumOne': IDL.Opt(IDL.Vec(L2MainnetService)),
    'BaseMainnet': IDL.Opt(IDL.Vec(L2MainnetService)),
    'OptimismMainnet': IDL.Opt(IDL.Vec(L2MainnetService)),
    'Custom': IDL.Record({
      chainId: IDL.Nat64,
      services: IDL.Vec(IDL.Record({
        url: IDL.Text,
        headers: IDL.Opt(IDL.Vec(IDL.Record({ name: IDL.Text, value: IDL.Text })))
      }))
    }),
  });

  const Block = IDL.Record({
    number: IDL.Nat,
    hash: IDL.Text,
    timestamp: IDL.Nat,
    transactions: IDL.Vec(IDL.Text),
    gasUsed: IDL.Nat,
    baseFeePerGas: IDL.Opt(IDL.Nat),
    miner: IDL.Text,
    parentHash: IDL.Text,
  });

  const RpcError = IDL.Variant({
    'ProviderError': IDL.Record({ code: IDL.Int64, message: IDL.Text }),
    'HttpOutcallError': IDL.Record({ message: IDL.Text }),
    'JsonRpcError': IDL.Record({ code: IDL.Int64, message: IDL.Text }),
    'ValidationError': IDL.Record({ message: IDL.Text }),
  });

  const GetBlockByNumberResult = IDL.Variant({
    'Ok': Block,
    'Err': RpcError,
  });

  const MultiGetBlockByNumberResult = IDL.Variant({
    'Consistent': GetBlockByNumberResult,
    'Inconsistent': IDL.Vec(IDL.Tuple(IDL.Text, GetBlockByNumberResult)),
  });

  return IDL.Service({
    'eth_getBlockByNumber': IDL.Func(
      [
        IDL.Record({
          rpcServices: RpcServices,
          blockTag: BlockTag,
        })
      ],
      [MultiGetBlockByNumberResult],
      []
    ),
  });
};

export type Block = {
  number: bigint;
  hash: string;
  timestamp: bigint;
  transactions: string[];
  gasUsed: bigint;
  baseFeePerGas?: bigint;
  miner: string;
  parentHash: string;
};

export type RpcError = 
  | { ProviderError: { code: bigint; message: string } }
  | { HttpOutcallError: { message: string } }
  | { JsonRpcError: { code: bigint; message: string } }
  | { ValidationError: { message: string } };

export type GetBlockByNumberResult = 
  | { Ok: Block }
  | { Err: RpcError };

export type MultiGetBlockByNumberResult =
  | { Consistent: GetBlockByNumberResult }
  | { Inconsistent: [string, GetBlockByNumberResult][] };
