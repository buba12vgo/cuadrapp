# Cuadrapp

Aplicación de cuadrantes de turnos para Policía Portuaria.

Stack: React, TypeScript, Tailwind CSS, Firebase (Auth y Firestore).

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Acceso

- **Superadmin** (`buba12@gmail.com`, placa 102): entra con Google y puede ver y cambiar todo. Da de alta al resto en Usuarios.
- **Admin** (`jonymivi@gmail.com` y el alias `jony.mivi@gmail.com`, placa 108): entra con Google, ve todo y edita las fichas de todos los agentes (días, puestos y turnos), Permisos, Cuadrante jefes, Calendario jefes y el Calendario.
- **Consulta jefes**: correo y contraseña que crea el superadmin. Solo ven Cuadrante jefes y Calendario jefes. Cambian la contraseña en Opciones.

En Firebase Authentication hay que tener activos Google y Correo/contraseña.
Despliega `firestore.rules` para que los usuarios de consulta puedan leer y el admin no escriba el cuadrante operativo.
