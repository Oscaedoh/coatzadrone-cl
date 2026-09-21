# COATZADRONE CHILE — Landing de Cursos y Workshops Pix4D

Sitio estático para **coatzadrone.cl**, enfocado en captar inscripciones y leads para los
cursos y workshops oficiales Pix4D que dicta CoatzaDrone Chile.

CoatzaDrone figura como **Centro de Entrenamiento Oficial Pix4D para Chile** en el
[directorio mundial de Pix4D](https://training.pix4d.com/pages/locate-a-pix4d-trusted-training-center).

---

## Qué hay aquí

```
.
├── index.html              Landing completa (una sola página)
├── data/
│   └── cursos.json         ← TODO el contenido vive acá. Agregar cursos = editar este archivo
├── assets/
│   ├── css/styles.css      Sistema de diseño (gráfica corporativa CoatzaDrone)
│   ├── js/app.js           Render dinámico, formulario, calendario .ics, analítica
│   └── img/                Logo, favicon e imágenes corporativas
├── _headers                Cabeceras y caché para Cloudflare Pages
├── robots.txt / sitemap.xml
└── docs/                   Guías operativas (leer CONFIGURAR.md primero)
```

**No hay build.** Es HTML, CSS y JavaScript plano. Se publica tal cual.
Sin Node, sin dependencias, sin costos de mantención.

---

## Antes de publicar

Lee **[docs/CONFIGURAR.md](docs/CONFIGURAR.md)**. Hay 7 datos que faltan (teléfono,
precio en CLP, fechas confirmadas, endpoint del formulario, IDs de analítica y links
de pago). Todos se editan en un solo archivo: `data/cursos.json`.

---

## Ver el sitio en tu computador

El sitio necesita servirse por HTTP (no basta con abrir `index.html` con doble clic,
porque el navegador bloquea la lectura de `data/cursos.json` desde `file://`).

Con PowerShell, desde la carpeta del proyecto:

```bash
powershell -ExecutionPolicy Bypass -File scripts/servidor-local.ps1
```

Luego abre <http://localhost:8899>.

---

## Publicar cambios

El sitio está conectado a Cloudflare Pages. Cada `git push` a la rama `main`
publica automáticamente en **coatzadrone.cl** en menos de un minuto.

```bash
git add .
git commit -m "Actualiza fechas del workshop de noviembre"
git push
```

Ver **[docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md)** para la configuración inicial.

---

## Guías

| Documento | Para qué |
|---|---|
| [docs/CONFIGURAR.md](docs/CONFIGURAR.md) | Los datos que faltan antes de salir al aire |
| [docs/GUIA-AGREGAR-CURSOS.md](docs/GUIA-AGREGAR-CURSOS.md) | Agregar o editar un curso paso a paso |
| [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md) | GitHub + Cloudflare Pages + dominio .cl |
| [docs/PAGOS.md](docs/PAGOS.md) | Mercado Pago y Flow: activación y links de pago |
| [docs/PUBLICIDAD.md](docs/PUBLICIDAD.md) | Medición de leads y preparación de campañas |
