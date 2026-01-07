"use server";

import { revalidatePath } from "next/cache";
import {
  ContactRepository,
  RecipientListRepository,
  ProjectRepository,
} from "@senlo/db";
import { Contact, RecipientList, Project } from "@senlo/core";
import { ActionResult, validateId, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { CreateContactSchema, CreateListSchema } from "./schemas";
import { auth } from "apps/web/auth";

const contactRepo = new ContactRepository();
const listRepo = new RecipientListRepository();
const projectRepo = new ProjectRepository();

async function authorizeProject(projectId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const project = await projectRepo.findById(projectId);
  if (!project || project.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  return { project, session };
}

export async function getAudienceData(): Promise<
  ActionResult<{ projects: Project[] }>
> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized', statusCode: 401 } };

  const userId = session.user.id;

  return withErrorHandling(async () => {
    logger.debug("Getting audience data for user", { userId });
    const projects = await projectRepo.findByUser(userId);
    return { projects };
  });
}

export async function listProjectContacts(
  projectId: number
): Promise<ActionResult<Contact[]>> {
  return withErrorHandling(async () => {
    const validProjectId = validateId(projectId, "projectId");
    await authorizeProject(validProjectId);

    logger.debug("Listing project contacts", { projectId: validProjectId });

    return contactRepo.findByProject(validProjectId);
  });
}

export async function listProjectLists(
  projectId: number
): Promise<ActionResult<RecipientList[]>> {
  return withErrorHandling(async () => {
    const validProjectId = validateId(projectId, "projectId");
    await authorizeProject(validProjectId);

    logger.debug("Listing project lists", { projectId: validProjectId });

    return listRepo.findByProject(validProjectId);
  });
}

export async function listListContacts(
  listId: number
): Promise<ActionResult<Contact[]>> {
  return withErrorHandling(async () => {
    const validListId = validateId(listId, "listId");
    
    // To authorize list access, we need to check the project it belongs to
    const list = await listRepo.findById(validListId);
    if (!list) throw new Error("List not found");
    
    await authorizeProject(list.projectId);

    logger.debug("Listing list contacts", { listId: validListId });

    return listRepo.getContacts(validListId, false);
  });
}

export async function createContact(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };

  const parsed = CreateContactSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const { email, name, projectId, listId } = parsed.data;

  try {
    await authorizeProject(projectId);

    logger.info("Creating contact", {
      projectId,
      email,
      hasName: !!name,
      listId,
    });

    const contact = await contactRepo.upsert({
      projectId,
      email,
      name: name || null,
    });

    if (listId) {
      // Check list ownership too
      const list = await listRepo.findById(listId);
      if (!list || list.projectId !== projectId) throw new Error("Invalid list");
      
      await listRepo.addContacts(listId, [contact.id]);
      logger.info("Contact added to list", { contactId: contact.id, listId });
    }

    logger.info("Contact created successfully", { contactId: contact.id });

    revalidatePath("/audience");

    return { success: true, data: contact };
  } catch (error) {
    logger.error("Failed to create contact", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
      email,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create contact"] },
      },
    };
  }
}

export async function createList(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };

  const parsed = CreateListSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const { name, description, projectId } = parsed.data;

  try {
    await authorizeProject(projectId);

    logger.info("Creating recipient list", {
      projectId,
      name,
      hasDescription: !!description,
    });

    const list = await listRepo.create({
      projectId,
      name,
      description: description || null,
    });

    revalidatePath("/audience");

    logger.info("Recipient list created successfully", { listId: list.id });

    return { success: true, data: list };
  } catch (error) {
    logger.error("Failed to create list", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
      name,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create list"] },
      },
    };
  }
}

export async function deleteContact(contactId: number) {
  return withErrorHandling(async () => {
    const validContactId = validateId(contactId, "contactId");
    
    // Check contact ownership via its project
    const contact = await contactRepo.findById(validContactId);
    if (!contact) throw new Error("Contact not found");
    
    await authorizeProject(contact.projectId);

    logger.debug("Deleting contact", { contactId: validContactId });

    await contactRepo.delete(validContactId);
    revalidatePath("/audience");

    return { success: true };
  });
}

export async function importContactsAction(data: {
  projectId: number;
  contacts: {
    email: string;
    name?: string;
    meta?: Record<string, unknown> | null;
  }[];
  listId?: number;
  newListName?: string;
}) {
  try {
    const { projectId, contacts: contactData, listId, newListName } = data;

    const validProjectId = validateId(projectId, "projectId");
    await authorizeProject(validProjectId);

    if (!contactData.length) {
      return {
        error: {
          formErrors: [],
          fieldErrors: {
            contacts: ["At least one contact is required for import"],
          },
        },
      };
    }

    for (let i = 0; i < contactData.length; i++) {
      const contact = contactData[i];
      if (!contact.email) {
        return {
          error: {
            formErrors: [],
            fieldErrors: { contacts: [`Contact ${i + 1}: email is required`] },
          },
        };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        return {
          error: {
            formErrors: [],
            fieldErrors: {
              contacts: [`Contact ${i + 1}: invalid email format`],
            },
          },
        };
      }
      if (contact.name && contact.name.length > 255) {
        return {
          error: {
            formErrors: [],
            fieldErrors: {
              contacts: [
                `Contact ${i + 1}: name too long (max 255 characters)`,
              ],
            },
          },
        };
      }
    }

    logger.info("Starting contact import", {
      projectId: validProjectId,
      contactCount: contactData.length,
      listId,
      newListName,
    });

    const emails = contactData.map((c) => c.email);
    const existingContacts = await contactRepo.findByEmails(
      validProjectId,
      emails
    );
    const existingEmails = new Set(existingContacts.map((c) => c.email));

    const newCount = contactData.filter(
      (c) => !existingEmails.has(c.email)
    ).length;
    const updatedCount = contactData.length - newCount;

    // 2. Upsert contacts
    const savedContacts = await contactRepo.batchUpsert(
      validProjectId,
      contactData
    );
    const contactIds = savedContacts.map((c) => c.id);

    let targetListId = listId;

    if (newListName) {
      const trimmedName = newListName.trim();
      if (!trimmedName) {
        return {
          error: {
            formErrors: [],
            fieldErrors: { newListName: ["New list name cannot be empty"] },
          },
        };
      }

      const newList = await listRepo.create({
        projectId: validProjectId,
        name: trimmedName,
        description: `Imported on ${new Date().toLocaleDateString()}`,
      });
      targetListId = newList.id;

      logger.info("Created new list for import", {
        listId: newList.id,
        name: trimmedName,
      });
    }

    if (targetListId) {
      // Ensure list belongs to project
      const list = await listRepo.findById(targetListId);
      if (!list || list.projectId !== validProjectId) throw new Error("Invalid list");

      await listRepo.addContacts(targetListId, contactIds);
      logger.info("Added contacts to list", {
        listId: targetListId,
        contactCount: contactIds.length,
      });
    }

    revalidatePath("/audience");

    const result = {
      total: contactData.length,
      newCount,
      updatedCount,
      listId: targetListId,
    };

    logger.info("Contact import completed", result);

    return { success: true, data: result };
  } catch (error) {
    logger.error("Failed to import contacts", {
      error: error instanceof Error ? error.message : String(error),
      projectId: data.projectId,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to import contacts"] },
      },
    };
  }
}
