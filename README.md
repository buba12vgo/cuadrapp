# Cuadrapp

Aplicación de cuadrantes de turnos para Policía Portuaria.

Stack: React, TypeScript, Tailwind CSS, Firebase (Auth y Firestore).

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Acceso

Solo entra la cuenta de Google configurada en `VITE_ADMIN_EMAIL` (por defecto `buba12@gmail.com`). Cualquier otra cuenta se cierra al instante.

Despliega también `firestore.rules` en Firebase para que el backend rechace lecturas y escrituras que no sean de esa cuenta.
