import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Badge, PlayerStats } from "../backend.d";
import { useActor } from "./useActor";

export function useGetStats() {
  const { actor, isFetching } = useActor();
  return useQuery<PlayerStats>({
    queryKey: ["stats"],
    queryFn: async () => {
      if (!actor) {
        return {
          streak: BigInt(0),
          totalXp: BigInt(0),
          badges: [],
          level: BigInt(1),
          score: BigInt(0),
          highScore: BigInt(0),
        };
      }
      return actor.getStats();
    },
    enabled: !isFetching,
  });
}

export function useGetLeaderboard() {
  const { actor, isFetching } = useActor();
  return useQuery<Array<[import("@icp-sdk/core/principal").Principal, bigint]>>(
    {
      queryKey: ["leaderboard"],
      queryFn: async () => {
        if (!actor) return [];
        return actor.getLeaderboard();
      },
      enabled: !!actor && !isFetching,
    },
  );
}

export function useUpdateStats() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      score,
      xp,
      streak,
      badges,
    }: {
      score: bigint;
      xp: bigint;
      streak: bigint;
      badges: Badge[];
    }) => {
      if (!actor) return;
      await actor.updateStats(score, xp, streak, badges);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}
