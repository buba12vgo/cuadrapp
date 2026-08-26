# Cuadrapp

Aplicación de cuadrantes de turnos para Policía Portuaria.

Stack: React, TypeScript, Tailwind CSS, Firebase (Auth y Firestore).

```bash
cp .env.example .env.local
npm install
npm run dev
```

## gstack (AI workflows)

Este repo requiere [gstack](https://github.com/garrytan/gstack) para trabajo asistido por IA.

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
# En Cursor: ./setup --team --host cursor
```

Skills disponibles tras instalar: `/office-hours`, `/review`, `/qa`, `/ship`, `/browse`, `/investigate`, etc.
