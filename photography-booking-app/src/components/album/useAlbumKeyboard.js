import { useEffect } from "react";

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export default function useAlbumKeyboard({
  onPrev,
  onNext,
  onFirst,
  onLast,
  onEscape,
  onToggleCurrent,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled) return;

    function handler(e) {
      if (isTypingTarget(e.target)) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          onPrev?.();
          break;
        case "ArrowRight":
        case " ":
          e.preventDefault();
          onNext?.();
          break;
        case "Home":
          e.preventDefault();
          onFirst?.();
          break;
        case "End":
          e.preventDefault();
          onLast?.();
          break;
        case "Escape":
          onEscape?.();
          break;
        case "s":
        case "S":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            onToggleCurrent?.();
          }
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onPrev, onNext, onFirst, onLast, onEscape, onToggleCurrent]);
}
