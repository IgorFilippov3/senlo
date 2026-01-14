import { NextRequest, NextResponse } from "next/server";
import { RecipientListRepository } from "@senlo/db";
import { validateApiKey } from "apps/web/lib";
import { z } from "zod";

const listRepo = new RecipientListRepository();

const CreateListSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req);
  if (!auth.success) return auth.response;

  try {
    const lists = await listRepo.findByProject(auth.apiKey.projectId);
    return NextResponse.json({ success: true, data: lists });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch lists" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json();
    const result = CreateListSchema.safeParse(body);

    console.dir({ body, result });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.flatten() },
        { status: 400 }
      );
    }

    const list = await listRepo.create({
      projectId: auth.apiKey.projectId,
      name: result.data.name,
      description: result.data.description,
    });

    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create list" },
      { status: 500 }
    );
  }
}
