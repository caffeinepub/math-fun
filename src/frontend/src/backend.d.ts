import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface PlayerStats {
    streak: bigint;
    totalXp: bigint;
    badges: Array<Badge>;
    level: bigint;
    score: bigint;
    highScore: bigint;
}
export interface Badge {
    name: string;
    description: string;
}
export interface backendInterface {
    getLeaderboard(): Promise<Array<[Principal, bigint]>>;
    getStats(): Promise<PlayerStats>;
    updateStats(score: bigint, xp: bigint, streak: bigint, badges: Array<Badge>): Promise<void>;
    whoami(): Promise<Principal>;
}
