import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().optional(),
  providerId: z.coerce.number().optional(),
  aiProviderId: z.coerce.number().optional(),
});



