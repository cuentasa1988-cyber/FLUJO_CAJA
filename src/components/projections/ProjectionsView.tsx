import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  TrendingUp, 
  Target, 
  Sliders, 
  RotateCcw, 
  Layers, 
  BarChart3,
  Sparkles,
  DollarSign,
  Flame,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  UserPlus,
  CloudSnow,
  Wrench,
  HelpCircle,
  ShoppingBag,
  Info
} from 'lucide-react';
import { 
  AppSettings, 
  Payable, 
  ProjectionScenario, 
  Transaction,
  WhatIfEvent
} from '../../types';
import { 
  calculateCurrentLiquidity, 
  formatCurrency, 
  generateProjections 
} from '../../utils/financial';
import { defaultScenario } from '../../utils/storage';

interface ProjectionsViewProps {
  settings: AppSettings;
  payables: Payable[];
  transactions: Transaction[];
  scenario: ProjectionScenario;
  onUpdateScenario: (s: ProjectionScenario) => void;
}

export const ProjectionsView: React.FC<ProjectionsViewProps> = ({
  settings,
  payables,
  transactions,
  scenario,
  onUpdateScenario,
}) => {
  const isCLP = settings.currency === 'CLP';
  const [activeHorizon, setActiveHorizon] = useState<3 | 6 | 12 | 24>(
    (scenario.horizonMonths as 3 | 6 | 12 | 24) || 12
  );
  const [selectedScenarioPreset, setSelectedScenarioPreset] = useState<string>(scenario.name || 'Esperado (Base)');
  const [viewMode, setViewMode] = useState<'chart' | 'matrix' | 'compare'>('chart');
  const [showAddWhatIfModal, setShowAddWhatIfModal] = useState(false);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  // New What-If form state
  const [newWhatIf, setNewWhatIf] = useState<Partial<WhatIfEvent>>({
    name: '',
    type: 'recurring_expense',
    amountOrPct: isCLP ? 500000 : 500,
    startMonthIndex: 2,
    enabled: true,
    description: '',
  });

  const { totalLiquidity } = calculateCurrentLiquidity(settings, transactions, payables);

  // Active scenario events
  const whatIfEvents: WhatIfEvent[] = scenario.whatIfEvents || defaultScenario.whatIfEvents || [];

  // Current scenario with active horizon and sales units
  const currentSalesUnits = scenario.monthlySalesUnits !== undefined ? scenario.monthlySalesUnits : 160;
  const currentTicket = scenario.ticketAverage > 0 ? scenario.ticketAverage : (isCLP ? 15000 : 1250);
  const currentFixed = scenario.fixedMonthlyCosts !== undefined ? scenario.fixedMonthlyCosts : (isCLP ? 1800000 : 43500);

  const currentScenarioWithHorizon: ProjectionScenario = {
    ...scenario,
    ticketAverage: currentTicket,
    monthlySalesUnits: currentSalesUnits,
    fixedMonthlyCosts: currentFixed,
    horizonMonths: activeHorizon,
    whatIfEvents,
  };

  const projections = generateProjections(
    currentScenarioWithHorizon, 
    payables, 
    totalLiquidity,
    transactions
  );

  // Generate 3 scenarios for comparison tab
  const conservativeScenario: ProjectionScenario = {
    id: 'conservative',
    name: 'Conservador (Pesimista)',
    ticketAverage: Math.round(currentTicket * 0.9),
    monthlySalesUnits: Math.round(currentSalesUnits * 0.85),
    salesVolumeMoMGrowth: 0.0,
    variableCostRatio: 46.0,
    fixedMonthlyCosts: currentFixed,
    horizonMonths: activeHorizon,
    whatIfEvents,
  };

  const expectedScenario: ProjectionScenario = {
    id: 'base',
    name: 'Esperado (Base)',
    ticketAverage: currentTicket,
    monthlySalesUnits: currentSalesUnits,
    salesVolumeMoMGrowth: 5.0,
    variableCostRatio: 42.0,
    fixedMonthlyCosts: currentFixed,
    horizonMonths: activeHorizon,
    whatIfEvents,
  };

  const optimisticScenario: ProjectionScenario = {
    id: 'optimistic',
    name: 'Optimista (Agresivo)',
    ticketAverage: Math.round(currentTicket * 1.15),
    monthlySalesUnits: Math.round(currentSalesUnits * 1.25),
    salesVolumeMoMGrowth: 12.0,
    variableCostRatio: 38.0,
    fixedMonthlyCosts: currentFixed,
    horizonMonths: activeHorizon,
    whatIfEvents,
  };

  const projConservative = generateProjections(conservativeScenario, payables, totalLiquidity, transactions);
  const projExpected = generateProjections(expectedScenario, payables, totalLiquidity, transactions);
  const projOptimistic = generateProjections(optimisticScenario, payables, totalLiquidity, transactions);

  // Dynamic slider bounds based on currency
  const ticketMin = isCLP ? 1000 : 5;
  const ticketMax = isCLP ? 250000 : 5000;
  const ticketStep = isCLP ? 1000 : 10;

  const salesMin = 10;
  const salesMax = 2000;
  const salesStep = 5;

  const fixedMin = 0;
  const fixedMax = isCLP ? 20000000 : 100000;
  const fixedStep = isCLP ? 50000 : 500;

  // Handlers
  const handleTicketChange = (val: number) => {
    onUpdateScenario({ ...scenario, ticketAverage: Math.max(0, val) });
  };

  const handleSalesUnitsChange = (val: number) => {
    onUpdateScenario({ ...scenario, monthlySalesUnits: Math.max(1, val) });
  };

  const handleGrowthChange = (val: number) => {
    onUpdateScenario({ ...scenario, salesVolumeMoMGrowth: val });
  };

  const handleFixedCostsChange = (val: number) => {
    onUpdateScenario({ ...scenario, fixedMonthlyCosts: Math.max(0, val) });
  };

  const handleVariableCostRatioChange = (val: number) => {
    onUpdateScenario({ ...scenario, variableCostRatio: Math.min(90, Math.max(5, val)) });
  };

  const handlePresetSelect = (preset: 'conservative' | 'base' | 'optimistic' | 'stress') => {
    if (preset === 'conservative') {
      setSelectedScenarioPreset('Conservador (Pesimista)');
      onUpdateScenario({
        ...scenario,
        name: 'Conservador (Pesimista)',
        salesVolumeMoMGrowth: 0.0,
        variableCostRatio: 46.0,
      });
    } else if (preset === 'base') {
      setSelectedScenarioPreset('Esperado (Base)');
      onUpdateScenario({
        ...scenario,
        name: 'Esperado (Base)',
        salesVolumeMoMGrowth: 5.0,
        variableCostRatio: 42.0,
      });
    } else if (preset === 'optimistic') {
      setSelectedScenarioPreset('Optimista (Agresivo)');
      onUpdateScenario({
        ...scenario,
        name: 'Optimista (Agresivo)',
        salesVolumeMoMGrowth: 12.0,
        variableCostRatio: 38.0,
      });
    } else if (preset === 'stress') {
      setSelectedScenarioPreset('Estrés / Crisis (-10%)');
      onUpdateScenario({
        ...scenario,
        name: 'Estrés / Crisis (-10%)',
        salesVolumeMoMGrowth: -10.0,
        variableCostRatio: 50.0,
      });
    }
  };

  const handleResetScenario = () => {
    const defaultFixed = isCLP ? 1800000 : 43500;
    const defaultTicket = isCLP ? 15000 : 1250;
    onUpdateScenario({
      ...defaultScenario,
      ticketAverage: defaultTicket,
      monthlySalesUnits: 160,
      fixedMonthlyCosts: defaultFixed,
      horizonMonths: activeHorizon,
    });
    setSelectedScenarioPreset('Esperado (Base)');
  };

  // What-If Toggle & Actions
  const toggleWhatIf = (id: string) => {
    const updated = whatIfEvents.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e);
    onUpdateScenario({ ...scenario, whatIfEvents: updated });
  };

  const deleteWhatIf = (id: string) => {
    const updated = whatIfEvents.filter(e => e.id !== id);
    onUpdateScenario({ ...scenario, whatIfEvents: updated });
  };

  const handleAddWhatIfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhatIf.name) return;

    const eventToAdd: WhatIfEvent = {
      id: `wi-${Date.now()}`,
      name: newWhatIf.name || 'Nuevo Evento What-If',
      type: newWhatIf.type || 'recurring_expense',
      amountOrPct: Number(newWhatIf.amountOrPct) || 0,
      startMonthIndex: Number(newWhatIf.startMonthIndex) || 0,
      endMonthIndex: newWhatIf.endMonthIndex !== undefined ? Number(newWhatIf.endMonthIndex) : undefined,
      enabled: true,
      description: newWhatIf.description || '',
    };

    onUpdateScenario({ ...scenario, whatIfEvents: [...whatIfEvents, eventToAdd] });
    setShowAddWhatIfModal(false);
    setNewWhatIf({
      name: '',
      type: 'recurring_expense',
      amountOrPct: isCLP ? 500000 : 500,
      startMonthIndex: 2,
      enabled: true,
      description: '',
    });
  };

  // Export Matrix to CSV
  const handleExportMatrix = () => {
    const headerRow = ['Categoría', ...projections.months.map(m => m.label)];
    const incomeRow = ['Ingresos Estimados', ...projections.months.map(m => m.estGrossIncome.toFixed(2))];
    const cogsRow = ['COGS / Insumos', ...projections.months.map(m => m.cogs.toFixed(2))];
    const mktgRow = ['Marketing & Comisiones', ...projections.months.map(m => m.marketing.toFixed(2))];
    const payrollRow = ['Nómina Base', ...projections.months.map(m => m.payroll.toFixed(2))];
    const rentRow = ['Arriendos y Servicios', ...projections.months.map(m => m.rentAndUtil.toFixed(2))];
    const payablesRow = ['Pasivos y Cuotas Programadas', ...projections.months.map(m => m.scheduledPayables.toFixed(2))];
    const whatIfRow = ['Impacto Eventos What-If', ...projections.months.map(m => (m.whatIfImpactIncome - m.whatIfImpactExpense).toFixed(2))];
    const netRow = ['Saldo Neto Mensual', ...projections.months.map(m => m.netMonthly.toFixed(2))];
    const cumRow = ['Caja Acumulada Proyectada', ...projections.months.map(m => m.cumulativeCash.toFixed(2))];

    const csvContent = [
      headerRow,
      [],
      ['--- INGRESOS ---'],
      incomeRow,
      [],
      ['--- COSTOS VARIABLES ---'],
      cogsRow,
      mktgRow,
      [],
      ['--- COSTOS FIJOS, PASIVOS Y WHAT-IF ---'],
      payrollRow,
      rentRow,
      payablesRow,
      whatIfRow,
      [],
      ['--- RESULTADOS DE LIQUIDEZ ---'],
      netRow,
      cumRow,
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Proyeccion_Flujo_Caja_${activeHorizon}Meses_${scenario.name || 'Escenario'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Base monthly revenue calculation for display
  const baseMonthlyRevenue = currentSalesUnits * currentTicket;
  const activeWhatIfCount = whatIfEvents.filter(w => w.enabled).length;

  // Chart Scaling & Coordinate Mathematics
  const cashValues = projections.months.map(m => m.cumulativeCash);
  const flowValues = projections.months.flatMap(m => [m.estGrossIncome, m.totalCosts]);
  
  const maxCashValue = Math.max(...cashValues, projections.minCashRequired, 1000);
  const minCashValue = Math.min(...cashValues, 0);
  const maxFlowValue = Math.max(...flowValues, 1000);

  // Range spanning for zero-line calculation
  const totalCashRange = Math.max(1, maxCashValue - minCashValue);
  const zeroLinePercent = minCashValue < 0 
    ? (Math.abs(minCashValue) / totalCashRange) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#F1F5F9] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Proyección de Liquidez y Simulador Runway
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#E0E7FF] text-[#3730A3] text-[11px] font-bold">
              {activeHorizon} Meses
            </span>
          </div>
          <p className="text-sm text-[#64748B] mt-0.5">
            Modelación de escenarios estratégicos, detección de punto de quiebre y simulador de decisiones What-If
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Horizon Selector: 3M, 6M, 12M, 24M */}
          <div className="flex bg-[#F1F5F9] p-0.5 rounded-md border border-[#E2E8F0] text-xs font-semibold">
            {[
              { m: 3 as const, label: '3 Meses' },
              { m: 6 as const, label: '6 Meses' },
              { m: 12 as const, label: '12 Meses' },
              { m: 24 as const, label: '24 Meses' },
            ].map((h) => (
              <button
                key={h.m}
                onClick={() => {
                  setActiveHorizon(h.m);
                  onUpdateScenario({ ...scenario, horizonMonths: h.m });
                }}
                className={`px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                  activeHorizon === h.m ? 'bg-white text-[#0F172A] shadow-xs font-bold' : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-[#F1F5F9] p-0.5 rounded-md border border-[#E2E8F0] text-xs font-semibold">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'chart' ? 'bg-white text-[#0F172A] shadow-xs font-bold' : 'text-[#64748B]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#0F172A]" />
              <span>Curva de Caja</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'matrix' ? 'bg-white text-[#0F172A] shadow-xs font-bold' : 'text-[#64748B]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#006C49]" />
              <span>Matriz Mensual</span>
            </button>
            <button
              onClick={() => setViewMode('compare')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'compare' ? 'bg-white text-[#0F172A] shadow-xs font-bold' : 'text-[#64748B]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>3 Escenarios</span>
            </button>
          </div>

          <button
            onClick={handleExportMatrix}
            className="bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#006C49]" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 3 Quick Scenario Presets Bar */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#0F172A]" />
          <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Escenarios de Crecimiento:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => handlePresetSelect('conservative')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
              selectedScenarioPreset.includes('Conservador')
                ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B] shadow-xs'
                : 'bg-white text-[#64748B] border-[#CBD5E1] hover:bg-[#F1F5F9]'
            }`}
          >
            🛡️ Conservador (0% MoM)
          </button>
          <button
            onClick={() => handlePresetSelect('base')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
              selectedScenarioPreset.includes('Esperado') || selectedScenarioPreset.includes('Base')
                ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-xs'
                : 'bg-white text-[#64748B] border-[#CBD5E1] hover:bg-[#F1F5F9]'
            }`}
          >
            ⚖️ Esperado (+5% MoM)
          </button>
          <button
            onClick={() => handlePresetSelect('optimistic')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
              selectedScenarioPreset.includes('Optimista')
                ? 'bg-[#DCFCE7] text-[#006C49] border-[#006C49] shadow-xs'
                : 'bg-white text-[#64748B] border-[#CBD5E1] hover:bg-[#F1F5F9]'
            }`}
          >
            🚀 Optimista (+12% MoM)
          </button>
          <button
            onClick={() => handlePresetSelect('stress')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
              selectedScenarioPreset.includes('Estrés')
                ? 'bg-[#FEE2E2] text-[#991B1B] border-[#DC2626] shadow-xs'
                : 'bg-white text-[#64748B] border-[#CBD5E1] hover:bg-[#F1F5F9]'
            }`}
          >
            ⚠️ Estrés / Caída (-10%)
          </button>
        </div>
      </div>

      {/* Valle de la Muerte / Cash Burn Alert Banner (Si aplica) */}
      {projections.deathValleyMonth ? (
        <div className="bg-[#FEF2F2] border-2 border-[#DC2626] rounded-md p-4 flex items-start gap-3.5 shadow-sm animate-pulse">
          <ShieldAlert className="w-5 h-5 text-[#DC2626] mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#991B1B]">
                ¡Alerta Crítica: Punto de Quiebre / Valle de la Muerte Detectado!
              </span>
              <span className="px-2 py-0.5 rounded bg-[#DC2626] text-white font-mono-num font-bold text-xs">
                Mes de Agotamiento: {projections.deathValleyMonth}
              </span>
            </div>
            <p className="text-xs text-[#7F1D1D] leading-relaxed">
              Bajo la proyección actual y los eventos What-If configurados, la caja disponible se agotará por completo en <strong>{projections.deathValleyMonth}</strong>.
              Se requiere una inyección de capital estimada de <strong>{formatCurrency(Math.abs(minCashValue) + projections.minCashRequired, settings.currencySymbol, 0)}</strong> o ajustar la estructura de costos fijos ({formatCurrency(currentFixed, settings.currencySymbol, 0)}/mes) o elevar las ventas para garantizar la continuidad operativa.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-md p-3.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-[#166534]">
            <ShieldCheck className="w-4 h-4 text-[#006C49] shrink-0" />
            <span className="font-bold">Solvencia Proyectada Sólida:</span>
            <span>La caja acumulada se mantiene positiva durante todo el horizonte de {activeHorizon} meses.</span>
          </div>
          <span className="text-[11px] font-semibold text-[#15803D] bg-white px-2.5 py-1 rounded border border-[#86EFAC]">
            Caja Final ({activeHorizon}M): {formatCurrency(projections.months[projections.months.length - 1]?.cumulativeCash || 0, settings.currencySymbol, 0)}
          </span>
        </div>
      )}

      {/* 4 Key KPI Critical Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Runway Real */}
        <div className="bg-white border border-[#E2E8F0] rounded-md p-4 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              RUNWAY REAL
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              projections.runwayMonths >= 6 
                ? 'bg-[#DCFCE7] text-[#006C49]' 
                : projections.runwayMonths >= 3 
                ? 'bg-[#FEF3C7] text-[#92400E]' 
                : 'bg-[#FEE2E2] text-[#991B1B]'
            }`}>
              {projections.runwayMonths >= 6 ? 'Saludable' : projections.runwayMonths >= 3 ? 'Precaución' : 'Crítico'}
            </span>
          </div>
          <div className="text-2xl font-bold text-[#0F172A] tnum my-1">
            {projections.runwayMonths > 0 ? `${projections.runwayMonths} meses` : '0 meses'}
          </div>
          <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden my-2">
            <div 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                projections.runwayMonths >= 6 ? 'bg-[#006C49]' : projections.runwayMonths >= 3 ? 'bg-[#F59E0B]' : 'bg-[#DC2626]'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, (projections.runwayMonths / 24) * 100))}%` }}
            />
          </div>
          <div className="text-[11px] text-[#64748B] flex justify-between items-center">
            <span>Caja: {formatCurrency(totalLiquidity, settings.currencySymbol, 0)}</span>
            <span className="font-semibold text-[#0F172A]">Cero Ingresos</span>
          </div>
        </div>

        {/* 2. Burn Rate Operativo Neto */}
        <div className="bg-white border border-[#E2E8F0] rounded-md p-4 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              BURN RATE OPERATIVO
            </div>
            <Flame className="w-3.5 h-3.5 text-[#DC2626]" />
          </div>
          <div className="text-2xl font-bold text-[#0F172A] tnum my-1">
            {formatCurrency(projections.netBurnRateMonthly, settings.currencySymbol, 0)}
            <span className="text-xs text-[#64748B] font-normal">/mes</span>
          </div>
          <div className="text-[11px] text-[#64748B] mt-2 flex items-center gap-1">
            <span>Costo de supervivencia mensual</span>
          </div>
        </div>

        {/* 3. Punto de Equilibrio (Break-Even) */}
        <div className="bg-white border border-[#E2E8F0] rounded-md p-4 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              PUNTO DE EQUILIBRIO
            </div>
            <Target className="w-3.5 h-3.5 text-[#006C49]" />
          </div>
          <div className="text-2xl font-bold text-[#0F172A] tnum my-1">
            {formatCurrency(projections.breakEvenMonthly, settings.currencySymbol, 0)}
            <span className="text-xs text-[#64748B] font-normal">/mes</span>
          </div>
          <div className="text-[11px] text-[#64748B] mt-2 flex items-center gap-1">
            <span>Venta mensual para resultado $0</span>
          </div>
        </div>

        {/* 4. Utilidad Neta y Margen */}
        <div className="bg-white border border-[#E2E8F0] rounded-md p-4 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              RESULTADO ({activeHorizon}M)
            </div>
            <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
          </div>
          <div className={`text-2xl font-bold tnum my-1 ${projections.annualNetProfit >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
            {formatCurrency(projections.annualNetProfit, settings.currencySymbol, 0)}
          </div>
          <div className="text-[11px] text-[#64748B] mt-2 flex justify-between items-center">
            <span>Margen Operativo:</span>
            <span className={`font-bold font-mono-num ${projections.realOperatingMargin >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
              {projections.realOperatingMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Simulator Card: Real-time What-If Sensitivity Engine */}
      <div className="bg-white border border-[#E2E8F0] rounded-md p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0F172A]" />
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              SIMULADOR DE SENSIBILIDAD Y DECISIONES ESTRATÉGICAS (WHAT-IF)
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[#64748B]">
              Ventas Base Estimadas:{' '}
              <strong className="text-[#006C49] font-mono-num">
                {formatCurrency(baseMonthlyRevenue, settings.currencySymbol, 0)}/mes
              </strong>
            </div>
            <button
              onClick={handleResetScenario}
              className="text-xs text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 font-semibold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>

        {/* 5 Interactive Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          
          {/* 1. Ventas Mensuales Estimadas */}
          <div className="space-y-2 bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#475569] font-semibold flex items-center gap-1">
                <ShoppingBag className="w-3 h-3 text-[#006C49]" />
                <span>Ventas / Mes</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={salesMin}
                  max={salesMax}
                  step={salesStep}
                  value={currentSalesUnits}
                  onChange={(e) => handleSalesUnitsChange(parseInt(e.target.value) || 1)}
                  className="w-16 px-1.5 py-0.5 text-right font-bold font-mono-num text-[#0F172A] bg-white border border-[#CBD5E1] rounded text-xs focus:ring-1 focus:ring-[#0F172A]"
                />
                <span className="text-[#94A3B8] font-bold text-[10px]">u.</span>
              </div>
            </div>
            <input
              type="range"
              min={salesMin}
              max={salesMax}
              step={salesStep}
              value={currentSalesUnits}
              onChange={(e) => handleSalesUnitsChange(parseInt(e.target.value) || 1)}
              className="w-full accent-[#006C49] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono-num">
              <span>{salesMin} u.</span>
              <span>{salesMax} u.</span>
            </div>
          </div>

          {/* 2. Ticket Promedio */}
          <div className="space-y-2 bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#475569] font-semibold">Ticket Promedio</span>
              <div className="flex items-center gap-1">
                <span className="text-[#94A3B8] font-bold">{settings.currencySymbol}</span>
                <input
                  type="number"
                  min={ticketMin}
                  max={ticketMax}
                  step={ticketStep}
                  value={currentTicket}
                  onChange={(e) => handleTicketChange(parseFloat(e.target.value) || 0)}
                  className="w-20 px-1.5 py-0.5 text-right font-bold font-mono-num text-[#0F172A] bg-white border border-[#CBD5E1] rounded text-xs focus:ring-1 focus:ring-[#0F172A]"
                />
              </div>
            </div>
            <input
              type="range"
              min={ticketMin}
              max={ticketMax}
              step={ticketStep}
              value={currentTicket}
              onChange={(e) => handleTicketChange(parseFloat(e.target.value) || 0)}
              className="w-full accent-[#0F172A] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono-num">
              <span>{formatCurrency(ticketMin, settings.currencySymbol, 0)}</span>
              <span>{formatCurrency(ticketMax, settings.currencySymbol, 0)}</span>
            </div>
          </div>

          {/* 3. Crecimiento MoM (%) */}
          <div className="space-y-2 bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#475569] font-semibold">Crecimiento MoM</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="-50"
                  max="100"
                  step="0.5"
                  value={scenario.salesVolumeMoMGrowth}
                  onChange={(e) => handleGrowthChange(parseFloat(e.target.value) || 0)}
                  className={`w-16 px-1.5 py-0.5 text-right font-bold font-mono-num bg-white border border-[#CBD5E1] rounded text-xs focus:ring-1 focus:ring-[#0F172A] ${scenario.salesVolumeMoMGrowth >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}
                />
                <span className="text-[#94A3B8] font-bold">%</span>
              </div>
            </div>
            <input
              type="range"
              min="-20"
              max="30"
              step="0.5"
              value={scenario.salesVolumeMoMGrowth}
              onChange={(e) => handleGrowthChange(parseFloat(e.target.value) || 0)}
              className="w-full accent-[#0F172A] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono-num">
              <span>-20%</span>
              <span>+30%</span>
            </div>
          </div>

          {/* 4. Costos Fijos Mensuales */}
          <div className="space-y-2 bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#475569] font-semibold">Costos Fijos / Mes</span>
              <div className="flex items-center gap-1">
                <span className="text-[#94A3B8] font-bold">{settings.currencySymbol}</span>
                <input
                  type="number"
                  min={fixedMin}
                  max={fixedMax}
                  step={fixedStep}
                  value={currentFixed}
                  onChange={(e) => handleFixedCostsChange(parseFloat(e.target.value) || 0)}
                  className="w-24 px-1.5 py-0.5 text-right font-bold font-mono-num text-[#0F172A] bg-white border border-[#CBD5E1] rounded text-xs focus:ring-1 focus:ring-[#0F172A]"
                />
              </div>
            </div>
            <input
              type="range"
              min={fixedMin}
              max={fixedMax}
              step={fixedStep}
              value={currentFixed}
              onChange={(e) => handleFixedCostsChange(parseFloat(e.target.value) || 0)}
              className="w-full accent-[#0F172A] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono-num">
              <span>{formatCurrency(fixedMin, settings.currencySymbol, 0)}</span>
              <span>{formatCurrency(fixedMax, settings.currencySymbol, 0)}</span>
            </div>
          </div>

          {/* 5. Costos Variables Ratio */}
          <div className="space-y-2 bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#475569] font-semibold">Costos Variables</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="5"
                  max="90"
                  step="1"
                  value={scenario.variableCostRatio}
                  onChange={(e) => handleVariableCostRatioChange(parseFloat(e.target.value) || 0)}
                  className="w-16 px-1.5 py-0.5 text-right font-bold font-mono-num text-[#0F172A] bg-white border border-[#CBD5E1] rounded text-xs focus:ring-1 focus:ring-[#0F172A]"
                />
                <span className="text-[#94A3B8] font-bold">%</span>
              </div>
            </div>
            <input
              type="range"
              min="10"
              max="80"
              step="1"
              value={scenario.variableCostRatio}
              onChange={(e) => handleVariableCostRatioChange(parseFloat(e.target.value) || 0)}
              className="w-full accent-[#0F172A] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono-num">
              <span>10%</span>
              <span>80%</span>
            </div>
          </div>
        </div>

        {/* What-If Strategic Events Section */}
        <div className="pt-3 border-t border-[#F1F5F9] space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#0F172A]" />
                <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Eventos y Decisiones Simuladas (What-If Switchers)
                </h4>
              </div>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Activa o desactiva decisiones reales para ver su impacto instantáneo sobre la caja futura y el runway.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddWhatIfModal(true)}
              className="px-2.5 py-1 bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#006C49]" />
              <span>Añadir Evento What-If</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {whatIfEvents.map((event) => {
              const isContratacion = event.type === 'recurring_expense';
              const isInvierno = event.type === 'revenue_change_pct';
              const isCapex = event.type === 'one_time_capex';

              return (
                <div 
                  key={event.id}
                  className={`p-3.5 rounded-md border transition-all ${
                    event.enabled 
                      ? 'bg-white border-[#0F172A] shadow-sm' 
                      : 'bg-[#F8FAFC] border-[#E2E8F0] opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${event.enabled ? 'bg-[#0F172A] text-white' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                        {isContratacion && <UserPlus className="w-3.5 h-3.5" />}
                        {isInvierno && <CloudSnow className="w-3.5 h-3.5" />}
                        {isCapex && <Wrench className="w-3.5 h-3.5" />}
                        {!isContratacion && !isInvierno && !isCapex && <DollarSign className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[#0F172A] leading-tight">
                          {event.name}
                        </div>
                        <div className="text-[10px] text-[#64748B] font-mono-num mt-0.5">
                          {event.type === 'revenue_change_pct' 
                            ? `${event.amountOrPct > 0 ? '+' : ''}${event.amountOrPct}% (Mes ${event.startMonthIndex + 1} a ${event.endMonthIndex !== undefined ? event.endMonthIndex + 1 : 'Fin'})`
                            : `${event.type === 'recurring_expense' ? '+ ' : ''}${formatCurrency(event.amountOrPct, settings.currencySymbol, 0)} ${event.type === 'recurring_expense' ? '/mes (Mes ' + (event.startMonthIndex + 1) + '+)' : '(Mes ' + (event.startMonthIndex + 1) + ')'}`
                          }
                        </div>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox" 
                        checked={event.enabled} 
                        onChange={() => toggleWhatIf(event.id)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-[#CBD5E1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#CBD5E1] after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#006C49]"></div>
                    </label>
                  </div>

                  {event.description && (
                    <p className="text-[11px] text-[#64748B] mt-2 pt-2 border-t border-[#F1F5F9] line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  <div className="flex justify-end gap-1 mt-2">
                    <button
                      type="button"
                      onClick={() => deleteWhatIf(event.id)}
                      className="text-[#94A3B8] hover:text-[#DC2626] p-1 text-[10px] flex items-center gap-0.5 cursor-pointer"
                      title="Eliminar evento"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main View Area: 1. Curva de Caja Interactiva / 2. Matriz Mensual / 3. 3 Escenarios Comparativa */}
      {viewMode === 'chart' && (
        <div className="bg-white border border-[#E2E8F0] rounded-md p-5 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
                Curva de Caja Proyectada vs. Línea Roja de Seguridad ({activeHorizon} Meses)
              </h3>
              <p className="text-xs text-[#64748B]">
                Ingresos vs. Egresos mensuales con evolución del saldo acumulado y colchón de supervivencia
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#0F172A] rounded-full"></span>
                <span className="text-[#475569]">Saldo Caja</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#DC2626] rounded-full border-t-2 border-dashed border-[#DC2626]"></span>
                <span className="text-[#DC2626]">Reserva Mínima ({formatCurrency(projections.minCashRequired, settings.currencySymbol, 0)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#006C49] rounded-xs"></span>
                <span className="text-[#006C49]">Ingresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#94A3B8] rounded-xs"></span>
                <span className="text-[#64748B]">Egresos</span>
              </div>
            </div>
          </div>

          {/* Interactive Responsive SVG Projection Chart */}
          <div className="space-y-4">
            <div className="h-80 w-full relative border-b border-l border-[#CBD5E1] pt-6 pr-3 pb-3 pl-3 flex items-end justify-between gap-1 sm:gap-2">
              
              {/* Red Line: Minimum Safe Cash Buffer */}
              {projections.minCashRequired > 0 && (
                <div 
                  className="absolute left-0 right-0 border-t-2 border-dashed border-[#DC2626] z-10 pointer-events-none flex justify-end pr-3"
                  style={{ 
                    bottom: `${Math.min(92, Math.max(8, ((projections.minCashRequired - minCashValue) / totalCashRange) * 100))}%` 
                  }}
                >
                  <span className="text-[10px] font-bold text-[#DC2626] bg-white px-1.5 py-0.5 rounded border border-[#FCA5A5] -mt-3 shadow-xs">
                    Línea Roja de Seguridad: {formatCurrency(projections.minCashRequired, settings.currencySymbol, 0)}
                  </span>
                </div>
              )}

              {/* Zero Balance Line (Axis) */}
              {minCashValue < 0 && (
                <div 
                  className="absolute left-0 right-0 border-t border-[#94A3B8] z-0 pointer-events-none"
                  style={{ bottom: `${zeroLinePercent}%` }}
                >
                  <span className="text-[9px] text-[#94A3B8] font-mono-num pl-1 bg-white">
                    $0 (Eje Cero)
                  </span>
                </div>
              )}

              {/* Monthly Visual Columns */}
              {projections.months.map((m, idx) => {
                const isHovered = hoveredMonthIndex === idx;
                
                // Flow Heights for comparative bars (0 to 100%)
                const incomeBarHeight = Math.min(100, Math.max(4, (m.estGrossIncome / maxFlowValue) * 60));
                const expenseBarHeight = Math.min(100, Math.max(4, (m.totalCosts / maxFlowValue) * 60));
                
                // Cash Curve Dot Height
                const cashPercentPos = Math.min(96, Math.max(4, ((m.cumulativeCash - minCashValue) / totalCashRange) * 100));
                const isNegative = m.cumulativeCash <= 0;
                const isBelowSafety = m.cumulativeCash < projections.minCashRequired;

                return (
                  <div 
                    key={idx} 
                    onMouseEnter={() => setHoveredMonthIndex(idx)}
                    onMouseLeave={() => setHoveredMonthIndex(null)}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  >
                    
                    {/* Hover Card Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-24 left-1/2 -translate-x-1/2 z-30 bg-[#0F172A] text-white p-2.5 rounded shadow-xl text-[11px] whitespace-nowrap min-w-[170px] space-y-1">
                        <div className="font-bold border-b border-[#334155] pb-1 flex justify-between">
                          <span>{m.label}</span>
                          <span className={m.netMonthly >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}>
                            Neto: {formatCurrency(m.netMonthly, settings.currencySymbol, 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#94A3B8]">
                          <span>Ingresos:</span>
                          <span className="text-[#4ADE80] font-mono-num font-semibold">{formatCurrency(m.estGrossIncome, settings.currencySymbol, 0)}</span>
                        </div>
                        <div className="flex justify-between text-[#94A3B8]">
                          <span>Egresos Totales:</span>
                          <span className="text-[#CBD5E1] font-mono-num font-semibold">{formatCurrency(m.totalCosts, settings.currencySymbol, 0)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-[#334155] font-bold">
                          <span>Caja Acumulada:</span>
                          <span className={`font-mono-num ${m.cumulativeCash >= 0 ? 'text-white' : 'text-[#F87171]'}`}>
                            {formatCurrency(m.cumulativeCash, settings.currencySymbol, 0)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Flow Columns: Income & Expense */}
                    <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-56 pb-2">
                      {/* Income Bar (Green) */}
                      <div 
                        style={{ height: `${incomeBarHeight}%` }}
                        className="w-1/2 max-w-[14px] bg-[#006C49] hover:bg-[#00875A] rounded-t-xs transition-all"
                        title={`Ingresos: ${formatCurrency(m.estGrossIncome, settings.currencySymbol, 0)}`}
                      />

                      {/* Expense Bar (Slate/Gray) */}
                      <div 
                        style={{ height: `${expenseBarHeight}%` }}
                        className="w-1/2 max-w-[14px] bg-[#94A3B8] hover:bg-[#64748B] rounded-t-xs transition-all"
                        title={`Egresos: ${formatCurrency(m.totalCosts, settings.currencySymbol, 0)}`}
                      />
                    </div>

                    {/* Dot on the Cash Curve */}
                    <div 
                      style={{ bottom: `${cashPercentPos}%` }}
                      className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all z-20 ${
                        isNegative 
                          ? 'bg-[#DC2626] border-white shadow-xs' 
                          : isBelowSafety 
                          ? 'bg-[#F59E0B] border-white shadow-xs' 
                          : 'bg-[#0F172A] border-white shadow-xs'
                      }`}
                    />

                    {/* Month Label */}
                    <span className="text-[10px] font-mono-num text-[#64748B] mt-2 whitespace-nowrap">
                      {m.label.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick Summary Numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Caja de Inicio</span>
                <span className="font-bold text-[#0F172A] text-sm">{formatCurrency(totalLiquidity, settings.currencySymbol, 0)}</span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Reserva Mínima (2M)</span>
                <span className="font-bold text-[#DC2626] text-sm">{formatCurrency(projections.minCashRequired, settings.currencySymbol, 0)}</span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Caja Proyectada ({activeHorizon}M)</span>
                <span className={`font-bold text-sm ${projections.months[projections.months.length - 1]?.cumulativeCash >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                  {formatCurrency(projections.months[projections.months.length - 1]?.cumulativeCash || 0, settings.currencySymbol, 0)}
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Eventos What-If Activos</span>
                <span className="font-bold text-[#3B82F6] text-sm">{activeWhatIfCount} eventos activos</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main View Mode: Matriz Mensual Detallada */}
      {viewMode === 'matrix' && (
        <div className="bg-white border border-[#E2E8F0] rounded-md p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
                Matriz Financiera de Flujo de Caja ({settings.currency})
              </h3>
              <p className="text-xs text-[#64748B]">
                Desglose detallado mensual de ingresos, costos variables, fijos, eventos What-If y caja final
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#CBD5E1] rounded-md">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-[#CBD5E1] bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-2.5 px-3 font-semibold w-56 sticky left-0 bg-[#F8FAFC] z-10">Concepto / Categoría</th>
                  {projections.months.map((m, idx) => (
                    <th key={idx} className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-xs">
                
                {/* Ingresos Estimados */}
                <tr className="bg-white hover:bg-[#F8FAFC]">
                  <td className="py-2.5 px-3 font-bold text-[#0F172A] sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                    Ingresos Estimados
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className="py-2.5 px-3 font-mono-num font-bold text-right text-[#006C49] tnum">
                      {formatCurrency(m.estGrossIncome, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>

                {/* Section: COSTOS VARIABLES */}
                <tr className="bg-[#F8FAFC]">
                  <td colSpan={projections.months.length + 1} className="py-1.5 px-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                    COSTOS VARIABLES OPERATIVOS
                  </td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 text-[#475569] pl-6 sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                    COGS (Materia Prima / Insumos)
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className="py-2 px-3 font-mono-num text-right text-[#64748B] tnum">
                      {formatCurrency(m.cogs, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 text-[#475569] pl-6 sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                    Marketing & Comisiones
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className="py-2 px-3 font-mono-num text-right text-[#64748B] tnum">
                      {formatCurrency(m.marketing, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>

                {/* Section: COSTOS FIJOS Y PASIVOS */}
                <tr className="bg-[#F8FAFC]">
                  <td colSpan={projections.months.length + 1} className="py-1.5 px-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                    COSTOS FIJOS Y PASIVOS PROGRAMADOS
                  </td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 text-[#475569] pl-6 sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                    Nómina Base
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className="py-2 px-3 font-mono-num text-right text-[#64748B] tnum">
                      {formatCurrency(m.payroll, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 text-[#475569] pl-6 sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                    Arriendos y Servicios
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className="py-2 px-3 font-mono-num text-right text-[#64748B] tnum">
                      {formatCurrency(m.rentAndUtil, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 text-[#475569] pl-6 sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                    Cuentas por Pagar (Cuotas)
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className="py-2 px-3 font-mono-num text-right text-[#64748B] tnum">
                      {formatCurrency(m.scheduledPayables, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>

                {/* What-If Impact Row */}
                <tr className="hover:bg-[#F8FAFC] bg-[#F8FAFC]/50">
                  <td className="py-2 px-3 text-[#3B82F6] font-semibold pl-6 sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                    Impacto Decisiones What-If
                  </td>
                  {projections.months.map((m, idx) => {
                    const impact = m.whatIfImpactIncome - m.whatIfImpactExpense;
                    return (
                      <td key={idx} className={`py-2 px-3 font-mono-num text-right font-semibold tnum ${impact < 0 ? 'text-[#DC2626]' : impact > 0 ? 'text-[#006C49]' : 'text-[#94A3B8]'}`}>
                        {impact !== 0 ? formatCurrency(impact, settings.currencySymbol, 0) : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Total Egresos */}
                <tr className="bg-[#F8FAFC] font-semibold border-t border-[#CBD5E1]">
                  <td className="py-2 px-3 text-[#0F172A] sticky left-0 bg-[#F8FAFC] z-10 border-r border-[#CBD5E1]">
                    Egresos Totales
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className="py-2 px-3 font-mono-num text-right text-[#0F172A] tnum">
                      {formatCurrency(m.totalCosts, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>

                {/* Saldo Neto Mensual */}
                <tr className="bg-white hover:bg-[#F8FAFC] font-bold border-t border-[#CBD5E1]">
                  <td className="py-2.5 px-3 text-[#0F172A] sticky left-0 bg-white z-10 border-r border-[#F1F5F9]">
                    Flujo Neto Mensual
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className={`py-2.5 px-3 font-mono-num text-right tnum ${m.netMonthly >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                      {formatCurrency(m.netMonthly, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>

                {/* Caja Acumulada */}
                <tr className="bg-[#0F172A] text-white font-bold">
                  <td className="py-3 px-3 sticky left-0 bg-[#0F172A] z-10 border-r border-[#334155]">
                    Caja Acumulada Final
                  </td>
                  {projections.months.map((m, idx) => (
                    <td key={idx} className={`py-3 px-3 font-mono-num text-right tnum ${m.cumulativeCash < 0 ? 'text-[#FCA5A5]' : 'text-white'}`}>
                      {formatCurrency(m.cumulativeCash, settings.currencySymbol, 0)}
                    </td>
                  ))}
                </tr>

              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Main View Mode: Comparativa de 3 Escenarios */}
      {viewMode === 'compare' && (
        <div className="bg-white border border-[#E2E8F0] rounded-md p-5 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
              Comparativa Estratégica: 3 Escenarios de Futuro ({activeHorizon} Meses)
            </h3>
            <p className="text-xs text-[#64748B]">
              Compara el impacto sobre liquidez, runway y punto de quiebre entre una estrategia defensiva, esperada y agresiva.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Conservador */}
            <div className="p-4 rounded-md border border-[#F59E0B] bg-[#FFFBEB] space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#92400E]">🛡️ Conservador (Pesimista)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E]">0% Crecimiento</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-[#FDE68A]">
                  <span className="text-[#92400E]">Runway Estimado:</span>
                  <span className="font-bold font-mono-num">{projConservative.runwayMonths} meses</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#FDE68A]">
                  <span className="text-[#92400E]">Punto de Quiebre:</span>
                  <span className="font-bold font-mono-num">{projConservative.deathValleyMonth || 'Solvente'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#FDE68A]">
                  <span className="text-[#92400E]">Utilidad Neta ({activeHorizon}M):</span>
                  <span className="font-bold font-mono-num">{formatCurrency(projConservative.annualNetProfit, settings.currencySymbol, 0)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold">
                  <span className="text-[#92400E]">Caja Final:</span>
                  <span className="font-mono-num">{formatCurrency(projConservative.months[projConservative.months.length - 1]?.cumulativeCash || 0, settings.currencySymbol, 0)}</span>
                </div>
              </div>
            </div>

            {/* 2. Esperado */}
            <div className="p-4 rounded-md border-2 border-[#0F172A] bg-[#F8FAFC] space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#0F172A]">⚖️ Esperado (Base Case)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0F172A] text-white">+5% Crecimiento</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Runway Estimado:</span>
                  <span className="font-bold font-mono-num text-[#0F172A]">{projExpected.runwayMonths} meses</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Punto de Quiebre:</span>
                  <span className="font-bold font-mono-num text-[#0F172A]">{projExpected.deathValleyMonth || 'Solvente'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Utilidad Neta ({activeHorizon}M):</span>
                  <span className={`font-bold font-mono-num ${projExpected.annualNetProfit >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                    {formatCurrency(projExpected.annualNetProfit, settings.currencySymbol, 0)}
                  </span>
                </div>
                <div className="flex justify-between py-1 font-bold">
                  <span className="text-[#0F172A]">Caja Final:</span>
                  <span className="font-mono-num text-[#0F172A]">{formatCurrency(projExpected.months[projExpected.months.length - 1]?.cumulativeCash || 0, settings.currencySymbol, 0)}</span>
                </div>
              </div>
            </div>

            {/* 3. Optimista */}
            <div className="p-4 rounded-md border border-[#006C49] bg-[#F0FDF4] space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#166534]">🚀 Optimista (Agresivo)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#006C49]">+12% Crecimiento</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-[#BBF7D0]">
                  <span className="text-[#166534]">Runway Estimado:</span>
                  <span className="font-bold font-mono-num text-[#166534]">{projOptimistic.runwayMonths} meses</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#BBF7D0]">
                  <span className="text-[#166534]">Punto de Quiebre:</span>
                  <span className="font-bold font-mono-num text-[#166534]">{projOptimistic.deathValleyMonth || 'Solvente'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#BBF7D0]">
                  <span className="text-[#166534]">Utilidad Neta ({activeHorizon}M):</span>
                  <span className="font-bold font-mono-num text-[#006C49]">{formatCurrency(projOptimistic.annualNetProfit, settings.currencySymbol, 0)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold">
                  <span className="text-[#166534]">Caja Final:</span>
                  <span className="font-mono-num text-[#006C49]">{formatCurrency(projOptimistic.months[projOptimistic.months.length - 1]?.cumulativeCash || 0, settings.currencySymbol, 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add What-If Event */}
      {showAddWhatIfModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-3">
              <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#006C49]" />
                <span>Añadir Evento / Decisión What-If</span>
              </h3>
              <button
                onClick={() => setShowAddWhatIfModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddWhatIfSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#475569] font-semibold mb-1">
                  Nombre del Evento
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Contratar 1 Vendedor, Nueva Sucursal, etc."
                  value={newWhatIf.name}
                  onChange={(e) => setNewWhatIf({ ...newWhatIf, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded focus:ring-1 focus:ring-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-[#475569] font-semibold mb-1">
                  Tipo de Impacto
                </label>
                <select
                  value={newWhatIf.type}
                  onChange={(e) => setNewWhatIf({ ...newWhatIf, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded focus:ring-1 focus:ring-[#0F172A]"
                >
                  <option value="recurring_expense">Gasto Recurrente (+Sueldo, +Arriendo)</option>
                  <option value="one_time_capex">Inversión Única / CAPEX (Maquinaria, Obras)</option>
                  <option value="revenue_change_pct">Variación de Ventas (% Estacional o Campaña)</option>
                  <option value="one_time_income">Ingreso Extraordinario Único (Premio, Subsidio)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#475569] font-semibold mb-1">
                    {newWhatIf.type === 'revenue_change_pct' ? 'Porcentaje (%)' : `Monto (${settings.currency})`}
                  </label>
                  <input
                    type="number"
                    required
                    value={newWhatIf.amountOrPct}
                    onChange={(e) => setNewWhatIf({ ...newWhatIf, amountOrPct: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded font-mono-num focus:ring-1 focus:ring-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-[#475569] font-semibold mb-1">
                    Mes de Inicio
                  </label>
                  <select
                    value={newWhatIf.startMonthIndex}
                    onChange={(e) => setNewWhatIf({ ...newWhatIf, startMonthIndex: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded focus:ring-1 focus:ring-[#0F172A]"
                  >
                    {projections.months.map((m, idx) => (
                      <option key={idx} value={idx}>
                        Mes {idx + 1} ({m.label.split(' ')[0]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#475569] font-semibold mb-1">
                  Descripción u Objetivo
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre por qué se simula esta decisión..."
                  value={newWhatIf.description}
                  onChange={(e) => setNewWhatIf({ ...newWhatIf, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded focus:ring-1 focus:ring-[#0F172A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowAddWhatIfModal(false)}
                  className="px-3.5 py-2 border border-[#CBD5E1] rounded font-semibold text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#006C49] hover:bg-[#00875A] text-white rounded font-bold shadow-xs cursor-pointer"
                >
                  Guardar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
