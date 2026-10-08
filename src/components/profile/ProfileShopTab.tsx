import { useEffect, useState } from 'react';
import { useAuthStore } from '../../authStore';
import { getShopCatalog, purchaseShopItem, setActiveTheme, type ShopItem } from '../../lib/api/shop';
import { Coins, Check, ChevronLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { BallBounceLoader } from '../ui/loaders/BallBounceLoader';
import { cn } from '../../lib/cn';

const CATEGORY_LABELS: Record<ShopItem['category'], string> = {
  badge: 'Badge accanto al nickname',
  theme: 'Temi colore del profilo',
};

export interface ProfileShopTabProps {
  onBack: () => void;
}

/**
 * Shop — schermata a sé stante (replica di `shop.html`), raggiunta
 * toccando la pill monete nell'header del Profilo, non una tab. Aggiunta
 * rispetto al codice precedente: anteprima con selezione (tocchi una
 * card per vederla in anteprima, l'azione — acquista/attiva — si fa dalla
 * card "Anteprima" in alto, non più un bottone per ogni singola card).
 */
export function ProfileShopTab({ onBack }: ProfileShopTabProps) {
  const { user, profile, fetchProfile } = useAuthStore();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const load = () => {
    if (!user) return;
    setLoading(true);
    getShopCatalog(user.id)
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || !profile) return null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <BallBounceLoader />
      </div>
    );
  }

  const coins = profile.coins || 0;
  const previewItem = items.find((i) => i.code === previewCode) ?? null;
  const canAfford = previewItem ? coins >= previewItem.cost : true;
  const isOwned = previewItem?.owned ?? false;
  const isActiveTheme = previewItem?.category === 'theme' && profile.theme_color === previewItem.colorHex;

  async function handleAction() {
    if (!previewItem || !user) return;
    setPending(true);
    if (previewItem.category === 'theme' && previewItem.owned) {
      const ok = await setActiveTheme(user.id, previewItem.code);
      if (ok) await fetchProfile(user.id);
    } else if (!previewItem.owned) {
      const result = await purchaseShopItem(user.id, previewItem.code);
      if (result.success) {
        await fetchProfile(user.id);
        load();
      }
    }
    setPending(false);
  }

  const byCategory = (['badge', 'theme'] as const)
    .map((category) => ({ category, items: items.filter((i) => i.category === category) }))
    .filter((group) => group.items.length > 0);

  const previewRing = previewItem?.category === 'theme' && previewItem.colorHex
    ? previewItem.colorHex
    : 'conic-gradient(from 180deg, var(--color-volt) 0 50%, var(--color-turf-3) 50%)';
  const previewNameColor = previewItem?.category === 'theme' ? previewItem.colorHex ?? undefined : undefined;

  return (
    <div className="relative flex min-h-screen flex-col gap-4 bg-ink px-4 pb-10 pt-12 text-chalk">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Indietro" onClick={onBack} className="btn flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-turf-1">
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
          <h1 className="disp text-[30px]">Shop</h1>
        </div>
        <span className="mono flex h-11 items-center gap-2 rounded-np-pill bg-[rgba(242,193,78,.12)] py-0 pl-2 pr-3.5 text-lg font-bold text-[#FFD36E]">
          <span className="coin flex h-7 w-7 items-center justify-center rounded-full text-ink" style={{ background: 'linear-gradient(135deg,#FFE08A,#C4901C)' }}>
            <Coins className="h-3.5 w-3.5" />
          </span>
          {coins}
        </span>
      </header>

      <section className="flex flex-col gap-3.5 rounded-np-hero border border-white/7 bg-turf-1 p-[18px]">
        <span className="cond text-xs text-label">Anteprima</span>
        <div className="flex items-center gap-3.5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px_20px_20px_6px] p-[3px]" style={{ background: previewRing }}>
            <span className="disp flex h-full w-full items-center justify-center rounded-[17px_17px_17px_4px] border-[3px] border-turf-1 bg-turf-2 text-base">
              {(profile.nickname || profile.first_name || 'TU').slice(0, 2).toUpperCase()}
            </span>
          </span>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="disp text-[22px]" style={{ fontStretch: '105%', color: previewNameColor }}>
                {profile.nickname || profile.first_name || 'Tu'}
              </span>
              {previewItem?.category === 'badge' && <span className="pop text-lg leading-none">{previewItem.icon}</span>}
            </div>
            <span className="text-[13px] text-chalk-2">
              {previewItem ? `${previewItem.category === 'badge' ? 'Badge' : 'Tema'} ${previewItem.label}` : 'Nessuna selezione'}
            </span>
          </div>
        </div>
        {previewItem && (
          <Button
            variant={isOwned && !isActiveTheme ? 'volt' : isActiveTheme ? 'chalk' : canAfford ? 'volt' : 'ghost'}
            disabled={pending || isActiveTheme || (!isOwned && !canAfford)}
            loading={pending}
            onClick={handleAction}
          >
            {isActiveTheme ? (
              <>
                <Check className="h-4 w-4" /> Attivo
              </>
            ) : isOwned ? (
              previewItem.category === 'theme' ? (
                'Attiva'
              ) : (
                'Posseduto'
              )
            ) : canAfford ? (
              <>
                <Coins className="h-4 w-4" /> Acquista per {previewItem.cost}
              </>
            ) : (
              <>
                Ti mancano <span className="mono text-[#FFD36E]">{previewItem.cost - coins}</span> monete
              </>
            )}
          </Button>
        )}
      </section>

      {byCategory.map((group) => (
        <section key={group.category} className="flex flex-col gap-2.5">
          <span className="cond text-xs text-label">{CATEGORY_LABELS[group.category]}</span>
          <div className="grid grid-cols-3 gap-2">
            {group.items.map((item) => {
              const selected = previewCode === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setPreviewCode(item.code)}
                  className={cn(
                    'item flex h-[118px] flex-col items-center justify-center gap-2 rounded-np-lg border-[1.5px]',
                    selected ? 'border-volt bg-volt/[.06]' : 'border-white/7 bg-turf-1'
                  )}
                >
                  {item.category === 'badge' ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-np-md bg-turf-2 text-xl">{item.icon}</span>
                  ) : (
                    <span
                      className="h-11 w-11 rounded-full"
                      style={{ background: item.colorHex ?? 'var(--color-turf-3)', boxShadow: 'inset 0 0 0 8px var(--color-turf-2)' }}
                    />
                  )}
                  <span className="text-[13px] font-semibold">{item.label}</span>
                  {item.owned ? (
                    <span className="mono flex items-center gap-1 text-xs font-semibold text-volt">
                      <Check className="h-3 w-3" /> Posseduto
                    </span>
                  ) : (
                    <span className="mono text-xs font-semibold text-[#FFD36E]">{item.cost}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
