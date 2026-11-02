import React from 'react';
import { User } from 'firebase/auth';
import { 
  LayoutDashboard, 
  ReceiptText, 
  ClockAlert, 
  Wallet, 
  FileSpreadsheet,
  CalendarDays, 
  Settings, 
  Plus,
  X
} from 'lucide-react';
import { TabType } from '../../types';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenNewTransaction: () => void;
  onOpenSettings: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  currentUser?: User | null;
  onOpenCloudAuth?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenNewTransaction,
  onOpenSettings,
  isMobileOpen = false,
  onCloseMobile,
  currentUser,
  onOpenCloudAuth,
}) => {
  const navItems = [
    { id: 'dashboard' as TabType, label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'registry' as TabType, label: 'Registro Diario', icon: ReceiptText },
    { id: 'payables' as TabType, label: 'Cuentas por Pagar', icon: ClockAlert },
    { id: 'cashflow30' as TabType, label: 'Crédito y Cobranza', icon: CalendarDays },
    { id: 'financial_statements' as TabType, label: 'Estados Financieros', icon: FileSpreadsheet },
    { id: 'distribution' as TabType, label: 'Distribución 4 Bolsillos', icon: Wallet },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-[#0F172A]/50 z-40 backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}
      
      <aside 
        id="sidebar-navigation"
        className={`
          flex flex-col w-64 shrink-0 bg-[#F8FAFC] border-r border-[#E2E8F0] h-screen p-4 z-50 select-none overflow-y-auto transition-transform duration-300 ease-in-out
          fixed md:sticky top-0 left-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 py-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1E293B] border border-[#CBD5E1] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
                alt="User Avatar"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#0F172A] tracking-tight leading-tight">
                Centro de Control
              </h1>
              <p className="text-xs text-[#64748B] font-medium">
                Gestión de Flujo y Caja
              </p>
            </div>
          </div>
          
          <button 
            className="md:hidden p-1 text-[#64748B] hover:text-[#0F172A] rounded-md"
            onClick={onCloseMobile}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          id="btn-new-transaction-sidebar"
          onClick={() => {
            onOpenNewTransaction();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.99] text-white py-2.5 px-4 rounded-md font-semibold text-sm mb-6 transition-all duration-150 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white stroke-[2.5]" />
          <span>Nuevo Movimiento</span>
        </button>

        {/* Nav Items */}
        <nav className="flex-1 space-y-1.5" aria-label="Navegación Principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#6CF8BB] text-[#002113] font-bold shadow-xs'
                    : 'text-[#475569] hover:bg-[#EFF6FF] hover:text-[#0F172A]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#002113] stroke-[2.5]' : 'text-[#64748B]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Nav */}
        <div className="mt-auto border-t border-[#E2E8F0] pt-4 space-y-1.5">
          <button
            id="btn-settings-sidebar"
            onClick={() => {
              onOpenSettings();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm text-[#475569] hover:bg-[#EFF6FF] hover:text-[#0F172A] transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-[#64748B]" />
            <span>Configuración</span>
          </button>
        </div>
      </aside>
    </>
  );
};
