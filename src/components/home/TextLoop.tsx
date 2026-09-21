"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";

import "./TextLoop.css";

const VIEW_W = 1200;
const VIEW_H = 180;
const CX = VIEW_W / 2;
const EDGE_PAD = 6;

type TextLoopShape = "wave" | "circle" | "infinity" | "arch" | "line";
type TextLoopDirection = "forward" | "reverse";

export type TextLoopProps = {
  text?: string;
  shape?: TextLoopShape;
  path?: string;
  speed?: number;
  direction?: TextLoopDirection;
  separator?: string;
  /** Non-breaking spaces around the separator (default 1). Use 0 for tighter mobile loops. */
  separatorPadding?: number;
  curviness?: number;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  color?: string;
  ribbon?: boolean;
  ribbonColor?: string;
  ribbonWidth?: number;
  pauseOnHover?: boolean;
  className?: string;
  style?: CSSProperties;
};

function buildPath(
  shape: TextLoopShape,
  curviness: number,
  ribbonWidth: number,
  viewH: number,
) {
  const c = Math.max(0, curviness);
  const cy = viewH / 2;
  const room = Math.max(20, cy - Math.max(0, ribbonWidth) / 2 - EDGE_PAD);

  switch (shape) {
    case "circle": {
      const r = Math.min(90 + c * 0.95, room);
      return `M ${CX - r} ${cy} A ${r} ${r} 0 1 1 ${CX + r} ${cy} A ${r} ${r} 0 1 1 ${CX - r} ${cy} Z`;
    }
    case "infinity": {
      const r = 150 + c * 1.4;
      const h = Math.min(60 + c * 0.95, room);
      return [
        `M ${CX} ${cy}`,
        `C ${CX + r * 0.55} ${cy - h} ${CX + r} ${cy - h} ${CX + r} ${cy}`,
        `C ${CX + r} ${cy + h} ${CX + r * 0.55} ${cy + h} ${CX} ${cy}`,
        `C ${CX - r * 0.55} ${cy - h} ${CX - r} ${cy - h} ${CX - r} ${cy}`,
        `C ${CX - r} ${cy + h} ${CX - r * 0.55} ${cy + h} ${CX} ${cy}`,
        "Z",
      ].join(" ");
    }
    case "arch": {
      const rise = Math.min(120 + c * 1.1, room * 2);
      return `M 120 ${cy + rise / 2} Q ${CX} ${cy - rise * 1.5} ${VIEW_W - 120} ${cy + rise / 2}`;
    }
    case "line":
      return `M -320 ${cy} L ${VIEW_W + 320} ${cy}`;
    default: {
      const a = Math.min(c * 2.2, room * 2);
      return `M -320 ${cy} Q -160 ${cy - a} 0 ${cy} T 320 ${cy} T 640 ${cy} T 960 ${cy} T 1280 ${cy} T ${VIEW_W + 320} ${cy}`;
    }
  }
}

