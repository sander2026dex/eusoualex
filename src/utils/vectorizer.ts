import { VectorPath, PathCommand } from '../types';

interface Point {
  x: number;
  y: number;
}

const vecSub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const vecAdd = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const vecScale = (v: Point, s: number): Point => ({ x: v.x * s, y: v.y * s });
const vecDot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const vecLenSq = (v: Point): number => v.x * v.x + v.y * v.y;
const vecLen = (v: Point): number => Math.sqrt(vecLenSq(v));
const vecNormalize = (v: Point): Point => {
  const len = vecLen(v);
  return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
};
const vecDistSq = (a: Point, b: Point): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/**
 * Smoothes points of a contour using a moving average window to eliminate high-frequency pixel steps,
 * while preserving sharp corners exactly and not smoothing across them.
 */
export function smoothContourPoints(
  points: Point[],
  windowSize: number = 5,
  corners: Set<number> = new Set()
): Point[] {
  if (points.length < 3) return points;
  const n = points.length;
  const smoothed: Point[] = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < n; i++) {
    // Keep corners perfectly intact
    if (corners.has(i)) {
      smoothed.push({ x: points[i].x, y: points[i].y });
      continue;
    }

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let w = -half; w <= half; w++) {
      const idx = (i + w + n) % n;
      
      // Determine if a sharp corner is between i and idx along the path
      let crossedCorner = false;
      const step = Math.sign(w);
      if (step !== 0) {
        let curr = i;
        while (curr !== idx) {
          if (corners.has(curr)) {
            crossedCorner = true;
            break;
          }
          curr = (curr + step + n) % n;
        }
      }

      if (!crossedCorner) {
        sumX += points[idx].x;
        sumY += points[idx].y;
        count++;
      }
    }

    if (count > 0) {
      smoothed.push({ x: sumX / count, y: sumY / count });
    } else {
      smoothed.push({ x: points[i].x, y: points[i].y });
    }
  }
  return smoothed;
}

/**
 * Chord-length parameterization for least-squares fitting.
 */
function chordLengthParameterize(points: Point[], first: number, last: number): number[] {
  const u: number[] = [0];
  for (let i = first + 1; i <= last; i++) {
    u.push(u[u.length - 1] + vecLen(vecSub(points[i], points[i - 1])));
  }
  const totalLength = u[u.length - 1];
  if (totalLength > 0) {
    for (let i = 0; i < u.length; i++) {
      u[i] /= totalLength;
    }
  } else {
    for (let i = 0; i < u.length; i++) {
      u[i] = i / (u.length - 1);
    }
  }
  return u;
}

function evaluateBezier(bezier: Point[], t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return vecAdd(
    vecAdd(vecScale(bezier[0], mt3), vecScale(bezier[1], 3 * mt2 * t)),
    vecAdd(vecScale(bezier[2], 3 * mt * t2), vecScale(bezier[3], t3))
  );
}

function evaluateBezierDeriv1(bezier: Point[], t: number): Point {
  const mt = 1 - t;
  return vecAdd(
    vecScale(vecSub(bezier[1], bezier[0]), 3 * mt * mt),
    vecAdd(vecScale(vecSub(bezier[2], bezier[1]), 6 * mt * t), vecScale(vecSub(bezier[3], bezier[2]), 3 * t * t))
  );
}

function evaluateBezierDeriv2(bezier: Point[], t: number): Point {
  const mt = 1 - t;
  const d1 = vecSub(vecAdd(bezier[2], bezier[0]), vecScale(bezier[1], 2));
  const d2 = vecSub(vecAdd(bezier[3], bezier[1]), vecScale(bezier[2], 2));
  return vecAdd(vecScale(d1, 6 * mt), vecScale(d2, 6 * t));
}

function refineParameters(bezier: Point[], points: Point[], first: number, last: number, u: number[]): number[] {
  const n = last - first;
  const refinedU = [...u];

  for (let i = 0; i <= n; i++) {
    let t = u[i];
    for (let iter = 0; iter < 3; iter++) {
      const q = evaluateBezier(bezier, t);
      const qp = evaluateBezierDeriv1(bezier, t);
      const qpp = evaluateBezierDeriv2(bezier, t);

      const d = vecSub(q, points[first + i]);
      const numerator = vecDot(qp, d);
      const denominator = vecLenSq(qp) + vecDot(qpp, d);

      if (denominator === 0) break;

      t -= numerator / denominator;
      t = Math.max(0, Math.min(1, t));
    }
    refinedU[i] = t;
  }
  return refinedU;
}

