"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzeContribution,
  createContribution,
  getDefaultPlanet,
  getMyImpact,
  getPlanetEvents,
  getPlanetTimeline,
  login,
  register,
} from "@/lib/api";

export function usePlanetQuery() {
  return useQuery({
    queryKey: ["planet", "default"],
    queryFn: getDefaultPlanet,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useEventsQuery(planetId?: string) {
  return useQuery({
    queryKey: ["planet", planetId, "events"],
    queryFn: () => getPlanetEvents(planetId ?? ""),
    enabled: Boolean(planetId),
    refetchInterval: 20_000,
    staleTime: 8_000,
  });
}

export function useTimelineQuery(planetId?: string) {
  return useQuery({
    queryKey: ["planet", planetId, "timeline"],
    queryFn: () => getPlanetTimeline(planetId ?? ""),
    enabled: Boolean(planetId),
    staleTime: 30_000,
  });
}

export function useImpactQuery() {
  return useQuery({
    queryKey: ["me", "impact"],
    queryFn: getMyImpact,
    retry: 1,
  });
}

export function useLoginMutation() {
  return useMutation({ mutationFn: login });
}

export function useRegisterMutation() {
  return useMutation({ mutationFn: register });
}

export function useAnalyzeContributionMutation() {
  return useMutation({ mutationFn: analyzeContribution });
}

export function useCreateContributionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createContribution,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["planet"] });
      void queryClient.invalidateQueries({ queryKey: ["me", "impact"] });
    },
  });
}
