import { useEffect, useRef } from "react";

/** Keep keyboard focus inside an open modal and return it to its opener. */
export function useModalAccessibility(isOpen: boolean, onClose: () => void, busy = false) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    )].filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));
    const focusFirst = () => (dialog.querySelector<HTMLElement>('[data-autofocus]') || focusable()[0] || dialog).focus();
    focusFirst();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) closeRef.current();
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (!dialog.contains(document.activeElement) ||
          (event.shiftKey && (document.activeElement === first || document.activeElement === dialog))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocus);
      document.body.style.overflow = previousOverflow;
      const returnFocus = opener?.isConnected ? opener : document.querySelector<HTMLElement>('[data-modal-return-focus]');
      returnFocus?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  return dialogRef;
}
