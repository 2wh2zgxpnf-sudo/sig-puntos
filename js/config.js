// Configuración de la Liga SIG.
//
// Mientras `firebase` sea null, la página funciona en MODO DEMOSTRACIÓN:
// datos ficticios guardados solo en este navegador (sirve para probar el diseño).
//
// Para conectar la base real, pega aquí el objeto que da la consola de Firebase
// (Configuración del proyecto → Tus apps → App web → firebaseConfig). Esos valores
// NO son secretos: la seguridad la dan las reglas de `firestore.rules`.
export const CONFIG = {
  firebase: null,
  // firebase: {
  //   apiKey: "...",
  //   authDomain: "sig-puntos.firebaseapp.com",
  //   projectId: "sig-puntos",
  //   appId: "...",
  // },
  nombreLiga: "Liga SIG",
  premioPorDefecto: "Vaso SIG edición campeón",
};
