import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDocFromServer,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  AppSettings, 
  Transaction, 
  Payable, 
  Receivable, 
  DailyClosure, 
  ProjectionScenario 
} from '../types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with auto-detect long polling for reliable connection across environments & proxies
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined
);

// Initialize Auth with localStorage persistence for iframe resilience
export const auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[FirebaseAuth] Persistence setup notice:', err);
  });
}
export const googleProvider = new GoogleAuthProvider();

// Quota & Exhaustion Tracker
let isQuotaExceeded = typeof window !== 'undefined' && sessionStorage.getItem('firestore_quota_exceeded') === 'true';
const quotaListeners = new Set<(exceeded: boolean) => void>();

export function getIsQuotaExceeded(): boolean {
  return isQuotaExceeded;
}

export function subscribeQuotaStatus(cb: (exceeded: boolean) => void): () => void {
  quotaListeners.add(cb);
  cb(isQuotaExceeded);
  return () => quotaListeners.delete(cb);
}

export function markQuotaExceeded(): void {
  if (!isQuotaExceeded) {
    isQuotaExceeded = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('firestore_quota_exceeded', 'true');
    }
    quotaListeners.forEach(cb => cb(true));
    console.warn('[Firestore] Project write quota exceeded. Operating seamlessly in resilient local mode.');
  }
}

export function resetQuotaStatus(): void {
  isQuotaExceeded = false;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('firestore_quota_exceeded');
  }
  quotaListeners.forEach(cb => cb(false));
}

export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const errorObj = err as { code?: string; message?: string };
  const code = errorObj.code || '';
  const msg = (errorObj.message || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota') ||
    msg.includes('exhausted') ||
    msg.includes('maximum allowed queued writes')
  );
}

function handleWriteError(action: string, error: unknown) {
  if (isQuotaError(error)) {
    markQuotaExceeded();
    return;
  }
  console.warn(`[Firestore] Handled error in ${action}:`, error);
}

// Test Firestore connection on boot as required by safety guidelines
export async function testFirebaseConnection(): Promise<boolean> {
  if (isQuotaExceeded) {
    return false;
  }
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    console.warn('[Firestore] Dispositivo fuera de línea; operando con almacenamiento local.');
    return false;
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timed out; offline mode active')), 3500)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeoutPromise
    ]);
    console.log('Firebase connection verified');
    return true;
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExceeded();
      return false;
    }
    const errObj = error as { code?: string; message?: string };
    const code = errObj?.code || '';
    const msg = (errObj?.message || '').toLowerCase();
    if (
      code === 'unavailable' || 
      msg.includes('unavailable') || 
      msg.includes('offline') || 
      msg.includes('timed out') || 
      msg.includes('could not reach')
    ) {
      console.warn('[Firestore] Backend no alcanzable de momento; la aplicación opera en modo local.');
      return false;
    }
    console.warn('[Firestore] Test connection notice:', error);
    return false;
  }
}

// Subcollections helpers per user
export function getUserCollections(userId: string) {
  return {
    userDoc: doc(db, 'users', userId),
    transactions: collection(db, 'users', userId, 'transactions'),
    payables: collection(db, 'users', userId, 'payables'),
    receivables: collection(db, 'users', userId, 'receivables'),
    closures: collection(db, 'users', userId, 'closures'),
    settings: doc(db, 'users', userId, 'config', 'settings'),
    scenario: doc(db, 'users', userId, 'config', 'scenario'),
  };
}

