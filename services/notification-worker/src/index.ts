import type { WorldEvent } from "@planet/shared-types";

export interface NotificationDraft {
  userId: string;
  type: string;
  title: string;
  body: string;
  worldEventId: string;
}

export function contributionActivatedNotification(
  userId: string,
  contributionName: string,
  event: WorldEvent,
): NotificationDraft {
  if (event.type !== "CONTRIBUTION_ADDED") {
    throw new Error("Activation notifications require a contribution event");
  }
  return {
    userId,
    type: "CONTRIBUTION_ACTIVE",
    title: contributionName,
    body: "Your contribution entered the causal simulation",
    worldEventId: event.id,
  };
}

export function notificationsFromEvents(
  userId: string,
  events: WorldEvent[],
): NotificationDraft[] {
  return events
    .filter((event) => event.rootContributionId !== null)
    .filter((event) =>
      [
        "VEGETATION_SPREAD",
        "SPECIES_CREATED",
        "TECHNOLOGY_DISCOVERED",
        "WAR_STARTED",
        "SPECIES_EXTINCT",
      ].includes(event.type),
    )
    .map((event) => ({
      userId,
      type: event.type,
      title: String(event.payload.name ?? event.type),
      body: event.cause,
      worldEventId: event.id,
    }));
}
