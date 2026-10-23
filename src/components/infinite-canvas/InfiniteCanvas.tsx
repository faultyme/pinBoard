"use client";

import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { useRef, useState } from "react";

const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, var(--canvas-dot, #d4d4d4) 1px, transparent 1px)",
  backgroundSize: "20px 20px",
  backgroundColor: "var(--canvas-bg, #fafafa)",
};

const ZOOM_LEVELS = [ 50, 75, 100, 150, 200] as const;

export function InfiniteCanvas() {
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const [currentZoom, setCurrentZoom] = useState(100);

  const handleZoomTo = (percent: number) => {
    transformRef.current?.centerView(percent / 100, 200);
  };

  const getClosestLevel = (zoom: number) => {
    let closest: number = ZOOM_LEVELS[0];
    let minDiff = Math.abs(zoom - closest);
    
    ZOOM_LEVELS.forEach((level) => {
      const diff = Math.abs(zoom - level);
      if (diff < minDiff) {
        minDiff = diff;
        closest = level;
      }
    });
    
    return closest;
  };

  const activeLevel = getClosestLevel(currentZoom);

  return (
    <div className="relative h-screen w-screen cursor-grab overflow-hidden">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.25}
        maxScale={2}
        centerOnInit
        limitToBounds
        disablePadding
        centerZoomedOut={false}
        wheel={{ step: 0.15 }}
        doubleClick={{ disabled: true }}
        onTransform={(_ref, state) => setCurrentZoom(state.scale * 100)}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "10000px", height: "10000px", position: "relative" }}
        >
          <div className="h-full w-full" style={DOT_PATTERN} />
        </TransformComponent>
      </TransformWrapper>

      <div 
        className="absolute bottom-4 right-4 z-10 flex gap-1 rounded-lg border px-2 py-1 shadow-sm backdrop-blur-md"
        style={{
          backgroundColor: "color-mix(in srgb, var(--ui-surface, #ffffff) 85%, transparent)",
          borderColor: "var(--ui-border, #e5e5e5)",
        }}
      >
        {ZOOM_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => handleZoomTo(level)}
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
              activeLevel === level
                ? "bg-brand-blue text-white"
                : "text-app-text-muted hover:text-app-text"
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}