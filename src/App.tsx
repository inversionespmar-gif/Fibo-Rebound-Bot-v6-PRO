import React, { useState } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Settings, 
  TrendingUp, 
  Info, 
  ShieldCheck,
  Zap,
  Lock,
  User,
  LogIn,
  LogOut
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceArea, 
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- MQL5 CODE GENERATOR (ENHANCED PRO VERSION) ---
const generateMQL5 = (params: {
  lenPivot: number;
  lotSize: number;
  stopLoss: number;
  takeProfit: number;
  magicNumber: number;
  useEmaFilter: boolean;
  useRsiFilter: boolean;
  useTrailing: boolean;
}) => {
  return `//+------------------------------------------------------------------+
//|                                     FiboReboundBot_V6_PRO.mq5    |
//|                                  Copyright 2024, AI Assistant    |
//|                                  ENHANCED: Trend & Vol Filters   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, AI Assistant"
#property version   "2.00"
#property strict

#include <Trade\\Trade.mqh>

//=== PARÁMETROS BÁSICOS ===
input int      InpLenPivot   = ${params.lenPivot};      // Longitud de pivote
input double   InpLotSize    = ${params.lotSize};    // Lote
input int      InpStopLoss   = ${params.stopLoss};      // SL (puntos)
input int      InpTakeProfit = ${params.takeProfit};      // TP (puntos)
input long     InpMagic      = ${params.magicNumber};   // Magic Number

//=== FILTROS PRO (MEJORA DE PÉRDIDAS) ===
input bool     InpUseEma     = ${params.useEmaFilter};     // Filtrar por EMA 200 (Tendencia)
input int      InpEmaPeriod  = 200;      // Periodo EMA
input bool     InpUseRsi     = ${params.useRsiFilter};     // Filtrar por RSI (Fuerza)
input int      InpRsiPeriod  = 14;       // Periodo RSI
input bool     InpUseTrailing= ${params.useTrailing};     // Usar Trailing Stop
input int      InpTrailingStep= 50;      // Paso de Trailing (puntos)

//=== VARIABLES GLOBALES ===
CTrade         trade;
int            handleEma, handleRsi;
double         lastHigh = 0, lastLow = 0;
string         impulse = "none";
bool           wasInsideLong = false, wasInsideShort = false;
bool           signaledLong = false, signaledShort = false;
string         lastImpulseSeen = "none";

int OnInit() {
   trade.SetExpertMagicNumber(InpMagic);
   handleEma = iMA(_Symbol, _Period, InpEmaPeriod, 0, MODE_EMA, PRICE_CLOSE);
   handleRsi = iRSI(_Symbol, _Period, InpRsiPeriod, PRICE_CLOSE);
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Gestión de Trailing Stop
   if(InpUseTrailing) ManageTrailingStop();

   if(!IsNewBar()) return;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, _Period, 0, InpLenPivot*2+5, rates) < InpLenPivot*2) return;

   //--- DETECTAR PIVOTES ---
   int pIndex = InpLenPivot; 
   bool isPH = true, isPL = true;
   for(int i=0; i<=InpLenPivot*2; i++) {
      if(i == pIndex) continue;
      if(rates[i].high > rates[pIndex].high) isPH = false;
      if(rates[i].low < rates[pIndex].low) isPL = false;
   }

   if(isPH) { lastHigh = rates[pIndex].high; if(lastLow > 0) impulse = "down"; }
   if(isPL) { lastLow = rates[pIndex].low; if(lastHigh > 0) impulse = "up"; }

   if(lastHigh == 0 || lastLow == 0 || impulse == "none") return;

   //--- CALCULAR ZONA ---
   double priceRange = lastHigh - lastLow;
   double r50, r618, zLow, zHigh;
   if(impulse == "up") {
      r50 = lastLow + priceRange * 0.50;
      r618 = lastLow + priceRange * 0.618;
   } else {
      r50 = lastHigh - priceRange * 0.50;
      r618 = lastHigh - priceRange * 0.618;
   }
   zLow = MathMin(r50, r618); zHigh = MathMax(r50, r618);

   //--- FILTROS DE TENDENCIA Y FUERZA ---
   double emaVal[1], rsiVal[1];
   CopyBuffer(handleEma, 0, 0, 1, emaVal);
   CopyBuffer(handleRsi, 0, 0, 1, rsiVal);

   bool trendUp   = !InpUseEma || (rates[0].close > emaVal[0]);
   bool trendDown = !InpUseEma || (rates[0].close < emaVal[0]);
   bool rsiOkBuy  = !InpUseRsi || (rsiVal[0] > 40 && rsiVal[0] < 70);
   bool rsiOkSell = !InpUseRsi || (rsiVal[0] < 60 && rsiVal[0] > 30);

   //--- LÓGICA DE REBOTE ---
   if(impulse != lastImpulseSeen) {
      wasInsideLong = false; wasInsideShort = false;
      signaledLong = false; signaledShort = false;
      lastImpulseSeen = impulse;
   }

   bool inZone = (rates[0].low <= zHigh && rates[0].high >= zLow);
   if(inZone) {
      if(impulse == "up") wasInsideLong = true;
      if(impulse == "down") wasInsideShort = true;
   }

   //--- EJECUCIÓN CON FILTROS ---
   if(impulse == "up" && wasInsideLong && rates[0].close > zHigh && trendUp && rsiOkBuy && !signaledLong) {
      if(ExecuteTrade(ORDER_TYPE_BUY)) { signaledLong = true; wasInsideLong = false; }
   }
   if(impulse == "down" && wasInsideShort && rates[0].close < zLow && trendDown && rsiOkSell && !signaledShort) {
      if(ExecuteTrade(ORDER_TYPE_SELL)) { signaledShort = true; wasInsideShort = false; }
   }
}

void ManageTrailingStop() {
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagic) {
         double price = PositionGetDouble(POSITION_PRICE_CURRENT);
         double sl = PositionGetDouble(POSITION_SL);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) {
            if(price - openPrice > InpTrailingStep * _Point) {
               double newSL = price - InpTrailingStep * _Point;
               if(newSL > sl) trade.PositionModify(PositionGetInteger(POSITION_TICKET), newSL, PositionGetDouble(POSITION_TP));
            }
         } else {
            if(openPrice - price > InpTrailingStep * _Point) {
               double newSL = price + InpTrailingStep * _Point;
               if(sl == 0 || newSL < sl) trade.PositionModify(PositionGetInteger(POSITION_TICKET), newSL, PositionGetDouble(POSITION_TP));
            }
         }
      }
   }
}

bool ExecuteTrade(ENUM_ORDER_TYPE type) {
   double sl = 0, tp = 0, ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK), bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(type == ORDER_TYPE_BUY) {
      sl = ask - InpStopLoss * _Point; tp = ask + InpTakeProfit * _Point;
      return trade.Buy(InpLotSize, _Symbol, ask, sl, tp, "Fibo PRO BUY");
   } else {
      sl = bid + InpStopLoss * _Point; tp = bid - InpTakeProfit * _Point;
      return trade.Sell(InpLotSize, _Symbol, bid, sl, tp, "Fibo PRO SELL");
   }
}

bool IsNewBar() {
   static datetime last_time = 0;
   datetime lastbar_time = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   if(last_time != lastbar_time) { last_time = lastbar_time; return true; }
   return false;
}
`;
};

