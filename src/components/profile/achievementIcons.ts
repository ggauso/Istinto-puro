import type { AchievementCode } from '../../types/game';

/**
 * Un glifo SVG unico per achievement (26 path distinti), esatti da
 * `achievement.html`. Il campo `icon` restituito dall'API (`Trophy`,
 * `Flame`, ...) è un enum lucide generico condiviso da più achievement —
 * questa mappa invece associa ogni singolo `AchievementCode` al suo
 * disegno specifico, come nel mockup (dove ogni achievement della stessa
 * categoria aveva un'icona diversa, non ripetuta).
 */
export const ACHIEVEMENT_ICON_PATHS: Record<AchievementCode, string> = {
  first_win: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4zM12 3v5M20.5 9.5l-5 1M17 19.5l-2.8-5M7 19.5l2.8-5M3.5 9.5l5 1',
  win_10: 'M5 5h6v7l8 3a2 2 0 0 1 1 2v2H4zM4 15h16M8 19v2M13 19v2',
  win_50: 'M5 6l7 4 7-4M5 11l7 4 7-4M5 16l7 4 7-4',
  win_150: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  win_500: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5zM5 16h14',
  streak5: 'M12 3c1 4 5 6 5 10.5a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5.5 1-9z',
  streak10: 'M12 3c3 2 5 6 4 11l-2 3h-4l-2-3C7 9 9 5 12 3zM10.5 9.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M10 17l-1.5 4M14 17l1.5 4',
  streak25: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  tier_silver: 'M4 18l6-6 4 4 6-8M15 8h5v5',
  tier_gold: 'M8 3l4 6 4-6M6 15a6 6 0 1 0 12 0a6 6 0 1 0-12 0M12 13v4',
  tier_platinum: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 8l3.5 2v4L12 16l-3.5-2v-4z',
  tier_diamond: 'M7 4h10l4 5-9 12L3 9zM3 9h18M9.5 4L12 9l2.5-5M12 9v12',
  speed: 'M13 2 4 14h7l-1 8 9-12h-7z',
  speed_flash: 'M10 2 3 13h5l-1 7 7-10H9zM17 6l-3 5h3l-1 5 4-6h-3z',
  perfect: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  perfect25: 'M3 20l6-11 4 6 3-4 5 9zM7.5 12l1.5 1.5 1.5-1.5',
  social10: 'M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M3 20c.8-3.5 3-5 6-5s5.2 1.5 6 5M14.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M16 15c3 0 4.5 1.5 5 4',
  social50: 'M5 3l11 11M19 3L8 14M14 16l4 4M10 16l-4 4M16 13l-3 3M8 13l3 3',
  social200: 'M5 12a7 7 0 0 1 14 0v7h-5v-5h-4v5H5zM12 5V2M8 14h8',
  play50: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  play250: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M9 15l2 2 4-4',
  play1000: 'M7 9a3 3 0 1 0 0 6c3 0 7-6 10-6a3 3 0 1 1 0 6c-3 0-7-6-10-6z',
  tournament_join: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM14 7v10',
  tournament_win: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
  tournament_win5: 'M3 20v-6h6v6M9 20V9h6v11M15 20v-8h6v8M12 3.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z',
  tournament_big_win: 'M3 4h5v4H3M3 16h5v4H3M8 6h3v12H8M11 12h3M14 9h7v6h-7z',
};
