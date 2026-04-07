# Sistema Artemisa (Migración React)

Aplicación migrada a React con arquitectura orientada a componentes, autenticación por usuario y panel admin.

## Cambios principales
- Front-end reescrito en React (sin build step, usando módulos ESM en navegador).
- Login de usuarios por **usuario + contraseña** y registro automático.
- Login exclusivo de administrador con **Google Provider**.
- Aislamiento de información por usuario/paciente mediante `ownerUid`.
- Panel de administración para activar/desactivar y eliminar usuarios.
- Migración de pacientes legacy a usuarios con patrón `primerNombre + inicialApellido` y password `123456`.
- CRUD de citas y exámenes, filtros y reporte imprimible.

## Estructura
- `src/App.js`: composición principal de componentes.
- `src/components/*`: UI reusable.
- `src/services/firebase.js`: autenticación y usuarios.
- `src/services/dataService.js`: catálogos y entradas clínicas.
- `src/utils/report.js`: impresión por filtros.
- `firestore.rules`: reglas propuestas para privacidad por usuario.

## Importante
Debes desplegar las nuevas reglas de Firestore para que la privacidad quede activa.
