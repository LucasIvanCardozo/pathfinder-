# Guía del editor de Pathfinder

> Una visita rápida al editor de battle-maps para la primera vez que lo abrís.

## ¿Qué es esto?

Pathfinder es un editor de mapas para juegos de rol. Te deja pintar el piso de un escenario pieza por pieza (mesas, sillas, paredes, etc.), dividir el escenario en plantas (Subsuelo, Planta Baja, Piso 1, etc.) y aplicar efectos como oscuridad.

Tu trabajo como game master es preparar el mapa antes de la sesión. Los jugadores lo ven en otra pantalla.

## Empezando

1. En la lista de escenarios, hacé click en uno existente o creá uno nuevo.
2. Vas a entrar al editor con el piso **Planta Baja** activo.
3. Cambiá el nombre del escenario desde el input de arriba a la izquierda. Se guarda solo.

## Layout del editor

El editor tiene tres zonas:

- **Panel izquierdo** (flotante): herramientas, piezas, clima, limpiar, atajos.
- **Barra superior** (flotante): nombre, navegación entre pisos, zoom, tabs de subdivisión, estado de guardado.
- **Lienzo central** (Konva): el mapa. Acá pintás.

Podés ocultar/mostrar los paneles flotantes con la tecla **H**.

## Pintar

1. Elegí una pieza del panel izquierdo (las cards de la paleta).
2. Asegurate de tener la herramienta **Pintar** activa (ícono de pincel, atajo `B`).
3. Elegí una subdivisión desde los tabs de arriba (Suelo, Objetos grandes, Objetos pequeños, Estructuras).
4. Click y arrastrá sobre el lienzo para pintar.

El pincel pinta un cuadrado o círculo de celdas. El tamaño se cambia con `[` y `]` (o los botones `−` y `+` del panel). La forma (circular o cuadrada) se cambia con `Shift+B`.

## Borrar

Herramienta **Borrar** (ícono de goma, atajo `E`). Click y arrastrá sobre la subdivisión activa. Solo borra la subdivisión en la que estás parado, no toca las otras.

## Oscuridad (efecto niebla)

La oscuridad pinta un tinte oscuro semitransparente sobre las celdas. Sirve para revelar el mapa de a poco durante la sesión.

1. Herramienta **Oscuridad** (ícono de luna, sin atajo por defecto — hay que clickearla en el panel).
2. Click y arrastrá para aplicar oscuridad sobre una zona.
3. Click en la herramienta de nuevo para alternar a "borrar oscuridad" (ícono de sol).
4. No se ve como tab en las subdivisiones porque es una capa especial, no una capa de piezas.

## Subdivisiones (capas)

El escenario se divide en cuatro capas independientes. Cada capa tiene su propia grilla y solo pintás en la activa:

| Tecla | Capa | Para qué sirve |
|---|---|---|
| `1` | Suelo | Baldosas, pasto, agua, etc. |
| `2` | Objetos grandes | Muebles, mesas, estructuras grandes |
| `3` | Objetos pequeños | Jarrones, libros, items chicos |
| `4` | Estructuras | Muros, puertas, paredes |

Cambiá con los tabs o con las teclas `1`..`4`.

## Pisos

Un escenario puede tener varios pisos apilados (Subsuelo, Planta Baja, Piso 1, etc.). Por defecto tenés solo Planta Baja.

- **Subir / bajar de piso**: `Shift + ↑` / `Shift + ↓`.
- **Agregar piso arriba**: botón en el switcher de pisos.
- **Agregar piso abajo**: mismo botón, opción "abajo".

Solo se ven renderizados los pisos hasta el activo (no se renderizan los de arriba). Eso es intencional: si estás en Planta Baja, no querés ver el Piso 1 flotando arriba tapando todo.

## Estados de piezas (puertas y similares)

Ciertas piezas tienen **estados** que podés cambiar. El caso más común es la puerta: abierta, cerrada, con llave.

