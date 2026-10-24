"use client";

import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { useEffect, useRef, useState, useCallback } from "react";
import { ClickableImage } from "@/lib/neondb/schemas";

const DOT_PATTERN: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, var(--color-app-dot) 1px, transparent 1px)",
  backgroundSize: "20px 20px",
  backgroundColor: "var(--color-app-bg)",
};

const ZOOM_LEVELS = [50, 75, 100, 150, 200, 400, 500] as const;
const CANVAS_SIZE = 10000;
const IMAGE_WIDTH = 320;
const DEFAULT_SIZE = 320;
const MIN_SIZE = 80;
const MAX_SIZE = 2000;

export function InfiniteCanvas() {
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [currentZoom, setCurrentZoom] = useState(100);
  const [images, setImages] = useState<ClickableImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Track transform state locally (library doesn't expose transformState on instance)
  const [transformState, setTransformState] = useState({
    scale: 1,
    positionX: 0,
    positionY: 0,
  });

  const dragCounter = useRef(0);

  // Load existing images on mount
  useEffect(() => {
    fetch("/api/images")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => Array.isArray(rows) && setImages(rows))
      .catch(() => {});
  }, []);

  const handleZoomTo = (percent: number) => {
    transformRef.current?.centerView(percent / 100, 200);
  };

  // Snap zoom value to the closest preset for active button highlighting
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

  // Convert screen (clientX/Y) coords to canvas content coords.
  // Inverse of: screen = content * scale + translate
  const screenToCanvas = (clientX: number, clientY: number) => {
    const el = wrapperRef.current;
    if (!el) return { x: 0, y: 0 };

    const rect = el.getBoundingClientRect();
    const { scale, positionX, positionY } = transformState;

    return {
      x: (clientX - rect.left - positionX) / scale,
      y: (clientY - rect.top - positionY) / scale,
    };
  };

  // Upload a single file — POSTs to /api/images with file + target coords
  const uploadFile = useCallback(
    async (file: File, clientX: number, clientY: number) => {
      if (!file.type.startsWith("image/")) return;
      setUploading(true);
      try {
        const pos = screenToCanvas(clientX, clientY);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("x", String(Math.round(pos.x)));
        fd.append("y", String(Math.round(pos.y)));
        fd.append("width", String(DEFAULT_SIZE));
        fd.append("height", String(DEFAULT_SIZE));

        const res = await fetch("/api/images", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");

        const row: ClickableImage = await res.json();
        setImages((prev) => [...prev, row]);
      } catch (e) {
        console.error(e);
        alert("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [transformState] // depends on transformState for coordinate math
  );

  const handleFiles = useCallback(
    (files: FileList | null, clientX: number, clientY: number) => {
      if (!files) return;
      Array.from(files).forEach((f) => uploadFile(f, clientX, clientY));
    },
    [uploadFile]
  );

  // Paste handler — pastes at viewport center
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const rect = wrapperRef.current?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : 0;
      const cy = rect ? rect.top + rect.height / 2 : 0;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) uploadFile(file, cx, cy);
        }
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploadFile]);

  // Drag & drop — counter prevents flicker from child enter/leave events
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    handleFiles(e.dataTransfer.files, e.clientX, e.clientY);
  };

  // ---------- persistence helpers ----------
  const patchImage = useCallback(
    async (id: string, patch: Partial<ClickableImage>) => {
      // optimistic update
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...patch } : img))
      );
      try {
        const res = await fetch(`/api/images?id=${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("Update failed");
      } catch (e) {
        console.error(e);
      }
    },
    []
  );

  const deleteImage = useCallback(async (id: string) => {
    if (!confirm("Delete this image?")) return;
    setImages((prev) => prev.filter((img) => img.id !== id));
    try {
      await fetch(`/api/images?id=${id}`, { method: "DELETE" });
    } catch (e) {
      console.error(e);
    }
  }, []);

  // ---------- image drag (move) ----------
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null
  );

  const startMove = (e: React.PointerEvent, img: ClickableImage) => {
    e.stopPropagation();
    e.preventDefault();

    const startPointer = screenToCanvas(e.clientX, e.clientY);
    const offsetX = startPointer.x - img.position.x;
    const offsetY = startPointer.y - img.position.y;
    setDragOffset({ x: offsetX, y: offsetY });

    const onMove = (ev: PointerEvent) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const newPos = {
        x: Math.round(p.x - offsetX),
        y: Math.round(p.y - offsetY),
      };
      setImages((prev) =>
        prev.map((it) =>
          it.id === img.id ? { ...it, position: newPos } : it
        )
      );
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragOffset(null);
      const p = screenToCanvas(ev.clientX, ev.clientY);
      void patchImage(img.id, {
        position: {
          x: Math.round(p.x - offsetX),
          y: Math.round(p.y - offsetY),
        },
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ---------- image resize ----------
  const startResize = (e: React.PointerEvent, img: ClickableImage) => {
    e.stopPropagation();
    e.preventDefault();

    const start = screenToCanvas(e.clientX, e.clientY);
    const startW = img.width;
    const startH = img.height;

    const onMove = (ev: PointerEvent) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const dx = p.x - start.x;
      const newW = Math.max(
        MIN_SIZE,
        Math.min(MAX_SIZE, Math.round(startW + dx))
      );
      const newH = Math.round((newW / startW) * startH);
      setImages((prev) =>
        prev.map((it) =>
          it.id === img.id ? { ...it, width: newW, height: newH } : it
        )
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setImages((prev) => {
        const cur = prev.find((it) => it.id === img.id);
        if (cur) {
          void patchImage(img.id, { width: cur.width, height: cur.height });
        }
        return prev;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={wrapperRef}
      className="relative h-dvh w-full cursor-grab overflow-hidden"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.5}
        maxScale={5}
        centerOnInit
        limitToBounds
        disablePadding
        centerZoomedOut={false}
        wheel={{ step: 0.15 }}
        doubleClick={{ disabled: true }}
        panning={{ disabled: dragOffset !== null }}
        // Sync zoom UI + transform state used for coordinate math
        onTransform={(_ref, state) => {
          setCurrentZoom(state.scale * 100);
          setTransformState({
            scale: state.scale,
            positionX: state.positionX,
            positionY: state.positionY,
          });
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{
            width: `${CANVAS_SIZE}px`,
            height: `${CANVAS_SIZE}px`,
            position: "relative",
          }}
        >
          <div className="h-full w-full" style={DOT_PATTERN}>
            {images.map((img) => (
              <div
                key={img.id}
                className="group absolute"
                style={{
                  left: img.position.x,
                  top: img.position.y,
                  width: img.width,
                  height: img.height,
                }}
              >
                <img
                  src={img.coverImage}
                  alt={img.title}
                  draggable={false}
                  onPointerDown={(e) => startMove(e, img)}
                  className="h-full w-full cursor-move select-none rounded-lg object-cover shadow-md"
                />

                {/* hover controls */}
                <div className="absolute -top-2 right-0 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(img.id === editingId ? null : img.id);
                    }}
                    className="rounded bg-white px-2 py-0.5 text-xs shadow"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteImage(img.id);
                    }}
                    className="rounded bg-red-500 px-2 py-0.5 text-xs text-white shadow"
                  >
                    Delete
                  </button>
                </div>

                {/* resize handle (bottom-right) */}
                <div
                  onPointerDown={(e) => startResize(e, img)}
                  className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-sm bg-white opacity-0 shadow group-hover:opacity-100"
                />

                {/* edit popup */}
                {editingId === img.id && (
                  <EditPopup
                    img={img}
                    onClose={() => setEditingId(null)}
                    onSave={(patch) => {
                      void patchImage(img.id, patch);
                      setEditingId(null);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Drop overlay shown while dragging files over canvas */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-brand-blue/10">
          <div className="rounded-lg border-2 border-dashed border-brand-blue bg-white/80 px-6 py-4 text-sm font-medium text-brand-blue">
            Drop image to upload
          </div>
        </div>
      )}

      {/* Upload in-flight indicator */}
      {uploading && (
        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white">
          Uploading…
        </div>
      )}

      {/* Zoom preset bar */}
      <div
        className="absolute bottom-4 right-4 z-10 flex gap-1 rounded-lg border px-2 py-1 shadow-sm backdrop-blur-md"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-app-surface) 85%, transparent)",
          borderColor: "var(--color-app-border)",
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

// ---------------------------------------------------------------------------
// Edit popup rendered below an image
// ---------------------------------------------------------------------------
function EditPopup({
  img,
  onClose,
  onSave,
}: {
  img: ClickableImage;
  onClose: () => void;
  onSave: (patch: Partial<ClickableImage>) => void;
}) {
  const [title, setTitle] = useState(img.title);
  const [link, setLink] = useState(img.link ?? "");
  const [keywords, setKeywords] = useState(img.keywords.join(", "));

  return (
    <div
      className="absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border bg-white p-3 shadow-lg"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="mb-1 block text-xs font-medium">Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
      />

      <label className="mb-1 block text-xs font-medium">Link</label>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://..."
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
      />

      <label className="mb-1 block text-xs font-medium">Keywords</label>
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="comma, separated"
        className="mb-3 w-full rounded border px-2 py-1 text-sm"
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded border px-3 py-1 text-xs"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              title,
              link: link || null,
              keywords: keywords
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="rounded bg-brand-blue px-3 py-1 text-xs text-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}