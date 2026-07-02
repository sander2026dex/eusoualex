import React, { useState } from 'react';
import { NestingResult, Artwork } from '../types';
import { generatePDF, generateSVG, generateDXF } from '../utils/exporter';
import { Download, FileText, Code, Settings, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface ExportSectionProps {
  result: NestingResult;
  artwork: Artwork | null;
}

export default function ExportSection({ result, artwork }: ExportSectionProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const triggerDownload = (type: 'pdf' | 'svg' | 'dxf' | 'ai') => {
    if (!artwork || result.items.length === 0) return;

    setDownloading(type);
    
    // Slight timeout to show beautiful loading feedback
    setTimeout(() => {
      try {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
        const baseName = `filme_recorte_${artwork.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${timestamp}`;

        if (type === 'pdf') {
          const doc = generatePDF(result, artwork);
          doc.save(`${baseName}.pdf`);
        } else if (type === 'svg') {
          const svgContent = generateSVG(result, artwork);
          downloadBlob(svgContent, `${baseName}.svg`, 'image/svg+xml');
        } else if (type === 'dxf') {
          const dxfContent = generateDXF(result, artwork);
          downloadBlob(dxfContent, `${baseName}.dxf`, 'image/vnd.dxf');
        } else if (type === 'ai') {
          // AI reads PDF vector with 100% precision. 
          // We export a highly compatible vector PDF and inform the user.
          const doc = generatePDF(result, artwork);
          doc.save(`${baseName}_illustrator.pdf`);
        }
      } catch (err) {
        console.error('Erro ao gerar exportação:', err);
      } finally {
        setDownloading(null);
      }
    }, 500);
  };

  const downloadBlob = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasItems = result.items.length > 0 && artwork !== null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-800">Exportar Arquivos</h2>
        </div>
        {hasItems && (
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
            Traço: 0,75 pt
          </span>
        )}
      </div>

      {!hasItems ? (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 text-xs text-slate-500 font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Selecione ou crie uma arte para habilitar a exportação.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* PDF Button */}
          <button
            onClick={() => triggerDownload('pdf')}
            disabled={downloading !== null}
            className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold">Exportar PDF Vetorial</span>
                <span className="block text-[10px] text-slate-400 font-medium leading-tight">
                  Tamanho Real (100% Escala) com traço de 0.75 pt pronto para plotter
                </span>
              </div>
            </div>
            <span className="text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-300 font-semibold group-hover:text-indigo-400">
              {downloading === 'pdf' ? 'Gerando...' : '.PDF'}
            </span>
          </button>

          {/* SVG Button */}
          <button
            onClick={() => triggerDownload('svg')}
            disabled={downloading !== null}
            className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold border border-slate-200 transition-all disabled:opacity-50 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                <Code className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold">Exportar SVG Vetorial</span>
                <span className="block text-[10px] text-slate-500 font-medium leading-tight">
                  Traço calibrado em 0.75 pt para CorelDraw e Inkscape
                </span>
              </div>
            </div>
            <span className="text-xs bg-slate-50 px-2 py-1 rounded-md text-slate-500 font-semibold group-hover:text-indigo-600">
              {downloading === 'svg' ? 'Gerando...' : '.SVG'}
            </span>
          </button>

          {/* DXF Button */}
          <button
            onClick={() => triggerDownload('dxf')}
            disabled={downloading !== null}
            className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold border border-slate-200 transition-all disabled:opacity-50 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Settings className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold">Exportar DXF (AutoCAD)</span>
                <span className="block text-[10px] text-slate-500 font-medium leading-tight">
                  Universal para plotters antigas e Silhouette
                </span>
              </div>
            </div>
            <span className="text-xs bg-slate-50 px-2 py-1 rounded-md text-slate-500 font-semibold group-hover:text-indigo-600">
              {downloading === 'dxf' ? 'Gerando...' : '.DXF'}
            </span>
          </button>

          {/* AI (Adobe Illustrator) Button */}
          <button
            onClick={() => triggerDownload('ai')}
            disabled={downloading !== null}
            className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold border border-slate-200 transition-all disabled:opacity-50 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold">Exportar para Adobe Illustrator</span>
                <span className="block text-[10px] text-slate-500 font-medium leading-tight">
                  Gera arquivo PDF 1:1 vetorizado para Illustrator
                </span>
              </div>
            </div>
            <span className="text-xs bg-slate-50 px-2 py-1 rounded-md text-slate-600 font-semibold group-hover:text-amber-700">
              {downloading === 'ai' ? 'Gerando...' : '.AI'}
            </span>
          </button>

          <p className="text-[10px] text-slate-400 italic text-center mt-2 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Todos os arquivos são exportados em tamanho real de produção.
          </p>
        </div>
      )}
    </div>
  );
}
