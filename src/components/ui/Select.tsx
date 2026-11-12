import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "../../lib/utils";

interface Placement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  up: boolean;
  /** Where the list grows from: the middle of the trigger, at the edge it hangs from. */
  origin: string;
}

/** How long a closing list stays on screen for its exit animation. */
const EXIT_MS = 140;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * A dropdown in the Graphiq look, as in Inq and Uplinq Studio: a button
 * showing the chosen option, and a list that springs out under it (or above
 * it, when there is no room below).
 *
 * It replaces the native select because the open list is the one part a
 * native control won't let the theme reach: a white Windows list opening out
 * of a dark panel. What the native one gave is kept: arrows, Home/End, Enter
 * or Space to choose, Escape and Tab to close, type-ahead, and
 * combobox/listbox semantics. The focus stays on the button throughout, so
 * the keys never escape to a dialog around it.
 *
 * Here the label is read out but not drawn: in Disq Studio the text beside a
 * dropdown already says what it's for.
 */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { mounted, closing } = usePresence(open);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Placement | null>(null);
  const typed = useRef({ text: "", at: 0 });
  const current = options.findIndex((o) => o.value === value);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const below = window.innerHeight - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    const wanted = Math.min(options.length * 34 + 14, 320);
    const up = below < Math.min(wanted, 160) && above > below;
    const listWidth = Math.max(r.width, listRef.current?.offsetWidth ?? 0);
    const left = Math.max(margin, Math.min(r.left, window.innerWidth - listWidth - margin));
    setPlace({
      left,
      top: up ? r.top - gap : r.bottom + gap,
      width: r.width,
      maxHeight: Math.max(96, Math.min(320, up ? above : below)),
      up,
      origin: `${r.left + r.width / 2 - left}px ${up ? "100%" : "0px"}`,
    });
  }, [options.length]);

  const show = useCallback(() => {
    if (disabled) return;
    setActive(Math.max(0, current));
    measure();
    setOpen(true);
  }, [current, disabled, measure]);

  const choose = (i: number) => {
    const o = options[i];
    setOpen(false);
    if (o && o.value !== value) onChange(o.value);
  };

  // Close when something outside is pressed, and follow the trigger while the page moves.
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!triggerRef.current?.contains(n) && !listRef.current?.contains(n)) setOpen(false);
    };
    const moved = (e: Event) => {
      if (e.type === "scroll" && listRef.current?.contains(e.target as Node)) return;
      measure();
    };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", moved);
    window.addEventListener("scroll", moved, true);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", moved);
      window.removeEventListener("scroll", moved, true);
    };
  }, [open, measure]);

  // Once the list exists its real width is known: place it again so it stays on screen.
  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = options.length;
    if (!n) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    // While the list is open the keys belong to it, not to a dialog around it.
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
      setOpen(false);
      return;
    }
    const move = (to: number) => {
      e.preventDefault();
      e.stopPropagation();
      setActive(Math.max(0, Math.min(n - 1, to)));
    };
    if (e.key === "ArrowDown") return move(active + 1);
    if (e.key === "ArrowUp") return move(active - 1);
    if (e.key === "Home" || e.key === "PageUp") return move(0);
    if (e.key === "End" || e.key === "PageDown") return move(n - 1);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      choose(active);
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.stopPropagation();
      const now = Date.now();
      typed.current = { text: (now - typed.current.at > 700 ? "" : typed.current.text) + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  const listId = `${id}-list`;
  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={cx("select-trigger", open && "is-open", className)}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        aria-activedescendant={open ? `${id}-o${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{options[current]?.label ?? ""}</span>
        <ChevronDown size={14} className="select-chevron" aria-hidden="true" />
      </button>
      {mounted &&
        place &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-hidden={closing || undefined}
            className={cx("menu", "select-menu", place.up && "is-up")}
            data-state={closing ? "closed" : "open"}
            style={
              {
                left: place.left,
                minWidth: place.width,
                maxHeight: place.maxHeight,
                "--origin": place.origin,
                ...(place.up ? { bottom: window.innerHeight - place.top } : { top: place.top }),
              } as CSSProperties & Record<"--origin", string>
            }
            // Keep the focus on the trigger, so the keyboard keeps working.
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((o, i) => (
              <div
                key={String(o.value)}
                id={`${id}-o${i}`}
                data-index={i}
                role="option"
                aria-selected={i === current}
                className={cx("menu-item", "select-option", i === active && "is-active", i === current && "is-chosen")}
                // Rows arrive a beat after the list, each a little after the one above.
                style={{ animationDelay: `${Math.min(i, 8) * 12}ms` }}
                onMouseEnter={() => setActive(i)}
                onClick={() => !closing && choose(i)}
              >
                <span className="menu-item-label">{o.label}</span>
                <span className="select-option-check">{i === current && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Keeps a list on screen long enough to animate out: React would remove it the
 * moment it closes. `closing` is true during the exit; opening again cancels it.
 */
function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [previous, setPrevious] = useState(open);
  if (open !== previous) {
    setPrevious(open);
    if (open) setMounted(true);
  }
  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), reducedMotion() ? 0 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);
  return { mounted: open || mounted, closing: !open && mounted };
}