- **Click derecho** sobre una cell pintada con una pieza con estados.
- Aparece un menú con los estados disponibles. Elegí el que quieras.
- El estado se guarda como parte de la pieza.

## Atajos de teclado

Para ver la lista completa en el editor, presioná **`?`** (o el botón de teclado en el panel izquierdo).

Los más usados:

| Atajo | Acción |
|---|---|
| `B` | Pincel (pintar) |
| `E` | Borrador |
| `[` / `]` | Reducir / aumentar pincel |
| `Shift+B` | Cambiar forma del pincel |
| `V` | Mostrar / ocultar preview del pincel |
| `1`..`4` | Cambiar subdivisión |
| `Shift+↑` / `Shift+↓` | Subir / bajar de piso |
| `+` / `-` | Zoom in / out |
| `Ctrl+S` | Guardar manualmente |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Shift+Z` | Rehacer |
| `?` | Ver todos los atajos |
| `H` | Mostrar / ocultar paneles |
| `Esc` | Cerrar menú o modal |
| `Ctrl + click+drag` | Mover el mapa |

## Guardado

El editor guarda solo cada 60 segundos si hiciste cambios. Vas a ver el estado en la barra superior ("Guardando…", "Guardado hace 1 min", etc.). También podés guardar manualmente con `Ctrl+S`.

Si cerrás la pestaña sin guardar, perdés hasta 60 segundos de trabajo. Conviene `Ctrl+S` antes de cerrar.

## Deshacer (Ctrl+Z)

Si pintaste algo que no querías, `Ctrl+Z` lo revierte. `Ctrl+Shift+Z` lo rehace.

**Importante**: el historial de undo es en memoria. Si refrescás la página **antes del primer guardado** (los 60s), perdés el historial. Después del primer guardado, el mapa persistido es la fuente de verdad.

No todo se puede deshacer todavía: agregar o quitar pisos, renombrar el escenario, y abrir/cerrar puertas todavía no entran en la pila de undo (está en v1.1).

## Clima y ambiente

El botón de nube en el panel izquierdo abre un sub-menú para configurar clima visual (lluvia, niebla, etc.) y audio ambiente. **Esto no se guarda todavía** — es local a la sesión. Si recargás, perdés el clima.

## Limpiar

El botón rojo de papelera abre un menú con tres opciones de limpieza:

- **Todo el scenario**: borra todas las cells de todos los pisos.
- **Este piso**: borra solo las cells del piso activo.
- **Esta subdivisión**: borra solo las cells de la subdivisión activa en el piso activo.

Las tres acciones se pueden deshacer con `Ctrl+Z` (siempre que no hayas refrescado la página).

---

## Cosas que pueden no funcionar bien

Pathfinder está en desarrollo activo. Algunas cosas que pueden fallar o comportarse raro:

- **Dos pestañas abiertas a la vez**: los cambios de una pisan a la otra. No hay protección contra esto todavía. Si trabajás en serio, usá una sola pestaña.
- **Undo de algunas acciones**: agregar/quitar pisos, renombrar el escenario y cambiar estados de piezas (puerta abierta/cerrada) todavía no entran en la pila de undo.
- **Clima y audio**: no se guardan. Es local a la sesión.
- **Refrescar antes del primer guardado**: el historial de undo se pierde.
- **Pincel muy grande con subdivisions densas**: el rendimiento puede bajar si pintás miles de cells de una. Si sentís lag, achicá el pincel o recargá.

## Si encontrás algo raro

Anotámelo con la mayor cantidad de detalle posible:

- **Qué estabas haciendo** (pintando, borrando, cambiando de piso, etc.)
- **Qué pasó** (lo que viste en pantalla, error si hubo, comportamiento inesperado)
- **Qué esperabas que pase** (cómo creés que debería funcionar)

Comunicámelo a mí. Mientras más contexto, mejor.

---

**Tip final**: si el editor se siente lento, abrí la consola del navegador (F12) y avisame si hay errores en rojo. Eso me ayuda a encontrar bugs rápido.