function generateBezierLeastSquares(
  points: Point[],
  first: number,
  last: number,
  u: number[],
  tHat1: Point,
  tHat2: Point
): Point[] {
  const p0 = points[first];
  const p3 = points[last];
  const n = last - first;

  const chord = vecSub(p3, p0);
  const chordLength = vecLen(chord);

  // Fallback if the chord is extremely short or zero
  if (chordLength < 1e-6) {
    return [p0, p0, p3, p3];
  }

  const vHat = vecScale(chord, 1 / chordLength);

  // 1. Constrain tangents to face forward along the chord (dot product >= 0.1)
  // This mathematically guarantees the control points can never go backwards,
  // which is the primary cause of loop-backs and self-intersection cusps.
  let safeTHat1 = tHat1;
  const dot1 = vecDot(tHat1, vHat);
  if (dot1 < 0.1) {
    safeTHat1 = vecNormalize(vecAdd(tHat1, vecScale(vHat, 0.2 - dot1)));
  }

  let safeTHat2 = tHat2;
  const dot2 = vecDot(tHat2, vHat);
  if (dot2 < 0.1) {
    safeTHat2 = vecNormalize(vecAdd(tHat2, vecScale(vHat, 0.2 - dot2)));
  }

  let c11 = 0;
  let c12 = 0;
  let c22 = 0;
  let x1 = 0;
  let x2 = 0;

  for (let i = 0; i <= n; i++) {
    const ui = u[i];
    const mt = 1 - ui;
    
    const b0 = mt * mt * mt;
    const b1 = 3 * mt * mt * ui;
    const b2 = 3 * mt * ui * ui;
    const b3 = ui * ui * ui;

    const term0 = vecScale(p0, b0 + b1);
    const term3 = vecScale(p3, b2 + b3);
    const tmp = vecSub(points[first + i], vecAdd(term0, term3));

    const v1 = vecScale(safeTHat1, b1);
    const v2 = vecScale(safeTHat2, b2);

    c11 += vecDot(v1, v1);
    c12 += vecDot(v1, v2);
    c22 += vecDot(v2, v2);

    x1 += vecDot(tmp, v1);
    x2 += vecDot(tmp, v2);
  }

  const det = c11 * c22 - c12 * c12;
  let alpha1 = 0;
  let alpha2 = 0;

  if (Math.abs(det) > 1e-6) {
    alpha1 = (x1 * c22 - x2 * c12) / det;
    alpha2 = (c11 * x2 - c12 * x1) / det;
  }

  const threshold = chordLength * 1e-6;

  if (alpha1 < threshold || alpha2 < threshold) {
    const val = chordLength / 3;
    return [p0, vecAdd(p0, vecScale(safeTHat1, val)), vecSub(p3, vecScale(safeTHat2, val)), p3];
  }

  // Cap the control point distances (alphas) to a maximum of 0.45 * chordLength.
  // This completely prevents cubic Bezier curves from overshooting, looping back,
  // or forming self-intersecting loops/cusps, which create the "white teeth/wedges"
  // and jagged/wavy defects in the filled strokes.
  const maxAlpha = chordLength * 0.45;
  if (alpha1 > maxAlpha) alpha1 = maxAlpha;
  if (alpha2 > maxAlpha) alpha2 = maxAlpha;

  return [p0, vecAdd(p0, vecScale(safeTHat1, alpha1)), vecSub(p3, vecScale(safeTHat2, alpha2)), p3];
}

function isSegmentStraight(points: Point[], first: number, last: number, tolerance: number): boolean {
  const pStart = points[first];
  const pEnd = points[last];
  const dx = pEnd.x - pStart.x;
  const dy = pEnd.y - pStart.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return true;

  const nx = -dy / len;
  const ny = dx / len;

  for (let i = first + 1; i < last; i++) {
    const pt = points[i];
    const dist = Math.abs((pt.x - pStart.x) * nx + (pt.y - pStart.y) * ny);
    if (dist > tolerance) {
      return false;
    }
  }
  return true;
}

