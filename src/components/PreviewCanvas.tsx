import React, { useRef, useEffect, useState } from 'react';
import { NestingResult, Artwork, NestedItem } from '../types';
import { transformPoint } from '../utils/exporter';
import { ZoomIn, ZoomOut, Maximize, Move, HelpCircle } from 'lucide-react';

interface PreviewCanvasProps {
  result: NestingResult;
  artwork: Artwork | null;
}

export default function PreviewCanvas({ result, artwork }: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(5); // pixels per cm
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const { filmWidthCm, filmHeightCm, items } = result;

  // Fit to container on load or size changes
  const fitToView = () => {
    if (!canvasRef.current || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    // We want the film to fit inside the viewport with some padding (e.g. 40px)
    const padding = 60;
    const availableW = cw - padding * 2;
    const availableH = ch - padding * 2;

    const zoomW = availableW / (filmWidthCm || 1);
    // If filmHeightCm is 0, default to some reasonable aspect ratio
    const fHeight = filmHeightCm > 0 ? filmHeightCm : 100;
    const zoomH = availableH / fHeight;

    const newZoom = Math.min(zoomW, zoomH, 15); // cap zoom max at 15px/cm
    setZoom(newZoom);

    // Center the film
    const offsetX = (cw - filmWidthCm * newZoom) / 2;
    const offsetY = padding;
    setOffset({ x: offsetX, y: offsetY });
  };

  useEffect(() => {
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmWidthCm, filmHeightCm]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      fitToView();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [filmWidthCm, filmHeightCm]);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on container sizes
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    canvas.width = width;
    canvas.height = height;

    // Clear background (Plotter interface color: soft dark gray or light cutting board grid)
    ctx.fillStyle = '#F8FAFC'; // Light, professional background
    ctx.fillRect(0, 0, width, height);

    // DRAW GRID ON THE WORKSPACE (not on the film)
    drawBackgroundGrid(ctx, width, height);

    // Draw the actual VINYL ROLL (The film canvas)
    // 1 cm = zoom pixels
    const filmW = filmWidthCm * zoom;
    const filmH = (filmHeightCm || 50) * zoom;
    const filmX = offset.x;
    const filmY = offset.y;

    // Film Background Shadow
    ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;

    // Film Roll Base Sheet
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(filmX, filmY, filmW, filmH);

    // Reset shadow for subsequent drawings
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Film Border Outline
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(filmX, filmY, filmW, filmH);

    // DRAW GRID INSIDE THE FILM (Grid of 5cm squares, subtle dot pattern)
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    for (let gx = 5; gx < filmWidthCm; gx += 5) {
      ctx.beginPath();
      ctx.moveTo(filmX + gx * zoom, filmY);
      ctx.lineTo(filmX + gx * zoom, filmY + filmH);
      ctx.stroke();
    }
    for (let gy = 5; gy < filmHeightCm; gy += 5) {
      ctx.beginPath();
      ctx.moveTo(filmX, filmY + gy * zoom);
      ctx.lineTo(filmX + filmW, filmY + gy * zoom);
      ctx.stroke();
    }

    // DRAW THE CUTTING LOGOS/ARTWORKS
    if (artwork && items.length > 0) {
      ctx.strokeStyle = '#000000'; // Black outline (Plotter Cut Color)
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      items.forEach((item) => {
        artwork.paths.forEach((path) => {
          if (path.points.length < 2) return;

          ctx.beginPath();
          // Transform first point
          const p0 = transformPoint(
            path.points[0].x,
            path.points[0].y,
            artwork.viewBox,
            artwork.widthCm,
            artwork.heightCm,
            item
          );

          // Map cm on film to canvas pixel coordinates
          ctx.moveTo(filmX + p0.x * zoom, filmY + p0.y * zoom);

          for (let i = 1; i < path.points.length; i++) {
            const pt = transformPoint(
              path.points[i].x,
              path.points[i].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            ctx.lineTo(filmX + pt.x * zoom, filmY + pt.y * zoom);
          }

          if (path.isClosed) {
            ctx.closePath();
          }
          ctx.stroke();

          // Subtle visual fill for the cut lines so they look premium and solid
          ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
          ctx.fill();
        });
      });
    }

    // DRAW RULERS & DIMENSIONS LABELS
    drawDimensionsAndLabels(ctx, filmX, filmY, filmW, filmH);
  }, [zoom, offset, items, artwork, filmWidthCm, filmHeightCm]);

  const drawBackgroundGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 0.5;
    const gridSpacing = 40;
    for (let x = 0; x < w; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  };

  const drawDimensionsAndLabels = (
    ctx: CanvasRenderingContext2D,
    fx: number,
    fy: number,
    fw: number,
    fh: number
  ) => {
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748B';

    // 1. Draw film width label (horizontal)
    const midX = fx + fw / 2;
    ctx.textAlign = 'center';
    ctx.fillText(`${filmWidthCm} cm`, midX, fy - 12);

    // Horizontal arrow/dimension lines
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // left notch
    ctx.moveTo(fx, fy - 18);
    ctx.lineTo(fx, fy - 12);
    // right notch
    ctx.moveTo(fx + fw, fy - 18);
    ctx.lineTo(fx + fw, fy - 12);
    // main line
    ctx.moveTo(fx, fy - 15);
    ctx.lineTo(fx + fw, fy - 15);
    ctx.stroke();

    // 2. Draw film length label (vertical on the left)
    const midY = fy + fh / 2;
    ctx.save();
    ctx.translate(fx - 15, midY);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${(filmHeightCm / 100).toFixed(2)} m (${filmHeightCm} cm)`, 0, -4);
    ctx.restore();

    // Vertical arrow/dimension lines
    ctx.beginPath();
    // top notch
    ctx.moveTo(fx - 22, fy);
    ctx.lineTo(fx - 16, fy);
    // bottom notch
    ctx.moveTo(fx - 22, fy + fh);
    ctx.lineTo(fx - 16, fy + fh);
    // main line
    ctx.moveTo(fx - 19, fy);
    ctx.lineTo(fx - 19, fy + fh);
    ctx.stroke();

    // 3. Draw Cut plotter margin indicators
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)'; // indigo dotted line for plotter guides
    ctx.setLineDash([3, 4]);
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.setLineDash([]); // reset
  };

  // MOUSE EVENTS FOR PANNING
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // WHEEL SCROLL ZOOM
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.5, Math.min(60, zoom * zoomFactor));
    
    // We want to zoom into the mouse cursor position
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate mouse position in "film" centimeters before zoom
    const cmX = (mouseX - offset.x) / zoom;
    const cmY = (mouseY - offset.y) / zoom;

    setZoom(newZoom);
    // Adjust offset to keep mouse position anchored
    setOffset({
      x: mouseX - cmX * newZoom,
      y: mouseY - cmY * newZoom,
    });
  };

  const adjustZoom = (factor: number) => {
    const newZoom = Math.max(0.5, Math.min(60, zoom * factor));
    setZoom(newZoom);
  };

  return (
    <div className="flex-1 min-h-[500px] flex flex-col relative bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
      {/* Top action/info bar */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-100 shadow-xs flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-bold text-slate-700">Pré-visualização 100% Real</span>
      </div>

      {/* Rulers / Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full flex-1 cursor-grab active:cursor-grabbing relative overflow-hidden"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Floating control buttons */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => adjustZoom(1.2)}
          className="p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/80 shadow-xs text-slate-600 hover:text-indigo-600 transition-colors"
          title="Aumentar Zoom"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => adjustZoom(0.8)}
          className="p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/80 shadow-xs text-slate-600 hover:text-indigo-600 transition-colors"
          title="Diminuir Zoom"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={fitToView}
          className="p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/80 shadow-xs text-slate-600 hover:text-indigo-600 transition-colors"
          title="Ajustar à Tela"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Guide Indicator */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-2 max-w-xs text-[10px] text-slate-500">
        <Move className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <span>Use o mouse para <b>Arrastar/Mover</b> e a rodinha (scroll) para <b>Zoom</b></span>
      </div>
    </div>
  );
}
