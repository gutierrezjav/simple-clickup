import {
  useEffectEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent
} from "react";
import { createPortal } from "react-dom";

interface TooltipPosition {
  left: number;
  top: number;
  placement: "top" | "bottom";
}

interface TooltipSize {
  width: number;
  height: number;
}

const tooltipDelayMs = 180;
const tooltipFadeMs = 120;
const tooltipGap = 8;
const tooltipViewportPadding = 12;

function getTooltipPosition(element: HTMLElement, tooltipSize?: TooltipSize): TooltipPosition {
  const rect = element.getBoundingClientRect();
  const tooltipHalfWidth = tooltipSize ? tooltipSize.width / 2 : 0;
  const minLeft = tooltipViewportPadding + tooltipHalfWidth;
  const maxLeft = window.innerWidth - tooltipViewportPadding - tooltipHalfWidth;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2, minLeft),
    Math.max(minLeft, maxLeft)
  );
  const topTooltipHeight = tooltipSize?.height ?? 40;
  const hasRoomAbove = rect.top - topTooltipHeight - tooltipGap > tooltipViewportPadding;

  return {
    left,
    placement: hasRoomAbove ? "top" : "bottom",
    top: hasRoomAbove ? rect.top - tooltipGap : rect.bottom + tooltipGap
  };
}

export function useVisibleTooltip<T extends HTMLElement>(label: string | undefined) {
  const id = useId();
  const ref = useRef<T | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const showTimerRef = useRef<number | undefined>(undefined);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isTargetActive, setIsTargetActive] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useEffectEvent(() => {
    const element = ref.current;
    if (!element) {
      setPosition(null);
      return;
    }

    const tooltipElement = tooltipRef.current;
    const tooltipSize = tooltipElement
      ? {
          height: tooltipElement.offsetHeight,
          width: tooltipElement.offsetWidth
        }
      : undefined;

    setPosition(getTooltipPosition(element, tooltipSize));
  });

  const showTooltip = () => {
    setIsTargetActive(true);

    if (!label) {
      return;
    }

    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(showTimerRef.current);
    showTimerRef.current = window.setTimeout(() => {
      updatePosition();
      setIsMounted(true);
    }, tooltipDelayMs);
  };

  const hideTooltip = () => {
    setIsTargetActive(false);
    window.clearTimeout(showTimerRef.current);
    setIsOpen(false);
    hideTimerRef.current = window.setTimeout(() => {
      setIsMounted(false);
    }, tooltipFadeMs);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(showTimerRef.current);
      window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!label) {
      window.clearTimeout(showTimerRef.current);
      setIsOpen(false);
      setIsMounted(false);
      return;
    }

    if (isTargetActive) {
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = window.setTimeout(() => {
        updatePosition();
        setIsMounted(true);
      }, tooltipDelayMs);
    }
  }, [isTargetActive, label]);

  useLayoutEffect(() => {
    if (!isMounted || !label) {
      return;
    }

    updatePosition();
    const animationFrame = window.requestAnimationFrame(() => {
      updatePosition();
      setIsOpen(true);
    });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isMounted, label]);

  const tooltip =
    isMounted && label && position
      ? createPortal(
          <span
            aria-hidden={!isOpen}
            className="visible-tooltip"
            data-placement={position.placement}
            data-visible={isOpen ? "true" : "false"}
            id={id}
            ref={tooltipRef}
            role="tooltip"
            style={{
              left: position.left,
              top: position.top
            }}
          >
            {label}
          </span>,
          document.body
        )
      : null;

  return {
    ref,
    tooltip,
    tooltipProps: {
      "aria-describedby": isOpen && label ? id : undefined,
      onBlur: (_event: FocusEvent<T>) => hideTooltip(),
      onFocus: (_event: FocusEvent<T>) => showTooltip(),
      onPointerEnter: (_event: PointerEvent<T>) => showTooltip(),
      onPointerLeave: (_event: PointerEvent<T>) => hideTooltip()
    }
  };
}
