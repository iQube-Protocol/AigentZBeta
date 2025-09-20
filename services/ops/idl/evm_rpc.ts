import { IDL } from '@dfinity/candid';

export const idlFactory = ({ IDL: I = IDL }) => {
  const EVMChainConfig = I.Record({
    chain_id: I.Nat32,
    name: I.Text,
    rpc_url: I.Text,
    block_explorer: I.Text,
    native_token: I.Text,
  });
  return I.Service({
    init_chain_configs: I.Func([], [], []),
    get_supported_chains: I.Func([], [I.Vec(EVMChainConfig)], ['query']),
  });
};

export type _SERVICE = {
  get_supported_chains: () => Promise<Array<{ chain_id: number; name: string; rpc_url: string; block_explorer: string; native_token: string }>>;
};
