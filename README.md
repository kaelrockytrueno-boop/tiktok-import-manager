# TikTok Colecciones · Import Manager

Herramienta en dos partes para extraer tus colecciones de TikTok (título + enlace) y organizar el traslado manual a otra cuenta.

## ⚠️ Realidad técnica (léelo antes de usar)

- TikTok **no expone una API pública** para leer ni escribir "colecciones/favoritos" de una cuenta.
- **GitHub Pages es hosting estático**: no puede autenticarse contra tiktok.com ni leer tu sesión. Por eso la extracción de datos **debe** ocurrir en tu propio navegador, dentro de tiktok.com (con tu sesión ya iniciada).
- No existe forma de "importar" en bloque a otra cuenta vía API. El re-guardado en la cuenta destino sigue siendo manual, video por video. Esta herramienta organiza y trackea ese proceso, no lo automatiza (automatizar clics de guardado viola los Términos de Servicio de TikTok y puede derivar en suspensión de cuenta).

## Parte 1 — Extraer tus colecciones, agrupadas (`tiktok-collections-scraper.user.js`)

1. Instala la extensión **Tampermonkey** en tu navegador (Chrome, Firefox o Edge).
2. Abre el panel de Tampermonkey → "Crear nuevo script" → pega el contenido de `tiktok-collections-scraper.user.js` → guarda.
3. Entra a `tiktok.com`, ve a tu perfil → **Colecciones**.
4. Abre **cada colección** (una por una) y **haz scroll lento** por todos los videos. El script detecta en qué colección estás (por el nombre que muestra TikTok en pantalla) y agrupa los videos automáticamente bajo ese nombre.
5. El contador flotante abajo a la derecha muestra `N videos · N colecciones` y el nombre de la colección activa. Repite en cada colección — todo se acumula en la misma sesión.
6. Cuando termines, pulsa **"Exportar JSON"**. Se descarga un archivo con esta estructura:
   ```json
   {
     "exportedAt": "...",
     "totalVideos": 84,
     "totalCollections": 5,
     "collections": {
       "Recetas": [ { "id": "...", "title": "...", "url": "...", "author": "..." } ],
       "Tutoriales": [ ... ]
     }
   }
   ```

**Nota sobre el nombre de colección:** se detecta leyendo el título que TikTok muestra en pantalla al abrir cada colección. Si TikTok cambia su diseño y el nombre sale como "Sin clasificar", el video/título/enlace igual queda capturado correctamente (eso no depende del diseño) — solo tendrías que reagrupar manualmente en el CSV/JSON.

## Parte 2 — Organizar el traslado, colección por colección (`index.html`)

1. Sube este repositorio a GitHub y activa **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / raíz).
2. Abre la URL de tu Pages (ej. `https://tuusuario.github.io/tiktok-import-manager/`).
3. Carga el JSON exportado (botón o arrastrar y soltar).
4. Verás un **acordeón por colección**, cada una con su barra de progreso (`X/Y guardados`). Haz clic en el nombre para expandirla.
5. Flujo sugerido por colección:
   - Crea primero una colección con el mismo nombre en la cuenta destino.
   - Ve abriendo cada video (columna "Abrir video") y guárdalo manualmente en esa colección destino.
   - Márcalo con "✓ Marcar" en la app (o usa "▶ Abrir siguiente pendiente" para que te vaya llevando video por video).
   - Cuando termines toda la colección, puedes usar "✓ Toda" para marcarla completa de una vez.
6. Exporta a CSV en cualquier momento como respaldo (incluye columna `coleccion`).

El progreso se guarda solo en `localStorage` de tu navegador — nada se envía a ningún servidor externo.

## Estructura del repo

```
/
├── index.html                        # App de gestión (GitHub Pages)
├── tiktok-collections-scraper.user.js  # Userscript (se instala en Tampermonkey, no en GitHub)
└── README.md
```
