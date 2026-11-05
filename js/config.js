// Configuración de la Liga SIG.
//
// Si `firebase` es null, la página funciona en MODO DEMOSTRACIÓN:
// datos ficticios guardados solo en este navegador (sirve para probar el diseño).
//
// Para conectar la base real, pega aquí el objeto que da la consola de Firebase
// (Configuración del proyecto → Tus apps → App web → firebaseConfig). Esos valores
// NO son secretos: la seguridad la dan las reglas de `firestore.rules`.
export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyC7g29kOaGdW39JabAzVixc22YYYJHOWmU",
    authDomain: "liga-sig.firebaseapp.com",
    projectId: "liga-sig",
    storageBucket: "liga-sig.firebasestorage.app",
    messagingSenderId: "504858665230",
    appId: "1:504858665230:web:6b8d5cf93a3838a1dc375f"
  },
  nombreLiga: "Liga SIG",
  premioPorDefecto: "Vaso SIG edición campeón",
};
