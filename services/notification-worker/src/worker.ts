import type { Notification, UserContribution, WorldEvent } from "@kawkab/shared-types";

export interface NotificationJob {
  event: WorldEvent;
  contributions: UserContribution[];
}

const queue: NotificationJob[] = [];
const notifications: Notification[] = [];

export function enqueue(job: NotificationJob): void {
  queue.push(job);
}

export function consumeOnce(): Notification[] {
  const job = queue.shift();
  if (!job) return [];
  const created = job.contributions
    .filter((contribution) => job.event.actorIds.includes(contribution.id) || job.event.causeEventIds.some((cause) => contribution.confirmedEventIds.includes(cause)))
    .map((contribution) => ({
      id: `notification-${job.event.id}-${contribution.userId}`,
      userId: contribution.userId,
      planetId: contribution.planetId,
      eventId: job.event.id,
      title: "أثر مساهمتك ظهر في العالم",
      body: `${job.event.title}: ${job.event.description}`,
      read: false,
      createdAt: new Date().toISOString()
    } satisfies Notification));
  notifications.push(...created);
  return created;
}

export function listNotifications(): Notification[] {
  return [...notifications];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Notification worker ready. Queue backend غير مفعّل: using in-process queue for local development.");
}
