import { useCallback } from "react";
import { useEditorStore } from "../state/editor.store";
import { useEditorHost, type EditorNavigationTarget } from "../host";

/**
 * Leaves the editor through the host. Client-side navigation does not fire
 * `beforeunload`, so unsaved changes are confirmed here for every exit.
 * `null` when the host gives the editor nowhere to go.
 */
export const useLeaveEditor = () => {
  const { onNavigate } = useEditorHost();
  const isDirty = useEditorStore((s) => s.isDirty);

  const leave = useCallback(
    (target: EditorNavigationTarget) => {
      if (
        isDirty &&
        !window.confirm("You have unsaved changes. Are you sure you want to leave?")
      ) {
        return;
      }
      onNavigate?.(target);
    },
    [isDirty, onNavigate],
  );

  return onNavigate ? leave : null;
};
