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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onLoginSuccess(result.user);
    } catch (err: any) {
      console.error("Erro no login com Google:", err);
      if (err.code === 'auth/popup-blocked') {
        setError(
          'O navegador bloqueou o pop-up de login. Por favor, ative os pop-ups ou utilize o "Acesso de Demonstração" abaixo.'
        );
      } else if (err.code === 'auth/iframe-userAgent-to-redirect-behavior') {
        setError(
          'Ambiente de visualização restrito. Por favor, use o "Acesso de Demonstração" abaixo para testar instantaneamente.'
        );
      } else {
        setError(
          'Não foi possível conectar via Google neste momento (restrição de ambiente). Use o botão de demonstração abaixo para liberar.'
        );
      }
    } finally {
      setLoading(false);
    }
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
            onClick={handleGoogleLogin}
            disabled={loading}
            className="hidden sm:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Entrar com Google
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

          {/* Interactive Login Options Card */}
          <div className="mt-8 max-w-md mx-auto bg-slate-50 rounded-3xl border border-slate-100 p-6 shadow-xl shadow-slate-100/50">
            <h3 className="text-sm font-bold text-slate-800 mb-4">
              Crie sua conta ou faça login para ter acesso gratuito e vitalício
            </h3>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-black text-sm py-4 px-6 rounded-2xl shadow-md transition-all duration-200 cursor-pointer"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Acessar Grátis com o Google
                  </>
                )}
              </button>

              <div className="flex items-center my-2">
                <div className="flex-1 border-t border-slate-200"></div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3">Ou use a demonstração</span>
                <div className="flex-1 border-t border-slate-200"></div>
              </div>

              <button
                onClick={onBypassLogin}
                className="w-full bg-white hover:bg-slate-100 text-indigo-600 border border-indigo-200 font-bold text-xs py-3 px-5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                Acesso de Teste Instantâneo (Bypass Iframe)
              </button>
            </div>

            <p className="mt-4 text-[11px] text-slate-400 font-medium">
              Conexão 100% segura provida pelo Firebase Google Auth.
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
                Por que preciso me cadastrar via Google?
              </h4>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium pl-6">
                O cadastro e autenticação garantem que sua sessão seja segura para salvar as preferências de material de corte (largura do filme, espaçamento) e também nos ajuda a mitigar abusos de bots no processamento do vetorizador de alta precisão.
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
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-white hover:bg-slate-100 disabled:bg-slate-300 text-slate-900 font-black text-sm py-3.5 px-6 rounded-xl transition-all cursor-pointer"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Acessar Ferramenta Grátis
                  </>
                )}
              </button>

              <button
                onClick={onBypassLogin}
                className="w-full sm:w-auto bg-indigo-800/80 hover:bg-indigo-800 text-indigo-100 border border-indigo-700/60 font-bold text-xs py-3 px-5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
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
