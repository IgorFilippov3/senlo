import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { emailDesignDocumentSchema } from "@senlo/core";
import { auth } from "../../../../auth";
import { ProjectRepository, AiProviderRepository } from "@senlo/db";

const projectRepo = new ProjectRepository();
const aiProviderRepo = new AiProviderRepository();

const SYSTEM_PROMPT = `
You are an expert email designer for the Senlo Email Builder.
... (rest of the prompt)
`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, currentDesign, projectId } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const project = await projectRepo.findById(Number(projectId));
    if (!project || project.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    if (!project.aiProviderId) {
      return NextResponse.json(
        { error: "No AI provider configured for this project" },
        { status: 400 },
      );
    }

    const aiProvider = await aiProviderRepo.findById(project.aiProviderId);
    if (!aiProvider) {
      return NextResponse.json(
        { error: "AI provider configuration not found" },
        { status: 404 },
      );
    }

    if (aiProvider.type !== "OPENAI") {
      return NextResponse.json(
        { error: `Provider type ${aiProvider.type} is not yet supported` },
        { status: 501 },
      );
    }

    const openai = new OpenAI({
      apiKey: aiProvider.config.apiKey,
    });

    const model = aiProvider.config.model || "gpt-4o";

    const isEditing =
      currentDesign && currentDesign.rows && currentDesign.rows.length > 0;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (isEditing) {
      messages.push({
        role: "system",
        content: `You are in EDIT mode. The user wants to modify their existing email design.
        
Current design JSON:
${JSON.stringify(currentDesign)}

Instructions for EDIT mode:
1. Respect the existing structure where possible unless the user explicitly asks to change it.
2. You can add new rows, remove rows, or update existing rows/blocks.
3. Keep the same JSON format as specified in the general rules.
4. If the user asks for a small change, don't rewrite everything from scratch if not needed, but return the COMPLETE design JSON reflecting the changes.`,
      });
    }

    messages.push({ role: "user", content: prompt });

    const completion = await openai.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    const aiDesign = JSON.parse(content);

    const validationResult = emailDesignDocumentSchema.safeParse(aiDesign);

    if (!validationResult.success) {
      console.error("AI generated invalid design:", validationResult.error);
      return NextResponse.json(
        {
          error: "AI generated an invalid template structure",
          details: validationResult.error.errors,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ design: validationResult.data });
  } catch (error) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate template",
      },
      { status: 500 },
    );
  }
}
