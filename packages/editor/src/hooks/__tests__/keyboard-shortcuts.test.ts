import { describe, expect, it } from "vitest";
import {
  getKeyboardShortcutModifier,
  KEYBOARD_SHORTCUTS,
} from "../use-keyboard-shortcuts";

describe("keyboard shortcut help", () => {
  it("uses the Command modifier on Apple platforms and Ctrl elsewhere", () => {
    expect(getKeyboardShortcutModifier("MacIntel")).toBe("⌘");
    expect(getKeyboardShortcutModifier("iPhone")).toBe("⌘");
    expect(getKeyboardShortcutModifier("Win32")).toBe("Ctrl");
    expect(getKeyboardShortcutModifier("Linux x86_64")).toBe("Ctrl");
  });

  it("lists all editing, selection, and history shortcuts from the hook", () => {
    expect(KEYBOARD_SHORTCUTS.map(({ group, label }) => [group, label])).toEqual([
      ["Editing", "Duplicate the selected row or block"],
      ["Editing", "Delete the selected row or block"],
      ["Selection", "Move the selection"],
      ["Selection", "Clear the selection"],
      ["History", "Undo"],
      ["History", "Redo"],
    ]);
  });
});