function fitCurveRecursive(
  points: Point[],
  first: number,
  last: number,
  tHat1: Point,
  tHat2: Point,
  errorTolerance: number,
  maxIterations: number = 4,
  checkStraight: boolean = true
): PathCommand[] {
  const p0 = points[first];
  const p3 = points[last];
  const n = last - first;

  if (n === 1) {
    return [{
      type: 'L',
      points: [p3]
    }];
  }

  // Check if this segment is extremely straight. If so, return a straight line!
  // This completely eliminates any waviness or wiggles on straight edges like rectangles.
  // We ONLY perform this check on the top-level segments to avoid flattening small curved arcs during recursive splitting.
  const straightTolerance = 0.35; // Tighter threshold to prevent small circular curves from being flattened
  if (checkStraight && isSegmentStraight(points, first, last, straightTolerance)) {
    return [{
      type: 'L',
      points: [p3]
    }];
  }

  let u = chordLengthParameterize(points, first, last);
  let bezier = generateBezierLeastSquares(points, first, last, u, tHat1, tHat2);

  let maxErrorSq = 0;
  let splitPoint = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    u = refineParameters(bezier, points, first, last, u);
    bezier = generateBezierLeastSquares(points, first, last, u, tHat1, tHat2);

    maxErrorSq = 0;
    splitPoint = first;

    for (let i = 0; i <= n; i++) {
      const q = evaluateBezier(bezier, u[i]);
      const errSq = vecDistSq(q, points[first + i]);
      if (errSq > maxErrorSq) {
        maxErrorSq = errSq;
        splitPoint = first + i;
      }
    }

    if (maxErrorSq < errorTolerance * errorTolerance) {
      return [{
        type: 'C',
        points: [bezier[1], bezier[2], bezier[3]]
      }];
    }
  }

  if (maxErrorSq > errorTolerance * errorTolerance) {
    if (splitPoint === first || splitPoint === last) {
      const cmds: PathCommand[] = [];
      for (let i = first + 1; i <= last; i++) {
        cmds.push({ type: 'L', points: [points[i]] });
      }
      return cmds;
    }

    const prevPt = points[splitPoint - 1];
    const nextPt = points[splitPoint + 1];
    const tHatSplit = vecNormalize(vecSub(nextPt, prevPt));

    const leftCmds = fitCurveRecursive(points, first, splitPoint, tHat1, tHatSplit, errorTolerance, maxIterations, false);
    const rightCmds = fitCurveRecursive(points, splitPoint, last, tHatSplit, tHat2, errorTolerance, maxIterations, false);

    return leftCmds.concat(rightCmds);
  }

  return [{
    type: 'C',
    points: [bezier[1], bezier[2], bezier[3]]
  }];
}

function simplifyPathIndices(points: Point[], tolerance: number): number[] {
  const n = points.length;
  if (n <= 2) {
    return points.map((_, i) => i);
  }

  const marked = new Uint8Array(n);
  marked[0] = 1;
  marked[n - 1] = 1;

  function recurse(first: number, last: number) {
    if (last - first <= 1) return;

    let maxSqDist = 0;
    let index = first;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > tolerance * tolerance) {
      marked[index] = 1;
      recurse(first, index);
      recurse(index, last);
    }
  }

  recurse(0, n - 1);

  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (marked[i] === 1) {
      indices.push(i);
    }
  }
  return indices;
}

