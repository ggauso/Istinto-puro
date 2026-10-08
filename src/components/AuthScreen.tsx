import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { checkEmailLocked, recordLoginAttempt } from '../lib/api/auth-security';
import { recordAuthAudit } from '../lib/api/audit';
import { ArrowLeft, Mail, Lock, User, Calendar, Trophy, Eye, EyeOff, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Field } from './ui/Field';
import { Checkbox } from './ui/Checkbox';
import { appUrl } from '../lib/paths';
import { Button } from './ui/Button';

interface AuthScreenProps {
  onBack: () => void;
  isPasswordRecovery?: boolean;
  onPasswordRecoveryDone?: () => void;
}

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Nascondi password' : 'Mostra password'}
      className="flex h-8 w-8 items-center justify-center text-chalk-2 hover:text-chalk"
    >
      {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
    </button>
  );
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
          redirectTo: appUrl("/")
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
          redirectTo: appUrl("/")
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Errore con il login Google.');
    }
  };

  const title =
    mode === 'login' ? 'Bentornato'
    : mode === 'register' ? 'Crea account'
    : mode === 'forgot_password' ? 'Recupero password'
    : 'Nuova password';

  const subtitle =
    mode === 'login' ? 'Accedi per salvare i tuoi progressi'
    : mode === 'register' ? 'Unisciti alla community di Istinto Puro'
    : mode === 'forgot_password' ? 'Inserisci la tua email per ricevere un link di recupero'
    : 'Scegli una nuova password per il tuo account';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink p-4 text-chalk">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-np-xl border border-white/[.07] bg-turf-1 p-8"
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Indietro"
          className="press mb-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-turf-2"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>

        <h2 className="disp mb-2 text-center text-[28px]">{title}</h2>
        <p className="mb-8 text-center text-sm text-chalk-2">{subtitle}</p>

        {error && (
          <div className="mb-6 rounded-np-md border border-ember/35 bg-ember/10 px-4 py-3 text-sm text-ember-light">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 flex items-center gap-2 rounded-np-md border border-volt/35 bg-volt/10 px-4 py-3 text-sm text-volt">
            {updateSuccess && <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} />}
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  icon={<User className="h-[18px] w-[18px]" />}
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nome"
                />
                <Field
                  icon={<User className="h-[18px] w-[18px]" />}
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Cognome"
                />
              </div>

              <Field
                icon={<Calendar className="h-[18px] w-[18px]" />}
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="[&::-webkit-calendar-picker-indicator]:invert"
              />

              <Field
                icon={<Trophy className="h-[18px] w-[18px]" />}
                value={favoriteTeam}
                onChange={(e) => setFavoriteTeam(e.target.value)}
                placeholder="Squadra del cuore · es. Juventus, Milan…"
              />
            </>
          )}

          {mode !== 'update_password' && (
            <Field
              icon={<Mail className="h-[18px] w-[18px]" />}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          )}

          {mode === 'update_password' && (
            <>
              <Field
                icon={<Lock className="h-[18px] w-[18px]" />}
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nuova password"
                suffix={<PasswordToggle show={showNewPassword} onToggle={() => setShowNewPassword((v) => !v)} />}
              />
              <Field
                icon={<Lock className="h-[18px] w-[18px]" />}
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Conferma password"
                suffix={<PasswordToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />}
              />
            </>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div className="flex flex-col gap-1.5">
              <Field
                icon={<Lock className="h-[18px] w-[18px]" />}
                type={showPassword ? 'text' : 'password'}
                required={mode !== 'forgot_password'}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                suffix={<PasswordToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
              />
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot_password');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="self-end text-xs font-semibold text-volt hover:underline"
                >
                  Password dimenticata?
                </button>
              )}
            </div>
          )}

          {mode === 'register' && (
            <Checkbox
              id="privacy"
              required
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="pt-1"
              label="Accetto i termini di servizio e la privacy policy per il trattamento dei dati personali."
            />
          )}

          <Button type="submit" variant="volt" loading={loading} disabled={updateSuccess} className="mt-2 w-full">
            {updateSuccess ? (
              <>
                <Check className="h-5 w-5" strokeWidth={2.4} />
                Password aggiornata!
              </>
            ) : mode === 'login' ? 'Accedi'
              : mode === 'register' ? 'Registrati'
              : mode === 'forgot_password' ? 'Invia link di recupero'
              : 'Salva nuova password'}
          </Button>
        </form>

        {mode !== 'update_password' && (
          <>
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="cond text-xs text-label">Oppure</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <Button type="button" variant="chalk" onClick={handleGoogleLogin} className="w-full">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continua con Google
            </Button>
          </>
        )}

        {(mode === 'login' || mode === 'register') && (
          <p className="mt-8 text-center text-sm text-chalk-2">
            {mode === 'login' ? 'Non hai un account? ' : 'Hai già un account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
                setSuccessMsg(null);
              }}
              className="font-semibold text-volt hover:underline"
            >
              {mode === 'login' ? 'Registrati' : 'Accedi'}
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}
