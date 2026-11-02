import React, { useState, useEffect } from 'react';
import { 
  TabType, 
  AppSettings, 
  Transaction, 
  Payable, 
  Receivable,
  ReceivableStatus,
  DailyClosure, 
  ProjectionScenario,
  DatePeriodFilter,
  OutflowMethod
} from './types';
import { storage } from './utils/storage';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { DailyRegistryView } from './components/registry/DailyRegistryView';
import { AccountsPayableView } from './components/payables/AccountsPayableView';
import { DistributionView } from './components/distribution/DistributionView';
import { FinancialStatementsView } from './components/financialStatements/FinancialStatementsView';
import { CashFlow30DaysView } from './components/cashflow/CashFlow30DaysView';
import { NewTransactionModal } from './components/modals/NewTransactionModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { F29TaxModal } from './components/modals/F29TaxModal';
import { getLocalDateString, getLocalTimeString } from './utils/financial';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { 
  auth, 
  testFirebaseConnection, 
  getUserCollections, 
  cloudSync,
  subscribeQuotaStatus,
  markQuotaExceeded,
  isQuotaError
} from './services/firebase';
import { CloudAuthModal } from './components/auth/CloudAuthModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [settings, setSettings] = useState<AppSettings>(() => storage.getSettings());
  const [transactions, setTransactions] = useState<Transaction[]>(() => storage.getTransactions());
  const [payables, setPayables] = useState<Payable[]>(() => storage.getPayables());
  const [receivables, setReceivables] = useState<Receivable[]>(() => storage.getReceivables());
  const [closures, setClosures] = useState<DailyClosure[]>(() => storage.getClosures());
  const [scenario, setScenario] = useState<ProjectionScenario>(() => storage.getScenario());
  const [periodFilter, setPeriodFilter] = useState<DatePeriodFilter>(() => storage.getPeriodFilter());

  // Cloud Authentication & Real-time Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudAuthOpen, setIsCloudAuthOpen] = useState<boolean>(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  const [dismissQuotaBanner, setDismissQuotaBanner] = useState<boolean>(false);

  useEffect(() => {
    testFirebaseConnection();
    const unsubQuota = subscribeQuotaStatus(setIsQuotaExceeded);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => {
      unsubQuota();
      unsubscribeAuth();
    };
  }, []);

  // Listen to Firestore real-time snapshots when user is authenticated (Option 1: Isolated per userId)
  useEffect(() => {
    if (!currentUser) return;
    if (localStorage.getItem('cloud_sync_disabled_v1') === 'true') {
      console.log('Cloud sync is disabled because of local reset.');
      return;
    }
    const uid = currentUser.uid;
    const collections = getUserCollections(uid);

    // Automatic background synchronization of any offline-registered or existing local data to the cloud
    const triggerAutoSync = async () => {
      try {
        if (transactions.length > 0 || payables.length > 0 || receivables.length > 0 || closures.length > 0) {
          console.log('[AutoSync] Backing up local data to cloud automatically...');
          await cloudSync.migrateLocalDataToCloud(uid, {
            transactions,
            payables,
            receivables,
            closures,
            settings,
            scenario
          });
          console.log('[AutoSync] Cloud synchronization complete.');
        }
      } catch (err) {
        console.warn('[AutoSync] Background synchronization bypassed:', err);
      }
    };
    triggerAutoSync();

    const handleSnapshotError = (source: string) => (err: unknown) => {
      console.warn(`[Firestore] Handled snapshot error on ${source}:`, err);
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
    };

    const unsubTx = onSnapshot(collections.transactions, (snapshot) => {
      if (!snapshot.empty) {
        const cloudTxs = snapshot.docs.map(d => d.data() as Transaction);
        cloudTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(cloudTxs);
      }
    }, handleSnapshotError('transactions'));

    const unsubPayables = onSnapshot(collections.payables, (snapshot) => {
      if (!snapshot.empty) {
        const cloudPayables = snapshot.docs.map(d => d.data() as Payable);
        setPayables(cloudPayables);
      }
    }, handleSnapshotError('payables'));

    const unsubReceivables = onSnapshot(collections.receivables, (snapshot) => {
      if (!snapshot.empty) {
        const cloudReceivables = snapshot.docs.map(d => d.data() as Receivable);
        setReceivables(cloudReceivables);
      }
    }, handleSnapshotError('receivables'));

    const unsubClosures = onSnapshot(collections.closures, (snapshot) => {
      if (!snapshot.empty) {
        const cloudClosures = snapshot.docs.map(d => d.data() as DailyClosure);
        setClosures(cloudClosures);
      }
    }, handleSnapshotError('closures'));

    const unsubSettings = onSnapshot(collections.settings, (docSnap) => {
      if (docSnap.exists()) {
        const cloudSettings = docSnap.data() as AppSettings;
        setSettings(cloudSettings);
        storage.saveSettings(cloudSettings);
      }
    }, handleSnapshotError('settings'));

    const unsubScenario = onSnapshot(collections.scenario, (docSnap) => {
      if (docSnap.exists()) {
        const cloudScenario = docSnap.data() as ProjectionScenario;
        setScenario(cloudScenario);
        storage.saveScenario(cloudScenario);
      }
    }, handleSnapshotError('scenario'));

    return () => {
      unsubTx();
      unsubPayables();
      unsubReceivables();
      unsubClosures();
      unsubSettings();
      unsubScenario();
    };
  }, [currentUser]);

  const handlePeriodFilterChange = (newFilter: DatePeriodFilter) => {
    setPeriodFilter(newFilter);
    storage.savePeriodFilter(newFilter);
  };

  const [isNewTxOpen, setIsNewTxOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isF29Open, setIsF29Open] = useState<boolean>(false);
  const [f29Month, setF29Month] = useState<string | undefined>(undefined);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Sync state to LocalStorage (pure local cache)
  useEffect(() => {
    storage.saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    storage.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    storage.savePayables(payables);
  }, [payables]);

  useEffect(() => {
    storage.saveReceivables(receivables);
  }, [receivables]);

  useEffect(() => {
    storage.saveClosures(closures);
  }, [closures]);

  useEffect(() => {
    storage.saveScenario(scenario);
  }, [scenario]);

  // Explicit Settings & Scenario Save Handlers (Prevents infinite write loops)
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    storage.saveSettings(newSettings);
    if (currentUser) {
      cloudSync.saveSettings(currentUser.uid, newSettings);
    }
  };

  const handleSaveScenario = (newScenario: ProjectionScenario) => {
    setScenario(newScenario);
    storage.saveScenario(newScenario);
    if (currentUser) {
      cloudSync.saveScenario(currentUser.uid, newScenario);
    }
  };

  // Transaction Handlers
  const handleAddTransaction = (tx: Transaction) => {
    if (currentUser) {
      cloudSync.saveTransaction(currentUser.uid, tx);
    }
    setTransactions(prev => {
      // Guard against duplicate ID or identical linked transaction
      const existingIdx = prev.findIndex(t => t.id === tx.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = tx;
        return updated;
      }
      return [tx, ...prev];
    });
  };

  const handleUpdateTransaction = (tx: Transaction) => {
    if (currentUser) {
      cloudSync.saveTransaction(currentUser.uid, tx);
    }
    const oldTx = transactions.find(t => t.id === tx.id);
    if (oldTx && (oldTx.grossAmount !== tx.grossAmount || oldTx.netAmount !== tx.netAmount || oldTx.date !== tx.date)) {
      // If linked to a receivable
      const recId = tx.linkedReceivableId;
      const targetRec = receivables.find(r => r.id === recId || (tx.type === 'income' && tx.id.startsWith('tx-rec-') && tx.concept.includes(r.clientName)));
      if (targetRec) {
        const oldAmount = oldTx.grossAmount || oldTx.netAmount || 0;
        const newAmount = tx.grossAmount || tx.netAmount || 0;
        const diff = newAmount - oldAmount;
        const newRemaining = Math.max(0, Math.min(targetRec.totalAmount, targetRec.remainingAmount - diff));
        const newStatus: ReceivableStatus = newRemaining <= 0 ? 'collected' : (newRemaining >= targetRec.totalAmount ? 'pending' : 'partial');
        const updatedHistory = (targetRec.paymentHistory || []).map(h => {
          if (h.id === tx.id || Math.abs(h.amount - oldAmount) < 0.01) {
            return { ...h, amount: newAmount, date: tx.date };
          }
          return h;
        });
        setReceivables(prev => prev.map(r => r.id === targetRec.id ? {
          ...r,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentHistory: updatedHistory,
        } : r));
      }

      // If linked to a payable
      const payId = tx.linkedPayableId;
      const targetPay = payables.find(p => p.id === payId || (tx.type === 'expense' && tx.id.startsWith('tx-pay-') && tx.concept.includes(p.vendor)));
      if (targetPay) {
        const oldAmount = oldTx.grossAmount || oldTx.netAmount || 0;
        const newAmount = tx.grossAmount || tx.netAmount || 0;
        const diff = newAmount - oldAmount;
        const newRemaining = Math.max(0, Math.min(targetPay.totalAmount, targetPay.remainingAmount - diff));
        const newStatus = newRemaining <= 0 ? 'paid' : 'pending';
        const updatedPayHistory = (targetPay.paymentHistory || []).map(h => {
          if (h.id === tx.id || Math.abs(h.amount - oldAmount) < 0.01) {
            return { ...h, amount: newAmount, date: tx.date };
          }
          return h;
        });
        setPayables(prev => prev.map(p => p.id === targetPay.id ? {
          ...p,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentHistory: updatedPayHistory,
        } : p));
      }
    }
    setTransactions(prev => prev.map(item => item.id === tx.id ? tx : item));
  };

  const handleDeleteTransaction = (id: string) => {
    // Check if the transaction being deleted is linked to a Receivable or Payable
    const txToDelete = transactions.find(t => t.id === id);
    if (txToDelete) {
      // 1. If it's linked to a Receivable (explicit or fallback by concept/prefix)
      let targetRec = txToDelete.linkedReceivableId 
        ? receivables.find(r => r.id === txToDelete.linkedReceivableId)
        : null;

      // Fallback matching if legacy transaction without linkedReceivableId:
      if (!targetRec && txToDelete.type === 'income') {
        targetRec = receivables.find(r => 
          (txToDelete.id.startsWith('tx-rec-') || txToDelete.concept.includes('Cobro a cliente:')) &&
          (txToDelete.concept.includes(r.clientName) || (r.docNumber && txToDelete.docNumber === r.docNumber))
        ) || null;
      }

      if (targetRec) {
        // Rollback the collection on this receivable:
        const revertedAmount = txToDelete.grossAmount || txToDelete.netAmount || 0;
        const newRemaining = Math.min(targetRec.totalAmount, targetRec.remainingAmount + revertedAmount);
        
        // Remove linked payment history entry
        let updatedHistory = targetRec.paymentHistory ? [...targetRec.paymentHistory] : [];
        if (updatedHistory.length > 0) {
          const entryIdx = updatedHistory.findIndex(h => h.id === txToDelete.id || Math.abs(h.amount - revertedAmount) < 0.01);
          if (entryIdx !== -1) {
            updatedHistory.splice(entryIdx, 1);
          } else {
            updatedHistory.pop();
          }
        }

        const newStatus: ReceivableStatus = newRemaining >= targetRec.totalAmount 
          ? 'pending' 
          : newRemaining <= 0 
            ? 'collected' 
            : 'partial';

        const updatedReceivable: Receivable = {
          ...targetRec,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentHistory: updatedHistory,
        };

        setReceivables(prev => prev.map(r => r.id === targetRec!.id ? updatedReceivable : r));
      }

      // 2. If it's linked to a Payable
      let targetPay = txToDelete.linkedPayableId
        ? payables.find(p => p.id === txToDelete.linkedPayableId)
        : null;

      if (!targetPay && txToDelete.type === 'expense') {
        targetPay = payables.find(p =>
          (txToDelete.id.startsWith('tx-pay-') || txToDelete.concept.includes('Pago compromiso:')) &&
          txToDelete.concept.includes(p.vendor)
        ) || null;
      }

      if (targetPay) {
        const revertedAmount = txToDelete.grossAmount || txToDelete.netAmount || 0;
        const newRemaining = Math.min(targetPay.totalAmount, targetPay.remainingAmount + revertedAmount);
        const newStatus = newRemaining <= 0 ? 'paid' : 'pending';
        const newInstallment = Math.max(0, (targetPay.currentInstallment || 1) - 1);

        let updatedPayHistory = targetPay.paymentHistory ? [...targetPay.paymentHistory] : [];
        if (updatedPayHistory.length > 0) {
          const entryIdx = updatedPayHistory.findIndex(h => h.id === txToDelete.id || Math.abs(h.amount - revertedAmount) < 0.01);
          if (entryIdx !== -1) {
            updatedPayHistory.splice(entryIdx, 1);
          } else {
            updatedPayHistory.pop();
          }
        }

        const updatedPayable: Payable = {
          ...targetPay,
          remainingAmount: newRemaining,
          status: newStatus,
          currentInstallment: newInstallment,
          paymentHistory: updatedPayHistory,
        };

        setPayables(prev => prev.map(p => p.id === targetPay!.id ? updatedPayable : p));
        if (currentUser) {
          cloudSync.savePayable(currentUser.uid, updatedPayable);
        }
      }
    }

    if (currentUser) {
      cloudSync.deleteTransaction(currentUser.uid, id);
    }
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Payable Handlers
  const handleAddPayable = (p: Payable | Payable[]) => {
    const payList = Array.isArray(p) ? p : [p];
    if (currentUser) {
      payList.forEach(item => cloudSync.savePayable(currentUser.uid, item));
    }
    setPayables(prev => [...payList, ...prev]);
  };

  const handleUpdatePayable = (updatedPay: Payable) => {
    if (currentUser) {
      cloudSync.savePayable(currentUser.uid, updatedPay);
    }
    const oldPay = payables.find(p => p.id === updatedPay.id);
    if (oldPay) {
      const newPaymentIds = new Set((updatedPay.paymentHistory || []).map(p => p.id).filter(Boolean));
      const removedPaymentIds = new Set<string>();
      if (oldPay.paymentHistory) {
        for (const oldPayEntry of oldPay.paymentHistory) {
          if (oldPayEntry.id && !newPaymentIds.has(oldPayEntry.id)) {
            removedPaymentIds.add(oldPayEntry.id);
          }
        }
      }

      // If payments were reverted (e.g. reopened or removed)
      if (removedPaymentIds.size > 0 || (updatedPay.status === 'pending' && oldPay.status !== 'pending' && updatedPay.remainingAmount === updatedPay.totalAmount)) {
        setTransactions(prev => prev.filter(tx => {
          if (removedPaymentIds.has(tx.id)) return false;
          if (tx.linkedPayableId === updatedPay.id && !newPaymentIds.has(tx.id)) return false;
          if (updatedPay.status === 'pending' && (tx.linkedPayableId === updatedPay.id || (tx.type === 'expense' && tx.id.startsWith('tx-pay-') && tx.concept.includes(updatedPay.vendor)))) {
            return false;
          }
          return true;
        }));
      }
    }
    setPayables(prev => prev.map(item => item.id === updatedPay.id ? updatedPay : item));
  };

  const handleDeletePayable = (id: string) => {
    if (currentUser) {
      cloudSync.deletePayable(currentUser.uid, id);
    }
    const payToDelete = payables.find(p => p.id === id);
    if (payToDelete) {
      const linkedTxIds = new Set<string>();
      if (payToDelete.paymentHistory) {
        payToDelete.paymentHistory.forEach(h => {
          if (h.id) linkedTxIds.add(h.id);
        });
      }
      setTransactions(prev => prev.filter(tx => {
        if (tx.linkedPayableId === id) return false;
        if (linkedTxIds.has(tx.id)) return false;
        if (tx.type === 'expense' && tx.id.startsWith('tx-pay-') && tx.concept.includes(payToDelete.vendor)) {
          return false;
        }
        return true;
      }));
    }
    setPayables(prev => prev.filter(p => p.id !== id));
  };

  // Receivable Handlers
  const handleAddReceivable = (rec: Receivable | Receivable[]) => {
    const recList = Array.isArray(rec) ? rec : [rec];
    if (currentUser) {
      recList.forEach(item => cloudSync.saveReceivable(currentUser.uid, item));
    }
    setReceivables(prev => [...recList, ...prev]);

    // Check for any initial payments / already collected entries and create transactions
    const newTxs: Transaction[] = [];
    for (const r of recList) {
      if (r.paymentHistory && r.paymentHistory.length > 0) {
        for (const h of r.paymentHistory) {
          const isTaxDoc = r.docType === 'factura' || r.docType === 'boleta' || r.hasFactura;
          const ivaAmount = isTaxDoc ? (h.amount - (h.amount / 1.19)) : 0;
          const incomePaymentMethod = h.destinationMethod === 'cash_drawer' ? 'cash' : 'bank_transfer';
          const txId = h.id || `tx-rec-init-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          h.id = txId; // ensure id matches
          newTxs.push({
            id: txId,
            type: 'income',
            date: h.date || getLocalDateString(),
            time: getLocalTimeString(),
            concept: `Cobro a cliente: ${r.clientName} (${r.concept})`,
            paymentMethod: incomePaymentMethod,
            docType: r.docType === 'factura' ? 'factura' : r.docType === 'boleta' ? 'boleta' : 'sin_doc',
            docNumber: r.docNumber,
            hasFactura: r.docType === 'factura',
            ivaAmount,
            grossAmount: h.amount,
            feeAmount: 0,
            netAmount: h.amount,
            notes: h.reference || 'Abono / Cobro registrado',
            linkedReceivableId: r.id,
          });
        }
      }
    }
    if (newTxs.length > 0) {
      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const filteredNew = newTxs.filter(t => !existingIds.has(t.id));
        return [...filteredNew, ...prev];
      });
    }
  };

  // Clean up any duplicate transactions currently in state
  useEffect(() => {
    setTransactions(prev => {
      const seenIds = new Set<string>();
      const seenLinked = new Set<string>();
      let changed = false;
      const cleanList: Transaction[] = [];

      for (const tx of prev) {
        if (!tx.id || seenIds.has(tx.id)) {
          changed = true;
          continue;
        }
        if (tx.linkedReceivableId) {
          const key = `${tx.linkedReceivableId}_${tx.grossAmount || tx.netAmount}_${tx.date}`;
          if (seenLinked.has(key)) {
            changed = true;
            continue;
          }
          seenLinked.add(key);
        }
        seenIds.add(tx.id);
        cleanList.push(tx);
      }

      return changed ? cleanList : prev;
    });
  }, []);

  const handleUpdateReceivable = (updatedRec: Receivable) => {
    const oldRec = receivables.find(r => r.id === updatedRec.id);
    if (oldRec) {
      // Check if payment history was cleared or reduced (e.g. Reabrir / anular cobro)
      const newPaymentIds = new Set((updatedRec.paymentHistory || []).map(p => p.id).filter(Boolean));
      
      const removedPaymentIds = new Set<string>();
      const removedPayments: { date: string; amount: number }[] = [];
      
      if (oldRec.paymentHistory) {
        for (const oldPay of oldRec.paymentHistory) {
          if (oldPay.id && !newPaymentIds.has(oldPay.id)) {
            removedPaymentIds.add(oldPay.id);
            removedPayments.push({ date: oldPay.date, amount: oldPay.amount });
          } else if (!oldPay.id) {
            const countInOld = oldRec.paymentHistory.filter(p => p.date === oldPay.date && Math.abs(p.amount - oldPay.amount) < 0.01).length;
            const countInNew = (updatedRec.paymentHistory || []).filter(p => p.date === oldPay.date && Math.abs(p.amount - oldPay.amount) < 0.01).length;
            if (countInNew < countInOld) {
              removedPayments.push({ date: oldPay.date, amount: oldPay.amount });
            }
          }
        }
      }

      // If all payment history was cleared (Reabrir / anular cobro) or specific payments removed:
      if (removedPaymentIds.size > 0 || removedPayments.length > 0 || (updatedRec.status === 'pending' && oldRec.status !== 'pending' && updatedRec.remainingAmount === updatedRec.totalAmount)) {
        setTransactions(prev => {
          let filtered = [...prev];
          // 1. Remove by ID if known
          if (removedPaymentIds.size > 0) {
            filtered = filtered.filter(tx => !removedPaymentIds.has(tx.id));
          }
          // 2. If completely reset to pending:
          if (updatedRec.status === 'pending' && updatedRec.remainingAmount === updatedRec.totalAmount) {
            filtered = filtered.filter(tx => !(
              tx.linkedReceivableId === updatedRec.id || 
              (tx.type === 'income' && tx.id.startsWith('tx-rec-') && tx.concept.includes(updatedRec.clientName))
            ));
          } else if (removedPayments.length > 0) {
            // Remove matching income transactions for the removed payments
            for (const rem of removedPayments) {
              const txIdx = filtered.findIndex(tx => 
                (tx.linkedReceivableId === updatedRec.id || (tx.type === 'income' && tx.concept.includes(updatedRec.clientName))) &&
                Math.abs((tx.grossAmount || tx.netAmount) - rem.amount) < 0.01
              );
              if (txIdx !== -1) {
                filtered.splice(txIdx, 1);
              }
            }
          }
          return filtered;
        });
      }
    }
    if (currentUser) {
      cloudSync.saveReceivable(currentUser.uid, updatedRec);
    }
    setReceivables(prev => prev.map(item => item.id === updatedRec.id ? updatedRec : item));
  };

  const handleDeleteReceivable = (id: string) => {
    if (currentUser) {
      cloudSync.deleteReceivable(currentUser.uid, id);
    }
    const recToDelete = receivables.find(r => r.id === id);
    if (recToDelete) {
      // Find all transaction IDs that originated from this receivable
      const linkedTxIds = new Set<string>();
      if (recToDelete.paymentHistory) {
        recToDelete.paymentHistory.forEach(h => {
          if (h.id) linkedTxIds.add(h.id);
        });
      }

      // Remove all transactions associated with this receivable
      setTransactions(prev => prev.filter(tx => {
        // Explicit link
        if (tx.linkedReceivableId === id) return false;
        // Linked by payment history entry ID
        if (linkedTxIds.has(tx.id)) return false;
        // Legacy link matching pattern
        if (tx.type === 'income' && tx.id.startsWith('tx-rec-') && tx.concept.includes(recToDelete.clientName)) {
          return false;
        }
        return true;
      }));
    }
    setReceivables(prev => prev.filter(r => r.id !== id));
  };

  // Handle collecting a receivable (total or partial payment from client)
  const handleRecordReceivableCollection = (
    receivable: Receivable,
    collectionAmount: number,
    destinationMethod: OutflowMethod,
    collectionDate?: string,
    collectionTime?: string,
    reference?: string
  ) => {
    const newRemaining = Math.max(0, receivable.remainingAmount - collectionAmount);
    const isNowCollected = newRemaining <= 0;
    const txId = `tx-rec-${Date.now()}`;

    const newHistoryEntry = {
      id: txId,
      date: collectionDate || getLocalDateString(),
      amount: collectionAmount,
      destinationMethod,
      reference,
    };

    const updatedReceivable: Receivable = {
      ...receivable,
      remainingAmount: newRemaining,
      status: isNowCollected ? 'collected' : 'partial',
      paymentHistory: [
        ...(receivable.paymentHistory || []),
        newHistoryEntry,
      ],
    };

    handleUpdateReceivable(updatedReceivable);

    // Also record income in transactions ledger using local timezone date and time!
    const isTaxDoc = receivable.docType === 'factura' || receivable.docType === 'boleta' || receivable.hasFactura;
    const ivaAmount = isTaxDoc ? (collectionAmount - (collectionAmount / 1.19)) : 0;
    const incomePaymentMethod = destinationMethod === 'cash_drawer' ? 'cash' : 'bank_transfer';

    const incomeTx: Transaction = {
      id: txId,
      type: 'income',
      date: collectionDate || getLocalDateString(),
      time: collectionTime || getLocalTimeString(),
      concept: `Cobro a cliente: ${receivable.clientName} (${receivable.concept})`,
      paymentMethod: incomePaymentMethod,
      docType: receivable.docType === 'factura' ? 'factura' : receivable.docType === 'boleta' ? 'boleta' : 'sin_doc',
      docNumber: receivable.docNumber,
      hasFactura: receivable.docType === 'factura',
      ivaAmount,
      grossAmount: collectionAmount,
      feeAmount: 0,
      netAmount: collectionAmount,
      notes: reference ? `Ref: ${reference}` : undefined,
      linkedReceivableId: receivable.id,
    };

    handleAddTransaction(incomeTx);
  };

  // Handle paying an installment or full amount of a payable
  const handleRecordPayablePayment = (
    payable: Payable, 
    paymentAmount: number, 
    paymentDate?: string, 
    paymentTime?: string,
    paymentMethod: OutflowMethod = 'bank_transfer'
  ) => {
    const newRemaining = Math.max(0, payable.remainingAmount - paymentAmount);
    const isNowPaid = newRemaining <= 0;
    const newCurrentInstallment = Math.min(payable.installmentCount, payable.currentInstallment + 1);
    const txId = `tx-pay-${Date.now()}`;

    const newHistoryEntry = {
      id: txId,
      date: paymentDate || getLocalDateString(),
      amount: paymentAmount,
      outflowMethod: paymentMethod,
    };

    const updatedPayable: Payable = {
      ...payable,
      remainingAmount: newRemaining,
      status: isNowPaid ? 'paid' : 'pending',
      currentInstallment: newCurrentInstallment,
      paymentHistory: [
        ...(payable.paymentHistory || []),
        newHistoryEntry,
      ],
    };

    handleUpdatePayable(updatedPayable);

    // Also record expense in transactions ledger using local timezone date and time
    const hasFactura = payable.hasFactura || payable.docType === 'factura';
    const ivaAmount = hasFactura ? (paymentAmount - (paymentAmount / 1.19)) : 0;
    
    const expenseTx: Transaction = {
      id: txId,
      type: 'expense',
      date: paymentDate || getLocalDateString(),
      time: paymentTime || getLocalTimeString(),
      concept: `Pago compromiso: ${payable.vendor} (${payable.concept})`,
      category: payable.category || 'software_services',
      outflowMethod: paymentMethod,
      docType: payable.docType || (payable.hasFactura ? 'factura' : 'sin_doc'),
      hasFactura: !!hasFactura,
      ivaAmount,
      grossAmount: paymentAmount,
      feeAmount: 0,
      netAmount: paymentAmount,
      linkedPayableId: payable.id,
    };

    handleAddTransaction(expenseTx);
  };

  // Closure Handlers with duplicate prevention
  const handleSaveClosure = (closure: DailyClosure) => {
    if (currentUser) {
      cloudSync.saveClosure(currentUser.uid, closure);
    }
    setClosures(prev => {
      // If a closure for same date and shift already exists, replace it to prevent accidental duplicates
      const existingIdx = prev.findIndex(c => c.date === closure.date && c.shift === closure.shift);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = closure;
        return updated;
      }
      return [closure, ...prev];
    });
  };

  const handleDeleteClosure = (id: string) => {
    if (currentUser) {
      cloudSync.deleteClosure(currentUser.uid, id);
    }
    setClosures(prev => {
      const updated = prev.filter(c => c.id !== id);
      storage.saveClosures(updated);
      return updated;
    });
  };

  const handleClearClosures = () => {
    storage.saveClosures([]);
    setClosures([]);
  };

  const handleCleanDuplicateClosures = () => {
    setClosures(prev => {
      const seen = new Set<string>();
      const updated = prev.filter(c => {
        const key = `${c.date}-${c.shift}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      storage.saveClosures(updated);
      return updated;
    });
  };

  // Scenario Handler
  const handleUpdateScenario = (newScenario: ProjectionScenario) => {
    setScenario(newScenario);
  };

  const [resetToastMessage, setResetToastMessage] = useState<string | null>(null);

  // Reset & Clear data handlers
  const handleClearAllData = async (customBalances?: { bank?: number; cashDrawer?: number; businessName?: string }) => {
    // Disable cloud sync immediately in localStorage to prevent old cloud cache from overriding 0-state
    localStorage.setItem('cloud_sync_disabled_v1', 'true');
    
    if (currentUser) {
      try {
        await cloudSync.clearAllCloudData(currentUser.uid);
      } catch (err) {
        console.error('Error clearing cloud data:', err);
      }
      try {
        await signOut(auth);
      } catch (err) {
        console.error('Error signing out:', err);
      }
    }
    const res = storage.clearAllData(customBalances);
    setSettings(res.settings);
    setTransactions([]);
    setPayables([]);
    setReceivables([]);
    setClosures([]);
    setScenario(res.scenario);
    setPeriodFilter(res.periodFilter);
    setCurrentTab('dashboard');
    setResetToastMessage('¡Aplicación reiniciada desde cero! Se ha desactivado la nube temporalmente debido al límite de cuota para permitirte operar de forma limpia de forma local.');
    setTimeout(() => {
      setResetToastMessage(null);
    }, 8000);
  };

  const handleResetDemoData = () => {
    localStorage.removeItem('cloud_sync_disabled_v1');
    const res = storage.resetToDemoData();
    if (res) {
      setSettings(res.settings);
      setTransactions(res.transactions);
      setPayables(res.payables);
      setReceivables(res.receivables);
      setClosures(res.closures);
      setScenario(res.scenario);
      setPeriodFilter(res.periodFilter);
    }
    setCurrentTab('dashboard');
    setResetToastMessage('Se han restaurado los datos de demostración iniciales.');
    setTimeout(() => {
      setResetToastMessage(null);
    }, 5000);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC] text-[#0B1C30] overflow-x-hidden">
      {/* Desktop & Mobile Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenNewTransaction={() => setIsNewTxOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        currentUser={currentUser}
        onOpenCloudAuth={() => setIsCloudAuthOpen(true)}
      />

      {/* Main App Container */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <TopNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenNewTransaction={() => setIsNewTxOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          currentUser={currentUser}
          onOpenCloudAuth={() => setIsCloudAuthOpen(true)}
        />

        {/* Dynamic Views Area */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {isQuotaExceeded && !dismissQuotaBanner && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-xs flex items-start justify-between gap-3 text-amber-900 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">Modo Local Activo (Límite diario de sincronización alcanzado)</h4>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    La cuota diaria gratuita de la base de datos Google Firestore se ha completado por hoy. 
                    <strong> Todas tus transacciones, pagos, clientes y configuraciones continúan guardándose y funcionando con normalidad en este dispositivo.</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissQuotaBanner(true)}
                className="text-xs font-semibold text-amber-800 hover:text-amber-950 px-2.5 py-1 rounded bg-amber-200/70 hover:bg-amber-200 transition-colors cursor-pointer shrink-0"
              >
                Entendido
              </button>
            </div>
          )}

          {resetToastMessage && (
            <div className="mb-4 p-4 bg-[#ECFDF5] border border-[#6EE7B7] rounded-lg shadow-sm flex items-center justify-between animate-fade-in text-[#065F46]">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" />
                <span className="text-sm font-semibold">{resetToastMessage}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setResetToastMessage(null)}
                className="text-xs font-bold text-[#047857] hover:text-[#065F46] px-2 py-1 rounded bg-[#D1FAE5] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}
          {currentTab === 'dashboard' && (
            <DashboardView
              settings={settings}
              transactions={transactions}
              payables={payables}
              receivables={receivables}
              scenario={scenario}
              onNavigate={setCurrentTab}
              onOpenF29Modal={() => {
                setF29Month(undefined);
                setIsF29Open(true);
              }}
              periodFilter={periodFilter}
              onChangePeriodFilter={handlePeriodFilterChange}
              onResetDemoData={handleResetDemoData}
              onOpenCloudAuth={() => setIsCloudAuthOpen(true)}
              currentUser={currentUser}
            />
          )}

          {currentTab === 'registry' && (
            <DailyRegistryView
              settings={settings}
              transactions={transactions}
              closures={closures}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onSaveClosure={handleSaveClosure}
              onDeleteClosure={handleDeleteClosure}
              onClearClosures={handleClearClosures}
              onCleanDuplicateClosures={handleCleanDuplicateClosures}
              onAddPayable={handleAddPayable}
              onOpenF29Modal={(month) => {
                setF29Month(month);
                setIsF29Open(true);
              }}
              periodFilter={periodFilter}
              onChangePeriodFilter={handlePeriodFilterChange}
              onResetDemoData={handleResetDemoData}
              onOpenCloudAuth={() => setIsCloudAuthOpen(true)}
              currentUser={currentUser}
            />
          )}

          {currentTab === 'payables' && (
            <AccountsPayableView
              settings={settings}
              payables={payables}
              transactions={transactions}
              onAddPayable={handleAddPayable}
              onUpdatePayable={handleUpdatePayable}
              onDeletePayable={handleDeletePayable}
              onRecordPayablePayment={handleRecordPayablePayment}
              onAddTransaction={handleAddTransaction}
              periodFilter={periodFilter}
              onChangePeriodFilter={handlePeriodFilterChange}
            />
          )}

          {currentTab === 'distribution' && (
            <DistributionView
              settings={settings}
              transactions={transactions}
              onAddTransaction={handleAddTransaction}
              onOpenF29Modal={(month) => {
                setF29Month(month);
                setIsF29Open(true);
              }}
              onUpdatePartners={(partners) => {
                handleSaveSettings({ ...settings, partners });
              }}
              periodFilter={periodFilter}
              onChangePeriodFilter={handlePeriodFilterChange}
            />
          )}

          {currentTab === 'financial_statements' && (
            <FinancialStatementsView
              settings={settings}
              transactions={transactions}
              payables={payables}
              receivables={receivables}
              periodFilter={periodFilter}
              onChangePeriodFilter={handlePeriodFilterChange}
            />
          )}

          {(currentTab === 'cashflow30' || currentTab === 'projections') && (
            <CashFlow30DaysView
              settings={settings}
              payables={payables}
              receivables={receivables}
              transactions={transactions}
              onAddReceivable={handleAddReceivable}
              onUpdateReceivable={handleUpdateReceivable}
              onDeleteReceivable={handleDeleteReceivable}
              onRecordReceivableCollection={handleRecordReceivableCollection}
              onNavigateToPayables={() => setCurrentTab('payables')}
            />
          )}
        </main>
      </div>

      {/* Quick Global New Transaction Modal */}
      <NewTransactionModal
        isOpen={isNewTxOpen}
        onClose={() => setIsNewTxOpen(false)}
        settings={settings}
        onAddTransaction={handleAddTransaction}
        onAddPayable={handleAddPayable}
      />

      {/* Formulario 29 SII Tax Liquidator Modal */}
      <F29TaxModal
        isOpen={isF29Open}
        onClose={() => setIsF29Open(false)}
        settings={settings}
        transactions={transactions}
        onAddTransaction={handleAddTransaction}
        defaultMonth={f29Month}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onClearAllData={handleClearAllData}
        onResetDemoData={handleResetDemoData}
      />

      {/* Cloud Authentication & Isolation Modal */}
      <CloudAuthModal
        isOpen={isCloudAuthOpen}
        onClose={() => setIsCloudAuthOpen(false)}
        currentUser={currentUser}
        localData={{
          transactions,
          payables,
          receivables,
          closures,
          settings,
          scenario,
        }}
      />
    </div>
  );
}
