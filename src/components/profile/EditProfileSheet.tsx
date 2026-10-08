import { useRef, useState, type FormEvent } from 'react';
import { useAuthStore } from '../../authStore';
import { BottomSheet } from '../ui/BottomSheet';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { Camera, ChevronRight, KeyRound, LogOut, Eye, EyeOff, X } from 'lucide-react';

export interface EditProfileSheetProps {
  open: boolean;
  onClose: () => void;
  /** Richiamata dopo il sign-out riuscito (torna alla Home). */
  onSignedOut: () => void;
}

/**
 * Sheet "Modifica profilo" (replica di `modifica-profilo.html`): sostituisce
 * il form inline che prima viveva in `ProfileInfoTab.tsx` (ora rimosso, il
 * suo contenuto è diviso tra l'header fuso di `ProfileScreen` e questo
 * sheet). Stessa logica di salvataggio/cambio password, solo presentazione
 * nuova.
 */
export function EditProfileSheet({ open, onClose, onSignedOut }: EditProfileSheetProps) {
  const { profile, updateProfile, changePassword, signOut } = useAuthStore();

  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    nickname: profile?.nickname || '',
    favorite_team: profile?.favorite_team || '',
    avatar_url: profile?.avatar_url || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const passwordRequestInFlight = useRef(false);

  if (!profile) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await updateProfile(form);
      onClose();
    } catch (error: any) {
      setSaveError(error.message || 'Errore durante il salvataggio del profilo');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (passwordRequestInFlight.current || isSavingPassword || passwordSuccess) return;
    if (newPassword.length < 6) {
      setPasswordError('La nuova password deve avere almeno 6 caratteri');
      return;
    }

    passwordRequestInFlight.current = true;
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      await changePassword(newPassword);
      setPasswordSuccess(true);
      setNewPassword('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess(false);
      }, 3000);
    } catch (error: any) {
      setPasswordError(error.message || 'Errore durante il cambio password');
    } finally {
      setIsSavingPassword(false);
      passwordRequestInFlight.current = false;
    }
  };

  const initials = (form.nickname || form.first_name || 'TU').slice(0, 2).toUpperCase();

  return (
    <BottomSheet open={open} onClose={onClose} className="max-h-[90vh] overflow-y-auto">
      <div className="flex flex-col gap-[18px] px-5 pb-7 pt-1.5">
        <header className="flex items-center justify-between">
          <h1 className="disp text-2xl">Modifica profilo</h1>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-turf-2 text-chalk"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </header>

        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex h-18 w-18 items-center justify-center rounded-[22px_22px_22px_6px] border-[1.5px] border-dashed border-chalk/25 bg-turf-2 text-xl font-extrabold">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Avatar" className="h-full w-full rounded-[22px_22px_22px_6px] object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              type="button"
              aria-label="Cambia avatar"
              onClick={() => avatarInputRef.current?.focus()}
              className="btn absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-turf-1 bg-volt text-ink"
            >
              <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          </div>
          <Field
            ref={avatarInputRef}
            containerClassName="h-11 rounded-np-md"
            value={form.avatar_url}
            onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
            placeholder="https://…"
            className="text-sm"
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-chalk-2">Nickname</span>
          <Field
            prefixSlot="@"
            containerClassName="h-13 rounded-np-md border-volt shadow-[0_0_0_4px_rgba(215,255,58,.15)]"
            value={form.nickname}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-chalk-2">Nome</span>
            <Field containerClassName="h-13 rounded-np-md" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-chalk-2">Cognome</span>
            <Field containerClassName="h-13 rounded-np-md" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-chalk-2">Squadra del cuore</span>
          <Field
            containerClassName="h-13 rounded-np-md"
            value={form.favorite_team}
            onChange={(e) => setForm({ ...form, favorite_team: e.target.value })}
            placeholder="Es. Milan"
          />
        </label>

        <div className="flex flex-col overflow-hidden rounded-np-lg bg-turf-2">
          <button
            type="button"
            onClick={() => setIsChangingPassword((v) => !v)}
            className="flex h-13 items-center gap-3 px-4 text-[15px] font-semibold"
          >
            <KeyRound className="h-[18px] w-[18px] text-[#FFD36E]" strokeWidth={2} />
            <span className="flex-1 text-left">Cambia password</span>
            <ChevronRight className="h-4 w-4 text-label" strokeWidth={2} />
          </button>

          {isChangingPassword && (
            <form onSubmit={handlePasswordChange} className="flex flex-col gap-3 border-t border-white/[.06] p-4">
              <Field
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nuova password"
                minLength={6}
                suffix={
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="mr-1 text-label">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              {passwordError && <span className="text-xs text-ember-light">{passwordError}</span>}
              {passwordSuccess && <span className="text-xs text-volt">Password aggiornata con successo!</span>}
              <Button variant="volt" size="sm" type="submit" loading={isSavingPassword} disabled={passwordSuccess}>
                Aggiorna password
              </Button>
            </form>
          )}

          <div className="h-px bg-white/[.06]" />
          <button
            type="button"
            onClick={async () => {
              await signOut();
              onSignedOut();
            }}
            className="flex h-13 items-center gap-3 px-4 text-[15px] font-semibold text-ember-light"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
            Esci
          </button>
        </div>

        {saveError && <span className="text-center text-sm text-ember-light">{saveError}</span>}

        <Button variant="volt" className="h-14 text-base" loading={isSaving} onClick={handleSave}>
          Salva modifiche
        </Button>
      </div>
    </BottomSheet>
  );
}
