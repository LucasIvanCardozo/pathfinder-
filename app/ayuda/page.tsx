import Link from 'next/link';
import { Fraunces } from 'next/font/google';
import type { Metadata } from 'next';
import {
  KEY_CODE_LABELS,
  listShortcuts,
  type ShortcutCategory,
  type ShortcutDef,
} from '@/lib/shared/constants';
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
  | 'arrow'
  | 'combat'
  | 'spell';

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
  combat: 'Combate',
  spell: 'Hechizos',
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
  combat: (
    <>
      <path d="M12 3l8 5-8 5-8-5 8-5z" />
      <path d="M12 13l3 8" />
    </>
  ),
  spell: (
    <>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
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
  { id: 'combate', number: 'IX', title: 'Combate' },
  { id: 'hechizos', number: 'X', title: 'Hechizos' },
  { id: 'atajos', number: 'XI', title: 'Atajos de teclado' },
  { id: 'guardado', number: 'XII', title: 'Guardado' },
  { id: 'undo', number: 'XIII', title: 'Deshacer y rehacer' },
  { id: 'clima', number: 'XIV', title: 'Clima y ambiente' },
  { id: 'limpiar', number: 'XV', title: 'Limpiar' },
  { id: 'bugs', number: 'XVI', title: 'Cosas que pueden no funcionar bien' },
  { id: 'reportar', number: 'XVII', title: 'Si encontrás algo raro' },
];

// Shortcut list — derived from `lib/shared/constants/shortcuts.ts` so the
// page can't drift from the editor's modal. Each shortcut is grouped by
// category for reading flow; the order matches the in-editor `ShortcutsModal`
// so a user who knows one screen can scan the other.
const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  tool: 'Herramientas',
  brush: 'Pincel',
  save: 'Guardado',
  edit: 'Edición',
  navigation: 'Navegación',
  overlay: 'Paneles y overlays',
  combat: 'Combate y hechizos',
};

// Display order; matches `ShortcutsModal.tsx::CATEGORY_ORDER`.
const CATEGORY_DISPLAY_ORDER: ShortcutCategory[] = [
  'tool',
  'brush',
  'navigation',
  'edit',
  'save',
  'overlay',
  'combat',
];

/** Format one binding as a list of key tokens for display. */
function formatBindingKeys(def: ShortcutDef): string[] {
  const tokens: string[] = [];
  if (def.ctrl) tokens.push('Ctrl');
  if (def.shift) tokens.push('⇧');
  if (def.code) tokens.push(KEY_CODE_LABELS[def.code] ?? def.code);
  return tokens;
}

/** Grouped shortcuts, derived from the registry. Excludes `panModifier` (it's a
 *  press-and-hold modifier, not a discrete shortcut the GM presses) and the
 *  subdivision template (no key of its own). `listShortcuts()` already filters
 *  the latter. The pan modifier would render as `Ctrl + click + drag` which is
 *  a UX pattern, not a key combo — we surface it separately below. */
const SHORTCUTS_BY_CATEGORY: Record<ShortcutCategory, { keys: string[]; label: string }[]> =
  (() => {
    const out = {} as Record<ShortcutCategory, { keys: string[]; label: string }[]>;
    for (const def of listShortcuts()) {
      if (def.id === 'panModifier') continue; // handled separately
      if (!out[def.category]) out[def.category] = [];
      out[def.category].push({ keys: formatBindingKeys(def), label: def.label });
    }
    return out;
  })();

