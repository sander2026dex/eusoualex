import React, { useState, useEffect, useRef } from 'react';
import { traceText } from '../utils/vectorizer';
import { Artwork } from '../types';
import { Type, Sparkles } from 'lucide-react';

interface TemplateGalleryProps {
  onSelectArtwork: (artwork: Artwork) => void;
  currentArtworkId: string;
}

const FONTS = [
  { name: 'Impact (Esportivo / Bloco)', value: 'Impact' },
  { name: 'Sans-Serif Moderno (Inter)', value: 'Inter' },
  { name: 'Collegiate Slab (Courier New)', value: 'Courier New' },
  { name: 'Serif Elegante (Georgia)', value: 'Georgia' },
  { name: 'Arial Black', value: 'Arial Black' },
];

export default function TemplateGallery({ onSelectArtwork, currentArtworkId }: TemplateGalleryProps) {
  const [inputText, setInputText] = useState('2026'); // Pre-fill with user's specific request '2026'
  const [selectedFont, setSelectedFont] = useState('Impact');
  const [isBold, setIsBold] = useState(true);
  const [isVertical, setIsVertical] = useState(true); // Default to vertical stacked layout as requested by user
  const [isHollow, setIsHollow] = useState(true); // Default to true (hollow double outlines) to match user's image exactly
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Trigger text tracing when input text, font, bold, layout, or style changes
  useEffect(() => {
    if (!inputText.trim()) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const weight = isBold ? 'bold' : 'normal';
      const result = traceText(inputText, selectedFont, weight, isVertical, isHollow);
      
      if (result.paths.length > 0) {
        // Automatically calculate perfect proportional dimensions
        const aspect = result.viewBox.width / (result.viewBox.height || 1);
        let w = 12;
        let h = 5;

        if (isVertical) {
          // A vertical layout is narrower than it is high
          w = 6;
          h = parseFloat((6 / aspect).toFixed(1));
        } else {
          // A horizontal layout is wider than it is high
          w = 12;
          h = parseFloat((12 / aspect).toFixed(1));
        }

        onSelectArtwork({
          id: 'custom-text',
          name: `Texto: "${inputText}"`,
          type: 'text',
          widthCm: w,
          heightCm: h,
          paths: result.paths,
          viewBox: result.viewBox,
          text: inputText,
          fontFamily: selectedFont,
          fontWeight: weight,
        });
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [inputText, selectedFont, isBold, isVertical, isHollow]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Type className="w-5 h-5 text-indigo-600" />
        <h2 className="text-sm font-bold text-slate-800">
          Vetorizar Texto Personalizado
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Digite o Texto do Filme
          </label>
          <input
            type="text"
            value={inputText}
            maxLength={25}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ex: SILK, TURMA, 2026..."
            className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Orientação do Texto (Layout de Corte)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsVertical(false)}
              className={`py-2.5 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                !isVertical
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Horizontal (Linear)
            </button>
            <button
              type="button"
              onClick={() => setIsVertical(true)}
              className={`py-2.5 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                isVertical
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Vertical (Empilhado)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Estilo da Borda / Linha de Corte
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsHollow(false)}
              className={`py-2.5 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                !isHollow
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Sólido (Apenas Silhueta)
            </button>
            <button
              type="button"
              onClick={() => setIsHollow(true)}
              className={`py-2.5 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                isHollow
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Vazado (Linha Dupla)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Escolher Fonte
            </label>
            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-xs font-medium focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all"
            >
              {FONTS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="block text-xs font-medium text-slate-600 mb-1.5 opacity-0">
              Estilo
            </label>
            <button
              type="button"
              onClick={() => setIsBold(!isBold)}
              className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                isBold
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Negrito / Bold (Recomendado)
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 italic leading-relaxed">
          * O texto é convertido em contorno vetorial em tempo real usando o algoritmo de vetorização Moore-Neighbor de altíssima precisão. Ideal para criar nomes e números personalizados para camisetas!
        </p>
      </div>
    </div>
  );
}
