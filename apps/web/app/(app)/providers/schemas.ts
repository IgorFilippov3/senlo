import { z } from "zod";

export const CreateProviderSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  type: z.string().min(1),
  apiKey: z.string().min(1),
  domain: z.string().trim().optional(),
  region: z.string().trim().optional().default("US"),
});

export const CreateAiProviderSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  type: z.string().min(1),
  apiKey: z.string().min(1),
  model: z.string().trim().optional(),
});



