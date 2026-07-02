export type ArtworkType = 'upload' | 'text' | 'sample';

export interface PathCommand {
  type: 'M' | 'L' | 'C';
  points: { x: number; y: number }[]; // M: [to], L: [to], C: [cp1, cp2, to]
}

export interface VectorPath {
  points: { x: number; y: number }[];
  isClosed: boolean;
  controlPointsCount?: number;
  commands?: PathCommand[];
}

export interface Artwork {
  id: string;
  name: string;
  type: ArtworkType;
  widthCm: number;
  heightCm: number;
  paths: VectorPath[]; // Real vector paths for cutting
  viewBox: { x: number; y: number; width: number; height: number };
  svgPathString?: string; // Pre-calculated SVG path string
  previewUrl?: string; // Original image or canvas preview
  text?: string;
  fontFamily?: string;
  fontWeight?: string;
  totalNodesCount?: number;
}

export type FilmWidthType = '28' | '56' | 'custom';

export interface NestingParams {
  artworkWidthCm: number;
  artworkHeightCm: number;
  quantity: number;
  spacingMm: number;
  marginMm: number;
  filmWidthType: FilmWidthType;
  customFilmWidthCm: number;
  allowRotation: boolean;
}

export interface NestedItem {
  id: string;
  x: number; // in cm
  y: number; // in cm
  width: number; // in cm
  height: number; // in cm
  rotation: number; // 0 or 90 degrees
}

export interface NestingResult {
  items: NestedItem[];
  filmWidthCm: number;
  filmHeightCm: number; // calculated total height needed
  piecesPerRow: number;
  totalRows: number;
  efficiency: number; // percentage (0-100)
  waste: number; // percentage (0-100)
}
