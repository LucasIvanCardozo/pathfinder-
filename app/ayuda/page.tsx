import Link from 'next/link';
import { Fraunces } from 'next/font/google';
import type { Metadata } from 'next';
import styles from './page.module.css';

const display = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Ayuda — Pathfinder',
  description:
    'Guía del editor de Pathfinder: herramientas, atajos, subdivisiones, pisos, undo y todo lo que necesitás saber para empezar.',
};

// Tiny inline icon helpers. The codebase already uses FontAwesome for the
// editor, but importing one icon per section here would balloon the client
// bundle for a static page — these are SVG primitives that read fine at the
// sizes we need (16-20px) and avoid a 'use client' boundary.
function Icon({ name }: { name: IconName }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <title>{ICON_LABELS[name]}</title>
        {ICONS[name]}
      </svg>
    </span>
  );
}

type IconName =
  | 'paint'
  | 'eraser'
  | 'moon'
  | 'layers'
  | 'stairs'
  | 'door'
  | 'keyboard'
  | 'save'
  | 'undo'
  | 'redo'
  | 'cloud'
  | 'trash'
  | 'alert'
  | 'arrow';

const ICON_LABELS: Record<IconName, string> = {
  paint: 'Pintar',
  eraser: 'Borrar',
  moon: 'Oscuridad',
  layers: 'Subdivisiones',
  stairs: 'Pisos',
  door: 'Estados de piezas',
  keyboard: 'Atajos de teclado',
  save: 'Guardado',
  undo: 'Deshacer',
  redo: 'Rehacer',
  cloud: 'Clima',
  trash: 'Limpiar',
  alert: 'Atención',
  arrow: 'Volver',
};

const ICONS: Record<IconName, React.ReactNode> = {
  paint: <path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" />,
  eraser: (
    <>
      <path d="M3 17l8-8 7 7-5 5H6l-3-4z" />
      <path d="M11 9l4-4a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-4 4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />,
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  stairs: (
    <>
      <path d="M3 20h4v-4h4v-4h4v-4h4V4" />
      <path d="M3 20h18" />
    </>
  ),
  door: (
    <>
      <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" />
      <circle cx="15" cy="12" r="0.7" fill="currentColor" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4M8 14h8v6H8z" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14l-4-4 4-4" />
      <path d="M5 10h9a5 5 0 0 1 0 10h-3" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l4-4-4-4" />
      <path d="M19 10h-9a5 5 0 0 0 0 10h3" />
    </>
  ),
  cloud: <path d="M7 18a4 4 0 1 1 1-7.9A6 6 0 0 1 19 11a4 4 0 0 1 0 8H7z" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5M12 18v.01" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

type Section = { id: string; number: string; title: string; lede?: string };

const SECTIONS: Section[] = [
  { id: 'empezando', number: 'I', title: 'Empezando', lede: 'Abrí un escenario y empezá a pintar.' },
  { id: 'layout', number: 'II', title: 'Layout del editor' },
  { id: 'pintar', number: 'III', title: 'Pintar' },
  { id: 'borrar', number: 'IV', title: 'Borrar' },
  { id: 'oscuridad', number: 'V', title: 'Oscuridad' },
  { id: 'subdivisiones', number: 'VI', title: 'Subdivisiones' },
  { id: 'pisos', number: 'VII', title: 'Pisos' },
  { id: 'estados', number: 'VIII', title: 'Estados de piezas' },
  { id: 'atajos', number: 'IX', title: 'Atajos de teclado' },
  { id: 'guardado', number: 'X', title: 'Guardado' },
  { id: 'undo', number: 'XI', title: 'Deshacer y rehacer' },
  { id: 'clima', number: 'XII', title: 'Clima y ambiente' },
  { id: 'limpiar', number: 'XIII', title: 'Limpiar' },
  { id: 'bugs', number: 'XIV', title: 'Cosas que pueden no funcionar bien' },
  { id: 'reportar', number: 'XV', title: 'Si encontrás algo raro' },
];

// Shortcut list — duplicated from the editor's modal. The list is
// canonical in `lib/shared/constants/shortcuts.ts`; this is a
// hand-picked subset of the most common bindings, ordered for reading
// flow rather than the registry's order.
const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['B'], label: 'Pincel (pintar)' },
  { keys: ['E'], label: 'Borrador' },
  { keys: ['['], label: 'Reducir pincel' },
  { keys: [']'], label: 'Aumentar pincel' },
  { keys: ['⇧', 'B'], label: 'Cambiar forma del pincel' },
  { keys: ['V'], label: 'Mostrar / ocultar preview del pincel' },
  { keys: ['1', '2', '3', '4'], label: 'Cambiar subdivisión' },
  { keys: ['⇧', '↑'], label: 'Subir de piso' },
  { keys: ['⇧', '↓'], label: 'Bajar de piso' },
  { keys: ['+'], label: 'Aumentar zoom' },
  { keys: ['-'], label: 'Reducir zoom' },
  { keys: ['Ctrl', 'Z'], label: 'Deshacer' },
  { keys: ['Ctrl', '⇧', 'Z'], label: 'Rehacer' },
  { keys: ['Ctrl', 'S'], label: 'Guardar manualmente' },
  { keys: ['?'], label: 'Ver todos los atajos' },
  { keys: ['H'], label: 'Mostrar / ocultar paneles' },
  { keys: ['Esc'], label: 'Cerrar menú o modal' },
  { keys: ['Ctrl', 'click + drag'], label: 'Mover el mapa' },
];