/** Modifier entries that aren't real keyboard shortcuts but the GM uses them. */
const MODIFIER_SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Ctrl', 'click + drag'], label: 'Mover el mapa' },
  { keys: ['Space', 'click + drag'], label: 'Mover el mapa (alternativo)' },
  { keys: ['1', '2', '3', '4', '…'], label: 'Cambiar subdivisión (uno por capa)' },
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
            <Note>
              Si el escenario ya tiene un combate guardado, vas a entrar con el
              visor de combate activo abajo (mirá <a href="#combate">Combate</a>).
              Para empezar de cero, finalizá el combate desde el botón del visor.
            </Note>
          </Section>

          <Section id="layout" number="II" title="Layout del editor">
            <p>El editor tiene cuatro zonas. Cada una cumple un rol distinto:</p>
            <div className={styles.zoneGrid}>
              <ZoneCard
                title="Panel izquierdo"
                lede="Herramientas (pintar, borrar, oscuridad, hechizos) + paletas + botones de combate, atajos, clima y limpiar."
                hint="Se oculta con H"
              />
              <ZoneCard
                title="Barra superior"
                lede="Nombre, navegación entre pisos, zoom, tabs de subdivisión, estado de guardado, botón Guardar."
              />
              <ZoneCard
                title="Lienzo central"
                lede="El mapa en sí. Acá pintás con click y drag."
                highlight
              />
              <ZoneCard
                title="Visor de combate (abajo)"
                lede="Aparece cuando hay un combate activo: ronda actual, combatiente en turno, cola de iniciativa y botón Finalizar."
              />
            </div>
            <p>
              El panel izquierdo cambia según la herramienta activa: muestra{' '}
              <strong>Piezas</strong> cuando pintás, <strong>Hechizos</strong> cuando
              lanzás spells (requiere combate activo). El visor de combate sólo
              aparece si iniciaste un combate en el escenario actual.
            </p>
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

          <Section id="combate" number="IX" title="Combate" icon="combat">
            <p>
              El tracker de combate te deja manejar iniciativa, rondas y orden de turno
              dentro del editor. Funciona como una sesión persistente: una vez que
              iniciás un combate, queda activo hasta que lo finalices, aunque refresques
              la página.
            </p>
            <ol className={styles.steps}>
              <li>
                Abrí el modal con el botón <strong>Combate</strong> del panel izquierdo
                (ícono de escudo) o con el atajo <Kbd>C</Kbd>.
              </li>
              <li>
                Agregá combatientes uno por uno: nombre, iniciativa (-10 a 40) y lado
                (jugadores / enemigos / neutral). El orden de la cola se calcula por
                iniciativa descendente, con el id del combatiente como desempate (el
                primero insertado gana).
              </li>
              <li>
                Hacé click en <strong>Iniciar combate</strong>. Se crea la ronda 1 y el
                primer combatiente (initiative más alta) queda "up".
              </li>
              <li>
                Desde el visor abajo o los atajos, avanzá el turno (<Kbd>N</Kbd>),
                retrocedelo (<Kbd>J</Kbd>), forzá una ronda (<Kbd>R</Kbd>) o agregá un
                combatiente al combate ya en curso (<Kbd>K</Kbd>).
              </li>
              <li>
                Para finalizar, hacé click en <strong>Finalizar</strong> en el visor
                (ícono de tacho rojo) y confirmá. Los combatientes se borran, los
                hechizos lanzados por combatientes removidos también se limpian, y la
                próxima vez que inicies un combate la ronda vuelve a 1.
              </li>
            </ol>
            <Note>
              Pasar al último combatiente de la cola <strong>incrementa la ronda</strong>{' '}
              (regla PF1e): ese wrap es el límite del mundo. Es el mismo momento en el
              que los hechizos con duración avanzan un round (ver{' '}
              <a href="#hechizos">Hechizos</a>).
            </Note>
            <Note>
              El id de cada combatiente se asigna en el cliente y el servidor lo honra
              tal cual al persistir. Esto permite referenciar al combatiente desde
              <code>casterCombatantId</code> en un hechizo <em>antes</em> de que el
              autosave persista el combate — el hechizo ya queda linkeado al combatiente
              correcto en el primer guardado.
            </Note>
          </Section>

          <Section id="hechizos" number="X" title="Hechizos" icon="spell">
            <p>
              Los hechizos (AoE spells) son markers que colocás sobre el mapa durante un
              combate activo. Tienen un color, una forma geométrica y una duración en
              rondas del mundo. Hay 7 templates hardcodeados:
            </p>
            <div className={styles.subdivisionTable}>
              <div className={styles.subdivisionRow}>
                <div className={styles.subdivisionName}>Cono 15 pies</div>
                <div className={styles.subdivisionPurpose}>
                  Cono rojo. Dos puntos de inicio (NE y SW). Rota con <Kbd>Q</Kbd> o con
                  click derecho sobre el canvas.
                </div>
              </div>
              <div className={styles.subdivisionRow}>
                <div className={styles.subdivisionName}>Cono 30 pies</div>
                <div className={styles.subdivisionPurpose}>
                  Cono naranja. Dos puntos de inicio (NE y SW). Rota con <Kbd>Q</Kbd> o
                  con click derecho sobre el canvas.
                </div>
              </div>
              <div className={styles.subdivisionRow}>
                <div className={styles.subdivisionName}>Radio 5 pies</div>
                <div className={styles.subdivisionPurpose}>Círculo azul. No rota.</div>
              </div>
              <div className={styles.subdivisionRow}>
                <div className={styles.subdivisionName}>Radio 10 pies</div>
                <div className={styles.subdivisionPurpose}>Círculo verde. No rota.</div>
              </div>
              <div className={styles.subdivisionRow}>
                <div className={styles.subdivisionName}>Radio 20 pies</div>
                <div className={styles.subdivisionPurpose}>Círculo violeta. No rota.</div>
              </div>
            </div>
            <ol className={styles.steps}>
              <li>
                Activá la herramienta <strong>Hechizos</strong> del toolbar (ícono de
                sombrero). Si no hay combate activo, sale un toast{' '}
                <em>“Iniciá un combate para usar hechizos”</em>.
              </li>
              <li>
                Elegí un template del <strong>SpellPalette</strong> en el panel
                izquierdo. Si es un cono, podés rotarlo con <Kbd>Q</Kbd> o con
                click derecho sobre el canvas (sobre celda vacía; el click derecho
                sobre pieza sigue abriendo el menú de estados). Click sobre el mismo
                card otra vez deselecciona el hechizo.
              </li>
              <li>
                Elegí la duración en rondas (1–10 por default) con el dropdown del
                SpellPalette. Un hechizo "muere" cuando el contador llega a 0.
              </li>
              <li>
                Hacé click sobre una celda del mapa. Se coloca el marker con el color y
                forma del template. El <code>casterCombatantId</code> queda asignado al
                combatiente activo en ese momento.
              </li>
              <li>
                El marker se queda fijo en el mapa con el color y la forma del
                template. El click izquierdo sobre el marker no hace nada — no se
                puede borrar manualmente.
              </li>
            </ol>
            <p>
              Los hechizos desaparecen del mapa de dos formas (ambas automáticas,
              sin acción del GM):
            </p>
            <ul className={styles.bullets}>
              <li>
                <strong>Expiración por rondas</strong>: en el wrap de ronda (cuando el
                cursor vuelve al primer combatiente) o en un{' '}
                <Kbd>R</Kbd> (avanzar ronda manualmente), el server decrementa
                <code>durationRounds</code> en cada marker y borra los que llegan a 0.
              </li>
              <li>
                <strong>Cleanup al finalizar combate</strong>: al cerrar el combate
                (botón Finalizar del visor), el server hace cascade delete de los
                Combatants y borra <em>todos</em> los hechizos del escenario en la
                misma TX (FK SetNull + <code>purgeOrphansInTx</code>). El mapa queda
                limpio para el próximo combate.
              </li>
            </ul>
            <Note>
              <strong>Regla PF1e — cuándo tickean los hechizos</strong>: pasar al
              último combatiente de la cola (lo que incrementa la ronda) es el{' '}
              <em>único</em> momento en el que los hechizos envejecen. Avanzar un turno
              intermedio no toca el contador. Si forzás una ronda con{' '}
              <Kbd>R</Kbd>, también se tickea.
            </Note>
            <Note>
              Si removés un combatiente mid-combate, sus hechizos se borran
              preventivamente (pre-cascade) en la misma TX. No quedan markers
              huérfanos flotando — ni durante el combate ni al finalizarlo.
            </Note>
          </Section>

          <Section id="atajos" number="XI" title="Atajos de teclado" icon="keyboard">
            <p>
              Para ver la lista completa en el editor, presioná <Kbd>?</Kbd> (o el
              botón de teclado en el panel izquierdo). Esta es la tabla canónica del
              editor, agrupada por categoría. Se genera directo del registro{' '}
              <code>lib/shared/constants/shortcuts.ts</code>, así que cualquier atajo
              nuevo que se sume al editor aparece acá automáticamente.
            </p>
            <Note>
              El atajo <Kbd>?</Kbd> está atado a la tecla física <code>/</code> (que
              produce <Kbd>?</Kbd> con <Kbd>⇧</Kbd> en US/LATAM). En layouts donde{' '}
              <Kbd>?</Kbd> está en otra tecla, este atajo no dispara — usá el botón
              del panel izquierdo como alternativa.
            </Note>
            {CATEGORY_DISPLAY_ORDER.filter((c) => SHORTCUTS_BY_CATEGORY[c]?.length > 0).map(
              (category) => (
                <div key={category} className={styles.shortcutCategory}>
                  <h3 className={styles.shortcutCategoryTitle}>
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <div className={styles.shortcutGrid}>
                    {SHORTCUTS_BY_CATEGORY[category].map((s) => (
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
                </div>
              ),
            )}
            <h3 className={styles.shortcutCategoryTitle}>Modificadores</h3>
            <div className={styles.shortcutGrid}>
              {MODIFIER_SHORTCUTS.map((s) => (
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

          <Section id="guardado" number="XII" title="Guardado" icon="save">
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

          <Section id="undo" number="XIII" title="Deshacer y rehacer" icon="undo">
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
              escenario, abrir/cerrar puertas, las acciones de combate
              (iniciar/finalizar, pasar turno, agregar combatientes) y los hechizos
              lanzados todavía no entran en la pila de undo.
            </Note>
          </Section>

          <Section id="clima" number="XIV" title="Clima y ambiente" icon="cloud">
            <p>
              El botón de nube en el panel izquierdo abre un sub-menú para configurar
              clima visual (lluvia, niebla, etc.) y audio ambiente.
            </p>
            <Note>
              <strong>Esto no se guarda todavía</strong> — es local a la sesión. Si
              recargás, perdés el clima.
            </Note>
          </Section>

          <Section id="limpiar" number="XV" title="Limpiar" icon="trash">
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
            <p>
              Los hechizos no entran en este menú. Se limpian solos: expiran
              cuando su contador de rondas llega a 0, y al finalizar el combate
              el server borra <em>todos</em> los del escenario. Mirá{' '}
              <a href="#hechizos">Hechizos</a> para el detalle. Para finalizar un
              combate activo, usá el botón del visor de combate abajo o el atajo{' '}
              <Kbd>C</Kbd>.
            </p>
          </Section>

          <Section id="bugs" number="XVI" title="Cosas que pueden no funcionar bien" icon="alert">
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
                renombrar el escenario, cambiar estados de piezas (puerta
                abierta/cerrada), iniciar/finalizar combate, pasar turno, agregar
                combatientes y lanzar/quitar hechizos todavía no entran en la pila de
                undo. Solo paint/erase/darkness/clear son reversibles con{' '}
                <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>.
              </li>
              <li>
                <strong>Refrescar mid-combate</strong>: el cliente mantiene el cursor
                optimista en memoria. Si refrescás antes del próximo guardado, perdés
                el cursor local y la próxima carga del servidor es la fuente de
                verdad.
              </li>
              <li>
                <strong>Hechizos requieren combate activo</strong>: si elegís la
                herramienta <strong>Hechizos</strong> sin haber iniciado un combate,
                sale un toast <em>“Iniciá un combate para usar hechizos”</em> y el
                cambio no se aplica.
              </li>
              <li>
                <strong>Atajo <Kbd>?</Kbd> en layouts no-US/LATAM</strong>: el binding
                está atado a la tecla física <code>/</code>, que produce <Kbd>?</Kbd>{' '}
                con Shift en US/LATAM. En layouts donde <Kbd>?</Kbd> está en otra tecla,
                este atajo no dispara — usá el botón del panel izquierdo como
                alternativa.
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

          <Section id="reportar" number="XVII" title="Si encontrás algo raro">
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
