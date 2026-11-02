import React, { useState } from 'react';
import { 
  Download, 
  X, 
  Smartphone, 
  Monitor, 
  Share2, 
  PlusSquare, 
  CheckCircle2, 
  Laptop,
  Check,
  Sparkles
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isDesktop, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'detected' | 'ios' | 'android' | 'desktop'>('detected');
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstalledSuccessfully(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const detectedPlatformName = isIOS 
    ? 'iPhone / iPad (iOS)' 
    : isAndroid 
      ? 'Móvil Android' 
      : 'Computadora / Escritorio';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-[#CBD5E1] overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0B1C30] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Instalar CashFlow Pro</h2>
              <p className="text-xs text-slate-300">Úsala como aplicación nativa en tu móvil o escritorio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">

          {/* Already installed banner */}
          {isInstalled ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-900">¡La aplicación ya está instalada!</p>
                <p className="text-[11px] text-emerald-700">
                  Ya estás ejecutando CashFlow Pro en modo ventana independiente o pantalla completa.
                </p>
              </div>
            </div>
          ) : installedSuccessfully ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-in zoom-in-95">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-900">¡Instalación completada!</p>
                <p className="text-[11px] text-emerald-700">
                  Encontrarás el icono de CashFlow Pro en tu pantalla de inicio o menú de aplicaciones.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Direct 1-Click Install Button (When browser provides event) */}
              {isInstallable && (
                <div className="p-4 bg-slate-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Instalación Rápida con 1 Clic
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tu navegador permite instalar CashFlow Pro directamente como aplicación de escritorio o móvil sin descargas de tiendas.
                  </p>
                  <button
                    onClick={handleInstallClick}
                    className="w-full flex items-center justify-center gap-2 bg-[#0B1C30] hover:bg-[#1E293B] text-emerald-400 hover:text-emerald-300 font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Instalar Aplicación Ahora</span>
                  </button>
                </div>
              )}

              {/* Navigation Tabs for Platform Guides */}
              <div className="flex border-b border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('detected')}
                  className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'detected'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tu Dispositivo ({detectedPlatformName})
                </button>
                <button
                  onClick={() => setActiveTab('android')}
                  className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'android'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Android
                </button>
                <button
                  onClick={() => setActiveTab('ios')}
                  className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'ios'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  iPhone / iPad
                </button>
                <button
                  onClick={() => setActiveTab('desktop')}
                  className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'desktop'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  PC / Mac
                </button>
              </div>

              {/* Platform Guides Content */}
              <div className="space-y-3 text-xs">
                
                {/* Auto detected or Selected Platform */}
                {(activeTab === 'detected' && isIOS) || activeTab === 'ios' ? (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>Cómo instalar en Safari (iOS / iPhone / iPad):</span>
                    </div>
                    <ol className="space-y-2.5 text-slate-600 list-decimal list-inside text-xs leading-relaxed">
                      <li>
                        Abre esta página en el navegador <strong>Safari</strong> de tu iPhone o iPad.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">2.</span>
                        <span>
                          Toca el botón <strong>Compartir</strong> <Share2 className="w-3.5 h-3.5 inline text-blue-600 mx-1" /> en la barra inferior de Safari.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">3.</span>
                        <span>
                          Desplázate hacia abajo y selecciona <strong>"Agregar al inicio"</strong> (o <em>"Add to Home Screen"</em> <PlusSquare className="w-3.5 h-3.5 inline text-slate-700 mx-1" />).
                        </span>
                      </li>
                      <li>
                        Toca <strong>Agregar</strong> en la esquina superior derecha. ¡Listo! El icono aparecerá en tu pantalla principal como una app nativa sin barras de navegación.
                      </li>
                    </ol>
                  </div>
                ) : null}

                {(activeTab === 'detected' && isAndroid) || activeTab === 'android' ? (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>Cómo instalar en Android (Chrome o navegador predeterminado):</span>
                    </div>
                    <ol className="space-y-2.5 text-slate-600 list-decimal list-inside text-xs leading-relaxed">
                      <li>
                        En <strong>Google Chrome</strong>, toca el menú de los tres puntos <span className="font-bold">⋮</span> en la esquina superior derecha.
                      </li>
                      <li>
                        Selecciona la opción <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
                      </li>
                      <li>
                        Confirma tocando <strong>Instalar</strong>. La app se integrará con el cajón de aplicaciones de tu teléfono con soporte offline.
                      </li>
                    </ol>
                  </div>
                ) : null}

                {(activeTab === 'detected' && isDesktop) || activeTab === 'desktop' ? (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Laptop className="w-4 h-4 text-emerald-600" />
                      <span>Cómo instalar en PC Windows, Mac o Linux (Chrome / Edge):</span>
                    </div>
                    <ol className="space-y-2.5 text-slate-600 list-decimal list-inside text-xs leading-relaxed">
                      <li>
                        En la barra de direcciones superior de tu navegador (Chrome o Edge), busca el icono de <strong>Instalar</strong> <Download className="w-3.5 h-3.5 inline text-slate-700 mx-1" /> al extremo derecho junto a la estrella de favoritos.
                      </li>
                      <li>
                        O haz clic en el botón superior <strong>"Instalar Aplicación Ahora"</strong> si está disponible en tu navegador.
                      </li>
                      <li>
                        Se abrirá una ventana propia sin marcos de navegador, pudiendo anclarla a la barra de tareas de Windows o al Dock de macOS.
                      </li>
                    </ol>
                  </div>
                ) : null}

              </div>

              {/* Benefits checklist */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Ventajas de instalar la App:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Acceso rápido desde el inicio</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Modo pantalla completa</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Carga ultrarrápida (caché local)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Sincronización con la nube</span>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
