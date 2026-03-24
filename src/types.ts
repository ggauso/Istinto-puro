/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Risultato della ricerca/validazione del giocatore
 * Restituito dall'RPC validate_player_intersection
 */
export interface PlayerSearchResult {
  /** ID univoco del giocatore (bigint convertito in string) */
  player_id: string | null;

  /** Nome completo del giocatore normalizzato */
  player_name: string | null;

  /** Score di similarità (0-1): quanto il nome inserito assomiglia al giocatore vero */
  similarity_score: number;
}
