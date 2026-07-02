import { jsPDF } from 'jspdf';
import { NestingResult, Artwork, VectorPath } from '../types';

/**
 * Transforms a point in the original artwork's coordinates
 * to the final nested coordinate system on the film (in cm).
 */
export function transformPoint(
  px: number,
  py: number,
  viewBox: { x: number; y: number; width: number; height: number },
  artworkWidthCm: number,
  artworkHeightCm: number,
  item: { x: number; y: number; rotation: number }
): { x: number; y: number } {
  // 1. Normalize original coordinate to [0, 1] relative to the viewBox
  const normX = viewBox.width > 0 ? (px - viewBox.x) / viewBox.width : 0;
  const normY = viewBox.height > 0 ? (py - viewBox.y) / viewBox.height : 0;

  if (item.rotation === 90) {
    // 2. Rotate 90 degrees clockwise in unit square: (x, y) -> (1 - y, x)
    const rotNX = 1 - normY;
    const rotNY = normX;

    // 3. Scale by rotated dimensions (width is artworkHeight, height is artworkWidth)
    const x = item.x + rotNX * artworkHeightCm;
    const y = item.y + rotNY * artworkWidthCm;
    return { x, y };
  } else {
    // 2. Scale by standard dimensions
    const x = item.x + normX * artworkWidthCm;
    const y = item.y + normY * artworkHeightCm;
    return { x, y };
  }
}

/**
 * Generates a vector PDF at 100% scale (1:1) ready for vinyl cutting plotters.
 */
export function generatePDF(result: NestingResult, artwork: Artwork): jsPDF {
  const { filmWidthCm, filmHeightCm, items } = result;

  // Create PDF with custom dimensions equal to the film dimensions
  const doc = new jsPDF({
    orientation: filmWidthCm > filmHeightCm ? 'landscape' : 'portrait',
    unit: 'cm',
    format: [filmWidthCm, filmHeightCm],
    compress: true,
  });

  // Plotter standard cut line: ultra-thin black lines for absolute precision (0.75 pt)
  doc.setDrawColor(0, 0, 0); // Black line (standard cut color)
  doc.setLineWidth(0.026458); // 0.75 pt converted to cm (0.75 * 2.54 / 72)

  items.forEach((item) => {
    artwork.paths.forEach((path) => {
      if (path.commands && path.commands.length > 0) {
        path.commands.forEach((cmd) => {
          if (cmd.type === 'M') {
            const p = transformPoint(
              cmd.points[0].x,
              cmd.points[0].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            doc.moveTo(p.x, p.y);
          } else if (cmd.type === 'L') {
            const p = transformPoint(
              cmd.points[0].x,
              cmd.points[0].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            doc.lineTo(p.x, p.y);
          } else if (cmd.type === 'C') {
            const cp1 = transformPoint(
              cmd.points[0].x,
              cmd.points[0].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            const cp2 = transformPoint(
              cmd.points[1].x,
              cmd.points[1].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            const to = transformPoint(
              cmd.points[2].x,
              cmd.points[2].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            doc.curveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y);
          }
        });

        if (path.isClosed) {
          doc.close();
        }
        doc.stroke();
      } else {
        // Fallback to polylines if commands don't exist
        if (path.points.length < 2) return;

        const p0 = transformPoint(
          path.points[0].x,
          path.points[0].y,
          artwork.viewBox,
          artwork.widthCm,
          artwork.heightCm,
          item
        );

        doc.moveTo(p0.x, p0.y);

        for (let i = 1; i < path.points.length; i++) {
          const pt = transformPoint(
            path.points[i].x,
            path.points[i].y,
            artwork.viewBox,
            artwork.widthCm,
            artwork.heightCm,
            item
          );
          doc.lineTo(pt.x, pt.y);
        }

        if (path.isClosed) {
          doc.lineTo(p0.x, p0.y);
        }
        
        doc.stroke();
      }
    });
  });

  return doc;
}

/**
 * Generates an SVG string containing all vector cutting paths.
 */
export function generateSVG(result: NestingResult, artwork: Artwork): string {
  const { filmWidthCm, filmHeightCm, items } = result;

  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${filmWidthCm}cm" height="${filmHeightCm}cm" viewBox="0 0 ${filmWidthCm} ${filmHeightCm}">
  <style>
    .cut-line {
      fill: none;
      stroke: #000000;
      stroke-width: 0.75pt; /* Exactly 0.75 points stroke weight */
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  </style>
  <!-- Background representative of vinyl roll -->
  <rect width="${filmWidthCm}" height="${filmHeightCm}" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.2" />
`;

  items.forEach((item, itemIdx) => {
    svg += `  <!-- Item ${itemIdx + 1} -->\n`;
    artwork.paths.forEach((path) => {
      if (path.commands && path.commands.length > 0) {
        let d = '';
        path.commands.forEach((cmd) => {
          if (cmd.type === 'M') {
            const p = transformPoint(
              cmd.points[0].x,
              cmd.points[0].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            d += `M ${p.x.toFixed(4)} ${p.y.toFixed(4)} `;
          } else if (cmd.type === 'L') {
            const p = transformPoint(
              cmd.points[0].x,
              cmd.points[0].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            d += `L ${p.x.toFixed(4)} ${p.y.toFixed(4)} `;
          } else if (cmd.type === 'C') {
            const cp1 = transformPoint(
              cmd.points[0].x,
              cmd.points[0].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            const cp2 = transformPoint(
              cmd.points[1].x,
              cmd.points[1].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            const to = transformPoint(
              cmd.points[2].x,
              cmd.points[2].y,
              artwork.viewBox,
              artwork.widthCm,
              artwork.heightCm,
              item
            );
            d += `C ${cp1.x.toFixed(4)} ${cp1.y.toFixed(4)}, ${cp2.x.toFixed(4)} ${cp2.y.toFixed(4)}, ${to.x.toFixed(4)} ${to.y.toFixed(4)} `;
          }
        });
        if (path.isClosed) {
          d += 'Z';
        }
        svg += `  <path d="${d.trim()}" class="cut-line" />\n`;
      } else {
        // Fallback to polylines if commands don't exist
        if (path.points.length < 2) return;

        const pointsTransformed = path.points.map((p) =>
          transformPoint(
            p.x,
            p.y,
            artwork.viewBox,
            artwork.widthCm,
            artwork.heightCm,
            item
          )
        );

        const d = pointsTransformed
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(4)} ${p.y.toFixed(4)}`)
          .join(' ') + (path.isClosed ? ' Z' : '');

        svg += `  <path d="${d}" class="cut-line" />\n`;
      }
    });
  });

  svg += '</svg>';
  return svg;
}

