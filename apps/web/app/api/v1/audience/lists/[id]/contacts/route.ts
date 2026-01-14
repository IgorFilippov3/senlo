import { NextRequest, NextResponse } from "next/server";
import { RecipientListRepository, ContactRepository } from "@senlo/db";
import { validateApiKey } from "apps/web/lib";
import { z } from "zod";

const listRepo = new RecipientListRepository();
const contactRepo = new ContactRepository();

const AddContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        email: z.string().email("Invalid email"),
        name: z.string().optional(),
        meta: z.record(z.any()).optional(),
      })
    )
    .min(1, "At least one contact is required"),
});

const RemoveContactsSchema = z.object({
  emails: z
    .array(z.string().email("Invalid email"))
    .min(1, "At least one email is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req);
  if (!auth.success) return auth.response;

  const { id } = await params;
  const listId = Number(id);

  if (isNaN(listId)) {
    return NextResponse.json(
      { success: false, error: "Invalid list ID" },
      { status: 400 }
    );
  }

  try {
    const list = await listRepo.findById(listId);
    if (!list || list.projectId !== auth.apiKey.projectId) {
      return NextResponse.json(
        { success: false, error: "List not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const result = AddContactsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.flatten() },
        { status: 400 }
      );
    }

    const upsertedContacts = await contactRepo.batchUpsert(
      auth.apiKey.projectId,
      result.data.contacts
    );

    const contactIds = upsertedContacts.map((c) => c.id);
    await listRepo.addContacts(listId, contactIds);

    return NextResponse.json({
      success: true,
      data: {
        count: upsertedContacts.length,
        contacts: upsertedContacts,
      },
    });
  } catch (error) {
    console.error("API Error (Add Contacts):", error);
    return NextResponse.json(
      { success: false, error: "Failed to add contacts" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req);
  if (!auth.success) return auth.response;

  const { id } = await params;
  const listId = Number(id);

  if (isNaN(listId)) {
    return NextResponse.json(
      { success: false, error: "Invalid list ID" },
      { status: 400 }
    );
  }

  try {
    const list = await listRepo.findById(listId);
    if (!list || list.projectId !== auth.apiKey.projectId) {
      return NextResponse.json(
        { success: false, error: "List not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const result = RemoveContactsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.flatten() },
        { status: 400 }
      );
    }

    const contactsToRemove = await contactRepo.findByEmails(
      auth.apiKey.projectId,
      result.data.emails
    );

    const foundEmails = contactsToRemove.map((c) => c.email.toLowerCase());
    const missingEmails = result.data.emails.filter(
      (e) => !foundEmails.includes(e.toLowerCase())
    );

    if (contactsToRemove.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "None of the provided emails were found in this project",
          missingEmails,
        },
        { status: 404 }
      );
    }

    const contactIds = contactsToRemove.map((c) => c.id);
    await listRepo.removeContacts(listId, contactIds);

    return NextResponse.json({
      success: true,
      data: {
        removedCount: contactIds.length,
        missingCount: missingEmails.length,
        missingEmails: missingEmails.length > 0 ? missingEmails : undefined,
      },
    });
  } catch (error) {
    console.error("API Error (Remove Contacts):", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove contacts" },
      { status: 500 }
    );
  }
}
