# Cuadrapp

Aplicación de cuadrantes de turnos para Policía Portuaria.

Stack: React, TypeScript, Tailwind CSS, Firebase (Auth y Firestore).

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Acceso admin

Solo puede entrar la cuenta configurada en `VITE_ADMIN_EMAIL` (por defecto `buba12@gmail.com`) mediante **Google Sign-In**.

En Firebase Console:

1. Authentication → Sign-in method → activar **Google**.
2. Firestore → Rules → desplegar `firestore.rules` del repo (solo el admin puede leer/escribir).
