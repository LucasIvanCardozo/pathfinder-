'use client';

import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCombatSession } from '@/app/editor/hooks/use-combat-session';
import { Button } from '@/components/Button';
import type { CombatView } from '@/lib/shared/types';
import styles from './RoundViewer.module.css';

type Props = {
  combat: CombatView | null;
  /**
   * Optional handler wired to a "Finalizar combate" affordance rendered to
   * the right of the initiative queue. The parent usually opens a confirm
   * dialog before mutating combat state.
   */
  onEndCombat?: () => void;
  /**
   * Modo "pantalla tumbada": posiciona el viewer arriba del viewport y lo
   * rota 180° para que los jugadores sentados al lado opuesto de la mesa
   * puedan leer los turnos sin girar la cabeza. Omite el botón "Finalizar"
   * (queda al revés e inutilizable para el GM) y aplica `aria-hidden` para
   * no duplicar anuncios del screen reader con la instancia normal.
   */
  flipped?: boolean;
};

export function RoundViewer({ combat, onEndCombat, flipped = false }: Props) {
  const session = useCombatSession(combat);
  if (!session.isActive) return null;
  const { roundNumber, currentCombatant, sortedCombatants } = session;
  // La instancia flipped es decorativa para los jugadores visuales; la única
  // fuente de anuncios a11y es la instancia normal (abajo, role=status).
  const a11y = flipped
    ? { 'aria-hidden': true as const }
    : { role: 'status', 'aria-live': 'polite' as const };

  return (
    <div className={`${styles.viewer} ${flipped ? styles.flipped : ''}`} {...a11y}>
      <div className={styles.round}>Ronda {roundNumber}</div>
      <div className={styles.turn}>
        <span className={styles.turnLabel}>Turno:</span>
        <span className={styles.turnName}>{currentCombatant?.name ?? '—'}</span>
      </div>
      <div className={styles.queue} title="Orden de iniciativa">
        {sortedCombatants.map((combatant, index) => (
          <span
            key={combatant.id}
            className={styles.queueItem}
            data-active={index === session.turnIndex ? 'true' : 'false'}
            data-side={combatant.side}
          >
            {combatant.name} ({combatant.initiative})
          </span>
        ))}
      </div>
      {!flipped && onEndCombat && (
        <span className={styles.endButton}>
          <Button
            type="button"
            size="mini"
            variant="danger"
            onClick={onEndCombat}
            title="Finalizar combate"
          >
            <FontAwesomeIcon icon={faTimes} /> Finalizar
          </Button>
        </span>
      )}
    </div>
  );
}