const SUBDIVISION_TABLE = [
  { key: '1', name: 'Suelo', purpose: 'Baldosas, pasto, agua, etc.' },
  { key: '2', name: 'Objetos grandes', purpose: 'Muebles, mesas, estructuras grandes' },
  { key: '3', name: 'Objetos pequeños', purpose: 'Jarrones, libros, items chicos' },
  { key: '4', name: 'Estructuras', purpose: 'Muros, puertas, paredes' },
];

export default function AyudaPage() {
  return (
    <main className={`${styles.page} ${display.variable}`}>
      <div className={styles.gridOverlay} aria-hidden="true" />

      <header className={styles.hero}>
        <div className={styles.heroMeta}>
          <Link href="/" className={styles.backLink}>
            ← Escenarios
          </Link>
        </div>
        <p className={styles.heroEyebrow}>Pathfinder · Battle Map</p>
        <h1 className={styles.heroTitle}>
          Guía del <em>editor</em>
        </h1>
        <p className={styles.heroLede}>
          Una visita rápida al editor de mapas para la primera vez que lo abrís. Empezá
          por arriba, saltá a lo que necesitás con el índice de la izquierda.
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.toc} aria-label="Índice de secciones">
          <p className={styles.tocTitle}>Índice</p>
          <ol className={styles.tocList}>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={styles.tocLink}>
                  <span className={styles.tocNumber}>{s.number}</span>
                  <span>{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className={styles.content}>
          <Section id="empezando" number="I" title="Empezando">
            <p>
              Pathfinder es un editor de mapas para juegos de rol. Te deja pintar el
              piso de un escenario pieza por pieza (mesas, sillas, paredes, etc.),
              dividir el escenario en plantas (Subsuelo, Planta Baja, Piso 1, etc.) y
              aplicar efectos como oscuridad.
            </p>
            <p>
              Tu trabajo como game master es preparar el mapa antes de la sesión. Los
              jugadores lo ven en otra pantalla.
            </p>
            <ol className={styles.steps}>
              <li>En la lista de escenarios, hacé click en uno existente o creá uno nuevo.</li>
              <li>Vas a entrar al editor con el piso <em>Planta Baja</em> activo.</li>
              <li>Cambiá el nombre del escenario desde el input de arriba a la izquierda. Se guarda solo.</li>
            </ol>
          </Section>

          <Section id="layout" number="II" title="Layout del editor">
            <p>El editor tiene tres zonas. Cada una cumple un rol distinto:</p>
            <div className={styles.zoneGrid}>
              <ZoneCard
                title="Panel izquierdo"
                lede="Herramientas, piezas, clima, limpiar, atajos."
                hint="Se oculta con H"
              />
              <ZoneCard
                title="Barra superior"
                lede="Nombre, navegación entre pisos, zoom, tabs de subdivisión, estado de guardado."
              />
              <ZoneCard
                title="Lienzo central"
                lede="El mapa en sí. Acá pintás con click y drag."
                highlight
              />
            </div>
          </Section>

          <Section id="pintar" number="III" title="Pintar" icon="paint">
            <ol className={styles.steps}>
              <li>Elegí una pieza del panel izquierdo (las cards de la paleta).</li>
              <li>Asegurate de tener la herramienta <strong>Pintar</strong> activa (ícono de pincel, atajo <Kbd>B</Kbd>).</li>
              <li>Elegí una subdivisión desde los tabs de arriba.</li>
              <li>Click y arrastrá sobre el lienzo para pintar.</li>
            </ol>
            <p>
              El pincel pinta un cuadrado o círculo de celdas. Cambiá el tamaño con{' '}
              <Kbd>[</Kbd> y <Kbd>]</Kbd>, o con los botones <Kbd>−</Kbd> / <Kbd>+</Kbd> del
              panel. Cambiá la forma (circular o cuadrada) con <Kbd>⇧</Kbd>+<Kbd>B</Kbd>.
            </p>
          </Section>

          <Section id="borrar" number="IV" title="Borrar" icon="eraser">
            <p>
              Herramienta <strong>Borrar</strong> (ícono de goma, atajo <Kbd>E</Kbd>).
              Click y arrastrá sobre la subdivisión activa. Solo borra la subdivisión
              en la que estás parado, no toca las otras.
            </p>
          </Section>

          <Section id="oscuridad" number="V" title="Oscuridad" icon="moon">
            <p>
              La oscuridad pinta un tinte semitransparente sobre las celdas. Sirve
              para revelar el mapa de a poco durante la sesión.
            </p>
            <ol className={styles.steps}>
              <li>Herramienta <strong>Oscuridad</strong> (ícono de luna).</li>
              <li>Click y arrastrá para aplicar oscuridad sobre una zona.</li>
              <li>Click en la herramienta de nuevo para alternar a "borrar oscuridad" (ícono de sol).</li>
              <li>No se ve como tab en las subdivisiones porque es una capa especial, no una capa de piezas.</li>
            </ol>
            <Note>La oscuridad es independiente de las subdivisions: podés oscurecer una zona de Suelo aunque la subdivisión activa sea Objetos grandes.</Note>
          </Section>

          <Section id="subdivisiones" number="VI" title="Subdivisiones" icon="layers">
            <p>
              El escenario se divide en cuatro capas independientes. Cada capa tiene
              su propia grilla y solo pintás en la activa. Cambiá con los tabs o con
              las teclas <Kbd>1</Kbd>..<Kbd>4</Kbd>.
            </p>
            <div className={styles.subdivisionTable}>
              {SUBDIVISION_TABLE.map((row) => (
                <div key={row.key} className={styles.subdivisionRow}>
                  <div className={styles.subdivisionKey}>
                    <Kbd>{row.key}</Kbd>
                  </div>
                  <div className={styles.subdivisionName}>{row.name}</div>
                  <div className={styles.subdivisionPurpose}>{row.purpose}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="pisos" number="VII" title="Pisos" icon="stairs">
            <p>
              Un escenario puede tener varios pisos apilados (Subsuelo, Planta Baja,
              Piso 1, etc.). Por defecto tenés solo Planta Baja.
            </p>
            <ul className={styles.bullets}>
              <li>
                <strong>Subir / bajar de piso</strong>: <Kbd>⇧</Kbd>+<Kbd>↑</Kbd> / <Kbd>⇧</Kbd>+<Kbd>↓</Kbd>.
              </li>
              <li>
                <strong>Agregar piso arriba / abajo</strong>: botones en el switcher de pisos.
              </li>
            </ul>
            <Note>
              Solo se ven renderizados los pisos hasta el activo (no se renderizan los
              de arriba). Si estás en Planta Baja, no querés ver el Piso 1 flotando
              arriba tapando todo.
            </Note>
          </Section>

          <Section id="estados" number="VIII" title="Estados de piezas" icon="door">
            <p>
              Ciertas piezas tienen <strong>estados</strong> que podés cambiar. El caso
              más común es la puerta: abierta, cerrada, con llave.
            </p>
            <ol className={styles.steps}>
              <li><strong>Click derecho</strong> sobre una cell pintada con una pieza con estados.</li>
              <li>Aparece un menú con los estados disponibles. Elegí el que quieras.</li>
              <li>El estado se guarda como parte de la pieza.</li>
            </ol>
            <Note>
              Todavía no se puede deshacer un cambio de estado de pieza con{' '}
              <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>. Está previsto para la próxima versión.
            </Note>
          </Section>

          <Section id="atajos" number="IX" title="Atajos de teclado" icon="keyboard">
            <p>
              Para ver la lista completa en el editor, presioná <Kbd>?</Kbd> (o el
              botón de teclado en el panel izquierdo). Esta es una selección de los
              más usados:
            </p>
            <div className={styles.shortcutGrid}>
              {SHORTCUTS.map((s) => (
                <div key={s.label} className={styles.shortcutRow}>
                  <div className={styles.shortcutKeys}>
                    {s.keys.map((k, i) => (
                      <span key={k} className={styles.shortcutKeyGroup}>
                        {i > 0 && <span className={styles.shortcutPlus}>+</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </div>
                  <div className={styles.shortcutLabel}>{s.label}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="guardado" number="X" title="Guardado" icon="save">
            <p>
              El editor guarda solo cada 60 segundos si hiciste cambios. Vas a ver el
              estado en la barra superior (<em>"Guardando…"</em>, <em>"Guardado hace 1 min"</em>,
              etc.). También podés guardar manualmente con <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd>.
            </p>
            <Note>
              Si cerrás la pestaña sin guardar, perdés hasta 60 segundos de trabajo.
              Conviene <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> antes de cerrar.
            </Note>
          </Section>

          <Section id="undo" number="XI" title="Deshacer y rehacer" icon="undo">
            <p>
              Si pintaste algo que no querías, <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> lo revierte.
              <Kbd>Ctrl</Kbd>+<Kbd>⇧</Kbd>+<Kbd>Z</Kbd> lo rehace.
            </p>
            <p>
              <strong>Importante</strong>: el historial de undo es en memoria. Si
              refrescás la página <em>antes del primer guardado</em> (los 60 s),
              perdés el historial. Después del primer guardado, el mapa persistido es
              la fuente de verdad.
            </p>
            <Note>
              No todo se puede deshacer todavía: agregar o quitar pisos, renombrar el
              escenario y abrir/cerrar puertas todavía no entran en la pila de undo.
            </Note>
          </Section>

          <Section id="clima" number="XII" title="Clima y ambiente" icon="cloud">
            <p>
              El botón de nube en el panel izquierdo abre un sub-menú para configurar
              clima visual (lluvia, niebla, etc.) y audio ambiente.
            </p>
            <Note>
              <strong>Esto no se guarda todavía</strong> — es local a la sesión. Si
              recargás, perdés el clima.
            </Note>
          </Section>

          <Section id="limpiar" number="XIII" title="Limpiar" icon="trash">
            <p>
              El botón rojo de papelera abre un menú con tres opciones:
            </p>
            <ul className={styles.bullets}>
              <li><strong>Todo el scenario</strong>: borra todas las cells de todos los pisos.</li>
              <li><strong>Este piso</strong>: borra solo las cells del piso activo.</li>
              <li><strong>Esta subdivisión</strong>: borra solo las cells de la subdivisión activa en el piso activo.</li>
            </ul>
            <p>
              Las tres acciones se pueden deshacer con <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>{' '}
              (siempre que no hayas refrescado la página).
            </p>
          </Section>

          <Section id="bugs" number="XIV" title="Cosas que pueden no funcionar bien" icon="alert">
            <p>
              Pathfinder está en desarrollo activo. Algunas cosas que pueden fallar o
              comportarse raro:
            </p>
            <ul className={styles.bullets}>
              <li>
                <strong>Dos pestañas abiertas a la vez</strong>: los cambios de una
                pisan a la otra. No hay protección contra esto todavía. Si trabajás
                en serio, usá una sola pestaña.
              </li>
              <li>
                <strong>Undo de algunas acciones</strong>: agregar/quitar pisos,
                renombrar el escenario y cambiar estados de piezas (puerta
                abierta/cerrada) todavía no entran en la pila de undo.
              </li>
              <li>
                <strong>Clima y audio</strong>: no se guardan. Es local a la sesión.
              </li>
              <li>
                <strong>Refrescar antes del primer guardado</strong>: el historial de
                undo se pierde.
              </li>
              <li>
                <strong>Pincel muy grande con subdivisions densas</strong>: el
                rendimiento puede bajar si pintás miles de cells de una. Si sentís
                lag, achicá el pincel o recargá.
              </li>
            </ul>
          </Section>

          <Section id="reportar" number="XV" title="Si encontrás algo raro">
            <p>
              Anotámelo con la mayor cantidad de detalle posible y comunicámelo:
            </p>
            <ul className={styles.bullets}>
              <li>
                <strong>Qué estabas haciendo</strong> (pintando, borrando, cambiando de
                piso, etc.).
              </li>
              <li>
                <strong>Qué pasó</strong> (lo que viste en pantalla, error si hubo,
                comportamiento inesperado).
              </li>
              <li>
                <strong>Qué esperabas que pase</strong> (cómo creés que debería
                funcionar).
              </li>
            </ul>
            <Note>
              <strong>Tip final</strong>: si el editor se siente lento, abrí la
              consola del navegador (<Kbd>F12</Kbd>) y avisame si hay errores en rojo.
              Eso me ayuda a encontrar bugs rápido.
            </Note>
          </Section>

          <footer className={styles.footer}>
            <p>
              Pathfinder está en desarrollo. Esta guía se actualiza con cada cambio
              importante.
            </p>
            <Link href="/" className={styles.footerLink}>
              <Icon name="arrow" />
              Volver a la lista de escenarios
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}

function Section({
  id,
  number,
  title,
  icon,
  children,
}: {
  id: string;
  number: string;
  title: string;
  icon?: IconName;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section} id={id}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionNumber}>{number}</span>
        <h2 className={styles.sectionTitle}>
          {icon && <Icon name={icon} />}
          <span>{title}</span>
        </h2>
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function ZoneCard({
  title,
  lede,
  hint,
  highlight,
}: {
  title: string;
  lede: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${styles.zoneCard} ${highlight ? styles.zoneCardHighlight : ''}`}>
      <div className={styles.zoneCardTitle}>{title}</div>
      <div className={styles.zoneCardLede}>{lede}</div>
      {hint && <div className={styles.zoneCardHint}>{hint}</div>}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <aside className={styles.note}>
      <span className={styles.noteLabel}>Nota</span>
      <div className={styles.noteBody}>{children}</div>
    </aside>
  );
}
