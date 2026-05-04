"use client";

import { useEffect } from "react";

const INTERACTIVE_SELECTOR =
  "a,button,[role='button'],summary,input[type='submit'],input[type='button'],[data-interactive='true']";

export function InteractionFeedback() {
  useEffect(() => {
    function handlePointerDown(ev: PointerEvent) {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!interactive) return;

      interactive.classList.add("ui-press-highlight");
      window.setTimeout(() => interactive.classList.remove("ui-press-highlight"), 260);
    }

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, []);

  return null;
}
