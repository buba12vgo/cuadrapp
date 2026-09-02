# Cuadrapp

Aplicación de cuadrantes de turnos para Policía Portuaria.

Stack: React, TypeScript, Tailwind CSS, Firebase (Auth y Firestore).

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Despliegue en Vercel

1. Configura las variables `VITE_FIREBASE_*` en Vercel (puedes copiarlas desde Firebase Console → Configuración del proyecto → Tus apps → SDK).
2. **Dominios autorizados:** cada URL de Vercel debe estar en Firebase Console → Authentication → Configuración → Dominios autorizados. Por ejemplo, si despliegas en `cuadrapp-chi.vercel.app`, añade exactamente ese dominio (sin `https://`).
3. Si usas un dominio personalizado en Vercel, añádelo también en Firebase.
4. Tras cambiar variables o dominios, redespliega en Vercel (sin build cache si la UI sigue mostrando configuración antigua).
