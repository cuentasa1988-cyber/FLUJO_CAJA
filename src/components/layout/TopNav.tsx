import React from 'react';
import { TabType } from '../../types';
import { User } from 'firebase/auth';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { 
  Search, 
  Plus,
  ShieldCheck,
  LayoutDashboard,
  ReceiptText,
  ClockAlert,
  Wallet,
  CalendarDays,
  Menu,
  Cloud,
  CloudCheck
} from 'lucide-react';

interface TopNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenNewTransaction: () => void;
  onOpenSettings?: () => void;
  onToggleMobileMenu?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  currentUser?: User | null;
  onOpenCloudAuth?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenNewTransaction,
  onOpenSettings,
  onToggleMobileMenu,
  searchQuery = '',
  onSearchChange,
  currentUser,
  onOpenCloudAuth,
}) => {
  const tabMeta: Record<TabType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    dashboard: { label: 'Panel Principal', icon: LayoutDashboard },
    registry: { label: 'Registro Diario', icon: ReceiptText },
    payables: { label: 'Cuentas por Pagar', icon: ClockAlert },
    cashflow30: { label: 'Crédito y Cobranza', icon: CalendarDays },
    financial_statements: { label: 'Estados Financieros', icon: ReceiptText },
    distribution: { label: 'Distribución 4 Bolsillos', icon: Wallet },
    projections: { label: 'Crédito y Cobranza', icon: CalendarDays },
  };

  const currentMeta = tabMeta[currentTab] || { label: 'Panel Principal', icon: LayoutDashboard };
  const CurrentIcon = currentMeta.icon;

  const todayFormatted = new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="w-full bg-[#FFFFFF] border-b border-[#E2E8F0] px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Breadcrumbs / Section Title */}
      <div className="flex items-center gap-2.5">
        {/* Mobile Menu Toggle */}
        {onToggleMobileMenu && (
          <button 
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 -ml-1.5 text-[#0F172A] hover:bg-[#F1F5F9] rounded-md transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Mobile Logo */}
        <div className="md:hidden flex items-center gap-1.5 mr-2">
          <span className="font-bold text-base text-[#0F172A] tracking-tight">
            CashFlow <span className="text-[#006C49]">Pro</span>
          </span>
        </div>

        {/* Mobile Current Section Tag */}
        <div className="md:hidden flex items-center gap-1 text-xs font-bold text-[#0F172A] bg-[#F1F5F9] px-2 py-0.5 rounded">
          <CurrentIcon className="w-3 h-3 text-[#006C49]" />
          <span>{currentMeta.label}</span>
        </div>
      </div>

      {/* Right Tools: Date, Search, Quick Add & Status */}
      <div className="flex items-center gap-3">
        {/* Real-time Date Badge */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded-md">
          <ShieldCheck className="w-3.5 h-3.5 text-[#006C49]" />
          <span className="capitalize">{todayFormatted}</span>
        </div>

        {/* Global Search */}
        {onSearchChange && (
          <div className="relative hidden sm:block w-48 lg:w-64">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cuentas, movimientos..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#0F172A] transition-all"
            />
          </div>
        )}

        {/* Mobile Quick Add Button */}
        <button
          onClick={onOpenNewTransaction}
          className="md:hidden bg-[#0F172A] hover:bg-[#1E293B] text-white p-2 rounded-md shadow-xs transition-colors cursor-pointer"
          title="Nuevo Movimiento"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* PWA Install Button */}
        <PWAInstallButton />

        {/* Cloud Sync Status / Connection Button */}
        {onOpenCloudAuth && (
          <button
            onClick={onOpenCloudAuth}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs border ${
              currentUser 
                ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] hover:bg-[#DCFCE7]' 
                : 'bg-white text-[#334155] border-[#CBD5E1] hover:bg-[#F8FAFC]'
            }`}
            title={currentUser ? `Conectado como: ${currentUser.email}` : 'Conectar base de datos en la nube'}
          >
            {currentUser ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
                <CloudCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="hidden sm:inline max-w-[140px] truncate">{currentUser.displayName || currentUser.email}</span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.2 rounded font-bold">Nube</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="hidden sm:inline">Conectar Nube</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">Local</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
};

