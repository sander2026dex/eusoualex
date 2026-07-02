import { DtfImage, DtfPackedItem, DtfSheetResult, DtfPackResult, DtfSheetParams } from '../types/dtf';

// Conversion constants
export const DPI = 300;
export const CM_PER_INCH = 2.54;

/**
 * Converts centimeters to pixels at 300 DPI
 */
export function cmToPx(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * DPI);
}

/**
 * Converts pixels to centimeters at 300 DPI
 */
export function pxToCm(px: number): number {
  return (px / DPI) * CM_PER_INCH;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatCurrentDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safe slicing limit in centimeters to prevent browser Canvas memory crashes.
 * At 300 DPI, 250cm is 29,527 pixels. 56cm is 6,614 pixels.
 * 29,527 * 6,614 * 4 bytes (RGBA) = ~780MB raw image data in memory, which is a safe limit.
 */
export const MAX_CANVAS_SLICE_HEIGHT_CM = 250;

/**
 * Packs multiple items into sheets using an optimized Shelf/Guillotine algorithm.
 * Sorts items by height in descending order for maximum packing density.
 */
export function packDtfItems(
  images: DtfImage[],
  params: DtfSheetParams
): DtfPackResult {
  const { widthCm, heightCm, spacingMm, marginMm, autoNesting, autoHeight, allowRotation } = params;

  const spacingCm = spacingMm / 10;
  const marginCm = marginMm / 10;

  // Flatten the images list into individual item instances based on the requested quantities
  interface PackableItem {
    id: string;
    image: DtfImage;
    widthCm: number;
    heightCm: number;
    area: number;
  }

  const itemsToPack: PackableItem[] = [];
  let totalItemsRequested = 0;

  images.forEach((img) => {
    totalItemsRequested += img.quantity;
    for (let q = 0; q < img.quantity; q++) {
      itemsToPack.push({
        id: `${img.id}_copy_${q}`,
        image: img,
        widthCm: img.printWidthCm,
        heightCm: img.printHeightCm,
        area: img.printWidthCm * img.printHeightCm,
      });
    }
  });

  // Calculate slice heights. If autoHeight is active, we pack everything into one continuous sheet first.
  const effHeightCm = autoHeight ? 100000 : heightCm;
  const sliceHeightCm = autoHeight ? 100000 : Math.min(effHeightCm, MAX_CANVAS_SLICE_HEIGHT_CM);
  const totalSlicesInJob = autoHeight ? 1 : Math.ceil(effHeightCm / sliceHeightCm);

  // If auto-nesting is disabled, we do a simple grid/stack layout
  if (!autoNesting) {
    const res = packSimpleGrid(itemsToPack, widthCm, sliceHeightCm, totalSlicesInJob, spacingCm, marginCm, totalItemsRequested);
    if (autoHeight && res.sheets.length > 0) {
      const sheet = res.sheets[0];
      const maxItemY = sheet.items.reduce((max, item) => Math.max(max, item.yCm + item.heightCm), 0);
      const computedHeight = maxItemY > 0 ? parseFloat((maxItemY + marginCm).toFixed(1)) : 20;
      sheet.heightCm = computedHeight;
    }
    return res;
  }

  // Sort items by height (descending) to optimize shelf packing density
  itemsToPack.sort((a, b) => b.heightCm - a.heightCm);

  const sheets: DtfSheetResult[] = Array.from({ length: totalSlicesInJob }).map((_, idx) => ({
    sheetIndex: idx,
    widthCm,
    heightCm: sliceHeightCm,
    items: [],
    efficiency: 0,
  }));

  const unpackedItems: { image: DtfImage; count: number }[] = [];

  // Shelf structure for each sheet:
  // Each shelf has a y-coordinate, a height, and a current x-cursor
  interface Shelf {
    y: number;
    height: number;
    xCursor: number;
  }

  const sheetShelves: Shelf[][] = Array.from({ length: totalSlicesInJob }).map(() => []);

  for (const item of itemsToPack) {
    let packed = false;

    // Try to pack in each sheet slice in order
    for (let sheetIdx = 0; sheetIdx < totalSlicesInJob; sheetIdx++) {
      const sheet = sheets[sheetIdx];
      const shelves = sheetShelves[sheetIdx];

      // We consider standard and rotated 90 degrees if allowRotation is true
      const orientations = [
        { w: item.widthCm, h: item.heightCm, rotated: false },
      ];
      if (allowRotation) {
        orientations.push({ w: item.heightCm, h: item.widthCm, rotated: true });
      }

      // If rotation is not needed or doesn't change dimensions, just use standard
      if (orientations.length > 1 && Math.abs(item.widthCm - item.heightCm) < 1e-4) {
        orientations.pop();
      }

      for (const orient of orientations) {
        const itemW = orient.w;
        const itemH = orient.h;

        // Check if item exceeds usable width/height of the sheet
        const usableWidth = widthCm - 2 * marginCm;
        const usableHeight = sliceHeightCm - 2 * marginCm;

        if (itemW > usableWidth || itemH > usableHeight) {
          continue; // Doesn't fit in this orientation on any shelf
        }

        // Try to place on an existing shelf
        for (const shelf of shelves) {
          // Check if shelf has enough vertical space for this item and if it fits horizontally
          if (itemH <= shelf.height && shelf.xCursor + itemW <= usableWidth) {
            // Found a fit! Place item on this shelf
            const finalX = marginCm + shelf.xCursor;
            const finalY = marginCm + shelf.y;

            sheet.items.push({
              id: item.id,
              image: item.image,
              xCm: finalX,
              yCm: finalY,
              widthCm: itemW,
              heightCm: itemH,
              isRotated: orient.rotated,
              sheetIndex: sheetIdx,
            });

            shelf.xCursor += itemW + spacingCm;
            packed = true;
            break;
          }
        }

        if (packed) break;

        // If no existing shelf could host it, try to create a new shelf on this sheet
        let currentShelvesHeight = shelves.reduce((sum, s) => sum + s.height + spacingCm, 0);
        if (currentShelvesHeight + itemH <= usableHeight) {
          const newShelfY = currentShelvesHeight;
          const newShelf: Shelf = {
            y: newShelfY,
            height: itemH,
            xCursor: itemW + spacingCm,
          };

          shelves.push(newShelf);

          const finalX = marginCm;
          const finalY = marginCm + newShelfY;

          sheet.items.push({
            id: item.id,
            image: item.image,
            xCm: finalX,
            yCm: finalY,
            widthCm: orient.w,
            heightCm: orient.h,
            isRotated: orient.rotated,
            sheetIndex: sheetIdx,
          });

          packed = true;
          break;
        }
      }

      if (packed) break;
    }

    if (!packed) {
      // Could not pack on any sheet slice (run out of space!)
      const existing = unpackedItems.find((ui) => ui.image.id === item.image.id);
      if (existing) {
        existing.count++;
      } else {
        unpackedItems.push({ image: item.image, count: 1 });
      }
    }
  }

  // Adjust dynamic height if autoHeight is active
  if (autoHeight && sheets.length > 0) {
    const sheet = sheets[0];
    const maxItemY = sheet.items.reduce((max, item) => Math.max(max, item.yCm + item.heightCm), 0);
    const computedHeight = maxItemY > 0 ? parseFloat((maxItemY + marginCm).toFixed(1)) : 20;
    sheet.heightCm = computedHeight;
  }

  // Calculate efficiencies for each sheet
  sheets.forEach((sheet) => {
    const usableArea = (widthCm - 2 * marginCm) * (sheet.heightCm - 2 * marginCm);
    const filledArea = sheet.items.reduce((sum, item) => sum + (item.widthCm * item.heightCm), 0);
    sheet.efficiency = usableArea > 0 ? Math.min(100, Math.round((filledArea / usableArea) * 100)) : 0;
  });

  const totalPacked = sheets.reduce((sum, s) => sum + s.items.length, 0);

  return {
    sheets,
    unpackedItems,
    totalSheets: sheets.length,
    totalItemsPacked: totalPacked,
    totalItemsRequested,
  };
}

/**
 * Fallback layout when auto-nesting is disabled: Simple sequential flow layout (Grid-like)
 */
function packSimpleGrid(
  items: { id: string; image: DtfImage; widthCm: number; heightCm: number }[],
  widthCm: number,
  sliceHeightCm: number,
  totalSlices: number,
  spacingCm: number,
  marginCm: number,
  totalItemsRequested: number
): DtfPackResult {
  const sheets: DtfSheetResult[] = Array.from({ length: totalSlices }).map((_, idx) => ({
    sheetIndex: idx,
    widthCm,
    heightCm: sliceHeightCm,
    items: [],
    efficiency: 0,
  }));

  const unpackedItems: { image: DtfImage; count: number }[] = [];

  let currentSheetIdx = 0;
  let currentX = marginCm;
  let currentY = marginCm;
  let shelfHeight = 0;

  for (const item of items) {
    const usableWidth = widthCm - 2 * marginCm;
    const usableHeight = sliceHeightCm - 2 * marginCm;

    // Check if the item can fit in the sheet margins at all
    if (item.widthCm > usableWidth || item.heightCm > usableHeight) {
      const existing = unpackedItems.find((ui) => ui.image.id === item.image.id);
      if (existing) existing.count++;
      else unpackedItems.push({ image: item.image, count: 1 });
      continue;
    }

    // Check if we need to wrap to the next row (shelf)
    if (currentX + item.widthCm > marginCm + usableWidth) {
      currentX = marginCm;
      currentY += shelfHeight + spacingCm;
      shelfHeight = 0;
    }

    // Check if we need to wrap to the next sheet slice
    if (currentY + item.heightCm > marginCm + usableHeight) {
      currentSheetIdx++;
      currentX = marginCm;
      currentY = marginCm;
      shelfHeight = 0;
    }

    if (currentSheetIdx >= totalSlices) {
      // Exceeded total slices budget
      const existing = unpackedItems.find((ui) => ui.image.id === item.image.id);
      if (existing) existing.count++;
      else unpackedItems.push({ image: item.image, count: 1 });
      continue;
    }

    const sheet = sheets[currentSheetIdx];
    sheet.items.push({
      id: item.id,
      image: item.image,
      xCm: currentX,
      yCm: currentY,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      isRotated: false,
      sheetIndex: currentSheetIdx,
    });

    shelfHeight = Math.max(shelfHeight, item.heightCm);
    currentX += item.widthCm + spacingCm;
  }

  // Calculate efficiencies
  sheets.forEach((sheet) => {
    const usableArea = (widthCm - 2 * marginCm) * (sliceHeightCm - 2 * marginCm);
    const filledArea = sheet.items.reduce((sum, item) => sum + (item.widthCm * item.heightCm), 0);
    sheet.efficiency = usableArea > 0 ? Math.min(100, Math.round((filledArea / usableArea) * 100)) : 0;
  });

  const totalPacked = sheets.reduce((sum, s) => sum + s.items.length, 0);

  return {
    sheets,
    unpackedItems,
    totalSheets: sheets.length,
    totalItemsPacked: totalPacked,
    totalItemsRequested,
  };
}

/**
 * Loads an image URL into an HTMLImageElement
 */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Draws a single virtual sheet slice onto an offscreen canvas and returns it as a Blob/DataURL
 */
export async function renderSheetToCanvas(
  sheet: DtfSheetResult,
  params: DtfSheetParams,
  drawGuidelines = false
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const widthPx = cmToPx(sheet.widthCm);
  const heightPx = cmToPx(sheet.heightCm);

  canvas.width = widthPx;
  canvas.height = heightPx;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  // Fill Background - High Contrast transparent or white for DTF transfer output
  // Standard DTF prints require transparent background. For rendering export, let's keep it transparent,
  // but let's give a subtle background grid pattern in the UI preview only.
  ctx.clearRect(0, 0, widthPx, heightPx);

  // Draw margins and guidelines if requested
  if (drawGuidelines) {
    const marginPx = cmToPx(params.marginMm / 10);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)'; // Cyan
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 10]);
    ctx.strokeRect(marginPx, marginPx, widthPx - 2 * marginPx, heightPx - 2 * marginPx);
  }

  // Load and render all packed images
  for (const item of sheet.items) {
    try {
      const imgElement = await loadImageElement(item.image.url);
      
      const xPx = cmToPx(item.xCm);
      const yPx = cmToPx(item.yCm);
      const wPx = cmToPx(item.widthCm);
      const hPx = cmToPx(item.heightCm);

      ctx.save();
      
      if (item.isRotated) {
        // Handle 90 degrees rotation around center
        ctx.translate(xPx + wPx / 2, yPx + hPx / 2);
        ctx.rotate(Math.PI / 2);
        // Drawing the original aspect ratio rotated
        ctx.drawImage(imgElement, -hPx / 2, -wPx / 2, hPx, wPx);
      } else {
        ctx.drawImage(imgElement, xPx, yPx, wPx, hPx);
      }

      ctx.restore();
    } catch (err) {
      console.error(`Failed to render item ${item.id}:`, err);
    }
  }

  return canvas;
}
