import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileCode, Sliders, Image as ImageIcon, CheckCircle, AlertTriangle } from 'lucide-react';
import { Artwork, VectorPath } from '../types';
import { traceCanvas } from '../utils/vectorizer';

interface UploadSectionProps {
  onArtworkLoaded: (artwork: Artwork) => void;
  currentArtwork: Artwork | null;
}

export default function UploadSection({ onArtworkLoaded, currentArtwork }: UploadSectionProps) {
  const [dragActive, setDragActive] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [traceType, setTraceType] = useState<'alpha' | 'brightness'>('alpha');
  const [threshold, setThreshold] = useState<number>(128);
  const [simplification, setSimplification] = useState<number>(0.3); // Default to highly precise 0.3 mm / px
  const [curveSmoothing, setCurveSmoothing] = useState<number>(90); // default 90%
  const [cornerThreshold, setCornerThreshold] = useState<number>(15); // default 15% (27 degrees)
  const [minSegmentLengthMm, setMinSegmentLengthMm] = useState<number>(1.0); // default 1.0 mm
  const [curveOptimization, setCurveOptimization] = useState<boolean>(true);
  const [removeTinySegments, setRemoveTinySegments] = useState<boolean>(true);
  const [mergeAdjacentNodes, setMergeAdjacentNodes] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Re-run tracing when parameters change
  useEffect(() => {
    if (!imageElement) return;
    runTrace();
  }, [
    imageElement,
    traceType,
    threshold,
    simplification,
    curveSmoothing,
    cornerThreshold,
    minSegmentLengthMm,
    curveOptimization,
    removeTinySegments,
    mergeAdjacentNodes
  ]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const isImage = file.type.match('image.*') || file.name.endsWith('.svg');
    if (!isImage) {
      setFeedback({
        status: 'error',
        message: 'Por favor, selecione uma imagem válida (PNG, JPG, SVG).',
      });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const url = event.target.result as string;
        setImgUrl(url);

        const img = new Image();
        img.onload = () => {
          setImageElement(img);
          setIsProcessing(false);
        };
        img.onerror = () => {
          setFeedback({
            status: 'error',
            message: 'Erro ao carregar a imagem. Tente outro arquivo.',
          });
          setIsProcessing(false);
        };
        img.src = url;
      }
    };
    reader.readAsDataURL(file);
  };

  const runTrace = () => {
    if (!imageElement || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale canvas to reasonable size for processing
    const maxDim = 600;
    let w = imageElement.naturalWidth;
    let h = imageElement.naturalHeight;

    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    canvas.width = w;
    canvas.height = h;

    // Draw the image onto the canvas
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imageElement, 0, 0, w, h);

    // Call vectorization
    const paths = traceCanvas(canvas, {
      threshold,
      traceType,
      simplification,
      curveSmoothing: curveSmoothing / 100,
      cornerThreshold: (cornerThreshold / 100) * 180,
      minSegmentLengthMm,
      curveOptimization,
      removeTinySegments,
      mergeAdjacentNodes,
    });

    if (paths.length === 0) {
      setFeedback({
        status: 'error',
        message: 'Nenhum contorno encontrado. Ajuste os filtros/limiar (threshold) de vetorização.',
      });
      return;
    }

    const totalNodesCount = paths.reduce((acc, p) => acc + (p.controlPointsCount || p.points.length), 0);

    // Report success
    setFeedback({
      status: 'success',
      message: `Vetorização de precisão (PowerTRACE) concluída! Encontrados ${paths.length} contornos e ${totalNodesCount} nós de corte.`,
    });

    // Fire callback to parent
    onArtworkLoaded({
      id: `uploaded-${Date.now()}`,
      name: 'Arte Importada',
      type: 'upload',
      widthCm: 10, // default dimensions (10cm x proportional)
      heightCm: parseFloat(((10 * h) / w).toFixed(1)),
      paths,
      viewBox: { x: 0, y: 0, width: w, height: h },
      previewUrl: imgUrl || undefined,
      totalNodesCount,
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
        <Upload className="w-5 h-5 text-indigo-600" />
        <h2 className="font-semibold text-slate-800">Enviar Sua Arte</h2>
      </div>

      {/* Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50/50'
            : imgUrl
            ? 'border-slate-200 bg-slate-50/30 hover:bg-slate-50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/svg+xml"
          onChange={handleFileInput}
          className="hidden"
        />

        {imgUrl ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white border border-slate-100 shadow-xs flex items-center justify-center p-1">
              <img src={imgUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
            </div>
            <p className="text-xs font-bold text-slate-700 mt-1">Imagem Carregada</p>
            <p className="text-[10px] text-indigo-600 font-semibold hover:underline">
              Clique para alterar o arquivo
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shadow-xs border border-slate-100">
              <Upload className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Arrastar & Soltar sua imagem aqui</p>
              <p className="text-xs text-slate-400 mt-1">PNG transparente, JPG ou SVG</p>
            </div>
            <button
              type="button"
              className="mt-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              Procurar Arquivo
            </button>
          </div>
        )}
      </div>

      {/* Hidden trace canvas - used for pixel processing */}
      <canvas ref={previewCanvasRef} className="hidden" />

      {/* Tracing configuration - only shown if an image is loaded */}
      {imgUrl && (
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Configuração do Filtro de Corte (Vetorização)
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              {showAdvanced ? 'Ocultar Opções Avançadas' : 'Ver Opções Avançadas (CorelDRAW Style)'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                Método de Detecção
              </label>
              <select
                value={traceType}
                onChange={(e) => setTraceType(e.target.value as 'alpha' | 'brightness')}
                className="block w-full rounded-lg border border-slate-200 bg-white py-2 px-2.5 text-xs font-medium focus:border-indigo-500 focus:outline-hidden transition-all"
              >
                <option value="alpha">Canal Alfa (PNG transparente)</option>
                <option value="brightness">Brilho/Preto (Para JPG com fundo branco)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1.5 flex justify-between">
                <span>Limiar / Threshold ({threshold})</span>
              </label>
              <input
                type="range"
                min="1"
                max="255"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none mt-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1.5 flex justify-between">
                <span>Tolerância de Simplificação ({simplification.toFixed(1)} px)</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="2.5"
                step="0.1"
                value={simplification}
                onChange={(e) => setSimplification(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none mt-2.5"
              />
            </div>

            {showAdvanced && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1.5 flex justify-between">
                  <span>Suavização de Curva ({curveSmoothing}%)</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={curveSmoothing}
                  onChange={(e) => setCurveSmoothing(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none mt-2.5"
                />
              </div>
            )}
          </div>

          {showAdvanced && (
            <div className="border-t border-slate-200/50 pt-4 mt-2 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1.5 flex justify-between">
                    <span>Limiar de Canto / Corner ({cornerThreshold}%)</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={cornerThreshold}
                    onChange={(e) => setCornerThreshold(parseInt(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none mt-2.5"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1.5 flex justify-between">
                    <span>Segmento Mínimo ({minSegmentLengthMm.toFixed(1)} mm)</span>
                  </label>
                  <input
                    type="range"
                    min="0.2"
                    max="5.0"
                    step="0.1"
                    value={minSegmentLengthMm}
                    onChange={(e) => setMinSegmentLengthMm(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none mt-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setCurveOptimization(!curveOptimization)}
                  className={`py-1.5 px-2 rounded-md text-[10px] font-bold border transition-colors ${
                    curveOptimization
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  Curva Bézier: {curveOptimization ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  onClick={() => setRemoveTinySegments(!removeTinySegments)}
                  className={`py-1.5 px-2 rounded-md text-[10px] font-bold border transition-colors ${
                    removeTinySegments
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  Filtro Ruído: {removeTinySegments ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  onClick={() => setMergeAdjacentNodes(!mergeAdjacentNodes)}
                  className={`py-1.5 px-2 rounded-md text-[10px] font-bold border transition-colors ${
                    mergeAdjacentNodes
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  Mesclar Nós: {mergeAdjacentNodes ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trace feedback status */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
            feedback.status === 'success'
              ? 'border-emerald-100 bg-emerald-50/50 text-emerald-800'
              : 'border-amber-100 bg-amber-50/50 text-amber-800'
          }`}
        >
          {feedback.status === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed font-medium">{feedback.message}</span>
        </div>
      )}

    </div>
  );
}