function getSqSegDist(p: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function estimateTangentLeft(points: Point[], idx: number): Point {
  const n = points.length;
  const step = Math.min(3, n - 1);
  return vecNormalize(vecSub(points[(idx + step) % n], points[idx]));
}

function estimateTangentRight(points: Point[], idx: number): Point {
  const n = points.length;
  const step = Math.min(3, n - 1);
  return vecNormalize(vecSub(points[idx], points[(idx - step + n) % n]));
}

function tryFitGeometricPrimitive(points: Point[]): PathCommand[] | null {
  const n = points.length;
  if (n < 12) return null; // Too few points to be a reliable primitive

  // 1. Compute bounding box and centroid
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    sumX += p.x;
    sumY += p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 6 || height < 6) return null;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = width / 2;
  const ry = height / 2;

  // --- 2. Ellipse / Circle Fitting Test ---
  let totalEllipseErrorSq = 0;
  for (let i = 0; i < n; i++) {
    const dx = points[i].x - cx;
    const dy = points[i].y - cy;
    const val = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    const err = val - 1.0;
    totalEllipseErrorSq += err * err;
  }
  const rmsEllipseError = Math.sqrt(totalEllipseErrorSq / n);

  // If the RMS error is low, it's a perfect circle or ellipse!
  // We use a robust 0.085 threshold so that pixelated rasters with small stair-steps
  // are beautifully fitted as perfect, smooth mathematical circles/ellipses.
  if (rmsEllipseError < 0.085) {
    const kappa = 0.5522847498;
    return [
      { type: 'M', points: [{ x: cx + rx, y: cy }] },
      {
        type: 'C',
        points: [
          { x: cx + rx, y: cy + ry * kappa },
          { x: cx + rx * kappa, y: cy + ry },
          { x: cx, y: cy + ry }
        ]
      },
      {
        type: 'C',
        points: [
          { x: cx - rx * kappa, y: cy + ry },
          { x: cx - rx, y: cy + ry * kappa },
          { x: cx - rx, y: cy }
        ]
      },
      {
        type: 'C',
        points: [
          { x: cx - rx, y: cy - ry * kappa },
          { x: cx - rx * kappa, y: cy - ry },
          { x: cx, y: cy - ry }
        ]
      },
      {
        type: 'C',
        points: [
          { x: cx + rx * kappa, y: cy - ry },
          { x: cx + rx, y: cy - ry * kappa },
          { x: cx + rx, y: cy }
        ]
      }
    ];
  }

  // --- 3. Rectangle Fitting Test ---
  let totalRectError = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const dx = Math.min(Math.abs(p.x - minX), Math.abs(p.x - maxX));
    const dy = Math.min(Math.abs(p.y - minY), Math.abs(p.y - maxY));
    totalRectError += Math.min(dx, dy);
  }
  const avgRectError = totalRectError / n;

  // If the average distance to the closest bounding box edge is very small, it is a perfect rectangle!
  if (avgRectError < 0.8) {
    return [
      { type: 'M', points: [{ x: minX, y: minY }] },
      { type: 'L', points: [{ x: maxX, y: minY }] },
      { type: 'L', points: [{ x: maxX, y: maxY }] },
      { type: 'L', points: [{ x: minX, y: maxY }] },
      { type: 'L', points: [{ x: minX, y: minY }] }
    ];
  }

  return null;
}

