import React from 'react';
import { NestingResult, NestingParams } from '../types';
import { LayoutGrid, Percent, Sparkles, Scissors, Info, Ruler } from 'lucide-react';

interface StatsPanelProps {
  result: NestingResult;
  params: NestingParams;
}

export default function StatsPanel({ result, params }: StatsPanelProps) {
  const {
    filmWidthCm,
    filmHeightCm,
    piecesPerRow,
    totalRows,
    efficiency,
    waste,
  } = result;

  const totalQty = params.quantity;
  const usedMeters = filmHeightCm / 100; // convert cm to meters

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col gap-6">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        <LayoutGrid className="w-5 h-5 text-indigo-400" />
        <h2 className="font-semibold text-slate-100">Métricas de Produção</h2>
      </div>

      {/* Grid stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-800 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Quantidade de Peças
          </span>
          <span className="text-2xl font-black text-white font-mono">
            {totalQty} <span className="text-xs font-normal text-slate-400">peças</span>
          </span>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-800 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Comprimento Utilizado
          </span>
          <span className="text-2xl font-black text-indigo-300 font-mono">
            {usedMeters.toFixed(2)} <span className="text-xs font-normal text-slate-400">m</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-800/50 flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Largura Útil
          </span>
          <span className="text-sm font-extrabold text-slate-200 font-mono">
            {filmWidthCm} cm
          </span>
        </div>

        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-800/50 flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Por Linha
          </span>
          <span className="text-sm font-extrabold text-slate-200 font-mono">
            {piecesPerRow} unid.
          </span>
        </div>

        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-800/50 flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Total Linhas
          </span>
          <span className="text-sm font-extrabold text-slate-200 font-mono">
            {totalRows} linhas
          </span>
        </div>
      </div>

      {/* Progress Bars for Efficiency */}
      <div className="flex flex-col gap-3 pt-2">
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              Aproveitamento do Filme
            </span>
            <span className="text-emerald-400 font-mono">{efficiency}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${efficiency}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5 text-amber-400" />
              Desperdício Estimado
            </span>
            <span className="text-amber-400 font-mono">{waste}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${waste}%` }}
            />
          </div>
        </div>
      </div>

      {/* Help info */}
      <div className="text-[10px] text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-lg flex items-start gap-2 border border-slate-800/50">
        <Info className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
        <span>
          O nesting calcula a distribuição em grade automática para aproveitar o máximo do material. Para reduzir o desperdício, tente habilitar a rotação de 90° ou use uma bobina de largura diferente.
        </span>
      </div>
    </div>
  );
}
