import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailDesignDocument } from "@senlo/core";

import { design, store, twoRowDesign } from "./fixtures";

beforeEach(() => {
  store().resetEditor();
  store().setDesign(twoRowDesign());
});

describe("setDesign", () => {
  it("replaces the document and marks it saved", () => {
    store().updateBlock("b1", { text: "Edited" });
    store().setDesign(twoRowDesign());

    expect((store().design.rows[0].columns[0].blocks[0] as any).data.text).toBe(
      "First",
    );
    expect(store().isDirty).toBe(false);
  });

  it("fills in global settings a stored document does not have", () => {
    store().setDesign({ version: 1, rows: [] } as unknown as EmailDesignDocument);

    expect(store().design.settings).toEqual({
      backgroundColor: "#ffffff",
      contentWidth: 600,
      fontFamily: "Arial, sans-serif",
      textColor: "#111827",
    });
  });

  it("keeps the settings a document brings with it", () => {
    const document = design([]);
    document.settings = { backgroundColor: "#111111", contentWidth: 480 };

    store().setDesign(document);

    expect(store().design.settings).toEqual({
      backgroundColor: "#111111",
      contentWidth: 480,
    });
  });

  it("does not clear the history", () => {
    // Current behaviour: loading a document leaves earlier steps in place, so
    // an undo right after a load reaches back into the previous document.
    store().updateBlock("b1", { text: "Edited" });
    store().setDesign(twoRowDesign());

    expect(store().historyPast).toHaveLength(1);
  });
});

describe("updateDesignFromAi", () => {
  it("replaces the document, records a step and marks it unsaved", () => {
    const generated = design([]);

    store().updateDesignFromAi(generated);

    expect(store().design.rows).toHaveLength(0);
    expect(store().historyPast).toHaveLength(1);
    expect(store().isDirty).toBe(true);
  });

  it("can be undone back to what the user had", () => {
    store().updateDesignFromAi(design([]));
    store().undo();

    expect(store().design.rows).toHaveLength(2);
  });
});

describe("global settings", () => {
  it("merge and record one step", () => {
    store().updateGlobalSettings({ contentWidth: 720 });

    expect(store().design.settings.contentWidth).toBe(720);
    expect(store().design.settings.fontFamily).toBe("Arial, sans-serif");
    expect(store().historyPast).toHaveLength(1);
  });

  it("do nothing when the value is the one already there", () => {
    store().updateGlobalSettings({ contentWidth: 600 });

    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(false);
  });

  it("can be changed without a history step", () => {
    store().updateGlobalSettingsWithoutHistory({ textColor: "#000000" });

    expect(store().design.settings.textColor).toBe("#000000");
    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(true);
  });

});

describe("template metadata", () => {
  it("is stored", () => {
    store().setTemplateMetadata("Welcome", "Hi there", "ru", "Preview text");

    expect(store().templateName).toBe("Welcome");
    expect(store().templateSubject).toBe("Hi there");
    expect(store().templateLocale).toBe("ru");
    expect(store().templatePreheader).toBe("Preview text");
  });

  it("keeps the locale when none is given", () => {
    store().setTemplateMetadata("Welcome", "Hi there", "ru", "");
    store().setTemplateMetadata("Welcome", "Hi there");

    expect(store().templateLocale).toBe("ru");
  });

  it("accepts an empty preheader, which is how it is cleared", () => {
    store().setTemplateMetadata("Welcome", "Hi", "en", "Preview");
    store().setTemplateMetadata("Welcome", "Hi", "en", "");

    expect(store().templatePreheader).toBe("");
  });

  it("is not part of the document, so changing it is not an edit", () => {
    store().setTemplateMetadata("Welcome", "Hi there");

    expect(store().isDirty).toBe(false);
    expect(store().historyPast).toHaveLength(0);
  });
});

describe("template and project ids", () => {
  it("are stored", () => {
    store().setTemplateId(42);
    store().setProjectInfo(7, true);

    expect(store().templateId).toBe(42);
    expect(store().projectId).toBe(7);
    expect(store().hasAiProvider).toBe(true);
  });
});

describe("merge tags", () => {
  it("are replaced wholesale", () => {
    const tags = [{ name: "Plan", value: "contact.plan" }] as any;
    store().setCustomMergeTags(tags);

    expect(store().customMergeTags).toEqual(tags);

    store().setCustomMergeTags([]);
    expect(store().customMergeTags).toEqual([]);
  });
});

describe("ui state", () => {
  it("tracks the sidebar tab", () => {
    store().setActiveSidebarTab("content");

    expect(store().activeSidebarTab).toBe("content");
  });

  it("forgets the drag type when the drag ends", () => {
    store().setDragActive(true, "block");
    expect(store().isDragActive).toBe(true);
    expect(store().activeDragType).toBe("block");

    store().setDragActive(false, "block");
    expect(store().isDragActive).toBe(false);
    expect(store().activeDragType).toBeNull();
  });

  it("tracks preview mode and its sample contact", () => {
    expect(store().previewContact).toEqual({
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
    });

    store().setPreviewMode(true);
    store().setPreviewContact({ first_name: "Ada" });

    expect(store().previewMode).toBe(true);
    expect(store().previewContact).toEqual({ first_name: "Ada" });
  });

  it("tracks AI generation", () => {
    store().setIsAiGenerating(true);
    expect(store().isAiGenerating).toBe(true);

    store().setIsAiGenerating(false);
    expect(store().isAiGenerating).toBe(false);
  });

  it("lets the header mark the document saved", () => {
    store().updateBlock("b1", { text: "Edited" });
    store().setDirty(false);

    expect(store().isDirty).toBe(false);
  });
});

describe("callbacks", () => {
  it("are kept as given", () => {
    const onSave = vi.fn();
    const onSendTest = vi.fn();

    store().setOnSave(onSave as any);
    store().setOnSendTest(onSendTest as any);

    expect(store().onSave).toBe(onSave);
    expect(store().onSendTest).toBe(onSendTest);
  });
});

describe("resetEditor", () => {
  it("returns the document to the empty one", () => {
    store().resetEditor();

    expect(store().design.rows).toHaveLength(0);
    expect(store().templateId).toBeNull();
    expect(store().previewMode).toBe(false);
    expect(store().templatePreheader).toBe("");
    expect(store().previewContact).toEqual({
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
    });
  });

  it("keeps what belongs to the page rather than the document", () => {
    // Current behaviour: the callbacks, the project and the template's name
    // survive a reset - the layout sets them again on mount.
    const onSave = vi.fn();
    store().setOnSave(onSave as any);
    store().setProjectInfo(7, true);
    store().setTemplateMetadata("Welcome", "Hi");

    store().resetEditor();

    expect(store().onSave).toBe(onSave);
    expect(store().projectId).toBe(7);
    expect(store().templateName).toBe("Welcome");
  });
});
