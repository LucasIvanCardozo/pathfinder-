'use client';

import { useCombatSession } from '@/app/editor/hooks/use-combat-session';
import type { CombatView } from '@/lib/shared/types';
import styles from './RoundViewer.module.css';

export function RoundViewer({ combat }: { combat: CombatView | null }) {
  const session = useCombatSession(combat);
  if (!session.isActive) return null;
  const { roundNumber, currentCombatant, sortedCombatants } = session;

  return (
    <div className={styles.viewer} role="status" aria-live="polite">
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
    </div>
  );
}