export function fitCurvesToContour(
  points: Point[],
  errorTolerance: number,
  cornerThresholdDeg: number
): PathCommand[] {
  if (points.length < 2) return [];

  // 0. Check for perfect geometric primitives (circle, ellipse, rectangle)
  const primitiveCmds = tryFitGeometricPrimitive(points);
  if (primitiveCmds) {
    return primitiveCmds;
  }

  const n = points.length;

  // 1. Get simplified path indices (Douglas-Peucker with a dynamic tolerance based on errorTolerance to eliminate high-frequency pixel steps and wiggles)
  const dpTolerance = Math.max(0.4, errorTolerance * 1.5);
  const simplifiedIndices = simplifyPathIndices(points, dpTolerance);

  if (simplifiedIndices.length < 3) {
    return [
      { type: 'M', points: [points[0]] },
      { type: 'L', points: [points[n - 1]] }
    ];
  }

  // 2. Detect which simplified vertices are sharp corners using a robust sliding window on points
  const cornerIndices: number[] = [];
  const nPoints = points.length;
  const m = simplifiedIndices.length;

  if (nPoints >= 8) {
    const k = Math.min(4, Math.floor(nPoints / 4));
    const cornerness = new Float32Array(nPoints);

    // Calculate cornerness (angle over window of size k) for all points
    for (let i = 0; i < nPoints; i++) {
      const pCurr = points[i];
      const pPrev = points[(i - k + nPoints) % nPoints];
      const pNext = points[(i + k) % nPoints];

      const v1 = vecNormalize(vecSub(pCurr, pPrev));
      const v2 = vecNormalize(vecSub(pNext, pCurr));

      const dot = vecDot(v1, v2);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      cornerness[i] = (angleRad * 180) / Math.PI;
    }

    const minThreshold = Math.max(32, cornerThresholdDeg);
    const ratio = 0.65; // Curvature at neighbors must be less than 65% of the corner's curvature

    for (let i = 0; i < m; i++) {
      const idx = simplifiedIndices[i];
      const val = cornerness[idx];
      if (val < minThreshold) continue;

      // Check if idx is a local maximum of cornerness in a neighborhood of [-k, k]
      let isLocalMax = true;
      for (let w = -k; w <= k; w++) {
        if (w === 0) continue;
        const nIdx = (idx + w + nPoints) % nPoints;
        if (cornerness[nIdx] > val) {
          isLocalMax = false;
          break;
        }
      }
      if (!isLocalMax) continue;

      // Check drop-off at neighbors to ensure it's a localized spike (corner) rather than a smooth curve
      // Curvature must drop off significantly on BOTH sides of the candidate index to be classified as a sharp corner.
      const leftNeighbor = cornerness[(idx - k + nPoints) % nPoints];
      const rightNeighbor = cornerness[(idx + k) % nPoints];
      if (leftNeighbor < val * ratio && rightNeighbor < val * ratio) {
        cornerIndices.push(idx);
      }
    }
  }

  // If no sharp corners are found (e.g., circles or clean ovals), use 4 symmetric points as virtual corners
  if (cornerIndices.length === 0) {
    const step = Math.floor(m / 4);
    if (step > 0) {
      for (let i = 0; i < 4; i++) {
        cornerIndices.push(simplifiedIndices[Math.min(i * step, m - 1)]);
      }
    } else {
      cornerIndices.push(simplifiedIndices[0]);
    }
  }

  // Sort corner indices to maintain chronological order
  cornerIndices.sort((a, b) => a - b);

  // Rotate points so that index 0 is always a sharp corner.
  // This produces extremely clean Bezier commands that start/end exactly on the geometric corners.
  const corners = [...cornerIndices];
  if (corners[0] !== 0) {
    const startCorner = corners[0];
    const rotatedPoints = [...points.slice(startCorner), ...points.slice(0, startCorner)];
    rotatedPoints.push(rotatedPoints[0]); // Keep closed loop structure
    return fitCurvesToContour(rotatedPoints, errorTolerance, cornerThresholdDeg);
  }

  corners.push(n - 1);

  const commands: PathCommand[] = [];
  commands.push({
    type: 'M',
    points: [points[0]]
  });

  for (let c = 0; c < corners.length - 1; c++) {
    const startIdx = corners[c];
    const endIdx = corners[c + 1];

    if (endIdx - startIdx <= 1) {
      commands.push({
        type: 'L',
        points: [points[endIdx]]
      });
      continue;
    }

    const tHat1 = estimateTangentLeft(points, startIdx);
    const tHat2 = estimateTangentRight(points, endIdx);

    const segmentPoints = points.slice(startIdx, endIdx + 1);
    const segmentCmds = fitCurveRecursive(segmentPoints, 0, segmentPoints.length - 1, tHat1, tHat2, errorTolerance);
    commands.push(...segmentCmds);
  }

  return commands;
}

export interface TraceOptions {
  threshold: number;
  traceType: 'alpha' | 'brightness';
  simplification: number;
  curveSmoothing?: number;      // 0.0 - 1.0 (90% = 0.9)
  cornerThreshold?: number;     // angle threshold in degrees (15% = 27 degrees)
  minSegmentLengthMm?: number;  // min segment length in mm
  curveOptimization?: boolean;  // whether to apply bezier smoothing
  removeTinySegments?: boolean;  // whether to delete tiny contours
  mergeAdjacentNodes?: boolean;  // whether to merge nodes close to each other
}

/**
 * Moore-Neighbor contour tracing algorithm.
 * Finds the boundaries of solid regions in a binary grid and simplifies/smooths them using advanced curve-fitting.
 */
