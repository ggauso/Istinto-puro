import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { checkEmailLocked, recordLoginAttempt, recordAuthAudit } from '../lib/rpc-client';
import { LogIn, UserPlus, ArrowLeft, Mail, Lock, User, Calendar, Shield, Trophy, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthScreenProps {
  onBack: () => void;
  isPasswordRecovery?: boolean;
  onPasswordRecoveryDone?: () => void;
}

export function AuthScreen({ onBack, isPasswordRecovery, onPasswordRecoveryDone }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password' | 'update_password'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Visibilità campi password
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Se arriva da un link di recupero password, imposta subito la modalità aggiornamento
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('update_password');
    }
  }, [isPasswordRecovery]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'register') {
        if (!privacyAccepted) {
          throw new Error('Devi accettare la privacy policy per registrarti.');
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              birth_date: birthDate,
              favorite_team: favoriteTeam,
              privacy_accepted: privacyAccepted
            }
          }
        });

        if (signUpError) throw signUpError;
        
        // If email confirmation is required, inform the user
        if (data.user && data.session === null) {
          setSuccessMsg('Controlla la tua email per confermare la registrazione!');
          setMode('login');
        } else {
          onBack(); // Go back to home after successful login
        }
      } else if (mode === 'forgot_password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        
        if (resetError) throw resetError;
        setSuccessMsg('Ti abbiamo inviato un link per il recupero della password. Controlla la tua email.');
      } else if (mode === 'update_password') {
        // Aggiornamento della password dopo aver cliccato il link di recupero.
        if (newPassword !== confirmPassword) {
          throw new Error('Le password non corrispondono.');
        }
        if (newPassword.length < 6) {
          throw new Error('La password deve essere di almeno 6 caratteri.');
        }

        const timeoutPromise = new Promise<{ data: any, error: any }>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: il server non ha risposto.')), 10000)
        );

        const { error: updateError } = await Promise.race([
          supabase.auth.updateUser({ password: newPassword }),
          timeoutPromise
        ]);

        if (updateError) {
          const msg = updateError.message.toLowerCase();
          if (msg.includes('different') || msg.includes('identical') || msg.includes('same as the old')) {
            throw new Error('La nuova password deve essere diversa da quella attuale.');
          }
          throw updateError;
        }

        // Successo: ferma immediatamente lo spinner e mostra la conferma verde
        setLoading(false);
        setUpdateSuccess(true);
        setSuccessMsg('Password aggiornata con successo! Reindirizzamento...');
        setTimeout(() => {
          onPasswordRecoveryDone?.();
        }, 2000);
        return; // evitiamo il finally che rimette a posto lo stato
      } else {
        // Rate limiting: verifica se l'email è bloccata
        const rateCheck = await checkEmailLocked(email);
        if (rateCheck.locked) {
          const minutes = Math.ceil(rateCheck.remainingSeconds / 60);
          throw new Error(`Troppi tentativi falliti. Riprova tra ${minutes} minuto/i.`);
        }

        // Tentativo di login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        // Registra il tentativo (fallito o riuscito)
        const clientIp = 'client-ip'; // In production, usare l'IP reale del client
        await recordLoginAttempt(email, clientIp, !signInError);

        // Registra audit event
        if (signInError) {
          // Login fallito
          await recordAuthAudit(null, 'login_failed', email, false).catch(() => {});
        } else {
          // Login riuscito - userId sarà disponibile nel session
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await recordAuthAudit(user.id, 'login', email, true).catch(() => {});
          }
        }

        if (signInError) throw signInError;
        onBack();
      }
    } catch (err: any) {
      // Registra tentativo fallito anche in caso di errore (se non già fatto)
      if (mode === 'login' && err.message?.includes('troppi tentativi')) {
        // Già gestito sopra
      } else if (mode === 'login') {
        const clientIp = 'client-ip';
        await recordLoginAttempt(email, clientIp, false).catch(() => {});
        // Registra login failed anche per altri errori
        await recordAuthAudit(null, 'login_failed', email, false).catch(() => {});
      }
      setError(err.message || 'Si è verificato un errore durante l\'autenticazione.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Errore con il login Google.');
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#1E1E1E] rounded-2xl p-8 shadow-2xl border border-white/5"
      >
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Torna indietro</span>
        </button>

        <h2 className="text-3xl font-bold mb-2 text-center">
          {mode === 'login' ? 'Bentornato' : mode === 'register' ? 'Crea Account' : mode === 'forgot_password' ? 'Recupero Password' : 'Nuova Password'}
        </h2>
        <p className="text-gray-400 text-center mb-8">
          {mode === 'login' ? 'Accedi per salvare i tuoi progressi' 
            : mode === 'register' ? 'Unisciti alla community di Istinto Puro' 
            : mode === 'forgot_password' ? 'Inserisci la tua email per ricevere un link di recupero'
            : 'Scegli una nuova password per il tuo account'}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-lg mb-6 text-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="text" 
                      required 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#FFD700] transition-colors"
                      placeholder="Mario"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Cognome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="text" 
                      required 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#FFD700] transition-colors"
                      placeholder="Rossi"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Data di Nascita</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="date" 
                    required 
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#FFD700] transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Squadra Preferita</label>
                <div className="relative">
                  <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="text" 
                    value={favoriteTeam}
                    onChange={(e) => setFavoriteTeam(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#FFD700] transition-colors"
                    placeholder="Es. Juventus, Milan..."
                  />
                </div>
              </div>
            </>
          )}

          {mode !== 'update_password' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#FFD700] transition-colors"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
          )}

          {/* Sezione Nuova Password (Recovery callback) */}
          {mode === 'update_password' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nuova Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-12 focus:outline-none focus:border-[#FFD700] transition-colors"
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Conferma Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-12 focus:outline-none focus:border-[#FFD700] transition-colors"
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-400">Password</label>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => {
                        setMode('forgot_password');
                        setError(null);
                        setSuccessMsg(null);
                    }}
                    className="text-xs text-[#FFD700] hover:underline"
                  >
                    Password dimenticata?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required={mode !== 'forgot_password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-12 focus:outline-none focus:border-[#FFD700] transition-colors"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="flex items-start gap-3 mt-4">
              <div className="flex items-center h-5">
                <input 
                  id="privacy" 
                  type="checkbox" 
                  required
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-black/50 text-[#FFD700] focus:ring-[#FFD700] focus:ring-offset-gray-900"
                />
              </div>
              <label htmlFor="privacy" className="text-sm text-gray-400">
                Accetto i termini di servizio e la privacy policy per il trattamento dei dati personali.
              </label>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || updateSuccess}
            className={`w-full font-bold py-3 px-4 rounded-xl transition-all mt-6 flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
              updateSuccess
                ? 'bg-green-500 text-white'
                : 'bg-[#FFD700] text-black hover:bg-yellow-400 disabled:opacity-50'
            }`}
          >
            {loading
              ? 'Caricamento...'
              : updateSuccess
              ? '✓ Password Aggiornata!'
              : (mode === 'login' ? 'Accedi' : mode === 'register' ? 'Registrati' : mode === 'forgot_password' ? 'Invia Link di Recupero' : 'Salva Nuova Password')
            }
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="text-sm text-gray-500">OPPURE</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          type="button"
          className="w-full mt-6 bg-white text-black font-bold py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continua con Google
        </button>

        <p className="text-center mt-8 text-gray-400 text-sm">
          {mode === 'login' ? 'Non hai un account? ' : mode === 'register' ? 'Hai già un account? ' : 'Ricordi la password? '}
          <button 
            onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
                setSuccessMsg(null);
            }}
            className="text-[#FFD700] hover:underline font-medium"
          >
            {mode === 'login' ? 'Registrati' : 'Accedi'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
