export interface DtfImage {
  id: string;
  name: string;
  url: string; // Blob/Data URL of the uploaded image
  widthPx: number; // Original width in pixels
  heightPx: number; // Original height in pixels
  aspectRatio: number; // width / height
  printWidthCm: number; // Desired print width in cm (default 10cm or proportional)
  printHeightCm: number; // Desired print height in cm (calculated)
  quantity: number; // Desired print quantity
  file?: File;
  format?: string; // e.g. "PNG", "JPG", "TIFF", "PDF"
  isRatioLocked?: boolean; // toggle proportional resizing
}

export interface DtfSheetParams {
  jobName: string;
  widthCm: number; // dynamic or selected (e.g. 28, 56 or manual)
  heightCm: number; // dynamic, 100 to 1000 cm
  spacingMm: number; // Spacing between items (e.g., 5mm)
  marginMm: number; // Margins around sheet (e.g., 10mm)
  autoNesting: boolean;
  autoHeight: boolean; // Auto-calculate required roll height
  allowRotation: boolean; // Allow items to be rotated by 90 degrees
}

export interface DtfPackedItem {
  id: string; // references DtfImage id
  image: DtfImage;
  xCm: number; // packed X position in cm (relative to sheet)
  yCm: number; // packed Y position in cm (relative to sheet)
  widthCm: number; // final width in cm (could be rotated)
  heightCm: number; // final height in cm (could be rotated)
  isRotated: boolean;
  sheetIndex: number; // which virtual sheet it's packed on
}

export interface DtfSheetResult {
  sheetIndex: number;
  widthCm: number;
  heightCm: number;
  items: DtfPackedItem[];
  efficiency: number; // percentage of used area
}

export interface DtfPackResult {
  sheets: DtfSheetResult[];
  unpackedItems: { image: DtfImage; count: number }[];
  totalSheets: number;
  totalItemsPacked: number;
  totalItemsRequested: number;
}