export default function TextLoop({
  text = "React ✦ Bits",
  shape = "wave",
  path,
  speed = 90,
  direction = "forward",
  separator = "✦",
  separatorPadding = 1,
  curviness = 90,
  fontSize = 46,
  fontWeight = 800,
  letterSpacing = 2,
  uppercase = true,
  color = "#ffffff",
  ribbon = true,
  ribbonColor = "#5227FF",
  ribbonWidth = 86,
  pauseOnHover = true,
  className = "",
  style = {},
}: TextLoopProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const headRef = useRef<SVGTextPathElement>(null);
  const tailRef = useRef<SVGTextPathElement>(null);

  const [metrics, setMetrics] = useState({
    pathLength: 0,
    reps: 2,
    contentWidth: 0,
  });

  const rawId = useId();
  const pathId = `text-loop-${rawId.replace(/:/g, "")}`;

  const viewH = useMemo(() => {
    if (shape !== "line") return VIEW_H;
    return Math.ceil(Math.max(ribbonWidth, fontSize) + 8);
  }, [shape, ribbonWidth, fontSize]);

  const d = useMemo(
    () => path || buildPath(shape, curviness, ribbonWidth, viewH),
    [path, shape, curviness, ribbonWidth, viewH],
  );

  const unit = useMemo(() => {
    const base = uppercase ? String(text).toUpperCase() : String(text);
    const pad = "\u00A0".repeat(Math.max(0, separatorPadding));
    const gap = separator ? `${pad}${separator}${pad}` : "\u00A0\u00A0\u00A0";
    return `${base}${gap}`;
  }, [text, separator, separatorPadding, uppercase]);

  const textStyle = useMemo(
    () => ({
      fontSize: `${fontSize}px`,
      fontWeight,
      letterSpacing: `${letterSpacing}px`,
    }),
    [fontSize, fontWeight, letterSpacing],
  );

  useLayoutEffect(() => {
    const pathEl = pathRef.current;
    const measureEl = measureRef.current;
    if (!pathEl || !measureEl) return undefined;

    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      let pathLength = 0;
      let unitWidth = 0;
      try {
        pathLength = pathEl.getTotalLength();
        unitWidth = measureEl.getComputedTextLength();
      } catch {
        return;
      }
      if (!pathLength || !unitWidth) return;

      // Cover the path twice so head/tail can scroll seamlessly without stretching.
      const reps = Math.max(2, Math.ceil((pathLength * 2) / unitWidth) + 1);
      const contentWidth = unitWidth * reps;
      setMetrics((prev) =>
        prev.pathLength === pathLength &&
        prev.reps === reps &&
        prev.contentWidth === contentWidth
          ? prev
          : { pathLength, reps, contentWidth },
      );
    };

    measure();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [d, unit, fontSize, fontWeight, letterSpacing, separatorPadding]);

  useEffect(() => {
    const { contentWidth } = metrics;
    const head = headRef.current;
    const tail = tailRef.current;
    if (!head || !tail || !contentWidth) return undefined;

    const apply = (offset: number) => {
      // Keep copies adjacent by natural text width (not path length).
      const period = contentWidth;
      let normalized = offset % period;
      if (normalized < 0) normalized += period;
      head.setAttribute("startOffset", String(normalized));
      tail.setAttribute("startOffset", String(normalized - period));
    };

    apply(0);

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || speed <= 0) return undefined;

    const state = { offset: 0 };
    const tween = gsap.to(state, {
      offset: direction === "reverse" ? -contentWidth : contentWidth,
      duration: contentWidth / speed,
      ease: "none",
      repeat: -1,
      onUpdate: () => apply(state.offset),
    });

    const root = rootRef.current;
    const pause = () => tween.pause();
    const resume = () => tween.resume();

    if (pauseOnHover && root) {
      root.addEventListener("pointerenter", pause);
      root.addEventListener("pointerleave", resume);
    }

    return () => {
      tween.kill();
      if (pauseOnHover && root) {
        root.removeEventListener("pointerenter", pause);
        root.removeEventListener("pointerleave", resume);
      }
    };
  }, [metrics, speed, direction, pauseOnHover]);

  const loopText = unit.repeat(metrics.reps);

  return (
    <div
      ref={rootRef}
      className={`text-loop ${className}`.trim()}
      style={style}
    >
      <svg
        className="text-loop-svg"
        viewBox={`0 0 ${VIEW_W} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={text}
      >
        <path
          ref={pathRef}
          id={pathId}
          d={d}
          fill="none"
          stroke={ribbon ? ribbonColor : "none"}
          strokeWidth={ribbon ? ribbonWidth : 0}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text ref={measureRef} className="text-loop-measure" style={textStyle}>
          {unit}
        </text>

        <text
          className="text-loop-text"
          style={textStyle}
          fill={color}
          dominantBaseline="central"
        >
          <textPath ref={headRef} href={`#${pathId}`} startOffset={0}>
            {loopText}
          </textPath>
        </text>

        <text
          className="text-loop-text"
          style={textStyle}
          fill={color}
          dominantBaseline="central"
        >
          <textPath ref={tailRef} href={`#${pathId}`} startOffset={0}>
            {loopText}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
