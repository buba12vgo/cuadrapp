# Cuadrapp — sistema de diseño Puerto

La marca visible es **MōaPP**. El símbolo es `public/moapp-mark.png`. La paleta sale del tablero: navy `#021A3D`, azul de fondo `#0B4C93`, azul brillante `#2AB7E9`, texto `#01081A`.

Fuente de verdad visual para la app y para Google Stitch (`styleGuidelines`).
Producto: cuadrantes de turnos de la Policía Portuaria. Escritorio primero, densidad operativa, no marketing SaaS.

## Tema Stitch

- `colorMode`: LIGHT
- `colorVariant`: TONAL_SPOT
- `roundness`: ROUND_EIGHT
- `headlineFont`: PLUS_JAKARTA_SANS
- `bodyFont` / `labelFont`: IBM_PLEX_SANS
- `overridePrimaryColor`: `#0B4C93` (azul de fondo)
- `overrideSecondaryColor`: `#1A7A6D` (verde dársena)
- `overrideTertiaryColor`: `#C45C26` (ámbar boya)
- `backgroundLight`: `#F3F6FA`

## Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| brand-50 / 100 / 200 | `#E8F6FC` / `#C9ECF8` / `#9ADAF2` | fondos activos, chips |
| brand-400 | `#2AB7E9` | azul brillante: foco, selección |
| brand-500 | `#1A82BE` | enlace y acento medio |
| brand-600 | `#0B4C93` | azul de fondo: botones |
| brand-700 / 800 | `#063163` / `#021A3D` | hover y navy principal en cabeceras |
| canvas | `#F3F6FA` | fondo de app |
| surface | `#ffffff` | paneles |
| ink | `#01081A` | texto |
| muted | `#3E5168` | secundario |
| line | `#D3DEE8` | bordes |

Turnos (semántica, no marca): M cielo, T ámbar, N violeta noche, MT teal, V esmeralda, D neutro, L verde suave.

## Layout

- Escritorio: sidebar izquierda plegable (iconos o grupos Plantilla · Operación · Normativa). Móvil: tira horizontal. El cuadrante usa el resto del viewport.
- Contenido a pantalla completa: el cuadrante es el objeto, no una tarjeta flotante.
- Radio 8px. Sombras mínimas (`shadow-card`). Sin degradados de marketing en el workspace.
- Tablas densas (celdas ~22px). Números siempre `tabular-nums`.
- Login: una tarjeta centrada, institucional, sin badge “SaaS”.

## Voz

Español. Directo. Etiquetas de policía (placa, puesto, M/T/N), no jerga de producto. El badge de marca es **Portuaria**, no “Pro”.

## Prohibido

- Índigo/violeta de plantilla Vite o “startup purple”.
- Badges SaaS, pulsos decorativos, copy de “motor activo”.
- Colores o tipografías en prompts de `generate` si este sistema ya está ligado al proyecto Stitch.
- Meter `STITCH_API_KEY` en el cliente (`VITE_*`).
