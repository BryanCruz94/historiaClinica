Historia Clínica Mamita

Aplicación web para el registro y gestión de historias clínicas de pacientes, desarrollada con Firebase (Firestore, Auth y Storage) y JavaScript modular con ES6.
Permite a un administrador registrar pacientes, citas y exámenes médicos, así como adjuntar archivos relacionados (PDF, imágenes, etc.).

Descripción general

Este sistema está diseñado para que los usuarios puedan consultar la información médica de manera estructurada y segura.
El administrador puede añadir nuevos pacientes, registrar citas y exámenes, y gestionar los catálogos de doctores, clínicas y acompañantes.

El proyecto se basa en una arquitectura totalmente client-side con conexión directa a los servicios de Firebase, sin necesidad de backend intermedio.

Características principales

Autenticación con Google (solo para administradores)
Control de acceso a funciones críticas, como la creación de pacientes o edición de datos.

Gestión de pacientes
Cada paciente tiene un subdocumento en Firestore donde se almacenan sus entradas médicas.

Historial clínico
Visualización ordenada de citas y exámenes con campos de fecha, clínica, doctor, acompañante, resumen o comentario, y adjuntos.

Subida y descarga de archivos
Integración con Firebase Storage para documentos en PDF, imágenes JPG o PNG.

Catálogos dinámicos
Administración de listas de doctores, clínicas y acompañantes mediante formularios, con actualización en tiempo real.

Control de permisos
Solo el administrador puede crear pacientes o eliminar registros.
Los usuarios con acceso al enlace pueden consultar la información disponible.

Estructura del proyecto
/public
│
├── index.html          # Interfaz principal
├── app.js              # Lógica del cliente, conexión con Firebase
├── config.js           # Configuración de Firebase y constantes
├── style.css           # Estilos principales
└── assets/             # Íconos, logotipos u otros recursos

Dependencias

Firebase v10.13.1 (CDN modular)

HTML5 / CSS3

JavaScript ES6+

Configuración inicial

Crear un proyecto en Firebase Console.

Habilitar los siguientes servicios:

Firestore Database

Authentication (con proveedor Google)

Firebase Storage

Copiar las credenciales del proyecto en el archivo config.js:

export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};


En la misma configuración, define los correos de administradores:

export const ADMIN_EMAILS = ["correo@ejemplo.com"];


Desplegar el sitio con Firebase Hosting o cualquier servidor estático.

Seguridad y reglas de Firestore

Asegúrate de restringir la creación de pacientes únicamente a los administradores.
Ejemplo de regla básica:

match /patients/{id} {
  allow read: if true;
  allow create, update, delete: if request.auth != null
    && request.auth.token.email in ["correo@ejemplo.com"];
}

Créditos y autoría

Este proyecto fue desarrollado con apoyo de inteligencia artificial para la generación, refactorización y documentación del código.
La integración, depuración y personalización final fueron realizadas manualmente por el desarrollador principal.

Autor: Bryan Cruz
Colaborador: Asistencia técnica generada con IA
