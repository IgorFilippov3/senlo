"use server";

import { revalidatePath } from "next/cache";
import { EmailProviderRepository } from "@senlo/db";
import { EmailProvider, EmailProviderType } from "@senlo/core";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { CreateProviderSchema } from "./schemas";
import { auth } from "apps/web/auth";

const providerRepo = new EmailProviderRepository();

export async function listProviders(): Promise<ActionResult<EmailProvider[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized', statusCode: 401 } };
  }

  const userId = session.user.id;

  return withErrorHandling(async () => {
    logger.debug("Listing all email providers", { userId });
    return await providerRepo.findByUser(userId);
  });
}

export async function createProviderAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };
  }

  const parsed = CreateProviderSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const { name, type, apiKey, domain, region } = parsed.data;

  try {
    let config: Record<string, string> = { apiKey };

    if (type === "MAILGUN") {
      if (!domain) {
        return {
          error: {
            formErrors: [],
            fieldErrors: { domain: ["Mailgun domain is required"] },
          },
        };
      }

      config = {
        apiKey,
        domain,
        region: region || "US",
      };
    }

    logger.info("Creating email provider", {
      name,
      type,
      hasDomain: !!domain,
      region: region || "US",
      userId: session.user.id,
    });

    const provider = await providerRepo.create({
      name,
      type: type as EmailProviderType,
      config,
      isActive: true,
      userId: session.user.id,
    });

    revalidatePath("/providers");

    logger.info("Email provider created successfully", {
      providerId: provider.id,
    });

    return { success: true, data: provider };
  } catch (error) {
    logger.error("Failed to create provider", {
      error: error instanceof Error ? error.message : String(error),
      name,
      type,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create provider"] },
      },
    };
  }
}

export async function deleteProviderAction(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    logger.debug("Deleting email provider", { providerId: id });
    await providerRepo.delete(id);
    revalidatePath("/providers");
  });
}

export async function toggleProviderAction(id: number, isActive: boolean): Promise<ActionResult<EmailProvider>> {
  return withErrorHandling(async () => {
    logger.debug("Toggling email provider status", { providerId: id, isActive });
    const updatedProvider = await providerRepo.update(id, { isActive });
    if (!updatedProvider) {
      throw new Error("Provider not found");
    }
    revalidatePath("/providers");
    return updatedProvider;
  });
}