export function traceCanvas(
  canvas: HTMLCanvasElement,
  options: TraceOptions
): VectorPath[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Create a binary grid where true = solid, false = empty
  const isSolid = new Uint8Array(width * height);
  const { threshold, traceType } = options;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      let solid = false;
      if (traceType === 'alpha') {
        solid = a >= threshold;
      } else {
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (a < 30) {
          solid = false;
        } else {
          solid = brightness < threshold;
        }
      }
      isSolid[y * width + x] = solid ? 1 : 0;
    }
  }

  // 1.5 Pre-processing: Morphological Median & Closure Filter to heal pixelated gaps/holes and remove jagged outline notches
  const processedSolid = new Uint8Array(width * height);
  const simplification = options.simplification || 0.3;

  if (simplification >= 0.1) {
    // A. 3x3 median filter to clean isolated pixel noise and pre-smooth borders
    const medianGrid = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          medianGrid[idx] = isSolid[idx];
          continue;
        }
        
        let solidCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (isSolid[(y + dy) * width + (x + dx)] === 1) {
              solidCount++;
            }
          }
        }
        medianGrid[idx] = solidCount >= 5 ? 1 : 0;
      }
    }

    // B. Advanced Separable Morphological Closing with a dynamic radius
    // Only applied at higher simplification values to avoid destroying features or adding bubbles ("bolhas")
    const radius = simplification >= 0.8 ? Math.max(1, Math.min(2, Math.round((simplification - 0.7) * 4))) : 0;
    
    if (radius > 0) {
      // Pass 1: Horizontal Dilation
      const dilatedH = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let active = 0;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < width) {
              if (medianGrid[y * width + nx] === 1) {
                active = 1;
                break;
              }
            }
          }
          dilatedH[y * width + x] = active;
        }
      }

      // Pass 2: Vertical Dilation
      const dilatedV = new Uint8Array(width * height);
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let active = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < height) {
              if (dilatedH[ny * width + x] === 1) {
                active = 1;
                break;
              }
            }
          }
          dilatedV[y * width + x] = active;
        }
      }

      // Pass 3: Horizontal Erosion
      const erodedH = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let active = 1;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < width) {
              if (dilatedV[y * width + nx] === 0) {
                active = 0;
                break;
              }
            } else {
              active = 0;
              break;
            }
          }
          erodedH[y * width + x] = active;
        }
      }

      // Pass 4: Vertical Erosion to yield final processed grid
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let active = 1;
          for (let dy = -radius; dy <= radius; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < height) {
              if (erodedH[ny * width + x] === 0) {
                active = 0;
                break;
              }
            } else {
              active = 0;
              break;
            }
          }
          processedSolid[y * width + x] = active;
        }
      }
    } else {
      // Use the median filtered grid directly - preserves details perfectly and prevents bubble fusions
      processedSolid.set(medianGrid);
    }
  } else {
    // Keep raw pixels
    processedSolid.set(isSolid);
  }

  // Helper to check grid
  const getPixel = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return processedSolid[y * width + x] === 1;
  };

  const visited = new Uint8Array(width * height);
  const paths: VectorPath[] = [];

  const cornerThresholdDeg = options.cornerThreshold !== undefined ? options.cornerThreshold : 27; // 15% of 180 = 27 deg
  const removeTinySegments = options.removeTinySegments !== false;

  // 2. Moore-Neighbor tracing
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      if (processedSolid[idx] === 1 && visited[idx] === 0) {
        let isBoundary = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!getPixel(x + dx, y + dy)) {
              isBoundary = true;
              break;
            }
          }
          if (isBoundary) break;
        }

        if (isBoundary) {
          const pathPoints = traceContour(x, y, width, height, getPixel, visited);
          if (pathPoints.length > 3) {
            // Remove tiny contours (based on perimeter / bounds)
            if (removeTinySegments) {
              let perimeter = 0;
              for (let i = 0; i < pathPoints.length - 1; i++) {
                const dx = pathPoints[i+1].x - pathPoints[i].x;
                const dy = pathPoints[i+1].y - pathPoints[i].y;
                perimeter += Math.sqrt(dx * dx + dy * dy);
              }
              if (perimeter < 8) continue; // Skip tiny noise specks
            }

            // A. Detect sharp corners on a pre-smoothed version of the contour using a robust sliding window
            // This filters out high-frequency staircase pixel steps so that circles and smooth curves
            // are not falsely decorated with sharp corners, while preserving actual geometric corners.
            const cornersSet = new Set<number>();
            const preSmoothedPoints = smoothContourPoints(pathPoints, 3); // Light pre-smoothing to wash out stair-steps
            const nPoints = preSmoothedPoints.length;

            if (nPoints >= 8) {
              const k = Math.min(4, Math.floor(nPoints / 4));
              const cornerness = new Float32Array(nPoints);

              // 1. Calculate cornerness (angle over window of size k) for all points
              for (let i = 0; i < nPoints; i++) {
                const pCurr = preSmoothedPoints[i];
                const pPrev = preSmoothedPoints[(i - k + nPoints) % nPoints];
                const pNext = preSmoothedPoints[(i + k) % nPoints];

                const v1 = vecNormalize(vecSub(pCurr, pPrev));
                const v2 = vecNormalize(vecSub(pNext, pCurr));

                const dot = vecDot(v1, v2);
                const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
                cornerness[i] = (angleRad * 180) / Math.PI;
              }

              // 2. Identify points that are local maxima of cornerness and exceed the threshold,
              // with a significant drop-off in their neighborhood (ruling out uniform curves).
              const minThreshold = Math.max(32, cornerThresholdDeg);
              const dpTol = 1.0;
              const simpIndices = simplifyPathIndices(preSmoothedPoints, dpTol);
              const m = simpIndices.length;

              for (let i = 0; i < m; i++) {
                const idx = simpIndices[i];
                const val = cornerness[idx];
                if (val < minThreshold) continue;

                // Check if idx is a local maximum of cornerness in a neighborhood of [-k, k]
                let isLocalMax = true;
                for (let w = -k; w <= k; w++) {
                  if (w === 0) continue;
                  const nIdx = (idx + w + nPoints) % nPoints;
                  if (cornerness[nIdx] > val) {
                    isLocalMax = false;
                    break;
                  }
                }
                if (!isLocalMax) continue;

                // Check drop-off at neighbors to ensure it's a localized spike (corner) rather than a smooth curve
                // Curvature must drop off significantly on BOTH sides of the candidate index to be classified as a sharp corner.
                const leftNeighbor = cornerness[(idx - k + nPoints) % nPoints];
                const rightNeighbor = cornerness[(idx + k) % nPoints];
                const ratio = 0.65; // Curvature at neighbors must be less than 65% of the corner's curvature
                if (leftNeighbor < val * ratio && rightNeighbor < val * ratio) {
                  cornersSet.add(idx);
                }
              }
            }

            // B. Dynamically choose smoothing window size and passes using curveSmoothing parameter (0.0 to 1.0)
            const userSmoothing = options.curveSmoothing !== undefined ? options.curveSmoothing : 0.9;
            let windowSize = 5;
            let passes = 3;

            if (userSmoothing < 0.1) {
              windowSize = 1;
              passes = 0;
            } else if (userSmoothing < 0.4) {
              windowSize = 3;
              passes = 1;
            } else if (userSmoothing < 0.7) {
              windowSize = 5;
              passes = 2;
            } else {
              windowSize = 5;
              passes = 3; // 3 passes of 5-wide moving average is a perfect Gaussian-like smooth filter
            }

            let smoothed = pathPoints;
            for (let p = 0; p < passes; p++) {
              smoothed = smoothContourPoints(smoothed, windowSize, cornersSet);
            }

            // B. Fit Cubic Bézier curves directly to the smoothed points using Schneider's algorithm
            const commands = fitCurvesToContour(smoothed, simplification, cornerThresholdDeg);

            if (commands.length > 1) {
              // Sample the Bézier commands at high resolution to fill points array for backwards compatibility
              const points: { x: number; y: number }[] = [];
              let currentPoint = commands[0].points[0];
              points.push(currentPoint);

              for (let i = 1; i < commands.length; i++) {
                const cmd = commands[i];
                if (cmd.type === 'L') {
                  const to = cmd.points[0];
                  points.push(to);
                  currentPoint = to;
                } else if (cmd.type === 'C') {
                  const from = currentPoint;
                  const cp1 = cmd.points[0];
                  const cp2 = cmd.points[1];
                  const to = cmd.points[2];
                  const steps = 15; // Smooth polyline sampling
                  for (let s = 1; s <= steps; s++) {
                     const t = s / steps;
                     const mt = 1 - t;
                     const x = mt*mt*mt*from.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*to.x;
                     const y = mt*mt*mt*from.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*to.y;
                     points.push({ x, y });
                  }
                  currentPoint = to;
                }
              }

              paths.push({
                points,
                isClosed: true,
                commands,
                controlPointsCount: commands.length,
              });
            }
          }
        }
      }
    }
  }

  return paths;
}

