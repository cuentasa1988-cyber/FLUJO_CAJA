import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Scale, 
  Download, 
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { 
  AppSettings, 
  Payable, 
  Receivable,
  Transaction,
  DatePeriodFilter
} from '../../types';
import { 
  calculateCurrentLiquidity, 
  calculateIVASummary,
  formatCurrency 
} from '../../utils/financial';
import { 
  getDefaultPeriodFilter, 
  isDateInPeriod 
} from '../../utils/dateFilter';
import { PeriodFilterBar } from '../common/PeriodFilterBar';

interface FinancialStatementsViewProps {
  settings: AppSettings;
  transactions: Transaction[];
  payables: Payable[];
  receivables?: Receivable[];
  periodFilter?: DatePeriodFilter;
  onChangePeriodFilter?: (filter: DatePeriodFilter) => void;
}

export const FinancialStatementsView: React.FC<FinancialStatementsViewProps> = ({
  settings,
  transactions,
  payables,
  receivables = [],
  periodFilter,
  onChangePeriodFilter,
}) => {
  const [activeTab, setActiveTab] = useState<'income_statement' | 'cash_flow' | 'balance_sheet'>('income_statement');
  const [localPeriodFilter, setLocalPeriodFilter] = useState<DatePeriodFilter>(() => getDefaultPeriodFilter());
  
  const activePeriodFilter = periodFilter || localPeriodFilter;
  const handlePeriodChange = onChangePeriodFilter || setLocalPeriodFilter;

  // Filter transactions based on active period filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => isDateInPeriod(t.date, activePeriodFilter));
  }, [transactions, activePeriodFilter]);

  // Liquidity calculation
  const { totalLiquidity, bank, cashDrawer } = calculateCurrentLiquidity(
    settings, 
    transactions, 
    payables
  );

  // Chilean Tax calculation (Base Imponible neta vs Débito Fiscal)
  const ivaSummary = useMemo(() => {
    return calculateIVASummary(filteredTransactions);
  }, [filteredTransactions]);

  // ==========================================
  // 1. ESTADO DE RESULTADOS (P&L / EERR)
  // ==========================================
  const incomeTransactions = filteredTransactions.filter(t => t.type === 'income');
  const expenseTransactions = filteredTransactions.filter(t => t.type === 'expense' || t.type === 'partner_withdrawal');

  // Gross & Net Revenue
  const grossRevenue = incomeTransactions.reduce((sum, t) => sum + t.grossAmount, 0);
  const netRevenue = incomeTransactions.reduce((sum, t) => sum + t.netAmount, 0);
  const paymentGatewayFees = grossRevenue - netRevenue;

  // ==========================================
  // CLASIFICACIÓN ESTRICTA Y EXCLUYENTE DE GASTOS
  // Cada transacción pertenece a EXACTAMENTE UN casillero
  // ==========================================
  const classifiedExpenses = useMemo(() => {
    const buckets = {
      cogs: [] as Transaction[],
      payroll: [] as Transaction[],
      rent_services: [] as Transaction[],
      marketing: [] as Transaction[],
      taxes: [] as Transaction[],
      capex: [] as Transaction[],
      equity_draw: [] as Transaction[],
      other_opex: [] as Transaction[],
    };

    for (const t of expenseTransactions) {
      const cat = t.category;
      const concept = (t.concept || '').toLowerCase();

      // 1. CAPEX (Inversión en Maquinaria y Activo Fijo)
      if (
        cat === 'capex_machinery' || 
        concept.includes('maquinaria') || 
        concept.includes('equipamiento capex') || 
        concept.includes('activo fijo')
      ) {
        buckets.capex.push(t);
      }
      // 2. Retiros y Reparto a Socios / Dueño / Reserva de Ganancias
      else if (
        cat === 'owner_draw' || 
        cat === 'profit_distribution' || 
        concept.includes('retiro de socio') || 
        concept.includes('sueldo del dueño') || 
        concept.includes('distribucion de ganancia') ||
        concept.includes('reserva de ganancias') ||
        concept.includes('fondo de emergencia')
      ) {
        buckets.equity_draw.push(t);
      }
      // 3. Impuestos y Leyes Sociales (F29, SII, Previred, Retenciones)
      else if (
        cat === 'taxes_sii' || 
        cat === 'taxes_previred' || 
        cat === 'tax_reserve' || 
        concept.includes('f29') || 
        concept.includes('impuesto') || 
        concept.includes('sii') || 
        concept.includes('previred') ||
        concept.includes('tesoreria')
      ) {
        buckets.taxes.push(t);
      }
      // 4. Costos Directos / Insumos / Mercaderías (COGS)
      else if (
        cat === 'raw_materials' || 
        cat === 'packaging' || 
        cat === 'shipping' ||
        concept.includes('insumo') || 
        concept.includes('mercaderia') || 
        concept.includes('proveedor directo') ||
        concept.includes('costo directo')
      ) {
        buckets.cogs.push(t);
      }
      // 5. Nómina y Sueldos
      else if (
        cat === 'payroll_daily' || 
        concept.includes('sueldo') || 
        concept.includes('nomina') || 
        concept.includes('honorario') ||
        concept.includes('remuneracion')
      ) {
        buckets.payroll.push(t);
      }
      // 6. Arriendos y Servicios Básicos (Luz, Agua, Internet, Software)
      else if (
        cat === 'rent' || 
        cat === 'utilities' || 
        cat === 'software_services' || 
        concept.includes('arriendo') || 
        concept.includes('luz') || 
        concept.includes('agua') || 
        concept.includes('internet') ||
        concept.includes('software') ||
        concept.includes('gastos comunes')
      ) {
        buckets.rent_services.push(t);
      }
      // 7. Marketing y Publicidad
      else if (
        cat === 'marketing' || 
        concept.includes('publicidad') || 
        concept.includes('marketing') ||
        concept.includes('anuncio') ||
        concept.includes('facebook ads') ||
        concept.includes('google ads')
      ) {
        buckets.marketing.push(t);
      }
      // 8. Otros Gastos Operativos y Generales (Exclusivo: no duplica impuestos ni capex)
      else {
        buckets.other_opex.push(t);
      }
    }

    return buckets;
  }, [expenseTransactions]);

  const totalCogs = classifiedExpenses.cogs.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalPayroll = classifiedExpenses.payroll.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalRentAndServices = classifiedExpenses.rent_services.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalMarketing = classifiedExpenses.marketing.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalOtherOpex = classifiedExpenses.other_opex.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalTaxes = classifiedExpenses.taxes.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalCapex = classifiedExpenses.capex.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalEquityDraw = classifiedExpenses.equity_draw.reduce((sum, t) => sum + t.grossAmount, 0);

  // Utilidad Bruta (Gross Profit)
  const grossProfit = netRevenue - totalCogs;
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  // Gastos de Operación (OpEx: Remuneraciones + Arriendos/Servicios + Marketing + Otros Operativos)
  const totalOperatingExpenses = totalPayroll + totalRentAndServices + totalMarketing + totalOtherOpex;

  // Utilidad Operativa (EBIT - Resultado Operacional)
  const operatingProfit = grossProfit - totalOperatingExpenses;
  const operatingMarginPct = grossRevenue > 0 ? (operatingProfit / grossRevenue) * 100 : 0;

  // Utilidad Neta Final del Ejercicio (EBIT - Impuestos)
  const netIncome = operatingProfit - totalTaxes;
  const netMarginPct = grossRevenue > 0 ? (netIncome / grossRevenue) * 100 : 0;

  // ==========================================
  // 2. FLUJO DE CAJA (CASH FLOW REAL)
  // ==========================================
  const cashInflows = incomeTransactions.reduce((sum, t) => sum + t.netAmount, 0);
  
  // Total desembolsos reales: suma exacta y reconciliada de todos los renglones
  const totalCashOutflows = totalCogs + totalPayroll + totalRentAndServices + totalMarketing + totalOtherOpex + totalTaxes + totalCapex + totalEquityDraw;
  const netCashFlow = cashInflows - totalCashOutflows;

  // ==========================================
  // 3. BALANCE GENERAL (BALANCE SHEET)
  // ==========================================
  // ACTIVOS
  const totalCashAssets = totalLiquidity;
  
  // Cuentas por Cobrar (Cartera de clientes pendiente de cobro)
  const pendingReceivables = receivables
    .filter(r => r.status !== 'collected' && r.remainingAmount > 0)
    .reduce((sum, r) => sum + r.remainingAmount, 0);

  const totalCurrentAssets = totalCashAssets + pendingReceivables;
  const totalFixedAssets = totalCapex;
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  // PASIVOS
  const pendingPayables = payables
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + p.remainingAmount, 0);

  const totalLiabilities = pendingPayables;

  // PATRIMONIO NETO
  const totalEquity = totalAssets - totalLiabilities;

  // Export Table to CSV
  const handleExportCSV = () => {
    let csvRows: string[][] = [];
    let fileName = '';

    if (activeTab === 'income_statement') {
      fileName = `Estado_de_Resultados_${settings.businessName || 'Empresa'}.csv`;
      csvRows = [
        ['ESTADO DE RESULTADOS (P&L)', 'MONTO (' + settings.currency + ')', '% SOBRE VENTAS'],
        ['Ingresos Brutos de Ventas', grossRevenue.toFixed(2), '100.0%'],
        ['(-) Débito Fiscal IVA 19% (Pasivo SII)', (-ivaSummary.ivaDebito).toFixed(2), (grossRevenue > 0 ? ((ivaSummary.ivaDebito / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['(-) Comisiones de Cobro / Pasarelas', (-paymentGatewayFees).toFixed(2), (grossRevenue > 0 ? ((paymentGatewayFees / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['= INGRESOS NETOS REALES', netRevenue.toFixed(2), (grossRevenue > 0 ? ((netRevenue / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['', '', ''],
        ['(-) Costo Directo de Ventas (COGS / Insumos)', (-totalCogs).toFixed(2), (grossRevenue > 0 ? ((totalCogs / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['= UTILIDAD BRUTA OPERACIONAL', grossProfit.toFixed(2), grossMarginPct.toFixed(1) + '%'],
        ['', '', ''],
        ['GASTOS DE ADMINISTRACION Y VENTAS (OPEX)', '', ''],
        ['(-) Nomina y Sueldos Base', (-totalPayroll).toFixed(2), (grossRevenue > 0 ? ((totalPayroll / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['(-) Arriendos y Servicios Basicos', (-totalRentAndServices).toFixed(2), (grossRevenue > 0 ? ((totalRentAndServices / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['(-) Marketing y Publicidad', (-totalMarketing).toFixed(2), (grossRevenue > 0 ? ((totalMarketing / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['(-) Otros Gastos Operativos y Generales', (-totalOtherOpex).toFixed(2), (grossRevenue > 0 ? ((totalOtherOpex / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['= TOTAL GASTOS OPERACIONALES', (-totalOperatingExpenses).toFixed(2), (grossRevenue > 0 ? ((totalOperatingExpenses / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['', '', ''],
        ['= UTILIDAD OPERATIVA (EBIT)', operatingProfit.toFixed(2), operatingMarginPct.toFixed(1) + '%'],
        ['(-) Impuestos y Retenciones (SII/F29/Previred)', (-totalTaxes).toFixed(2), (grossRevenue > 0 ? ((totalTaxes / grossRevenue) * 100).toFixed(1) : '0.0') + '%'],
        ['= RESULTADO NETO FINAL', netIncome.toFixed(2), netMarginPct.toFixed(1) + '%'],
      ];
    } else if (activeTab === 'cash_flow') {
      fileName = `Flujo_de_Caja_Real_${settings.businessName || 'Empresa'}.csv`;
      csvRows = [
        ['ESTADO DE FLUJO DE CAJA (CASH FLOW)', 'MONTO (' + settings.currency + ')'],
        ['Saldo Inicial de Caja y Banco', (settings.startingBankBalance + settings.startingCashDrawer).toFixed(2)],
        ['', ''],
        ['(+) ENTRADAS DE EFECTIVO', ''],
        ['Cobranza de Ventas y Facturas (Neto Recibido)', cashInflows.toFixed(2)],
        ['Total Entradas de Dinero', cashInflows.toFixed(2)],
        ['', ''],
        ['(-) SALIDAS DE EFECTIVO', ''],
        ['Pago de Insumos y Proveedores Directos', (-totalCogs).toFixed(2)],
        ['Pago de Nomina y Remuneraciones', (-totalPayroll).toFixed(2)],
        ['Pago de Arriendos y Gastos Fijos', (-totalRentAndServices).toFixed(2)],
        ['Pago de Publicidad y Marketing', (-totalMarketing).toFixed(2)],
        ['Otros Gastos Operativos y Generales', (-totalOtherOpex).toFixed(2)],
        ['Pago de Impuestos y Retenciones (F29/SII)', (-totalTaxes).toFixed(2)],
        ['Compra de Maquinaria y Activo Fijo (CAPEX)', (-totalCapex).toFixed(2)],
        ['Retiros de Socios / Reparto de Utilidades', (-totalEquityDraw).toFixed(2)],
        ['Total Salidas de Dinero', (-totalCashOutflows).toFixed(2)],
        ['', ''],
        ['= FLUJO NETO DEL PERIODO', netCashFlow.toFixed(2)],
        ['= SALDO FINAL DISPONIBLE EN CAJA Y BANCO', totalLiquidity.toFixed(2)],
      ];
    } else {
      fileName = `Balance_General_${settings.businessName || 'Empresa'}.csv`;
      csvRows = [
        ['BALANCE GENERAL (FOTO PATRIMONIAL)', 'MONTO (' + settings.currency + ')'],
        ['--- 1. ACTIVOS (LO QUE LA EMPRESA TIENE) ---', ''],
        ['Saldo en Cuentas Bancarias (Disponible)', bank.toFixed(2)],
        ['Saldo en Caja Chica / Efectivo (Disponible)', cashDrawer.toFixed(2)],
        ['Total Disponible Inmediato (Caja y Banco)', totalCashAssets.toFixed(2)],
        ['Cuentas por Cobrar a Clientes (Facturas Pendientes)', pendingReceivables.toFixed(2)],
        ['Total Activo Circulante (Líquido + Exigible)', totalCurrentAssets.toFixed(2)],
        ['Activos Fijos / Maquinaria y Equipos', totalFixedAssets.toFixed(2)],
        ['TOTAL ACTIVOS', totalAssets.toFixed(2)],
        ['', ''],
        ['--- 2. PASIVOS (LO QUE LA EMPRESA DEBE) ---', ''],
        ['Cuentas por Pagar a Proveedores (Pendientes)', pendingPayables.toFixed(2)],
        ['TOTAL PASIVOS', totalLiabilities.toFixed(2)],
        ['', ''],
        ['--- 3. PATRIMONIO NETO (VALOR DE LA EMPRESA) ---', ''],
        ['Capital Social y Reservas', (settings.startingBankBalance + settings.startingCashDrawer).toFixed(2)],
        ['Resultado Acumulado del Ejercicio', (totalEquity - (settings.startingBankBalance + settings.startingCashDrawer)).toFixed(2)],
        ['TOTAL PATRIMONIO NETO', totalEquity.toFixed(2)],
        ['', ''],
        ['CONTROL CONTABLE: TOTAL PASIVO + PATRIMONIO', (totalLiabilities + totalEquity).toFixed(2)],
      ];
    }

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#F1F5F9] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Estados Financieros Principales
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#E0E7FF] text-[#3730A3] text-[11px] font-bold">
              Contabilidad Directa
            </span>
          </div>
          <p className="text-sm text-[#64748B] mt-0.5">
            Los 3 pilares financieros de tu negocio: Rentabilidad (EERR), Liquidez (Caja) y Salud Patrimonial (Balance).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Export to CSV Button */}
          <button
            onClick={handleExportCSV}
            className="bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#006C49]" />
            <span>Descargar CSV</span>
          </button>
        </div>
      </div>

      {/* Global Synchronized Period Filter Bar */}
      <PeriodFilterBar
        filter={activePeriodFilter}
        onChangeFilter={handlePeriodChange}
      />

      {/* 3 Main Tabs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Tab 1: Estado de Resultados */}
        <button
          onClick={() => setActiveTab('income_statement')}
          className={`p-4 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            activeTab === 'income_statement'
              ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
              : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-4 h-4 ${activeTab === 'income_statement' ? 'text-[#4ADE80]' : 'text-[#006C49]'}`} />
              <span className="font-bold text-sm">1. Estado de Resultados</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              activeTab === 'income_statement' ? 'bg-[#1E293B] text-slate-200' : 'bg-[#F1F5F9] text-[#64748B]'
            }`}>
              P&L
            </span>
          </div>
          <p className={`text-xs ${activeTab === 'income_statement' ? 'text-slate-300' : 'text-[#64748B]'}`}>
            ¿Tu negocio gana o pierde dinero? (Ventas - Costos = Utilidad)
          </p>
          <div className="pt-2 border-t border-current/10 flex justify-between items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Resultado Neto:</span>
            <span className={`font-mono-num font-bold text-base ${
              activeTab === 'income_statement' 
                ? (netIncome >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]')
                : (netIncome >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]')
            }`}>
              {formatCurrency(netIncome, settings.currencySymbol, 0)}
            </span>
          </div>
        </button>

        {/* Tab 2: Flujo de Caja */}
        <button
          onClick={() => setActiveTab('cash_flow')}
          className={`p-4 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            activeTab === 'cash_flow'
              ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
              : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className={`w-4 h-4 ${activeTab === 'cash_flow' ? 'text-[#38BDF8]' : 'text-[#0284C7]'}`} />
              <span className="font-bold text-sm">2. Flujo de Caja Real</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              activeTab === 'cash_flow' ? 'bg-[#1E293B] text-slate-200' : 'bg-[#F1F5F9] text-[#64748B]'
            }`}>
              Cash Flow
            </span>
          </div>
          <p className={`text-xs ${activeTab === 'cash_flow' ? 'text-slate-300' : 'text-[#64748B]'}`}>
            ¿Entra o sale más dinero líquido de la cuenta corriente?
          </p>
          <div className="pt-2 border-t border-current/10 flex justify-between items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Caja Disponible:</span>
            <span className={`font-mono-num font-bold text-base ${
              activeTab === 'cash_flow'
                ? (totalLiquidity >= 0 ? 'text-[#38BDF8]' : 'text-[#F87171]')
                : (totalLiquidity >= 0 ? 'text-[#0284C7]' : 'text-[#DC2626]')
            }`}>
              {formatCurrency(totalLiquidity, settings.currencySymbol, 0)}
            </span>
          </div>
        </button>

        {/* Tab 3: Balance General */}
        <button
          onClick={() => setActiveTab('balance_sheet')}
          className={`p-4 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            activeTab === 'balance_sheet'
              ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
              : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className={`w-4 h-4 ${activeTab === 'balance_sheet' ? 'text-[#A78BFA]' : 'text-[#7C3AED]'}`} />
              <span className="font-bold text-sm">3. Balance General</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              activeTab === 'balance_sheet' ? 'bg-[#1E293B] text-slate-200' : 'bg-[#F1F5F9] text-[#64748B]'
            }`}>
              Patrimonio
            </span>
          </div>
          <p className={`text-xs ${activeTab === 'balance_sheet' ? 'text-slate-300' : 'text-[#64748B]'}`}>
            ¿Cuánto vale la empresa? (Activos vs Pasivos y Deudas)
          </p>
          <div className="pt-2 border-t border-current/10 flex justify-between items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Patrimonio Neto:</span>
            <span className={`font-mono-num font-bold text-base ${
              activeTab === 'balance_sheet'
                ? (totalEquity >= 0 ? 'text-[#A78BFA]' : 'text-[#F87171]')
                : (totalEquity >= 0 ? 'text-[#7C3AED]' : 'text-[#DC2626]')
            }`}>
              {formatCurrency(totalEquity, settings.currencySymbol, 0)}
            </span>
          </div>
        </button>
      </div>

      {/* 1. ESTADO DE RESULTADOS (INCOME STATEMENT / P&L) */}
      {activeTab === 'income_statement' && (
        <div className="bg-white border border-[#CBD5E1] rounded-md shadow-xs overflow-hidden">
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#006C49]" />
                <span>Estado de Resultados (Pérdidas y Ganancias)</span>
              </h3>
              <p className="text-xs text-[#64748B]">
                Refleja el rendimiento operativo real de las ventas generadas y los costos incurridos.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#64748B]">Margen Neto:</span>
              <span className={`font-bold px-2 py-0.5 rounded font-mono-num ${
                netMarginPct >= 15 ? 'bg-[#DCFCE7] text-[#006C49]' : netMarginPct >= 0 ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#FEE2E2] text-[#991B1B]'
              }`}>
                {netMarginPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#CBD5E1] text-[11px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-2.5 px-3 font-semibold">Línea Contable / Concepto</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-36">Monto ({settings.currency})</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-28">% Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                
                {/* 1. INGRESOS OPERACIONALES */}
                <tr className="bg-[#F8FAFC] font-bold text-[#0F172A]">
                  <td className="py-2.5 px-3">1. INGRESOS DE VENTAS</td>
                  <td className="py-2.5 px-3 text-right font-mono-num tnum">{formatCurrency(grossRevenue, settings.currencySymbol, 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-[#64748B]">{grossRevenue > 0 ? '100.0%' : '0.0%'}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">
                    <div>Ventas Totales Brutas (Facturas / Boletas)</div>
                    <div className="text-[11px] text-[#64748B] mt-0.5">
                      Base Neta sin IVA: <span className="font-mono-num font-semibold text-[#0F172A]">{formatCurrency(ivaSummary.salesNet, settings.currencySymbol, 0)}</span> | Débito Fiscal IVA 19%: <span className="font-mono-num font-semibold text-[#0F172A]">{formatCurrency(ivaSummary.ivaDebito, settings.currencySymbol, 0)}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#0F172A] tnum">{formatCurrency(grossRevenue, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#64748B]">{grossRevenue > 0 ? '100.0%' : '0.0%'}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#DC2626]">(-) Comisiones de Cobro / Pasarelas (Transbank/MP)</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(paymentGatewayFees, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626]">
                    {grossRevenue > 0 ? ((paymentGatewayFees / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="bg-[#F1F5F9] font-bold text-[#0F172A] border-t border-b border-[#CBD5E1]">
                  <td className="py-2 px-3 pl-4">= INGRESOS NETOS REALES</td>
                  <td className="py-2 px-3 text-right font-mono-num tnum">{formatCurrency(netRevenue, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num">
                    {grossRevenue > 0 ? ((netRevenue / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>

                {/* 2. COSTO DIRECTO DE VENTAS (COGS) */}
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#DC2626]">(-) Costo Directo de Insumos y Mercaderías (COGS)</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalCogs, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626]">
                    {grossRevenue > 0 ? ((totalCogs / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                
                {/* 3. UTILIDAD BRUTA */}
                <tr className="bg-[#ECFDF5] font-bold text-[#065F46] border-t-2 border-[#A7F3D0]">
                  <td className="py-2.5 px-3 pl-4">= UTILIDAD BRUTA OPERACIONAL</td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-sm tnum">{formatCurrency(grossProfit, settings.currencySymbol, 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-sm">{grossMarginPct.toFixed(1)}%</td>
                </tr>

                {/* 4. GASTOS DE OPERACION (OPEX) */}
                <tr className="bg-[#F8FAFC] font-bold text-[#0F172A]">
                  <td className="py-2.5 px-3">2. GASTOS DE ADMINISTRACIÓN Y VENTAS (OPEX)</td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalOperatingExpenses, settings.currencySymbol, 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-[#DC2626]">
                    {grossRevenue > 0 ? ((totalOperatingExpenses / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Nómina y Remuneraciones Base</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalPayroll, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#64748B]">
                    {grossRevenue > 0 ? ((totalPayroll / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Arriendos, Luz, Agua e Internet</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalRentAndServices, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#64748B]">
                    {grossRevenue > 0 ? ((totalRentAndServices / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Marketing y Publicidad</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalMarketing, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#64748B]">
                    {grossRevenue > 0 ? ((totalMarketing / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Otros Gastos Operativos y Generales</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalOtherOpex, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#64748B]">
                    {grossRevenue > 0 ? ((totalOtherOpex / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>

                {/* 5. UTILIDAD OPERATIVA (EBIT) */}
                <tr className="bg-[#F1F5F9] font-bold text-[#0F172A] border-t border-b border-[#CBD5E1]">
                  <td className="py-2.5 px-3 pl-4">= UTILIDAD OPERATIVA (EBIT)</td>
                  <td className={`py-2.5 px-3 text-right font-mono-num tnum ${operatingProfit >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                    {formatCurrency(operatingProfit, settings.currencySymbol, 0)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num">{operatingMarginPct.toFixed(1)}%</td>
                </tr>

                {/* 6. IMPUESTOS */}
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#DC2626]">(-) Impuestos, PPM y Retenciones (SII)</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalTaxes, settings.currencySymbol, 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626]">
                    {grossRevenue > 0 ? ((totalTaxes / grossRevenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>

                {/* 7. RESULTADO NETO FINAL */}
                <tr className={`font-bold border-t-2 ${
                  netIncome >= 0 ? 'bg-[#DCFCE7] text-[#006C49] border-[#16A34A]' : 'bg-[#FEE2E2] text-[#991B1B] border-[#DC2626]'
                }`}>
                  <td className="py-3 px-3 text-sm pl-4">= RESULTADO NETO DEL EJERCICIO (GANANCIA REAL)</td>
                  <td className="py-3 px-3 text-right font-mono-num text-base tnum">{formatCurrency(netIncome, settings.currencySymbol, 0)}</td>
                  <td className="py-3 px-3 text-right font-mono-num text-sm">{netMarginPct.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. FLUJO DE CAJA (CASH FLOW REAL) */}
      {activeTab === 'cash_flow' && (
        <div className="bg-white border border-[#CBD5E1] rounded-md shadow-xs overflow-hidden">
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#0284C7]" />
                <span>Estado de Flujo de Efectivo (Cash Flow)</span>
              </h3>
              <p className="text-xs text-[#64748B]">
                Movimiento real de dinero que entra y sale de las cuentas bancarias y caja chica.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#64748B]">Flujo Neto del Periodo:</span>
              <span className={`font-bold px-2 py-0.5 rounded font-mono-num ${
                netCashFlow >= 0 ? 'bg-[#DCFCE7] text-[#006C49]' : 'bg-[#FEE2E2] text-[#991B1B]'
              }`}>
                {formatCurrency(netCashFlow, settings.currencySymbol, 0)}
              </span>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#CBD5E1] text-[11px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-2.5 px-3 font-semibold">Concepto de Flujo de Efectivo</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-48">Monto ({settings.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                
                {/* Saldo Inicial */}
                <tr className="bg-[#F8FAFC] font-semibold text-[#0F172A]">
                  <td className="py-2.5 px-3">SALDO INICIAL DISPONIBLE (Apertura)</td>
                  <td className="py-2.5 px-3 text-right font-mono-num tnum">
                    {formatCurrency(settings.startingBankBalance + settings.startingCashDrawer, settings.currencySymbol, 0)}
                  </td>
                </tr>

                {/* ENTRADAS */}
                <tr className="bg-[#F0FDF4] font-bold text-[#166534]">
                  <td className="py-2.5 px-3">(+) ENTRADAS DE DINERO (Cobranzas Efectivas)</td>
                  <td className="py-2.5 px-3 text-right font-mono-num tnum">{formatCurrency(cashInflows, settings.currencySymbol, 0)}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Recaudación de Ventas (Efectivo, Tarjetas y Transferencias)</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#006C49] tnum">+{formatCurrency(cashInflows, settings.currencySymbol, 0)}</td>
                </tr>

                {/* SALIDAS */}
                <tr className="bg-[#FEF2F2] font-bold text-[#991B1B]">
                  <td className="py-2.5 px-3">(-) SALIDAS DE DINERO (Desembolsos Reales)</td>
                  <td className="py-2.5 px-3 text-right font-mono-num tnum">-{formatCurrency(totalCashOutflows, settings.currencySymbol, 0)}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Pago de Insumos y Proveedores Directos (Costos)</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalCogs, settings.currencySymbol, 0)}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Pago de Nómina y Sueldos</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalPayroll, settings.currencySymbol, 0)}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Pago de Arriendos, Servicios Básicos y Software</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalRentAndServices, settings.currencySymbol, 0)}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Pago de Publicidad y Marketing</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalMarketing, settings.currencySymbol, 0)}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Otros Gastos Operativos y Generales</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalOtherOpex, settings.currencySymbol, 0)}</td>
                </tr>
                <tr className="hover:bg-[#F8FAFC]">
                  <td className="py-2 px-3 pl-8 text-[#475569]">Pago de Impuestos y Retenciones (F29 / SII / Previred)</td>
                  <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalTaxes, settings.currencySymbol, 0)}</td>
                </tr>
                {totalCapex > 0 && (
                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-2 px-3 pl-8 text-[#475569]">Compra de Maquinaria y Activo Fijo (CAPEX)</td>
                    <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalCapex, settings.currencySymbol, 0)}</td>
                  </tr>
                )}
                {totalEquityDraw > 0 && (
                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-2 px-3 pl-8 text-[#475569]">Retiro de Socios / Reparto de Utilidades</td>
                    <td className="py-2 px-3 text-right font-mono-num text-[#DC2626] tnum">-{formatCurrency(totalEquityDraw, settings.currencySymbol, 0)}</td>
                  </tr>
                )}

                {/* RESULTADO NETO DE FLUJO */}
                <tr className="bg-[#F1F5F9] font-bold text-[#0F172A] border-t-2 border-[#CBD5E1]">
                  <td className="py-2.5 px-3 pl-4">= FLUJO NETO DEL PERIODO (Entradas - Salidas)</td>
                  <td className={`py-2.5 px-3 text-right font-mono-num text-sm tnum ${
                    netCashFlow >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'
                  }`}>
                    {formatCurrency(netCashFlow, settings.currencySymbol, 0)}
                  </td>
                </tr>

                {/* SALDO FINAL */}
                <tr className="bg-[#0F172A] text-white font-bold text-sm">
                  <td className="py-3 px-3 pl-4">= SALDO FINAL EN CAJA Y BANCO (DINERO DISPONIBLE)</td>
                  <td className="py-3 px-3 text-right font-mono-num text-base text-[#38BDF8] tnum">
                    {formatCurrency(totalLiquidity, settings.currencySymbol, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. BALANCE GENERAL (BALANCE SHEET) */}
      {activeTab === 'balance_sheet' && (
        <div className="bg-white border border-[#CBD5E1] rounded-md shadow-xs overflow-hidden">
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#7C3AED]" />
                <span>Balance General (Foto Patrimonial)</span>
              </h3>
              <p className="text-xs text-[#64748B]">
                Estructura patrimonial: Activos (lo que posees) vs. Pasivos (lo que debes) y Patrimonio Neto.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#64748B]">Ecuación Contable:</span>
              <span className="font-bold px-2 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9] font-mono-num">
                Activo = Pasivo + Patrimonio
              </span>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ACTIVOS */}
            <div className="border border-[#CBD5E1] rounded-md overflow-hidden">
              <div className="bg-[#F8FAFC] p-3 border-b border-[#CBD5E1] font-bold text-xs text-[#0F172A] uppercase tracking-wider flex justify-between">
                <span>1. ACTIVOS (BIENES Y DERECHOS)</span>
                <span className="text-[#006C49] font-mono-num">{formatCurrency(totalAssets, settings.currencySymbol, 0)}</span>
              </div>
              <div className="p-3 space-y-3 text-xs">
                <div className="space-y-1.5">
                  <span className="font-bold text-[11px] text-[#475569] uppercase tracking-wider">Activo Circulante (Disponible + Exigible)</span>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9] pl-3">
                    <span className="text-[#64748B]">Cuentas Bancarias Corrientes</span>
                    <span className="font-mono-num font-semibold text-[#0F172A]">{formatCurrency(bank, settings.currencySymbol, 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9] pl-3">
                    <span className="text-[#64748B]">Caja Chica / Efectivo en Mano</span>
                    <span className="font-mono-num font-semibold text-[#0F172A]">{formatCurrency(cashDrawer, settings.currencySymbol, 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 bg-[#F8FAFC] px-2 rounded font-medium">
                    <span className="text-[#475569]">Total Disponible Inmediato (Caja/Banco)</span>
                    <span className="font-mono-num text-[#006C49] font-bold">{formatCurrency(totalCashAssets, settings.currencySymbol, 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9] pl-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#64748B]">Cuentas por Cobrar a Clientes (Cobranza Viva)</span>
                      {pendingReceivables > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-[#EFF6FF] text-[#2563EB] font-bold rounded">
                          {receivables.filter(r => r.status !== 'collected' && r.remainingAmount > 0).length} doc(s)
                        </span>
                      )}
                    </div>
                    <span className="font-mono-num font-semibold text-[#2563EB]">{formatCurrency(pendingReceivables, settings.currencySymbol, 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 bg-[#EFF6FF]/60 px-2 rounded font-bold border border-[#DBEAFE]">
                    <span className="text-[#1E40AF]">Total Activo Circulante</span>
                    <span className="font-mono-num text-[#1E40AF]">{formatCurrency(totalCurrentAssets, settings.currencySymbol, 0)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="font-bold text-[11px] text-[#475569] uppercase tracking-wider">Activo Fijo (Bienes de Capital)</span>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9] pl-3">
                    <span className="text-[#64748B]">Maquinarias, Equipos y Mobiliario</span>
                    <span className="font-mono-num font-semibold text-[#0F172A]">{formatCurrency(totalFixedAssets, settings.currencySymbol, 0)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-[#CBD5E1] flex justify-between items-center font-bold text-sm bg-[#F0FDF4] p-2.5 rounded">
                  <span className="text-[#166534]">TOTAL ACTIVOS:</span>
                  <span className="font-mono-num text-[#166534]">{formatCurrency(totalAssets, settings.currencySymbol, 0)}</span>
                </div>
              </div>
            </div>

            {/* PASIVOS + PATRIMONIO */}
            <div className="space-y-4">
              <div className="border border-[#CBD5E1] rounded-md overflow-hidden">
                <div className="bg-[#F8FAFC] p-3 border-b border-[#CBD5E1] font-bold text-xs text-[#0F172A] uppercase tracking-wider flex justify-between">
                  <span>2. PASIVOS (DEUDAS Y COMPROMISOS)</span>
                  <span className="text-[#DC2626] font-mono-num">{formatCurrency(totalLiabilities, settings.currencySymbol, 0)}</span>
                </div>
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9] pl-3">
                    <span className="text-[#64748B]">Cuentas por Pagar Proveedores (Pendientes)</span>
                    <span className="font-mono-num font-semibold text-[#DC2626]">{formatCurrency(pendingPayables, settings.currencySymbol, 0)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-[#FEF2F2] px-2 rounded font-bold">
                    <span className="text-[#991B1B]">TOTAL PASIVOS (DEUDAS):</span>
                    <span className="font-mono-num text-[#991B1B]">{formatCurrency(totalLiabilities, settings.currencySymbol, 0)}</span>
                  </div>
                </div>
              </div>

              <div className="border border-[#CBD5E1] rounded-md overflow-hidden">
                <div className="bg-[#F8FAFC] p-3 border-b border-[#CBD5E1] font-bold text-xs text-[#0F172A] uppercase tracking-wider flex justify-between">
                  <span>3. PATRIMONIO NETO (VALOR REAL)</span>
                  <span className="text-[#7C3AED] font-mono-num">{formatCurrency(totalEquity, settings.currencySymbol, 0)}</span>
                </div>
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9] pl-3">
                    <span className="text-[#64748B]">Capital Inicial de Apertura</span>
                    <span className="font-mono-num font-semibold text-[#0F172A]">
                      {formatCurrency(settings.startingBankBalance + settings.startingCashDrawer, settings.currencySymbol, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9] pl-3">
                    <span className="text-[#64748B]">Resultado Acumulado del Negocio</span>
                    <span className={`font-mono-num font-semibold ${
                      (totalEquity - (settings.startingBankBalance + settings.startingCashDrawer)) >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'
                    }`}>
                      {formatCurrency(totalEquity - (settings.startingBankBalance + settings.startingCashDrawer), settings.currencySymbol, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-[#EDE9FE] px-2 rounded font-bold">
                    <span className="text-[#6D28D9]">TOTAL PATRIMONIO NETO:</span>
                    <span className="font-mono-num text-[#6D28D9]">{formatCurrency(totalEquity, settings.currencySymbol, 0)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-[#CBD5E1] flex justify-between items-center font-bold text-sm bg-[#0F172A] text-white p-3 rounded-md">
                <span>TOTAL PASIVO + PATRIMONIO:</span>
                <span className="font-mono-num text-[#38BDF8]">{formatCurrency(totalLiabilities + totalEquity, settings.currencySymbol, 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