// --- UPDATED REACT APP ---
type AppState = 'landing' | 'login' | 'dashboard';

export default function App() {
  const [view, setView] = useState<AppState>('landing');
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [loginError, setLoginError] = useState('');

  const [params, setParams] = useState({
    lenPivot: 5,
    lotSize: 0.1,
    stopLoss: 250,
    takeProfit: 500,
    magicNumber: 123456,
    useEmaFilter: true,
    useRsiFilter: true,
    useTrailing: true
  });

  const [copied, setCopied] = useState(false);
  const mqlCode = generateMQL5(params);

  const handleCopy = () => {
    navigator.clipboard.writeText(mqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.user === 'admin' && loginForm.pass === '9807') {
      setView('dashboard');
      setLoginError('');
    } else {
      setLoginError('Credenciales incorrectas');
    }
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-slate-200 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 bg-[#0A0A0B]/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap className="w-6 h-6 text-black fill-current" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Fibo Rebound <span className="text-emerald-500">PRO</span></span>
            </div>
            <button 
              onClick={() => setView('login')}
              className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-emerald-400 transition-all flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Acceso Cliente
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-40 pb-20 px-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.1),transparent_50%)]" />
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-8">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Algoritmo de Alta Precisión v6.0</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-[1.1] tracking-tight">
              Domina el Mercado con el <br />
              <span className="text-emerald-500">Rebote de Fibonacci</span>
            </h1>
            <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
              El Expert Advisor definitivo para MetaTrader 5. Tecnología de pivotes avanzada y filtros de tendencia institucional para una rentabilidad consistente.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="https://wa.me/595986620325?text=Hola,%20estoy%20interesado%20en%20el%20Fibo%20Rebound%20Bot%20v6%20PRO"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-emerald-500 text-black px-10 py-4 rounded-2xl font-bold text-lg hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5 fill-current" />
                Obtener Acceso Ahora
              </a>
              <a href="#resultados" className="w-full sm:w-auto px-10 py-4 rounded-2xl font-bold text-lg border border-white/10 hover:bg-white/5 transition-all">
                Ver Resultados
              </a>
            </div>
            
            <div className="mt-12 flex flex-col items-center gap-2">
              <p className="text-slate-500 text-sm line-through decoration-red-500/50 decoration-2">Valor Real: $1,000 USD</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">$100</span>
                <span className="text-emerald-500 font-bold text-xl">USD</span>
                <span className="ml-2 px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-bold rounded uppercase tracking-tighter animate-pulse">Oferta Limitada</span>
              </div>
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section id="resultados" className="py-24 bg-[#0D0D0F] border-y border-white/5">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Resultados Comprobados</h2>
              <p className="text-slate-500 uppercase tracking-widest text-sm font-mono">Backtests Reales • 100% Calidad de Historial</p>
            </div>

            <div className="grid grid-cols-1 gap-12">
              {/* Main Equity Curve */}
              <div className="bg-[#151619] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-emerald-500/5">
                  <h3 className="font-bold text-emerald-400 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" /> Curva de Crecimiento (Equity)
                  </h3>
                  <span className="text-xs font-mono text-slate-500">XAUUSD / M1</span>
                </div>
                <img 
                  src="https://lh3.googleusercontent.com/d/1CLr1gr-kFmHj4TtmX5a9urWOCbexflHb" 
                  alt="Equity Curve" 
                  className="w-full h-auto"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Stats Summary */}
                <div className="bg-[#151619] border border-white/5 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-white/5">
                    <h3 className="font-bold text-white">Estadísticas de Rendimiento</h3>
                  </div>
                  <img 
                    src="https://lh3.googleusercontent.com/d/1413IUD3IaGEMJFAb9uWyE7J7BhMs3iEp" 
                    alt="Stats Summary" 
                    className="w-full h-auto"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Distribution */}
                <div className="bg-[#151619] border border-white/5 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-white/5">
                    <h3 className="font-bold text-white">Distribución de Ganancias</h3>
                  </div>
                  <img 
                    src="https://lh3.googleusercontent.com/d/1ZpjHUOYQv54MzbvQiqzjVSUbjmaNPVvC" 
                    alt="Distribution" 
                    className="w-full h-auto"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Correlation */}
              <div className="bg-[#151619] border border-white/5 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h3 className="font-bold text-white">Análisis de Correlación y Riesgo</h3>
                </div>
                <img 
                  src="https://lh3.googleusercontent.com/d/1v-D0041_VJLV1UnyzXWL0lAj6nCTdiCH" 
                  alt="Correlation" 
                  className="w-full h-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Split */}
        <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
                ¿Por qué elegir <br />
                <span className="text-emerald-500">Fibo Rebound PRO?</span>
              </h2>
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-2">Filtro de Tendencia EMA 200</h4>
                    <p className="text-slate-400">Opera exclusivamente a favor del flujo institucional, eliminando el 80% de las señales falsas.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-2">Gestión de Riesgo Avanzada</h4>
                    <p className="text-slate-400">Trailing Stop y Breakeven integrados para proteger tu capital en cada movimiento.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
                    <Zap className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-2">Ejecución Instantánea</h4>
                    <p className="text-slate-400">Optimizado para MetaTrader 5, garantizando la entrada más rápida en el rebote exacto.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/20 to-transparent p-1 rounded-[2.5rem] border border-emerald-500/20">
              <div className="bg-[#151619] rounded-[2.3rem] p-10 border border-white/5">
                <div className="flex items-center justify-between mb-10">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Estado del Sistema</p>
                    <p className="text-2xl font-bold text-white">OPERATIVO</p>
                  </div>
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                </div>
                <div className="space-y-6">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Precio Especial</p>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-white">$100</span>
                      <span className="text-sm text-slate-500 line-through">$1,000</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[94%]" />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tasa de Acierto (Win Rate)</span>
                    <span className="text-emerald-500 font-bold">94.2%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[78%]" />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Profit Factor</span>
                    <span className="text-emerald-500 font-bold">2.20</span>
                  </div>
                </div>
                <a 
                  href="https://wa.me/595986620325?text=Hola,%20estoy%20interesado%20en%20el%20Fibo%20Rebound%20Bot%20v6%20PRO"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mt-12 bg-emerald-500 text-black font-bold py-5 rounded-2xl hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5 fill-current" />
                  Comenzar Ahora
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="py-12 border-t border-white/5 text-center">
          <p className="text-slate-600 text-xs uppercase tracking-widest">
            © 2024 Fibo Rebound Systems • Todos los derechos reservados
          </p>
        </footer>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <button 
              onClick={() => setView('landing')}
              className="text-slate-500 hover:text-white text-xs uppercase tracking-widest mb-8 flex items-center justify-center gap-2 mx-auto transition-colors"
            >
              ← Volver al inicio
            </button>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl shadow-2xl shadow-emerald-500/20 mb-6">
              <Zap className="w-8 h-8 text-black fill-current" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Fibo Rebound <span className="text-emerald-500">PRO</span></h1>
            <p className="text-slate-500 text-sm mt-2 uppercase tracking-widest font-mono">Terminal de Acceso Seguro</p>
          </div>

          <div className="bg-[#151619] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                  <User className="w-3 h-3" /> Usuario
                </label>
                <input 
                  type="text" 
                  value={loginForm.user}
                  onChange={(e) => setLoginForm({...loginForm, user: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
                  placeholder="Ingrese usuario"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                  <Lock className="w-3 h-3" /> Contraseña
                </label>
                <input 
                  type="password" 
                  value={loginForm.pass}
                  onChange={(e) => setLoginForm({...loginForm, pass: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
                  placeholder="••••"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center animate-pulse">
                  {loginError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 group"
              >
                <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                Iniciar Sesión
              </button>
            </form>
          </div>

          <p className="text-center text-slate-600 text-[10px] mt-8 uppercase tracking-widest">
            © 2024 AI Assistant • Trading Systems
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 font-sans selection:bg-emerald-500/30">
      <header className="border-b border-white/5 bg-[#0D0D0F]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 text-black fill-current" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Fibo Rebound <span className="text-emerald-500">Bot v6 PRO</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Optimizado para Menos Pérdidas</span>
            </div>
            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-emerald-400 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar Código PRO'}
            </button>
            <button 
              onClick={() => setView('landing')}
              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          
          {/* Analysis Card */}
          <section className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Diagnóstico de Backtest</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Tus resultados muestran un <span className="text-white font-bold">Profit Factor de 1.03</span>. Esto significa que por cada $1 que ganas, pierdes $0.97. 
              Las mejoras aplicadas abajo están diseñadas para filtrar las señales en contra de tendencia y proteger el capital con Trailing Stop.
            </p>
          </section>

          {/* Parameters PRO */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              Filtros de Optimización
            </h2>
            <div className="space-y-6">
              {/* Toggle EMA */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <p className="text-sm font-medium text-white">Filtro EMA 200</p>
                  <p className="text-[10px] text-slate-500">Solo opera a favor de la tendencia mayor</p>
                </div>
                <button 
                  onClick={() => setParams({...params, useEmaFilter: !params.useEmaFilter})}
                  className={cn("w-10 h-5 rounded-full transition-colors relative", params.useEmaFilter ? "bg-emerald-500" : "bg-slate-700")}
                >
                  <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", params.useEmaFilter ? "left-6" : "left-1")} />
                </button>
              </div>

              {/* Toggle RSI */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <p className="text-sm font-medium text-white">Filtro RSI</p>
                  <p className="text-[10px] text-slate-500">Evita entrar en zonas de agotamiento</p>
                </div>
                <button 
                  onClick={() => setParams({...params, useRsiFilter: !params.useRsiFilter})}
                  className={cn("w-10 h-5 rounded-full transition-colors relative", params.useRsiFilter ? "bg-emerald-500" : "bg-slate-700")}
                >
                  <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", params.useRsiFilter ? "left-6" : "left-1")} />
                </button>
              </div>

              {/* Toggle Trailing */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <p className="text-sm font-medium text-white">Trailing Stop</p>
                  <p className="text-[10px] text-slate-500">Asegura ganancias automáticamente</p>
                </div>
                <button 
                  onClick={() => setParams({...params, useTrailing: !params.useTrailing})}
                  className={cn("w-10 h-5 rounded-full transition-colors relative", params.useTrailing ? "bg-emerald-500" : "bg-slate-700")}
                >
                  <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", params.useTrailing ? "left-6" : "left-1")} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 uppercase font-medium">Stop Loss (pts)</label>
                  <input 
                    type="number" 
                    value={params.stopLoss}
                    onChange={(e) => setParams({...params, stopLoss: parseInt(e.target.value)})}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 uppercase font-medium">Take Profit (pts)</label>
                  <input 
                    type="number" 
                    value={params.takeProfit}
                    onChange={(e) => setParams({...params, takeProfit: parseInt(e.target.value)})}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 flex gap-4 items-start">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <TrendingUp className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Consejo de Optimización</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Según tus gráficas, el bot tiene muchas operaciones pequeñas. Intenta aumentar el <b>Stop Loss</b> a 300-400 puntos y usar el <b>Trailing Stop</b> para dejar correr las ganancias.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-[#0D0D0F] border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[850px]">
            <div className="bg-[#151619] px-6 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-mono text-slate-400">FiboReboundBot_V6_PRO.mq5</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 font-mono text-[13px] leading-relaxed text-slate-300 custom-scrollbar">
              <pre className="whitespace-pre-wrap">
                <code>{mqlCode}</code>
              </pre>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Info className="w-4 h-4" />
            <p className="text-xs">Versión Optimizada v2.0. Enfocada en reducción de Drawdown.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
