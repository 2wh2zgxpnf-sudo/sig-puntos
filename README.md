# Liga SIG 🏆

Sistema de puntos del **Surgery Interest Group FUSM**: ranking mensual en vivo de las actividades semanales del
grupo de WhatsApp. Todos pueden ver el ranking; solo la junta directiva registra puntos.
Origen: Acta SIG 014 (2026-09-08), punto 7.

- **Vista pública**: `index.html`. Muestra el podio del mes, el ranking, los últimos puntos, el salón de la fama
  (campeones de cada mes + acumulado histórico) y las actividades que suman.
- **Panel de la junta**: `admin.html`. Se entra con Google. Desde ahí se dan puntos, se gestionan participantes y
  actividades, se cambia el premio y se corrigen registros.

Es HTML/JS estático (GitHub Pages) con Firebase (Firestore + Authentication). No hay que compilar nada.

## Modo demostración
Mientras `js/config.js` tenga `firebase: null`, la página usa datos ficticios guardados solo en el navegador.
El panel deja "entrar" sin cuenta. Sirve para probar el diseño.

## Estado
Conectada al proyecto Firebase `liga-sig` (2026-11-04). Para agregar un admin: Firestore → colección
`admins` → *Agregar documento* → ID = correo Google en minúsculas → campo `nombre`.

## Conectar Firebase (referencia, ya hecho)
1. En https://console.firebase.google.com crea un proyecto (p. ej. `sig-puntos`). Analytics no hace falta.
2. **Build → Firestore Database → Crear base de datos** (modo producción, región `southamerica-east1` o `us-east1`).
3. **Build → Authentication → Comenzar → Google** → habilitar.
   En *Settings → Authorized domains* agrega `2wh2zgxpnf-sudo.github.io`.
4. **Configuración del proyecto → Tus apps → Web (`</>`)** → registra la app y copia el `firebaseConfig`
   dentro de `firebase:` en `js/config.js`. Esos valores no son secretos.
5. **Firestore → Reglas**: pega el contenido de `firestore.rules` y publica.
6. **Firestore → Datos → Iniciar colección `admins`**: un documento por miembro de la junta, con el **correo
   Google en minúsculas como ID del documento** (cualquier campo, p. ej. `nombre: "Laura"`). Los correos no
   quedan en el repositorio público y nadie más puede leer esa colección.
7. Sube `?v=N` en los `<link>`/`<script>` de `index.html` y `admin.html` al cambiar archivos
   (GitHub Pages cachea unos 10 minutos).

## Reglas de uso (privacidad)
- Participantes: **solo nombre + inicial del apellido** ("Laura R.") y, si quieren, un emoji. Nada de correos,
  teléfonos, documentos ni semestre: la página es pública.
- "Retirar" a alguien lo oculta del ranking sin borrar su historial.
- Para corregir un error: elimina el registro en *Registros*, o da puntos negativos como ajuste.

## Cómo se calcula
- **Ranking del mes**: suma de puntos con fecha dentro del mes calendario. Los empates comparten puesto.
- **Tendencia (▲▼)**: posición actual frente a hace 7 días. En la primera semana del mes no se muestra.
- **Campeón del mes**: se calcula solo al terminar el mes, sin que nadie tenga que "cerrarlo".
- **Insignias**: 🏆 campeón de algún mes · 🔥 racha de ≥2 semanas seguidas sumando · 🎯 puntos en ≥3
  actividades distintas · ⚡ primeros puntos del mes · ⭐ debut (su primer mes).
