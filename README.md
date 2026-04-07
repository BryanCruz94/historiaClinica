# Sistema Artemisa (Migración React)

Aplicación migrada a React con arquitectura orientada a componentes, autenticación por usuario y panel admin.

## ¿Necesito instalar Node?
No es obligatorio.

Este proyecto está hecho con **módulos ESM en navegador** y carga React/Tailwind por CDN.
Por eso **no existe `package.json` ni `node_modules`** en esta versión.

## Cómo ejecutar el programa
> Importante: debes abrirlo con servidor HTTP (no con doble click al `index.html`).

### Opción A (recomendada): Python (sin Node)
Si tienes Python instalado:

```bash
cd /workspace/historiaClinica
python3 -m http.server 5173
```

Luego abre:

- http://localhost:5173

### Opción B: Node (si prefieres usar Node)
Si ya tienes Node instalado:

```bash
cd /workspace/historiaClinica
npx serve -l 5173 .
```

Luego abre:

- http://localhost:5173

## Requisitos de Firebase
Para que funcione completamente (auth, datos y privacidad):

1. Configura en Firebase Authentication:
   - Email/Password habilitado.
   - Google Provider habilitado.
2. Usa las reglas de `firestore.rules` incluidas en este repo.
3. Asegura que el admin sea el correo:
   - `brayuco03@gmail.com`

## Cambios principales
- Front-end reescrito en React (sin build step, usando módulos ESM en navegador).
- Login de usuarios por **usuario + contraseña** y registro automático.
- Login exclusivo de administrador con **Google Provider**.
- Aislamiento de información por usuario/paciente mediante `ownerUid`.
- Panel de administración para activar/desactivar y eliminar usuarios.
- Migración de pacientes legacy a usuarios con patrón `primerNombre + inicialApellido` y password `123456`.
- CRUD de citas y exámenes, filtros y reporte imprimible.
- Al entrar como admin, la app intenta auto-migrar pacientes legacy sin usuario asociado.

## Estructura
- `src/App.js`: composición principal de componentes.
- `src/components/*`: UI reusable.
- `src/services/firebase.js`: autenticación y usuarios.
- `src/services/dataService.js`: catálogos y entradas clínicas.
- `src/utils/report.js`: impresión por filtros.
- `firestore.rules`: reglas propuestas para privacidad por usuario.

## Importante
Debes desplegar las nuevas reglas de Firestore para que la privacidad quede activa.
