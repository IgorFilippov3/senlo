"use client";

import React, { Suspense, useSyncExternalStore } from "react";

/** What every registered dialog receives on top of its own props. */
export interface DialogControlProps {
  isOpen: boolean;
  onClose: () => void;
}

/** One component per dialog name; each takes that dialog's props. */
export type DialogComponents<Registry extends { [K in keyof Registry]: object }> = {
  [K in keyof Registry]: React.ComponentType<Registry[K] & DialogControlProps>;
};

/**
 * A dialog store over a registry the app defines: dialog names mapped to the
 * props each one takes. `open("NAME", props)` from anywhere shows it in the
 * one `DialogHost`, which gets the components (lazy ones are fine) as a prop,
 * so the store never imports app code.
 *
 * One dialog at a time. Opened only from event handlers, so the module-level
 * state lives in the browser; the server always renders no dialog.
 */
export function createDialogs<Registry extends { [K in keyof Registry]: object }>() {
  type Current = { [K in keyof Registry]: { name: K; props: Registry[K] } }[keyof Registry];

  let current: Current | null = null;
  const listeners = new Set<() => void>();
  const set = (next: Current | null) => {
    current = next;
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const open = <K extends keyof Registry>(name: K, props: Registry[K]) =>
    set({ name, props } as Current);
  const close = () => set(null);

  function DialogHost({ components }: { components: DialogComponents<Registry> }) {
    const shown = useSyncExternalStore(
      subscribe,
      () => current,
      () => null,
    );
    if (!shown) return null;
    const Component = components[shown.name] as React.ComponentType<
      Registry[keyof Registry] & DialogControlProps
    >;
    return (
      <Suspense fallback={null}>
        <Component {...shown.props} isOpen onClose={close} />
      </Suspense>
    );
  }

  /** `open` and `close` are stable: no need to subscribe a caller that only opens. */
  const useDialogs = () => ({ open, close });

  return { open, close, useDialogs, DialogHost };
}
