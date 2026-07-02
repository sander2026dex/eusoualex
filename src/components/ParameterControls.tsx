import React, { useState, useEffect } from 'react';
import { NestingParams, FilmWidthType } from '../types';
import { Settings, RefreshCw, Layers, Sliders, Layout, Check } from 'lucide-react';

interface ParameterControlsProps {
  params: NestingParams;
  onChange: (params: NestingParams) => void;
  onReset: () => void;
}

export default function ParameterControls({ params, onChange, onReset }: ParameterControlsProps) {
  const [localWidth, setLocalWidth] = useState<string>(params.artworkWidthCm.toString());
  const [localHeight, setLocalHeight] = useState<string>(params.artworkHeightCm.toString());

  // Sync with props when they change from outside (e.g. from template/upload)
  useEffect(() => {
    setLocalWidth(params.artworkWidthCm.toString());
  }, [params.artworkWidthCm]);

  useEffect(() => {
    setLocalHeight(params.artworkHeightCm.toString());
  }, [params.artworkHeightCm]);

  const parsedWidth = parseFloat(localWidth) || 0;
  const parsedHeight = parseFloat(localHeight) || 0;

  const hasChanges = 
    parsedWidth !== params.artworkWidthCm || 
    parsedHeight !== params.artworkHeightCm;

  const isValid = 
    parsedWidth >= 0.1 && parsedWidth <= 500 && 
    parsedHeight >= 0.1 && parsedHeight <= 500;

  const handleApplyDimensions = () => {
    if (isValid && hasChanges) {
      onChange({
        ...params,
        artworkWidthCm: parsedWidth,
        artworkHeightCm: parsedHeight,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApplyDimensions();
    }
  };

  const handleBlur = () => {
    // Also auto-apply on blur if valid to make it seamless
    if (isValid && hasChanges) {
      handleApplyDimensions();
    }
  };

  const updateParam = <K extends keyof NestingParams>(key: K, value: NestingParams[K]) => {
    onChange({
      ...params,
      [key]: value,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-800">Parâmetros do Filme</h2>
        </div>
        <button
          onClick={onReset}
          className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-slate-50"
          title="Restaurar valores padrão"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Resetar
        </button>
      </div>

      {/* Arte Dimensions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 tracking-wider uppercase">
          <Layers className="w-4 h-4 text-slate-400" />
          Dimensões da Arte
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Largura (cm)
            </label>
            <div className="relative rounded-lg shadow-xs">
              <input
                type="text"
                value={localWidth}
                onChange={(e) => setLocalWidth(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder="Largura"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs text-slate-400 font-mono">cm</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Altura (cm)
            </label>
            <div className="relative rounded-lg shadow-xs">
              <input
                type="text"
                value={localHeight}
                onChange={(e) => setLocalHeight(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder="Altura"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs text-slate-400 font-mono">cm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Apply Dimensions button - highlighted if there are unapplied changes */}
        <button
          type="button"
          onClick={handleApplyDimensions}
          disabled={!hasChanges || !isValid}
          className={`mt-1.5 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            hasChanges && isValid
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 ring-2 ring-emerald-500/10'
              : hasChanges && !isValid
              ? 'bg-rose-50 text-rose-600 border border-rose-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-transparent'
          }`}
        >
          {hasChanges && isValid ? (
            <>
              <Check className="w-3.5 h-3.5 animate-pulse" />
              Aplicar Novo Tamanho
            </>
          ) : hasChanges && !isValid ? (
            'Tamanho Inválido (use de 0.1 a 500)'
          ) : (
            'Dimensões Aplicadas'
          )}
        </button>
      </div>

      {/* Distribuicao Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 tracking-wider uppercase">
          <Sliders className="w-4 h-4 text-slate-400" />
          Quantidade e Espaçamento
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5 flex justify-between items-center">
            <span>Quantidade de Peças</span>
            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {params.quantity} unid.
            </span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateParam('quantity', Math.max(1, params.quantity - 10))}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 transition-colors"
            >
              -10
            </button>
            <button
              type="button"
              onClick={() => updateParam('quantity', Math.max(1, params.quantity - 1))}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 transition-colors"
            >
              -1
            </button>
            <input
              type="number"
              min="1"
              max="5000"
              value={params.quantity}
              onChange={(e) => updateParam('quantity', Math.max(1, parseInt(e.target.value) || 1))}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 text-center text-sm font-semibold focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all"
            />
            <button
              type="button"
              onClick={() => updateParam('quantity', Math.min(5000, params.quantity + 1))}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 transition-colors"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => updateParam('quantity', Math.min(5000, params.quantity + 10))}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 transition-colors"
            >
              +10
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Espaço entre peças
            </label>
            <div className="relative rounded-lg shadow-xs">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={params.spacingMm}
                onChange={(e) => updateParam('spacingMm', Math.max(0, parseFloat(e.target.value) || 0))}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs text-slate-400 font-mono">mm</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Margem das bordas
            </label>
            <div className="relative rounded-lg shadow-xs">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={params.marginMm}
                onChange={(e) => updateParam('marginMm', Math.max(0, parseFloat(e.target.value) || 0))}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs text-slate-400 font-mono">mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bobina Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 tracking-wider uppercase">
          <Layout className="w-4 h-4 text-slate-400" />
          Largura do Filme (Bobina)
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['28', '56', 'custom'] as FilmWidthType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateParam('filmWidthType', type)}
              className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                params.filmWidthType === type
                  ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {type === '28' ? '28 cm' : type === '56' ? '56 cm' : 'Personalizar'}
            </button>
          ))}
        </div>

        {params.filmWidthType === 'custom' && (
          <div className="mt-1">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Largura personalizada da bobina
            </label>
            <div className="relative rounded-lg shadow-xs">
              <input
                type="number"
                min="5"
                max="300"
                step="0.5"
                value={params.customFilmWidthCm}
                onChange={(e) => updateParam('customFilmWidthCm', Math.max(1, parseFloat(e.target.value) || 10))}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-3 pr-12 text-sm focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs text-slate-400 font-mono">cm</span>
              </div>
            </div>
          </div>
        )}

        {/* Nesting options */}
        <div className="mt-2 flex items-center">
          <input
            id="allow-rotation"
            type="checkbox"
            checked={params.allowRotation}
            onChange={(e) => updateParam('allowRotation', e.target.checked)}
            className="h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-colors"
          />
          <label htmlFor="allow-rotation" className="ml-2 text-xs font-medium text-slate-600 select-none cursor-pointer">
            Permitir rotação automática de 90° (Otimizar encaixe)
          </label>
        </div>
      </div>
    </div>
  );
}
