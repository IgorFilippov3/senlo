import { NextRequest, NextResponse } from "next/server";
import { RecipientListRepository } from "@senlo/db";
import { validateApiKey } from "apps/web/lib";

const listRepo = new RecipientListRepository();

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

    await listRepo.delete(listId);

    return NextResponse.json({ success: true, message: "List deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete list" },
      { status: 500 }
    );
  }
}
