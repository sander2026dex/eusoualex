/**
 * Utility to convert an HTMLCanvasElement into a compliant uncompressed RGBA TIFF (.tif) Blob
 * in Little Endian format, with 300 DPI resolution metadata and straight alpha support.
 */
export function canvasToTiffBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(new Blob());
      return;
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    const rgbaData = imgData.data; // Uint8ClampedArray: R, G, B, A...

    // TIFF Structure calculation
    // Header: 8 bytes
    // IFD: 2 bytes (count) + 13 entries * 12 bytes + 4 bytes (next IFD offset) = 162 bytes
    // Extra Data:
    //   BitsPerSample: 4 * 2 bytes = 8 bytes
    //   XResolution: 2 * 4 bytes = 8 bytes
    //   YResolution: 2 * 4 bytes = 8 bytes
    // Total metadata size = 8 + 162 + 8 + 8 + 8 = 194 bytes
    const metadataSize = 194;
    const pixelDataSize = rgbaData.length;
    const totalSize = metadataSize + pixelDataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    // 1. Write Header (8 bytes)
    // Little endian indicator "II" (0x4949)
    view.setUint16(0, 0x4949, true);
    // TIFF magic number 42
    view.setUint16(2, 42, true);
    // Offset to first IFD (immediately after header at offset 8)
    view.setUint32(4, 8, true);

    // Offsets for extra data
    const bitsPerSampleOffset = 170;
    const xResolutionOffset = 178;
    const yResolutionOffset = 186;
    const pixelDataOffset = 194;

    // 2. Write IFD (13 entries) at offset 8
    // Number of directory entries (13)
    view.setUint16(8, 13, true);

    let offset = 10;

    const writeEntry = (tag: number, type: number, count: number, valOrOffset: number) => {
      view.setUint16(offset, tag, true);
      view.setUint16(offset + 2, type, true);
      view.setUint32(offset + 4, count, true);
      view.setUint32(offset + 8, valOrOffset, true);
      offset += 12;
    };

    // Entry 1: ImageWidth (0x0100), LONG (4), count 1
    writeEntry(0x0100, 4, 1, width);
    // Entry 2: ImageLength (0x0101), LONG (4), count 1
    writeEntry(0x0101, 4, 1, height);
    // Entry 3: BitsPerSample (0x0102), SHORT (3), count 4
    writeEntry(0x0102, 3, 4, bitsPerSampleOffset);
    // Entry 4: Compression (0x0103), SHORT (3), count 1, value 1 (Uncompressed)
    writeEntry(0x0103, 3, 1, 1);
    // Entry 5: PhotometricInterpretation (0x0106), SHORT (3), count 1, value 2 (RGB)
    writeEntry(0x0106, 3, 1, 2);
    // Entry 6: StripOffsets (0x0111), LONG (4), count 1
    writeEntry(0x0111, 4, 1, pixelDataOffset);
    // Entry 7: SamplesPerPixel (0x0115), SHORT (3), count 1, value 4 (RGBA)
    writeEntry(0x0115, 3, 1, 4);
    // Entry 8: RowsPerStrip (0x0116), LONG (4), count 1, value height
    writeEntry(0x0116, 4, 1, height);
    // Entry 9: StripByteCounts (0x0117), LONG (4), count 1, value pixelDataSize
    writeEntry(0x0117, 4, 1, pixelDataSize);
    // Entry 10: XResolution (0x011A), RATIONAL (5), count 1
    writeEntry(0x011A, 5, 1, xResolutionOffset);
    // Entry 11: YResolution (0x011B), RATIONAL (5), count 1
    writeEntry(0x011B, 5, 1, yResolutionOffset);
    // Entry 12: ResolutionUnit (0x0128), SHORT (3), count 1, value 2 (Inches)
    writeEntry(0x0128, 3, 1, 2);
    // Entry 13: ExtraSamples (0x0152), SHORT (3), count 1, value 2 (Unassociated Alpha / straight alpha)
    writeEntry(0x0152, 3, 1, 2);

    // Offset to next IFD: 0 (4 bytes)
    view.setUint32(offset, 0, true);

    // 3. Write Extra Data Blocks
    // BitsPerSample values: [8, 8, 8, 8]
    view.setUint16(bitsPerSampleOffset, 8, true);
    view.setUint16(bitsPerSampleOffset + 2, 8, true);
    view.setUint16(bitsPerSampleOffset + 4, 8, true);
    view.setUint16(bitsPerSampleOffset + 6, 8, true);

    // XResolution values: 300 / 1
    view.setUint32(xResolutionOffset, 300, true);
    view.setUint32(xResolutionOffset + 4, 1, true);

    // YResolution values: 300 / 1
    view.setUint32(yResolutionOffset, 300, true);
    view.setUint32(yResolutionOffset + 4, 1, true);

    // 4. Copy Pixel Data
    uint8View.set(rgbaData, pixelDataOffset);

    // Create & return blob
    const blob = new Blob([buffer], { type: 'image/tiff' });
    resolve(blob);
  });
}
