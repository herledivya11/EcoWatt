import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PredictionHistory } from "../backend.d";
import { useActor } from "./useActor";

export function useGetAllPredictions() {
  const { actor, isFetching } = useActor();
  return useQuery<PredictionHistory[]>({
    queryKey: ["predictions"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getAllPredictions();
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddPrediction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (history: PredictionHistory) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.addPrediction(history);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
    },
  });
}
