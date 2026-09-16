# Cuadrapp — sistema de diseño Puerto

Fuente de verdad visual para la app y para Google Stitch (`styleGuidelines`).
Producto: cuadrantes de turnos de la Policía Portuaria. Escritorio primero, densidad operativa, no marketing SaaS.

## Tema Stitch

- `colorMode`: LIGHT
- `colorVariant`: TONAL_SPOT
- `roundness`: ROUND_EIGHT
- `headlineFont`: PLUS_JAKARTA_SANS
- `bodyFont` / `labelFont`: IBM_PLEX_SANS
- `overridePrimaryColor`: `#0B4F6C` (navy puerto)
- `overrideSecondaryColor`: `#1A7A6D` (verde dársena)
- `overrideTertiaryColor`: `#C45C26` (ámbar boya)
- `backgroundLight`: `#F2F5F7`

## Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| brand-50 / 100 / 200 | `#eef5f8` / `#d4e6ee` / `#a8c9d8` | fondos activos, chips |
| brand-400 / 500 | `#3d8eaf` / `#1a7594` | foco, selección |
| brand-600 / 700 / 800 | `#0B4F6C` / `#083d54` / `#062c3d` | botones, cabeceras densas |
| canvas | `#F2F5F7` | fondo de app |
| surface | `#ffffff` | paneles |
| ink | `#0E1C24` | texto |
| muted | `#5A6B74` | secundario |
| line | `#DCE3E8` | bordes |

Turnos (semántica, no marca): M cielo, T ámbar, N violeta noche, MT teal, V esmeralda, D neutro, L verde suave.

## Layout

- Escritorio: sidebar izquierda con navegación agrupada (Plantilla · Operación · Normativa). Móvil: tira horizontal. El cuadrante usa el resto del viewport.
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
