"use client";

import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { useRef, useState } from "react";

const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)",
  backgroundSize: "20px 20px",
  backgroundColor: "#fafafa",
};

const ZOOM_LEVELS = [25, 50, 75, 100, 150, 200] as const;

export function InfiniteCanvas() {
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const [currentZoom, setCurrentZoom] = useState(100);

  const handleZoomTo = (percent: number) => {
    transformRef.current?.centerView(percent / 100, 200);
  };

  const ruler = (
    <div className="absolute bottom-4 right-4 z-10 flex gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 shadow">
      {ZOOM_LEVELS.map((level) => (
        <button
          key={level}
          onClick={() => handleZoomTo(level)}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
            currentZoom === level
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:text-neutral-900"
          }`}
        >
          {level}
        </button>
      ))}
    </div>
  );

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
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        onTransform={(_ref, state) => setCurrentZoom(Math.round(state.scale * 100))}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "10000px", height: "10000px", position: "relative" }}
        >
          <div className="h-full w-full" style={DOT_PATTERN} />
        </TransformComponent>
      </TransformWrapper>
      {ruler}
    </div>
  );
}