// Stub generated at deploy time by Caffeine build system.
// This file is replaced with real generated declarations during deployment.
import { Actor, HttpAgent } from '@dfinity/agent';

export const idlFactory = ({ IDL }) => {
  return IDL.Service({ whoami: IDL.Func([], [IDL.Principal], ['query']) });
};

export const canisterId = typeof process !== 'undefined'
  ? (process.env.CANISTER_ID_BACKEND ?? 'aaaaa-aa')
  : 'aaaaa-aa';

export function createActor(canisterId, options) {
  const agent = options?.agent ?? new HttpAgent({ ...options?.agentOptions });
  return Actor.createActor(idlFactory, { agent, canisterId, ...options?.actorOptions });
}

export const backend = createActor(canisterId);
