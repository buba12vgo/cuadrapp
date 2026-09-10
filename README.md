# Cuadrapp

Aplicación de cuadrantes de turnos para Policía Portuaria.

Stack: React, TypeScript, Tailwind CSS, Firebase (Auth y Firestore).

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Acceso

Pueden entrar las cuentas de Google listadas en `VITE_ADMIN_EMAILS` (separadas
por comas). Si no está definida, se usa `VITE_ADMIN_EMAIL` (por defecto
`buba12@gmail.com`). Cualquier otra cuenta se cierra al instante.

Ejemplo:

```bash
VITE_ADMIN_EMAILS=buba12@gmail.com,otro.admin@gmail.com
```

También hay que actualizar `firestore.rules` con los mismos correos y
desplegar las reglas en Firebase; si no, la UI deja entrar pero Firestore
rechaza lecturas/escrituras.
