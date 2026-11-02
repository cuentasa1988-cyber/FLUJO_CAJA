import React, { useState, useEffect } from 'react';
import { 
  User, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { auth, googleProvider, cloudSync, isQuotaError } from '../../services/firebase';
import { 
  X, 
  Cloud, 
  CloudCheck, 
  ShieldCheck, 
  Lock, 
  LogOut, 
  UploadCloud, 
  Mail, 
  Key, 
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { AppSettings, Transaction, Payable, Receivable, DailyClosure, ProjectionScenario } from '../../types';

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  localData: {
    transactions: Transaction[];
    payables: Payable[];
    receivables: Receivable[];
    closures: DailyClosure[];
    settings: AppSettings;
    scenario: ProjectionScenario;
  };
  onMigrationComplete?: () => void;
}

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  localData,
  onMigrationComplete,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasSynced, setHasSynced] = useState(false);

  // Trigger automatic migration/upload on modal open if user is logged in
  useEffect(() => {
    if (isOpen && currentUser && !isMigrating) {
      const runAutoMigration = async () => {
        setIsMigrating(true);
        setErrorMsg(null);
        try {
          await cloudSync.migrateLocalDataToCloud(currentUser.uid, localData);
          localStorage.removeItem('cloud_sync_disabled_v1');
          setHasSynced(true);
          if (onMigrationComplete) {
            onMigrationComplete();
          }
        } catch (err: unknown) {
          console.warn('[AutoMigration] Background migration skipped or blocked:', err);
        } finally {
          setIsMigrating(false);
        }
      };
      runAutoMigration();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        localStorage.removeItem('cloud_sync_disabled_v1');
        await cloudSync.saveUserProfile(result.user, localData.settings.businessName);
        setSuccessMsg(`¡Bienvenido, ${result.user.displayName || result.user.email}!`);
      }
    } catch (err: unknown) {
      console.error('Google sign in error:', err);
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Ventana de acceso cancelada.');
      } else {
        setErrorMsg(e.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor ingresa tu correo y contraseña.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (authMode === 'login') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        localStorage.removeItem('cloud_sync_disabled_v1');
        setSuccessMsg(`¡Sesión iniciada con éxito!`);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        localStorage.removeItem('cloud_sync_disabled_v1');
        await cloudSync.saveUserProfile(result.user, localData.settings.businessName);
        setSuccessMsg(`¡Cuenta creada con éxito! Tus datos ahora se respaldan en la nube.`);
      }
    } catch (err: unknown) {
      console.error('Email auth error:', err);
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setErrorMsg('Contraseña o correo incorrecto.');
      } else if (e.code === 'auth/email-already-in-use') {
        setErrorMsg('Este correo ya tiene una cuenta registrada. Cambia a "Iniciar Sesión".');
      } else if (e.code === 'auth/weak-password') {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      } else if (e.code === 'auth/invalid-email') {
        setErrorMsg('Formato de correo inválido.');
      } else {
        setErrorMsg(e.message || 'Error al procesar la autenticación.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setSuccessMsg('Has cerrado sesión.');
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadLocalToCloud = async () => {
    if (!currentUser) return;
    setIsMigrating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await cloudSync.migrateLocalDataToCloud(currentUser.uid, localData);
      localStorage.removeItem('cloud_sync_disabled_v1');
      setHasSynced(true);
      setSuccessMsg('¡Datos locales subidos y respaldados en la nube con éxito!');
      if (onMigrationComplete) {
        onMigrationComplete();
      }
    } catch (err: unknown) {
      console.warn('Error migrating to cloud:', err);
      if (isQuotaError(err) || cloudSync.isQuotaExceeded()) {
        setErrorMsg('La cuota diaria gratuita de Firestore de Google se ha completado por hoy. Tus datos permanecen 100% seguros y respaldados en este dispositivo.');
      } else {
        setErrorMsg('Ocurrió un error al subir los datos a Firestore. Intenta de nuevo.');
      }
    } finally {
      setIsMigrating(false);
    }
  };

  const handleClearCloudData = async () => {
    if (!currentUser) return;
    setIsDeletingCloud(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await cloudSync.clearAllCloudData(currentUser.uid);
      setSuccessMsg('¡Todos los datos de tu cuenta en la nube han sido eliminados correctamente!');
      setShowConfirmDelete(false);
    } catch (err) {
      console.warn('Error clearing cloud data:', err);
      if (isQuotaError(err) || cloudSync.isQuotaExceeded()) {
        setErrorMsg('No se pudo contactar a Firestore por límite de cuota diaria. Los datos locales ya están protegidos.');
      } else {
        setErrorMsg('No se pudieron borrar los datos de la nube. Intenta nuevamente.');
      }
    } finally {
      setIsDeletingCloud(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-[#CBD5E1] overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="bg-[#0F172A] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#6CF8BB]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Control Center Nube</h3>
              <p className="text-xs text-[#94A3B8]">Persistencia y Aislamiento por Correo (Opción 1)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Security Assurance Guarantee */}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] p-3.5 rounded-lg flex items-start gap-3 text-xs text-[#166534]">
            <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Privacidad 100% Garantizada:</span>
              <p className="mt-0.5 text-[#15803D] leading-relaxed">
                Cada correo tiene su propio espacio aislado en Firestore. Ningún otro usuario o correo podrá ver tus facturas, cuotas ni movimientos financieros.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {currentUser ? (
            /* Logged in state */
            <div className="space-y-4">
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || 'Avatar'} 
                    className="w-12 h-12 rounded-full border border-[#CBD5E1]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#006C49] text-white font-bold flex items-center justify-center text-lg">
                    {currentUser.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#0F172A] truncate">
                      {currentUser.displayName || 'Usuario'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      En línea
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] truncate">{currentUser.email}</p>
                  <p className="text-[11px] text-[#94A3B8] font-mono mt-0.5 truncate">
                    UID: {currentUser.uid.slice(0, 14)}...
                  </p>
                </div>
              </div>

              {/* Local to Cloud Sync Action */}
              {hasSynced ? (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <CloudCheck className="w-4 h-4 text-emerald-700" />
                    <span>Sincronización Automática Activa</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Tus {localData.transactions.length} movimientos, {localData.payables.length} cuentas por pagar, {localData.receivables.length} cuentas por cobrar y {localData.closures.length} arqueos están 100% actualizados y guardados automáticamente en la nube.
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium">
                    ✓ Respaldo activo en tiempo real
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <UploadCloud className="w-4 h-4 text-amber-700" />
                    <span>Sincronizar tus datos actuales a la nube</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Sube tus {localData.transactions.length} movimientos, {localData.payables.length} cuentas por pagar, {localData.receivables.length} cuentas por cobrar y {localData.closures.length} arqueos a tu espacio personal en Firestore.
                  </p>
                  <button
                    onClick={handleUploadLocalToCloud}
                    disabled={isMigrating}
                    className="w-full mt-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isMigrating ? (
                      <span>Sincronizando de forma automática...</span>
                    ) : (
                      <>
                        <CloudCheck className="w-4 h-4" />
                        <span>Sincronizar ahora manualmente</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Cloud Data Purge / Delete Section */}
              <div className="p-3 bg-red-50/60 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>¿Deseas vaciar tus datos en la nube?</span>
                  </div>
                </div>
                <p className="text-[11px] text-red-700 leading-snug">
                  Si ya no deseas tener tus registros guardados en Firestore, puedes purgarlos completamente de los servidores de Google en cualquier momento.
                </p>
                {!showConfirmDelete ? (
                  <button
                    onClick={() => setShowConfirmDelete(true)}
                    className="w-full text-xs font-semibold py-1.5 px-3 rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Borrar todos mis datos de la nube
                  </button>
                ) : (
                  <div className="p-2.5 bg-white border border-red-300 rounded-lg space-y-2 animate-in fade-in">
                    <p className="text-[11px] font-bold text-red-800">
                      ¿Confirmas eliminar permanentemente todos tus registros en Firestore?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleClearCloudData}
                        disabled={isDeletingCloud}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-2 rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingCloud ? 'Borrando...' : 'Sí, eliminar de la nube'}
                      </button>
                      <button
                        onClick={() => setShowConfirmDelete(false)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sign out */}
              <div className="pt-2 flex justify-between items-center">
                <button
                  onClick={onClose}
                  className="text-xs text-[#64748B] hover:text-[#0F172A] font-medium py-2 px-3 rounded-lg"
                >
                  Cerrar ventana
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          ) : (
            /* Logged out state */
            <div className="space-y-4">
              {/* Google 1-Click Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-[#1E293B] border border-[#CBD5E1] py-2.5 px-4 rounded-lg font-bold text-sm shadow-xs transition-all cursor-pointer hover:border-[#94A3B8]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continuar con Google</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-[#E2E8F0] w-full"></div>
                <span className="bg-white px-3 text-[11px] text-[#94A3B8] uppercase font-bold tracking-wider relative">
                  o con correo
                </span>
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tunegocio@correo.cl"
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Contraseña</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {isLoading 
                      ? 'Procesando...' 
                      : authMode === 'login' 
                        ? 'Iniciar Sesión en la Nube' 
                        : 'Crear Cuenta y Conectar Nube'}
                  </span>
                </button>
              </form>

              {/* Switch Mode */}
              <div className="text-center pt-1">
                {authMode === 'login' ? (
                  <p className="text-xs text-[#64748B]">
                    ¿No tienes cuenta aún?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className="font-bold text-[#006C49] hover:underline cursor-pointer"
                    >
                      Regístrate gratis
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-[#64748B]">
                    ¿Ya tienes una cuenta?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="font-bold text-[#006C49] hover:underline cursor-pointer"
                    >
                      Inicia sesión
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
