"use server";

import { revalidatePath } from "next/cache";
import { AiProviderRepository, db } from "@senlo/db";
import { AiProvider, AiProviderType } from "@senlo/core";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { CreateAiProviderSchema } from "./schemas";
import { auth } from "apps/web/auth";

const aiProviderRepo = new AiProviderRepository(db);

export async function listAiProviders(): Promise<ActionResult<AiProvider[]>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.debug("Listing all AI providers", { userId });
    return await aiProviderRepo.findByUser(userId);
  });
}

export async function createAiProviderAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };
  }

  const parsed = CreateAiProviderSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const { name, type, apiKey, model } = parsed.data;

  try {
    const config: Record<string, string> = {
      apiKey,
      model:
        model || (type === "OPENAI" ? "gpt-4o" : "claude-3-5-sonnet-20240620"),
    };

    logger.info("Creating AI provider", {
      name,
      type,
      model: config.model,
      userId,
    });

    const provider = await aiProviderRepo.create({
      name,
      type: type as AiProviderType,
      config,
      isActive: true,
      userId,
    });

    revalidatePath("/providers");

    logger.info("AI provider created successfully", {
      providerId: provider.id,
    });

    return { success: true, data: provider };
  } catch (error) {
    logger.error("Failed to create AI provider", {
      error: error instanceof Error ? error.message : String(error),
      name,
      type,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create AI provider"] },
      },
    };
  }
}

export async function deleteAiProviderAction(
  id: number,
): Promise<ActionResult<void>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    const provider = await aiProviderRepo.findById(id);
    if (!provider || provider.userId !== userId) {
      throw new Error("AI provider not found or unauthorized");
    }

    logger.debug("Deleting AI provider", { providerId: id, userId });
    await aiProviderRepo.delete(id);
    revalidatePath("/providers");
  });
}

export async function toggleAiProviderAction(
  id: number,
  isActive: boolean,
): Promise<ActionResult<AiProvider>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    const provider = await aiProviderRepo.findById(id);
    if (!provider || provider.userId !== userId) {
      throw new Error("AI provider not found or unauthorized");
    }

    logger.debug("Toggling AI provider status", {
      providerId: id,
      isActive,
      userId,
    });
    const updatedProvider = await aiProviderRepo.update(id, { isActive });
    if (!updatedProvider) {
      throw new Error("AI provider not found");
    }
    revalidatePath("/providers");
    return updatedProvider;
  });
}
