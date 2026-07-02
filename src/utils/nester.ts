import { NestingParams, NestingResult, NestedItem } from '../types';

/**
 * Calculates the optimal layout for vinyl cutting.
 * Compares normal vs rotated packing and selects the one with the shortest total height (highest efficiency).
 */
export function calculateNesting(params: NestingParams): NestingResult {
  const {
    artworkWidthCm,
    artworkHeightCm,
    quantity,
    spacingMm,
    marginMm,
    filmWidthType,
    customFilmWidthCm,
    allowRotation,
  } = params;

  // Convert inputs to cm
  const spacingCm = spacingMm / 10;
  const marginCm = marginMm / 10;

  // Determine film width
  let filmWidthCm = 28;
  if (filmWidthType === '56') {
    filmWidthCm = 56;
  } else if (filmWidthType === 'custom') {
    filmWidthCm = customFilmWidthCm;
  }

  const usableWidthCm = filmWidthCm - 2 * marginCm;

  if (usableWidthCm <= 0) {
    return {
      items: [],
      filmWidthCm,
      filmHeightCm: 0,
      piecesPerRow: 0,
      totalRows: 0,
      efficiency: 0,
      waste: 100,
    };
  }

  // Option 1: Normal layout (no individual item rotation)
  const layoutNormal = getRowLayout(
    artworkWidthCm,
    artworkHeightCm,
    quantity,
    usableWidthCm,
    spacingCm,
    marginCm,
    0 // 0 degrees
  );

  // Option 2: Rotated layout (all items rotated 90 deg)
  let layoutRotated: ReturnType<typeof getRowLayout> | null = null;
  if (allowRotation && artworkHeightCm <= usableWidthCm) {
    layoutRotated = getRowLayout(
      artworkHeightCm,
      artworkWidthCm,
      quantity,
      usableWidthCm,
      spacingCm,
      marginCm,
      90 // 90 degrees
    );
  }

  // Select the layout that uses the least height (i.e. shortest film length)
  let bestLayout = layoutNormal;
  if (layoutRotated && layoutRotated.totalHeight < layoutNormal.totalHeight) {
    bestLayout = layoutRotated;
  }

  // Calculate efficiency
  // Total area of the pieces
  const pieceArea = artworkWidthCm * artworkHeightCm;
  const totalPiecesArea = pieceArea * quantity;
  
  // Total area of the film used
  const totalFilmArea = filmWidthCm * bestLayout.totalHeight;
  
  const efficiency = totalFilmArea > 0 ? Math.min(100, (totalPiecesArea / totalFilmArea) * 100) : 0;
  const waste = Math.max(0, 100 - efficiency);

  return {
    items: bestLayout.items,
    filmWidthCm,
    filmHeightCm: parseFloat(bestLayout.totalHeight.toFixed(2)),
    piecesPerRow: bestLayout.piecesPerRow,
    totalRows: bestLayout.totalRows,
    efficiency: parseFloat(efficiency.toFixed(1)),
    waste: parseFloat(waste.toFixed(1)),
  };
}

interface RowLayoutResult {
  items: NestedItem[];
  totalHeight: number;
  piecesPerRow: number;
  totalRows: number;
}

function getRowLayout(
  itemW: number,
  itemH: number,
  qty: number,
  usableW: number,
  spacing: number,
  margin: number,
  rotation: number
): RowLayoutResult {
  // Calculate how many items fit in a row
  // We need space for: n * itemW + (n - 1) * spacing <= usableW
  // n * itemW + n * spacing - spacing <= usableW
  // n * (itemW + spacing) <= usableW + spacing
  const piecesPerRow = Math.max(1, Math.floor((usableW + spacing) / (itemW + spacing)));
  
  const totalRows = Math.ceil(qty / piecesPerRow);
  const items: NestedItem[] = [];

  for (let i = 0; i < qty; i++) {
    const row = Math.floor(i / piecesPerRow);
    const col = i % piecesPerRow;

    const x = margin + col * (itemW + spacing);
    const y = margin + row * (itemH + spacing);

    items.push({
      id: `item-${i}`,
      x,
      y,
      width: itemW,
      height: itemH,
      rotation,
    });
  }

  // Total height of the film used
  // Height = 2 * margin + totalRows * itemH + (totalRows - 1) * spacing
  const totalHeight = qty > 0 
    ? 2 * margin + totalRows * itemH + (totalRows - 1) * spacing 
    : 2 * margin;

  return {
    items,
    totalHeight,
    piecesPerRow,
    totalRows,
  };
}
