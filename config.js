// config.js  (NO LO EXPONGAS EN LA UI; solo es un módulo importado por app.js)
console.log("config.js cargado ✅");

export const firebaseConfig = {
  apiKey: "AIzaSyA3y3opPsuLNA9YcSaMgl1MoNwKJxA17zI",
  authDomain: "historia-clinica-602a4.firebaseapp.com",
  projectId: "historia-clinica-602a4",
  storageBucket: "historia-clinica-602a4.firebasestorage.app",
  messagingSenderId: "1039847414229",
  appId: "1:1039847414229:web:c10a78e415e025f426c55c"
};

export const ADMIN_EMAILS = [
  "brayuco03@gmail.com"
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];




