'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { useCallback, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { lockEditor } from '@/lib/server/actions/auth.action';
import { createBlankScenario } from '@/lib/server/actions/scenario.action';
import styles from './page.module.css';
import { UnlockModal } from './UnlockModal';

/**
 * Wire shape for a scenario card on the home page. Matches the post-RSC
 * serialization of `ScenarioSummary` from the server action: `updatedAt`
 * crosses the boundary as an ISO string, not a `Date`.
 */
export type ScenarioSummary = {
  id: string;
  name: string;
  floorCount: number;
  paintedCellCount: number;
  updatedAt: string;
};

type Props = {
  scenarios: ScenarioSummary[];
  unlocked: boolean;
};

/**
 * Client island for the home page. Owns the auth-gate modal and the
 * `pendingAction` callback that runs after a successful unlock. Scenario
 * cards and the "+ Nuevo" button go through `requireAuth` so locked users
 * see the password prompt instead of being silently redirected.
 */
export function HomeClient({ scenarios, unlocked }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (unlocked) {
        action();
        return;
      }
      pendingAction.current = action;
      setIsModalOpen(true);
    },
    [unlocked],
  );

  const handleModalSuccess = useCallback(() => {
    setIsModalOpen(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) action();
  }, []);

  const handleModalCancel = useCallback(() => {
    setIsModalOpen(false);
    pendingAction.current = null;
  }, []);

  const handleNewScenario = useCallback(() => {
    requireAuth(() => {
      startTransition(() => {
        // createBlankScenario is an unwrapped server action that calls
        // redirect() — any code after this call is unreachable.
        void createBlankScenario();
      });
    });
  }, [requireAuth]);

  const handleScenarioClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, id: string) => {
      // Let modifier-clicks (open in new tab, etc.) bypass the gate.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      requireAuth(() => router.push(`/editor?id=${id}`));
    },
    [requireAuth, router],
  );

  const handleLogout = useCallback(() => {
    startTransition(() => {
      // lockEditor is unwrapped and calls redirect('/').
      void lockEditor();
    });
  }, []);

  return (
    <>
      <header className={styles.homeHeader}>
        <h1>Pathfinder</h1>
        <p>Battle Map — editor de escenarios</p>
        <p className={styles.homeDedication}>
          Para el Sr Kisa, el gran maestro épico de Pathfinder.
        </p>
        <nav className={styles.homeNav}>
          <Link href="/ayuda" className={styles.homeNavLink}>
            📖 Ayuda del editor
          </Link>
          {unlocked ? (
            <button
              type="button"
              className={styles.homeNavLinkAsButton}
              onClick={handleLogout}
              disabled={isPending}
            >
              Cerrar sesión
            </button>
          ) : null}
        </nav>
      </header>

      <section className={styles.homeSection}>
        <div className={styles.homeSectionHeader}>
          <h2>Escenarios</h2>
          {/*
            The form is the real submit point: its `action` runs the unwrapped
            server action, which redirects to /editor. When locked, the
            inner Button's onClick calls preventDefault and stashes the
            navigation so it runs only after the password is accepted.
          */}
          <form action={createBlankScenario}>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
              onClick={(e) => {
                if (unlocked) return;
                e.preventDefault();
                handleNewScenario();
              }}
            >
              + Nuevo
            </Button>
          </form>
        </div>
        {scenarios.length === 0 ? (
          <Empty>No hay escenarios guardados. Creá uno para empezar.</Empty>
        ) : (
          <ul className={styles.scenarioList}>
            {scenarios.map((s) => (
              <li key={s.id} className={styles.scenarioCard}>
                <Link
                  href={`/editor?id=${s.id}`}
                  className={styles.scenarioLink}
                  onClick={(e) => handleScenarioClick(e, s.id)}
                >
                  <span className={styles.scenarioName}>{s.name}</span>
                  <span className={styles.scenarioMeta}>
                    {s.floorCount} {s.floorCount === 1 ? 'piso' : 'pisos'} · {s.paintedCellCount}{' '}
                    celdas pintadas
                  </span>
                  <span className={styles.scenarioDate}>
                    {new Date(s.updatedAt).toLocaleString('es')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isModalOpen ? (
        <UnlockModal onSuccess={handleModalSuccess} onCancel={handleModalCancel} />
      ) : null}
    </>
  );
}
