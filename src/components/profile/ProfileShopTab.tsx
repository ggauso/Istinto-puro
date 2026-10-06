import { useEffect, useState } from 'react';
import { useAuthStore } from '../../authStore';
import { getShopCatalog, purchaseShopItem, setActiveTheme, type ShopItem } from '../../lib/api/shop';
import { Coins, Loader2, Check, Palette } from 'lucide-react';
import { motion } from 'motion/react';

const CATEGORY_LABELS: Record<ShopItem['category'], string> = {
  badge: 'Badge Cosmetici',
  theme: 'Temi Colore Profilo',
};

export function ProfileShopTab() {
  const { user, profile, fetchProfile } = useAuthStore();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ code: string; message: string; isError: boolean } | null>(null);

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
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const coins = profile.coins || 0;

  async function handlePurchase(item: ShopItem) {
    setPendingCode(item.code);
    setFeedback(null);
    const result = await purchaseShopItem(user!.id, item.code);
    if (result.success) {
      setFeedback({ code: item.code, message: 'Acquistato!', isError: false });
      await fetchProfile(user!.id);
      load();
    } else {
      setFeedback({ code: item.code, message: result.message || result.error || 'Errore', isError: true });
    }
    setPendingCode(null);
  }

  async function handleActivateTheme(item: ShopItem) {
    setPendingCode(item.code);
    const ok = await setActiveTheme(user!.id, item.code);
    if (ok) {
      setFeedback({ code: item.code, message: 'Tema attivato!', isError: false });
      await fetchProfile(user!.id);
    } else {
      setFeedback({ code: item.code, message: 'Errore attivazione tema', isError: true });
    }
    setPendingCode(null);
  }

  const byCategory = (['badge', 'theme'] as const).map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-4 py-3">
        <span className="text-zinc-300 text-sm font-medium flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          Il tuo saldo
        </span>
        <span className="text-white font-bold text-lg">{coins}</span>
      </div>

      {byCategory.map((group) => (
        <div key={group.category} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {CATEGORY_LABELS[group.category]}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {group.items.map((item, index) => {
              const isActiveTheme = item.category === 'theme' && profile.theme_color === item.colorHex;
              const canAfford = coins >= item.cost;
              const isPending = pendingCode === item.code;
              const itemFeedback = feedback?.code === item.code ? feedback : null;

              return (
                <motion.div
                  key={item.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`relative rounded-xl p-4 border flex flex-col items-center text-center gap-2 ${
                    item.owned
                      ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-green-500/30'
                      : 'bg-zinc-800/40 border-zinc-700/50'
                  }`}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                    style={item.category === 'theme' && item.colorHex ? { backgroundColor: `${item.colorHex}33`, border: `1px solid ${item.colorHex}` } : undefined}
                  >
                    {item.category === 'badge' ? item.icon : <Palette className="w-6 h-6" style={{ color: item.colorHex || undefined }} />}
                  </div>
                  <div className="font-semibold text-sm text-white">{item.label}</div>
                  <div className="text-xs text-zinc-500">{item.description}</div>

                  {!item.owned && (
                    <div className="flex items-center gap-1 text-yellow-400 text-sm font-bold">
                      <Coins className="w-4 h-4" /> {item.cost}
                    </div>
                  )}

                  {item.owned ? (
                    item.category === 'theme' ? (
                      <button
                        onClick={() => handleActivateTheme(item)}
                        disabled={isPending || isActiveTheme}
                        className={`mt-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                          isActiveTheme
                            ? 'bg-green-600/30 text-green-300 cursor-default'
                            : 'bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50'
                        }`}
                      >
                        {isActiveTheme ? <><Check className="w-3 h-3" /> Attivo</> : isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Attiva'}
                      </button>
                    ) : (
                      <span className="mt-1 text-xs font-bold text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Posseduto
                      </span>
                    )
                  ) : (
                    <button
                      onClick={() => handlePurchase(item)}
                      disabled={isPending || !canAfford}
                      className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500 hover:bg-yellow-400 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : canAfford ? 'Acquista' : 'Saldo insufficiente'}
                    </button>
                  )}

                  {itemFeedback && (
                    <div className={`text-[10px] mt-1 ${itemFeedback.isError ? 'text-red-400' : 'text-green-400'}`}>
                      {itemFeedback.message}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