/**
 * Generates a standard R12 DXF file for CNC and cutting plotters.
 */
export function generateDXF(result: NestingResult, artwork: Artwork): string {
  const { items } = result;
  
  let dxf = `  0
SECTION
  2
HEADER
  9
$ACADVER
  1
AC1009
  0
ENDSEC
  0
SECTION
  2
ENTITIES
`;

  items.forEach((item) => {
    artwork.paths.forEach((path) => {
      if (path.points.length < 2) return;

      const pts = path.points.map((p) =>
        transformPoint(
          p.x,
          p.y,
          artwork.viewBox,
          artwork.widthCm,
          artwork.heightCm,
          item
        )
      );

      // We draw as individual LINE segments for maximum universal compatibility
      // with extremely old plotter software that doesn't support complex polylines.
      for (let i = 0; i < pts.length - 1; i++) {
        dxf += `  0
LINE
  8
CUT_LINES
 10
${(pts[i].x * 10).toFixed(3)}
 20
${(pts[i].y * 10).toFixed(3)}
 30
0.0
 11
${(pts[i + 1].x * 10).toFixed(3)}
 21
${(pts[i + 1].y * 10).toFixed(3)}
 31
0.0
`;
      }

      if (path.isClosed) {
        dxf += `  0
LINE
  8
CUT_LINES
 10
${(pts[pts.length - 1].x * 10).toFixed(3)}
 20
${(pts[pts.length - 1].y * 10).toFixed(3)}
 30
0.0
 11
${(pts[0].x * 10).toFixed(3)}
 21
${(pts[0].y * 10).toFixed(3)}
 31
0.0
`;
      }
    });
  });

  dxf += `  0
ENDSEC
  0
EOF
`;

  return dxf;
}
