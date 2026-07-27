import { z } from "zod";

export const DeleteSuppressionSchema = z.object({
  id: z.number(),
});