// Cloud Synchronization Service
export const cloudSync = {
  isQuotaExceeded() {
    return isQuotaExceeded;
  },

  // Save or update user profile
  async saveUserProfile(user: User, businessName?: string) {
    if (isQuotaExceeded) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        email: user.email || '',
        displayName: user.displayName || businessName || 'Mi Negocio',
        photoURL: user.photoURL || '',
        lastLoginAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleWriteError('saveUserProfile', e);
    }
  },

  // Save Settings
  async saveSettings(userId: string, settings: AppSettings) {
    if (isQuotaExceeded) return;
    try {
      const { settings: settingsRef } = getUserCollections(userId);
      await setDoc(settingsRef, {
        ...settings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleWriteError('saveSettings', e);
    }
  },

  // Save Scenario
  async saveScenario(userId: string, scenario: ProjectionScenario) {
    if (isQuotaExceeded) return;
    try {
      const { scenario: scenarioRef } = getUserCollections(userId);
      await setDoc(scenarioRef, {
        ...scenario,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleWriteError('saveScenario', e);
    }
  },

  // Save / Update a single Transaction
  async saveTransaction(userId: string, tx: Transaction) {
    if (isQuotaExceeded) return;
    try {
      const txRef = doc(db, 'users', userId, 'transactions', tx.id);
      await setDoc(txRef, {
        ...tx,
        userId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleWriteError('saveTransaction', e);
    }
  },

  // Delete a single Transaction
  async deleteTransaction(userId: string, txId: string) {
    if (isQuotaExceeded) return;
    try {
      const txRef = doc(db, 'users', userId, 'transactions', txId);
      await deleteDoc(txRef);
    } catch (e) {
      handleWriteError('deleteTransaction', e);
    }
  },

  // Save / Update a single Payable
  async savePayable(userId: string, payable: Payable) {
    if (isQuotaExceeded) return;
    try {
      const payableRef = doc(db, 'users', userId, 'payables', payable.id);
      await setDoc(payableRef, {
        ...payable,
        userId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleWriteError('savePayable', e);
    }
  },

  // Delete a single Payable
  async deletePayable(userId: string, payableId: string) {
    if (isQuotaExceeded) return;
    try {
      const payableRef = doc(db, 'users', userId, 'payables', payableId);
      await deleteDoc(payableRef);
    } catch (e) {
      handleWriteError('deletePayable', e);
    }
  },

  // Save / Update a single Receivable
  async saveReceivable(userId: string, receivable: Receivable) {
    if (isQuotaExceeded) return;
    try {
      const receivableRef = doc(db, 'users', userId, 'receivables', receivable.id);
      await setDoc(receivableRef, {
        ...receivable,
        userId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleWriteError('saveReceivable', e);
    }
  },

  // Delete a single Receivable
  async deleteReceivable(userId: string, receivableId: string) {
    if (isQuotaExceeded) return;
    try {
      const receivableRef = doc(db, 'users', userId, 'receivables', receivableId);
      await deleteDoc(receivableRef);
    } catch (e) {
      handleWriteError('deleteReceivable', e);
    }
  },

  // Save / Update a Daily Closure
  async saveClosure(userId: string, closure: DailyClosure) {
    if (isQuotaExceeded) return;
    try {
      const closureRef = doc(db, 'users', userId, 'closures', closure.id);
      await setDoc(closureRef, {
        ...closure,
        userId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleWriteError('saveClosure', e);
    }
  },

  // Delete a Daily Closure
  async deleteClosure(userId: string, closureId: string) {
    if (isQuotaExceeded) return;
    try {
      const closureRef = doc(db, 'users', userId, 'closures', closureId);
      await deleteDoc(closureRef);
    } catch (e) {
      handleWriteError('deleteClosure', e);
    }
  },

  // Initial migration: Upload full local dataset to cloud for new authenticated user
  async migrateLocalDataToCloud(
    userId: string, 
    data: {
      transactions: Transaction[];
      payables: Payable[];
      receivables: Receivable[];
      closures: DailyClosure[];
      settings: AppSettings;
      scenario: ProjectionScenario;
    }
  ) {
    if (isQuotaExceeded) {
      throw new Error('La cuota diaria gratuita de Firebase Firestore está completa por hoy. Tus datos permanecen 100% seguros y respaldados en tu dispositivo.');
    }
    try {
      const batch = writeBatch(db);

      // Save settings and scenario
      const { settings: settingsRef, scenario: scenarioRef } = getUserCollections(userId);
      batch.set(settingsRef, { ...data.settings, updatedAt: new Date().toISOString() });
      batch.set(scenarioRef, { ...data.scenario, updatedAt: new Date().toISOString() });

      // Save transactions
      data.transactions.forEach(tx => {
        const txRef = doc(db, 'users', userId, 'transactions', tx.id);
        batch.set(txRef, { ...tx, userId, updatedAt: new Date().toISOString() });
      });

      // Save payables
      data.payables.forEach(p => {
        const pRef = doc(db, 'users', userId, 'payables', p.id);
        batch.set(pRef, { ...p, userId, updatedAt: new Date().toISOString() });
      });

      // Save receivables
      data.receivables.forEach(r => {
        const rRef = doc(db, 'users', userId, 'receivables', r.id);
        batch.set(rRef, { ...r, userId, updatedAt: new Date().toISOString() });
      });

      // Save closures
      data.closures.forEach(c => {
        const cRef = doc(db, 'users', userId, 'closures', c.id);
        batch.set(cRef, { ...c, userId, updatedAt: new Date().toISOString() });
      });

      await batch.commit();
      console.log('Successfully migrated local data to cloud for user:', userId);
      return true;
    } catch (e) {
      handleWriteError('migrateLocalDataToCloud', e);
      throw e;
    }
  },

  // Delete all cloud data for a user (Wipe / Reset cloud storage)
  async clearAllCloudData(userId: string) {
    if (isQuotaExceeded) {
      throw new Error('La cuota de Firestore está agotada. Los datos locales ya fueron limpiados.');
    }
    try {
      const collections = getUserCollections(userId);
      const batch = writeBatch(db);

      const [txSnap, paySnap, recSnap, closSnap] = await Promise.all([
        getDocs(collections.transactions),
        getDocs(collections.payables),
        getDocs(collections.receivables),
        getDocs(collections.closures)
      ]);

      txSnap.docs.forEach(d => batch.delete(d.ref));
      paySnap.docs.forEach(d => batch.delete(d.ref));
      recSnap.docs.forEach(d => batch.delete(d.ref));
      closSnap.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();
      console.log('All cloud data deleted for user:', userId);
      return true;
    } catch (e) {
      handleWriteError('clearAllCloudData', e);
      throw e;
    }
  }
};
