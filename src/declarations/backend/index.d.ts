import type { ActorSubclass, HttpAgentOptions, ActorConfig, Agent } from '@dfinity/agent';
import type { Principal } from '@dfinity/principal';
import type { _SERVICE } from './backend.did.d.js';

export interface CreateActorOptions {
  agent?: Agent;
  agentOptions?: HttpAgentOptions;
  actorOptions?: ActorConfig;
}

export declare const backend: ActorSubclass<_SERVICE>;
export declare const canisterId: string;
export declare function createActor(
  canisterId: string | Principal,
  options?: CreateActorOptions,
): ActorSubclass<_SERVICE>;