/**
 * Traces a single contour starting at (startX, startY)
 */
function traceContour(
  startX: number,
  startY: number,
  width: number,
  height: number,
  getPixel: (x: number, y: number) => boolean,
  visited: Uint8Array
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  
  // Directions around a pixel (clockwise starting from top-left)
  const dirs = [
    { x: -1, y: -1 }, // 0: TL
    { x: 0, y: -1 },  // 1: T
    { x: 1, y: -1 },  // 2: TR
    { x: 1, y: 0 },   // 3: R
    { x: 1, y: 1 },   // 4: BR
    { x: 0, y: 1 },   // 5: B
    { x: -1, y: 1 },  // 6: BL
    { x: -1, y: 0 },  // 7: L
  ];

  let currX = startX;
  let currY = startY;
  
  // Find initial background neighbor (Moore neighborhood)
  // Since we scanned left-to-right, the pixel to the left (dir index 7) must be empty
  let backX = currX - 1;
  let backY = currY;
  let enterDir = 7; // Index of the direction we came from (or started looking at)

  const maxSteps = width * height; // Safely avoid infinite loops
  let steps = 0;

  points.push({ x: currX, y: currY });
  visited[currY * width + currX] = 1;

  while (steps < maxSteps) {
    steps++;
    
    // Find the next solid pixel in the neighborhood, scanning clockwise starting from the background pixel
    let foundNext = false;
    let scanIdx = (enterDir + 1) % 8;
    
    for (let i = 0; i < 8; i++) {
      const dir = dirs[scanIdx];
      const checkX = currX + dir.x;
      const checkY = currY + dir.y;
      
      if (getPixel(checkX, checkY)) {
        // Found next pixel in contour
        currX = checkX;
        currY = checkY;
        points.push({ x: currX, y: currY });
        visited[currY * width + currX] = 1;
        
        // Update enterDir to be the direction from the new pixel back to the old empty pixel
        // The empty pixel before this one is scanIdx - 1
        enterDir = (scanIdx + 4) % 8; // opposite direction
        foundNext = true;
        break;
      }
      
      scanIdx = (scanIdx + 1) % 8;
    }

    if (!foundNext) {
      // Isolated pixel
      break;
    }

    // Stop condition: back to start and the next pixel would be the second point
    if (currX === startX && currY === startY) {
      break;
    }
  }

  return points;
}



