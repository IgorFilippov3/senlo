import { WorkflowEventType, Contact } from "@senlo/core";

export interface EventRequest {
  event: WorkflowEventType;
  email: string;
  name?: string;
  locale?: string;
  metadata?: Record<string, any>;
}

export interface EventContext {
  projectId: number;
}

export type EventHandler = (
  req: EventRequest,
  ctx: EventContext,
) => Promise<Contact | null>;
