# COATZADRONE CHILE — Cursos y Workshops Pix4D

Sitio de **coatzadrone.cl**: el catálogo de cursos y workshops oficiales Pix4D que
dicta CoatzaDrone Chile, con una página por curso para vender y captar leads.

CoatzaDrone figura como **Centro de Entrenamiento Oficial Pix4D para Chile** en el
[directorio mundial de Pix4D](https://training.pix4d.com/pages/locate-a-pix4d-trusted-training-center).

---

## Cómo se administra

**Los cursos se manejan desde el panel:** <https://coatzadrone.cl/admin>

Ahí se crean, editan, ocultan y eliminan cursos con todo su contenido —textos,
imagen, temario, instructores, fechas, precios y link de pago—, y se administran
los instructores. Se publica al guardar, sin tocar código. Ver
**[docs/PANEL.md](docs/PANEL.md)**.

---

## Qué hay aquí

```
.
├── index.html              Plantilla única: la portada y la página de cada curso
├── admin/                  El panel comercial (interfaz)
├── assets/
│   ├── css/styles.css      Sistema de diseño (gráfica corporativa CoatzaDrone)
│   ├── js/app.js           Arma las páginas con el catálogo, formularios, analítica
│   └── img/                Logo, favicon e imágenes corporativas
├── data/cursos.json        Contacto, analítica y preguntas frecuentes, más el
│                           catálogo inicial de respaldo
├── worker/                 El servidor (Cloudflare Worker)
│   ├── index.js            Rutas, mantenimiento y captación de leads (Brevo)
│   ├── catalogo.js         El catálogo: lectura, validación y migración
│   ├── paginas.js          Arma la portada y cada /cursos/<curso>, y el sitemap
│   ├── admin.js            La API del panel
│   ├── media.js            Imágenes subidas desde el panel
│   └── vista.js            Vista previa para el dueño durante el mantenimiento
├── wrangler.jsonc          Configuración del Worker y del almacén KV
└── docs/                   Guías operativas
```

**No hay build.** Es HTML, CSS y JavaScript plano. El Worker lo empaqueta
Cloudflare al publicar.

---

## Las páginas

| Dirección | Qué es |
|---|---|
| `/` | Portada: cursos, próximo workshop, calendario, contacto y preguntas |
| `/cursos/<curso>` | Página de un curso. **Es a donde apuntan los anuncios** |
| `/admin` | El panel comercial |

Las dos primeras salen de la misma plantilla, `index.html`: las secciones de cada
una están marcadas con `data-solo`, y el servidor quita las que no corresponden.

---

## Ver el sitio

**Con el sitio en mantenimiento**, entra al panel: tu navegador queda habilitado
para ver el sitio real en coatzadrone.cl por 8 horas, mientras el público sigue
viendo el aviso.

**En tu computador**, sin internet de por medio:

```bash
powershell -ExecutionPolicy Bypass -File scripts/servidor-local.ps1
```

Luego abre <http://localhost:8899>. La página de un curso se abre como
`http://localhost:8899/index.html?curso=<curso>`. En local se ve el catálogo
inicial de `data/cursos.json`, no el del panel.

---

## Publicar cambios de código

Cada `git push` a `main` republica el sitio en menos de dos minutos. Los cambios
de cursos **no** necesitan esto: se publican desde el panel.

Ver **[docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md)** para la configuración inicial.

---

## Guías

| Documento | Para qué |
|---|---|
| [docs/PANEL.md](docs/PANEL.md) | El panel: cursos, fechas, precios e instructores |
| [docs/CONFIGURAR.md](docs/CONFIGURAR.md) | Lo que falta antes de salir al aire |
| [docs/PAGOS.md](docs/PAGOS.md) | Flow: activación y botón de pago |
| [docs/FORMULARIO.md](docs/FORMULARIO.md) | Captación de leads con Brevo |
| [docs/PUBLICIDAD.md](docs/PUBLICIDAD.md) | Medición y campañas |
| [docs/GUIA-AGREGAR-CURSOS.md](docs/GUIA-AGREGAR-CURSOS.md) | Qué queda en `data/cursos.json` |
| [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md) | GitHub + Cloudflare + dominio .cl |
