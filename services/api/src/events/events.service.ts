import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvent(id: string) {
    const event = await this.prisma.worldEvent.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    return event;
  }
}
