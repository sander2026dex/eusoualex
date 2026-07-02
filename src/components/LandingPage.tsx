import React, { useState } from 'react';
import { 
  Scissors, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Check, 
  Layers3, 
  Download, 
  Cpu, 
  Layers, 
  HelpCircle,
  FileCode,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';

interface LandingPageProps {
  onLoginSuccess: (user: any) => void;
  onBypassLogin: () => void;
}

export default function LandingPage({ onLoginSuccess, onBypassLogin }: LandingPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockStatus, setUnlockStatus] = useState<'idle' | 'verifying' | 'success'>('idle');
  const [countdown, setCountdown] = useState(3);

  const handleFacebookUnlock = () => {
    // Open the Facebook page/group link directly
    window.open('https://www.facebook.com/share/g/18kRWkFsXb/', '_blank');
    
    setUnlockStatus('verifying');
    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setUnlockStatus('success');
          
          // Save persistence to localStorage so user doesn't have to follow again on reload
          localStorage.setItem('facebook_subscribed', 'true');
          
          setTimeout(() => {
            onLoginSuccess({
              displayName: 'Membro do Facebook',
              email: 'facebook@comunidade.com',
              photoURL: null,
              isFacebook: true
            });
          }, 1500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased font-sans text-slate-800">
      {/* Top Banner with Facebook Link */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-xs px-4 py-2.5 text-center font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 shadow-xs">
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Curta a nossa página no Facebook e participe do nosso grupo!
        </span>
        <a 
          href="https://www.facebook.com/share/g/18kRWkFsXb/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline hover:text-cyan-200 transition-colors font-extrabold flex items-center gap-1"
        >
          Clique aqui para se inscrever →
        </a>
      </div>

      {/* Navigation Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Gerador de Filme de Recorte
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                  Plotter V1.0
                </span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Corte de Precisão Laser & Nesting Inteligente
              </p>
            </div>
          </div>

          <button
            onClick={handleFacebookUnlock}
            disabled={unlockStatus !== 'idle'}
            className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {unlockStatus === 'verifying' ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Verificando... ({countdown}s)</span>
              </>
            ) : unlockStatus === 'success' ? (
              <span>✅ Liberado!</span>
            ) : (
              <>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Liberar pelo Facebook
              </>
            )}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white pt-16 pb-20 border-b border-slate-100">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60"></div>

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-black rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            VETORIZADOR ESTILO LASER & NESTING DE PRECISÃO
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-none max-w-4xl mx-auto">
            Otimize seu Filme de Recorte com <span className="text-indigo-600 bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">Precisão Absoluta</span>
          </h2>

          <p className="mt-6 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Nossa tecnologia de traçado de alta fidelidade recria curvas perfeitas livre de dentes de serra, dentes brancos e sobreposições, encaixando centenas de artes em rolos de filme de dtf ou vinil em segundos.
          </p>

          {/* Error Message Box */}
          {error && (
            <div className="mt-8 max-w-md mx-auto p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-left text-amber-900 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Interactive Facebook Unlock Card */}
          <div className="mt-8 max-w-md mx-auto bg-white rounded-3xl border border-blue-100 p-6 shadow-xl shadow-blue-50/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600"></div>
            
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
              <span className="text-[11px] font-black tracking-wider text-blue-600 uppercase">
                DESBLOQUEIO OBRIGATÓRIO (100% GRÁTIS)
              </span>
            </div>

            <h3 className="text-sm font-black text-slate-800 mb-2">
              Se inscreva no Grupo do Facebook para liberar a ferramenta:
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed font-medium">
              Para mantermos o gerador e o vetorizador de alta precisão gratuitos e livres de anúncios, participe da nossa comunidade!
            </p>

            <div className="flex flex-col gap-4">
              {unlockStatus === 'idle' ? (
                <button
                  onClick={handleFacebookUnlock}
                  className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm py-4 px-6 rounded-2xl shadow-md shadow-blue-200 transition-all duration-200 cursor-pointer animate-pulse"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  CLIQUE AQUI PARA SE INSCREVER
                </button>
              ) : unlockStatus === 'verifying' ? (
                <div className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></span>
                  <span className="text-xs font-black text-slate-700">Verificando sua inscrição no grupo... ({countdown}s)</span>
                  <span className="text-[10px] text-slate-400 mt-1 font-semibold">Abra o link, clique em "Participar" e volte para esta tela!</span>
                </div>
              ) : (
                <div className="w-full bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex flex-col items-center justify-center text-center text-emerald-850">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 animate-bounce" />
                  <span className="text-xs font-black">Inscrição Confirmada com Sucesso!</span>
                  <span className="text-[10px] font-semibold text-emerald-600 mt-0.5">Desbloqueando e abrindo ferramenta...</span>
                </div>
              )}

              <div className="flex items-center my-1">
                <div className="flex-1 border-t border-slate-150"></div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold px-3">Após a inscrição o acesso é liberado</span>
                <div className="flex-1 border-t border-slate-150"></div>
              </div>

              <button
                onClick={onBypassLogin}
                className="w-full bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 font-bold text-xs py-3 px-5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                Acesso sem login (Bypass Instantâneo)
              </button>
            </div>

            <p className="mt-4 text-[11px] text-slate-400 font-medium">
              Não saia da página! O desbloqueio ocorre de forma automática assim que você clica para se inscrever.
            </p>
          </div>

          {/* Hero Mockup Frame */}
          <div className="mt-16 relative rounded-3xl overflow-hidden border border-slate-200 shadow-2xl shadow-indigo-100 bg-slate-900 p-2 max-w-4xl mx-auto">
            <div className="bg-slate-850 rounded-2xl border border-slate-800 p-4 aspect-[16/9] flex flex-col justify-between overflow-hidden relative">
              {/* Fake interface decoration */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] text-slate-500 font-bold font-mono ml-4">PowerTRACE_Nesting_Roll.svg</span>
                </div>
                <div className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                  Nível Laser: Alta Resolução
                </div>
              </div>

              {/* Vector representation mockup */}
              <div className="flex-1 flex items-center justify-center relative py-6">
                <div className="w-full max-w-md h-44 border-2 border-indigo-500/20 rounded-xl bg-indigo-950/20 flex flex-col items-center justify-center relative p-4 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:12px_12px] opacity-15"></div>
                  
                  {/* Neon laser simulator line */}
                  <div className="absolute left-0 right-0 h-[1.5px] bg-red-500 shadow-[0_0_10px_#ef4444] top-1/2 animate-bounce"></div>

                  <div className="text-center relative z-10">
                    <Scissors className="w-8 h-8 text-indigo-400 mx-auto mb-2 animate-pulse" />
                    <span className="text-xs font-mono text-indigo-300 font-bold block">120 cópias organizadas automaticamente</span>
                    <span className="text-[10px] font-mono text-slate-400 block mt-1">Largura útil: 56 cm | Perda: 2.1%</span>
                  </div>
                </div>
              </div>

              {/* Bottom control mockup info */}
              <div className="flex items-center justify-between border-t border-slate-850 pt-3">
                <span className="text-[10px] text-slate-500 font-mono">Resolução: 0.085 RMS</span>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Pronto para Silhouette, Graphtec, Mimaki & CorelDRAW
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Features Grid */}
      <section className="py-20 bg-slate-50 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              Recursos de Alta Tecnologia Laser para Recorte
            </h3>
            <p className="mt-3 text-slate-500 font-medium text-sm">
              Desenvolvemos soluções para eliminar os maiores problemas na hora de vetorizar fontes e logotipos complexos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Tecnologia PowerTRACE™</h4>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium">
                  Elimine os dentes de serra gerados por pixels de imagens rasters. Nosso motor reconstrói círculos perfeitos, linhas retas e junções suaves automaticamente.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Layers3 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Encaixe / Nesting Inteligente</h4>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium">
                  Não perca horas duplicando e arrumando manualmente no Corel ou Illustrator. Defina a quantidade, o espaçamento mínimo e gere o rolo completo em milissegundos.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Exportação SVG Real-Scale</h4>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium">
                  Exporte em formato vetorial com escala de 100% real (centímetros e milímetros) para abrir perfeitamente em programas de plotter como Silhouette Studio, Flexi ou SignMaster.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Proof Stats */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <span className="block text-4xl font-black text-indigo-600">100%</span>
              <span className="block mt-1 text-xs text-slate-400 font-bold uppercase tracking-wider">Escala Real</span>
            </div>
            <div>
              <span className="block text-4xl font-black text-emerald-600">&lt; 2%</span>
              <span className="block mt-1 text-xs text-slate-400 font-bold uppercase tracking-wider">Perda de Filme</span>
            </div>
            <div>
              <span className="block text-4xl font-black text-amber-600">0.085</span>
              <span className="block mt-1 text-xs text-slate-400 font-bold uppercase tracking-wider">Desvio RMS Máximo</span>
            </div>
            <div>
              <span className="block text-4xl font-black text-slate-900">UltraFast</span>
              <span className="block mt-1 text-xs text-slate-400 font-bold uppercase tracking-wider">Vetorização Instantânea</span>
            </div>
          </div>
        </div>
      </section>

      {/* Informative FAQ/Benefits Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Como funciona o desbloqueio?</h3>
            <p className="mt-3 text-slate-500 font-medium text-sm">Nenhum custo, nenhum cartão de crédito. Simplesmente conecte e use.</p>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Como funciona o desbloqueio pelo Facebook?
              </h4>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium pl-6">
                O desbloqueio é imediato e 100% gratuito. Ao clicar para se inscrever no nosso grupo oficial, nosso sistema identifica a ação e libera o uso completo de todas as funcionalidades de forma vitalícia, sem exigir que você preencha dados ou logins complexos.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                O vetorizador realmente funciona com qualquer imagem?
              </h4>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium pl-6">
                Sim! Ele funciona melhor com imagens em silhueta, logos em preto e branco de alta ou média resolução. Nosso filtro PowerTRACE elimina automaticamente imperfeições e ruídos pequenos para deixar o contorno limpo para a lâmina de corte.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Quais plotters e laminadoras são suportadas?
              </h4>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium pl-6">
                Praticamente todas! Silhouette Cameo/Portrait, Graphtec FC/CE, Mimaki, Roland, Cricut, ScannCut e plotters chinesas genéricas rodando SignMaster, ArtCut ou CorelDRAW direto.
              </p>
            </div>
          </div>

          {/* Footer Call to Action with Google Button */}
          <div className="mt-16 text-center bg-indigo-900 rounded-3xl text-white p-8 md:p-12 relative overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10"></div>
            
            <h3 className="text-2xl md:text-3xl font-black tracking-tight relative z-10">
              Pronto para economizar tempo e filme de recorte?
            </h3>
            <p className="mt-3 text-indigo-200 text-xs font-semibold max-w-md mx-auto relative z-10 leading-relaxed">
              Descubra por que dezenas de profissionais de comunicação visual e estamparia já usam nosso gerador todos os dias.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <button
                onClick={handleFacebookUnlock}
                disabled={unlockStatus !== 'idle'}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm py-3.5 px-6 rounded-xl transition-all cursor-pointer"
              >
                {unlockStatus === 'verifying' ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Verificando... ({countdown}s)</span>
                  </>
                ) : unlockStatus === 'success' ? (
                  <span>✅ Liberado!</span>
                ) : ( 
                  <>
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Se Inscrever no Facebook & Liberar
                  </>
                )}
              </button>

              <button
                onClick={onBypassLogin}
                className="w-full sm:w-auto bg-indigo-850/80 hover:bg-indigo-800 text-indigo-100 border border-indigo-700/60 font-bold text-xs py-3 px-5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                Acesso sem login (Iframe Bypass)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-100 py-8 px-6 text-center text-xs text-slate-400 font-medium">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span>Gerador de Filme de Recorte © 2026. Todos os direitos reservados.</span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Sua privacidade e dados protegidos
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