/**
 * Renders custom text onto an offscreen canvas and traces its contours to create a real vector cutting path.
 */
export function traceText(
  text: string,
  fontFamily: string,
  fontWeight: string = 'bold',
  isVertical: boolean = false,
  isHollow: boolean = false
): { paths: VectorPath[]; viewBox: { x: number; y: number; width: number; height: number } } {
  const canvas = document.createElement('canvas');
  if (isVertical) {
    canvas.width = 800;
    canvas.height = 2000;
  } else {
    canvas.width = 1600;
    canvas.height = 500;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return { paths: [], viewBox: { x: 0, y: 0, width: 100, height: 100 } };

  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Set font size and draw text in the middle
  const fontSize = isVertical ? 150 : 130;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, system-ui, sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 14; // Nice thick cutting stroke for hollow style
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isVertical) {
    const chars = Array.from(text);
    const charHeight = fontSize * 1.15;
    const totalHeight = chars.length * charHeight;
    const startY = (canvas.height - totalHeight) / 2 + charHeight / 2;

    chars.forEach((char, idx) => {
      if (isHollow) {
        ctx.strokeText(char, canvas.width / 2, startY + idx * charHeight);
      } else {
        ctx.fillText(char, canvas.width / 2, startY + idx * charHeight);
      }
    });
  } else {
    if (isHollow) {
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    } else {
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
  }

  // Trace the non-white pixels with advanced curve smoothing configurations
  const rawPaths = traceCanvas(canvas, {
    threshold: 120,
    traceType: 'brightness',
    simplification: 0.3, // High precision
    curveSmoothing: 0.90, // 90% smoothing
    cornerThreshold: 27, // 15% corner threshold
    curveOptimization: true,
    removeTinySegments: true,
    mergeAdjacentNodes: true,
  });

  if (rawPaths.length === 0) {
    return { paths: [], viewBox: { x: 0, y: 0, width: 100, height: 100 } };
  }

  // Calculate the overall bounding box of all paths
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  rawPaths.forEach((path) => {
    path.points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
  });

  const width = maxX - minX;
  const height = maxY - minY;

  // Normalize points so the width fits nicely in a standard coordinate space
  // We'll scale so the maximum bounding dimension is 100
  const maxDim = Math.max(width, height);
  const scale = maxDim > 0 ? 100 / maxDim : 1;

  const normalizedPaths = rawPaths.map((path) => ({
    isClosed: path.isClosed,
    points: path.points.map((p) => ({
      x: (p.x - minX) * scale,
      y: (p.y - minY) * scale,
    })),
  }));

  return {
    paths: normalizedPaths,
    viewBox: {
      x: 0,
      y: 0,
      width: width * scale,
      height: height * scale,
    },
  };
}

