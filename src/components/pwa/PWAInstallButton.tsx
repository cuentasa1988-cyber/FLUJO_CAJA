import React, { useState } from 'react';
import { Download, Sparkles, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '', 
  variant = 'compact' 
}) => {
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If already installed, hide the button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        // If dismissed or need instructions, open modal guide
        setIsModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  if (variant === 'sidebar') {
    return (
      <>
        <button
          id="btn-install-sidebar"
          onClick={handleClick}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-800 border-emerald-300 hover:bg-emerald-100/60 ${className}`}
          title="Instalar CashFlow Pro en móvil o PC"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Download className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="truncate">Instalar App</span>
          </div>
          <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
            PWA
          </span>
        </button>

        <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  if (variant === 'full') {
    return (
      <>
        <button
          id="btn-install-full"
          onClick={handleClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs border border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Instalar App</span>
        </button>

        <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  // Default compact button (for TopNav)
  return (
    <>
      <button
        id="btn-install-topnav"
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 ${className}`}
        title="Instalar CashFlow Pro en tu móvil o PC"
      >
        <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>

      <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
