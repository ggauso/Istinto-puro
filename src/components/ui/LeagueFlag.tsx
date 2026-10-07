import { cn } from '../../lib/cn';

/** Chiavi campionato: stessi id usati da `HomeScreen.LEAGUES` (API-Football), `null` → 'all'. */
export type LeagueKey = 'all' | 135 | 39 | 140 | 78 | 61;

export const LEAGUE_NAMES: Record<LeagueKey, string> = {
  all: 'Tutti i campionati',
  135: 'Serie A',
  39: 'Premier League',
  140: 'La Liga',
  78: 'Bundesliga',
  61: 'Ligue 1',
};

/** Bandiere semplificate a bande piatte (non stemmi ufficiali), coordinate 30×20 — fedeli 1:1 a `home-scegli-sfida.html`. */
function FlagSvg({ league }: { league: LeagueKey }) {
  switch (league) {
    case 135: // Serie A — Italia: 3 bande verticali
      return (
        <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="10" height="20" fill="#009246" />
          <rect x="10" width="10" height="20" fill="#F4F5F0" />
          <rect x="20" width="10" height="20" fill="#CE2B37" />
        </svg>
      );
    case 39: // Premier League — croce rossa su bianco
      return (
        <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="30" height="20" fill="#F4F5F0" />
          <rect x="13" width="4" height="20" fill="#CE1124" />
          <rect y="8" width="30" height="4" fill="#CE1124" />
        </svg>
      );
    case 140: // La Liga — Spagna: rosso/giallo/rosso (25/50/25)
      return (
        <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="30" height="20" fill="#AA151B" />
          <rect y="5" width="30" height="10" fill="#F1BF00" />
        </svg>
      );
    case 78: // Bundesliga — Germania: 3 bande orizzontali
      return (
        <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="30" height="6.67" fill="#141414" />
          <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
          <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
        </svg>
      );
    case 61: // Ligue 1 — Francia: 3 bande verticali
      return (
        <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="10" height="20" fill="#002395" />
          <rect x="10" width="10" height="20" fill="#F4F5F0" />
          <rect x="20" width="10" height="20" fill="#ED2939" />
        </svg>
      );
    case 'all':
    default:
      return (
        <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="6" height="20" fill="#009246" />
          <rect x="6" width="6" height="20" fill="#CE1124" />
          <rect x="12" width="6" height="20" fill="#F1BF00" />
          <rect x="18" width="6" height="20" fill="#141414" />
          <rect x="24" width="6" height="20" fill="#002395" />
          <circle cx="15" cy="10" r="6.2" fill="#0B0C0A" />
          <circle cx="15" cy="10" r="4.6" fill="none" stroke="#D7FF3A" strokeWidth="1.2" />
        </svg>
      );
  }
}

export interface LeagueFlagProps {
  league: LeagueKey;
  /** `wave` = vessillo 3:2 (rail campionati), `tile` = rettangolo 36×24, `circle` = cerchio 32, `chip` = quadrato 22 inline. */
  variant?: 'wave' | 'tile' | 'circle' | 'chip';
  className?: string;
}

const VARIANT_SIZE: Record<NonNullable<LeagueFlagProps['variant']>, { w: number; h: number }> = {
  wave: { w: 72, h: 48 },
  tile: { w: 36, h: 24 },
  circle: { w: 32, h: 32 },
  chip: { w: 22, h: 22 },
};

/**
 * Bandiera campionato come bande colore piatte via SVG inline (non stemmi
 * ufficiali, scelta deliberata — vedi restyle.md 11.1): sostituisce le
 * emoji testuali nel rail campionati Home. Replica esatta delle coordinate
 * SVG di `home-scegli-sfida.html`, non un'approssimazione a gradiente CSS.
 */
export function LeagueFlag({ league, variant = 'tile', className }: LeagueFlagProps) {
  const { w, h } = VARIANT_SIZE[variant];
  const rounded = variant === 'circle' ? 9999 : variant === 'wave' ? 10 : 6;
  const name = LEAGUE_NAMES[league];

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn('flag relative inline-block shrink-0 overflow-hidden', className)}
      style={{ width: w, height: h, borderRadius: rounded }}
    >
      <FlagSvg league={league} />
      <span
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)' }}
        aria-hidden="true"
      />
    </span>
  );
}
