/**
 * PrivacyScreen Component
 *
 * Termini di servizio e informativa privacy (URL: /privacy)
 */

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PrivacyScreenProps {
  onBack: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="disp text-[20px] text-chalk">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-chalk-2">{children}</div>
    </section>
  );
}

export function PrivacyScreen({ onBack }: PrivacyScreenProps) {
  return (
    <div className="relative flex min-h-screen flex-col gap-6 bg-ink px-4 pb-16 pt-12 text-chalk">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Indietro"
          onClick={onBack}
          className="btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-turf-1"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
        <h1 className="disp text-[28px]">Termini e privacy</h1>
      </header>

      <Section title="Un progetto dimostrativo">
        <p>
          Istinto Puro è una demo a scopo puramente dimostrativo e senza fini di lucro. Il gioco è gratuito, non
          contiene pubblicità, acquisti con denaro reale o altre forme di monetizzazione.
        </p>
        <p>
          Essendo una demo, il servizio viene fornito così com&apos;è: può cambiare, essere interrotto o i dati di gioco
          possono essere azzerati in qualsiasi momento, senza preavviso.
        </p>
      </Section>

      <Section title="Quali dati raccogliamo">
        <p>
          Quando ti registri raccogliamo: indirizzo email, nome, cognome, data di nascita, squadra del cuore e
          nickname. Durante il gioco salviamo i risultati delle partite, le statistiche, gli obiettivi sbloccati e le
          informazioni su amici, sfide e tornei.
        </p>
        <p>
          Nel browser vengono memorizzati solo i dati tecnici necessari al funzionamento, come la sessione di accesso.
        </p>
      </Section>

      <Section title="Come usiamo i tuoi dati">
        <p>
          I dati servono esclusivamente a far funzionare il gioco: autenticarti, mostrare il tuo profilo, la classifica,
          le sfide e i tornei, e inviarti le email di servizio (conferma della registrazione e recupero password).
        </p>
        <p>
          I tuoi dati non vengono usati per marketing, profilazione o pubblicità, non vengono venduti né ceduti a terzi
          per scopi commerciali e non vengono utilizzati in alcun modo analogo.
        </p>
      </Section>

      <Section title="Dove sono conservati">
        <p>
          I dati sono conservati tramite il servizio Supabase (autenticazione e database). L&apos;applicazione è
          pubblicata su GitHub Pages. Questi fornitori trattano i dati solo per erogare il servizio tecnico.
        </p>
        <p>
          Gli altri giocatori vedono solo il tuo nickname, insieme a livello, statistiche e risultati, nelle classifiche,
          nelle sfide e nei tornei. Nome, cognome, email e data di nascita non sono mai visibili agli altri utenti.
        </p>
      </Section>

      <Section title="I tuoi diritti">
        <p>
          Puoi chiedere in qualsiasi momento l&apos;accesso, la correzione o la cancellazione dei tuoi dati e del tuo
          account contattando chi gestisce il progetto.
        </p>
      </Section>

      <Section title="Regole di utilizzo">
        <p>
          Registrandoti ti impegni a usare il gioco in modo corretto, a non tentare di aggirare le regole o di
          compromettere il servizio e a scegliere un nickname non offensivo. Gli account che violano queste regole
          possono essere sospesi o rimossi.
        </p>
      </Section>

      <p className="text-xs text-label">
        Registrandoti dichiari di aver letto e accettato questi termini e questa informativa.
      </p>
    </div>
  );
}
