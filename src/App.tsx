import React, { useState, useEffect } from 'react';
import { Artwork, NestingParams, NestingResult } from './types';
import { calculateNesting } from './utils/nester';
import { traceText } from './utils/vectorizer';
import ParameterControls from './components/ParameterControls';
import TemplateGallery from './components/TemplateGallery';
import UploadSection from './components/UploadSection';
import PreviewCanvas from './components/PreviewCanvas';
import StatsPanel from './components/StatsPanel';
import ExportSection from './components/ExportSection';
import LandingPage from './components/LandingPage';
import DtfNestingTool from './components/DtfNestingTool';
import { auth, signOut, User } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Scissors, HelpCircle, Layers, FileCode, Sparkles, LogOut, User as UserIcon } from 'lucide-react';

const DEFAULT_PARAMS: NestingParams = {
  artworkWidthCm: 12,
  artworkHeightCm: 5,
  quantity: 120,
  spacingMm: 2,
  marginMm: 5,
  filmWidthType: '56',
  customFilmWidthCm: 60,
  allowRotation: true,
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [params, setParams] = useState<NestingParams>(DEFAULT_PARAMS);
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [nestingResult, setNestingResult] = useState<NestingResult>({
    items: [],
    filmWidthCm: 56,
    filmHeightCm: 0,
    piecesPerRow: 0,
    totalRows: 0,
    efficiency: 0,
    waste: 100,
  });

  const [activeTab, setActiveTab] = useState<'text' | 'upload'>('text');
  const [currentModule, setCurrentModule] = useState<'plotter' | 'dtf'>('plotter');

  // Monitor real-time authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else if (user && !user.isDemo) {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Initialize with a beautiful default text artwork on first load
  useEffect(() => {
    const defaultText = 'RECORTE';
    const trace = traceText(defaultText, 'Impact', 'bold');
    
    if (trace.paths.length > 0) {
      setArtwork({
        id: 'default-text',
        name: `Texto: "${defaultText}"`,
        type: 'text',
        widthCm: DEFAULT_PARAMS.artworkWidthCm,
        heightCm: DEFAULT_PARAMS.artworkHeightCm,
        paths: trace.paths,
        viewBox: trace.viewBox,
        text: defaultText,
        fontFamily: 'Impact',
        fontWeight: 'bold',
      });
    }
  }, []);

  // Sync artwork width/height back to parameters if the artwork changes
  const handleArtworkChange = (newArtwork: Artwork) => {
    setArtwork(newArtwork);
    setParams((prev) => ({
      ...prev,
      artworkWidthCm: newArtwork.widthCm,
      artworkHeightCm: newArtwork.heightCm,
    }));
  };

  // Run nesting calculation whenever parameters or artwork dimensions change
  useEffect(() => {
    const result = calculateNesting(params);
    setNestingResult(result);
  }, [params]);

  // If parameters change, update the artwork's scale representation in params
  const handleParamsChange = (newParams: NestingParams) => {
    setParams(newParams);
    if (artwork) {
      setArtwork((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          widthCm: newParams.artworkWidthCm,
          heightCm: newParams.artworkHeightCm,
        };
      });
    }
  };

  const handleReset = () => {
    setParams(DEFAULT_PARAMS);
    if (artwork) {
      setArtwork((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          widthCm: DEFAULT_PARAMS.artworkWidthCm,
          heightCm: DEFAULT_PARAMS.artworkHeightCm,
        };
      });
    }
  };

  const handleLogout = async () => {
    if (user?.isDemo) {
      setUser(null);
    } else {
      try {
        await signOut(auth);
        setUser(null);
      } catch (err) {
        console.error("Erro ao deslogar:", err);
        setUser(null); // Force local state clean anyway
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg animate-bounce">
            <Scissors className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <h2 className="text-sm font-black text-slate-800">Carregando Plotter Plot...</h2>
            <p className="text-xs text-slate-400 font-medium">Iniciando ambiente seguro</p>
          </div>
          <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-indigo-600 rounded-full w-2/3 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage 
        onLoginSuccess={(u) => setUser(u)} 
        onBypassLogin={() => setUser({ 
          displayName: 'Convidado de Demonstração', 
          email: 'convidado@demo.com', 
          photoURL: null,
          isDemo: true 
        })} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col antialiased font-sans">
      {/* Professional Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 shrink-0">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-md font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Plotter Suite
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                    V1.2
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Sua Oficina Digital
                </p>
              </div>
            </div>

            {/* Módulo selector tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setCurrentModule('plotter')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentModule === 'plotter'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                Filme de Recorte
              </button>
              <button
                type="button"
                onClick={() => setCurrentModule('dtf')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentModule === 'dtf'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Montagem DTF Têxtil
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-between sm:justify-end w-full sm:w-auto">
            {artwork && (
              <div className="hidden md:flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-end gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Arte Ativa
                </span>
                <span className="text-xs font-extrabold text-slate-700 truncate max-w-[200px]">
                  {artwork.name} ({artwork.widthCm}x{artwork.heightCm} cm)
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50/70 border border-indigo-100/30 px-1.5 py-0.5 rounded-md mt-0.5 self-end">
                  Nós de Corte: {artwork.paths.reduce((acc, p) => acc + (p.controlPointsCount || p.points.length), 0)} nós
                </span>
              </div>
            )}

            <div className="h-8 w-[1px] bg-slate-100 hidden md:block"></div>

            {/* Logged in user profile & sign out */}
            <div className="flex items-center gap-3 bg-slate-50 p-1.5 pr-3 rounded-2xl border border-slate-100">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  referrerPolicy="no-referrer" 
                  alt={user.displayName || "Usuário"} 
                  className="w-8 h-8 rounded-xl object-cover shadow-xs border border-white"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shadow-xs">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col text-left">
                <span className="text-xs font-black text-slate-800 leading-none truncate max-w-[120px]">
                  {user.displayName || 'Usuário'}
                </span>
                <span className="text-[9px] text-slate-400 font-semibold leading-tight truncate max-w-[120px]">
                  {user.email || 'Conectado'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Sair da Conta"
                className="ml-2 w-7 h-7 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Switch main view between Plotter and DTF Nesting modules */}
      {currentModule === 'dtf' ? (
        <DtfNestingTool />
      ) : (
        <>
          {/* Main Grid Workspace */}
          <main className="max-w-7xl mx-auto w-full flex-1 px-4 py-6 md:px-6 flex flex-col lg:grid lg:grid-cols-12 gap-6 animate-fadeIn">
            {/* Left Control Panel Column (Spans 5 cols on lg screen) */}
            <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto">
              {/* Creative Input Mode Selection (Text Generator vs Custom Image Upload) */}
              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex gap-2">
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'text'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Texto & Formas
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                  Importar Imagem/SVG
                </button>
              </div>

              {/* Active Creative Panel */}
              {activeTab === 'text' ? (
                <TemplateGallery
                  onSelectArtwork={handleArtworkChange}
                  currentArtworkId={artwork?.id || ''}
                />
              ) : (
                <UploadSection
                  onArtworkLoaded={handleArtworkChange}
                  currentArtwork={artwork}
                />
              )}

              {/* Parameter Settings */}
              <ParameterControls
                params={params}
                onChange={handleParamsChange}
                onReset={handleReset}
              />

              {/* Efficiency & Statistics */}
              <StatsPanel result={nestingResult} params={params} />

              {/* Export & Download Center */}
              <ExportSection result={nestingResult} artwork={artwork} />
            </div>

            {/* Right Preview Canvas Column (Spans 7 cols on lg screen) */}
            <div className="lg:col-span-7 flex flex-col h-full min-h-[550px] lg:h-[calc(100vh-140px)] sticky top-[92px]">
              <PreviewCanvas result={nestingResult} artwork={artwork} />
            </div>
          </main>

          {/* Footer copyright */}
          <footer className="bg-white border-t border-slate-100 mt-auto py-4 px-6 text-center text-[10px] text-slate-400 font-medium">
            Gerador de Filme de Recorte © 2026. Todos os arquivos gerados são compatíveis com Silhouette Studio, Graphtec, SignMaster e Adobe Illustrator.
          </footer>
        </>
      )}
    </div>
  );
}
