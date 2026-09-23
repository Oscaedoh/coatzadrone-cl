# COATZADRONE CHILE — contexto del proyecto

## Qué es la empresa

**CoatzaDrone** es una empresa de soluciones de precisión aérea y geoespacial con
base en Coatzacoalcos, Veracruz (México), con más de 6 años de operación y proyectos
en varios países de Latinoamérica. Sitio corporativo: <https://coatzadrone.com>

**CoatzaDrone Chile** es la filial chilena, propiedad del usuario de este proyecto
junto con el fundador original mexicano. Existe también **CoatzaDrone Perú**, del
mismo socio con otros participantes.

Historial de operaciones en Chile: un par de proyectos de captación de imágenes en
plantas de paneles solares en el norte, contratados por empresas europeas, con la
operación de vuelo tercerizada a una empresa local. Fuera de eso, la filial no ha
tenido actividad. El objetivo actual es activarla replicando lo que ya funciona en
México y Perú.

## Credencial clave

CoatzaDrone figura como **Centro de Entrenamiento Oficial Pix4D para Chile** en el
[directorio mundial de Pix4D](https://training.pix4d.com/pages/locate-a-pix4d-trusted-training-center).
Instructores listados para Chile: Adam Franklin (PIX4Dmatic, PIX4Dcloud, PIX4Dcatch),
Alen Arturo Dioses Avellaneda (PIX4Dcloud) y Arturo Salaises (PIX4Dfields).

Es el principal diferenciador comercial y debe estar visible y verificable en toda
comunicación.

## Qué es este repositorio

El sitio de **cursos y workshops Pix4D** para `coatzadrone.cl`. Primera pieza del
plan: partir ofreciendo capacitación con fuerza y desde ahí traer leads.

Sin build: HTML + CSS + JS plano, servido por un Worker de Cloudflare. Los cursos
y los instructores se administran en el panel `/admin` y se guardan en KV.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Hosting | Cloudflare (Worker con assets estáticos, no Pages) | Gratis sin límite de tráfico, incluye DNS para `.cl`, SSL y CDN |
| Repositorio | GitHub, deploy automático por push | Sin costo, con historial y rollback |
| Pagos | **Flow.cl** (Mercado Pago en pausa) | Reconocido en Chile y cubre Webpay; link de pago sin backend. El soporte de Mercado Pago sigue en el código, apagado en `MEDIOS_PAGO` |
| Arquitectura | Estático, sin framework | No hay Node instalado en la máquina; cero mantención y cero costo |
| Contenido | Panel `/admin` + Cloudflare KV | El dueño agrega, edita y quita cursos como en una tienda, sin tocar código ni esperar deploy |
| Páginas | Una landing por curso en `/cursos/<id>` | Destino de los anuncios de Meta; título, descripción e imagen propios al compartir |
| Idioma | Solo español | Alcance definido para la primera entrega |

## Entorno de la máquina

- Windows 10, PowerShell + Git Bash
- **git disponible**; **no hay Node, npm, gh CLI ni Python**
- Por eso el sitio no usa build y el servidor local es un script de PowerShell
  (`scripts/servidor-local.ps1`, puerto 8899)

## ⚠️ Estado actual — 22 de septiembre de 2026: EN MANTENIMIENTO

**`coatzadrone.cl` no está publicado.** Por decisión del dueño, mientras se
rehace el flujo de conversión el sitio público muestra una página de aviso con la
gráfica de la marca, WhatsApp, correo y el enlace al directorio de Pix4D.

- Responde **HTTP 503**, no 200. Es deliberado: le dice a Google que la caída es
  temporal. Un 200 arriesga que indexe el aviso como si fuera el sitio.
- **No hay dominio de excepción.** El dueño ve el sitio real con la **vista
  previa**: al entrar al panel recibe una cookie firmada con `ADMIN_CLAVE`
  (`worker/vista.js`) que le deja navegar coatzadrone.cl por 8 horas, con una
  etiqueta roja que lo recuerda. También abre cursos ocultos.
- En local: `scripts/servidor-local.ps1` → <http://localhost:8899>. La página de
  un curso es `index.html?curso=<id>`. Muestra el catálogo inicial del JSON, no el
  de KV.
- Las URLs `*.workers.dev` quedaron desactivadas en el panel: llevaban el nombre
  de la cuenta en la dirección.
- Siguen funcionando pese al mantenimiento: `/api/lead`, `/api/cursos`,
  `/media/*`, `/admin` y `/api/admin/*`. Los archivos estáticos (`/assets/*`,
  `/data/cursos.json`, `/robots.txt`) también responden: no pasan por el Worker
  y ya son públicos en GitHub. El aviso cubre las páginas.

**Para volver a publicarlo**, cualquiera de los dos:

1. En `worker/index.js`, `MANTENIMIENTO = false`, commit y push
2. Sin tocar código: en Cloudflare → `coatzadrone-cl` → *Settings* → *Variables
   and Secrets*, crear la variable **`SITIO_PUBLICO`** con valor **`1`**. Manda por
   sobre la constante y no necesita deploy.

## Lo que ya estaba resuelto al 21 de septiembre de 2026

(Publicado y en vivo hasta el mantenimiento descrito arriba.)

- **Sitio en producción: <https://coatzadrone.cl>**
- Repositorio: <https://github.com/Oscaedoh/coatzadrone-cl> (público, rama `main`)
- Deploy: cada `git push` a `main` republica el Worker automáticamente
- Dominio registrado **directo en NIC.cl**, delegado a Cloudflare
  (`bart.ns.cloudflare.com` / `hope.ns.cloudflare.com`)

Resuelto:

- WhatsApp real: +56 9 5704 2650
- Precio del workshop Pix4Dfields: **$275.000 CLP fijo, sin preventa** (decisión del dueño)
- Calendario en "Por anunciar", captando leads con prioridad de cupo
- Correo `contacto@coatzadrone.cl` **operativo**: recibe por Cloudflare Email Routing
  (reenvío a `coatzachile@gmail.com`) y envía desde Gmail vía SMTP de Brevo
- Brevo montado: remitente verificado, dominio autenticado (DKIM + DMARC), listas
  `Leads - Cursos Pix4D` y `Alumnos`, 7 atributos propios y la secuencia de bienvenida
  de 5 plantillas

## El catálogo — 22 de septiembre de 2026

Los cursos son **productos** que el dueño administra completos en `/admin`, como
en una tienda: textos, imagen, temario, instructores, fechas, precio y link de
pago. Los instructores son una lista aparte que los cursos referencian por id.

Lo que se **compra** no es el curso sino la **edición**: una fecha con su cupo,
su precio y su link de pago. Desde el 22 de septiembre el panel no tiene precio
ni link a nivel de curso: todo lo comercial se edita en cada edición.

- Una edición es una lista de días de clase: `sesiones` (fechas ISO, la primera
  es el inicio); `inicio` y `fin` se derivan de ella en `limpiarCohorte()`.
- Sin horario: se quitó del panel. El `.ics` sale como días completos (no se
  inventa una hora). `cupos_disponibles` también se quitó; `cupos_totales` en 0
  hace que la página no hable de cupos.
- El sitio aún lee `precio`/`pagos`/`observaciones` del curso como respaldo: el
  panel los migra a las ediciones al cargar y solo los conserva en un curso sin
  ediciones, avisándolo en el bloque *Fechas*.

Dónde vive cada cosa:

| | Dónde | Cómo se cambia |
|---|---|---|
| Cursos e instructores | KV, clave `catalogo` | panel `/admin` |
| Imágenes subidas | KV, claves `media:<id>`, servidas en `/media/<id>` | panel |
| `config` (contacto, analítica) y `faq` | `data/cursos.json` | commit + push |
| Catálogo inicial de respaldo | `data/cursos.json` (`cursos`, `instructores`) | solo se usa si KV nunca se guardó o falla |

- La clave vieja `comercio` (panel anterior) solo se lee para migrar, mientras
  no exista `catalogo`. El primer guardado del panel nuevo la deja obsoleta.
- Todo lo que entra por el panel se valida en `limpiarCatalogo()`. Imágenes: solo
  `/media/...` o `assets/img/...`; subidas: el tipo se decide por los bytes, SVG
  rechazado. Links: solo `https://`.
- `MEDIOS_PAGO` en `worker/catalogo.js` decide qué pasarelas existen. Hoy solo
  `flow`; los links de medios apagados se borran también **al leer**.
- Cambiar la dirección de un curso guarda la vieja en `alias` y responde 301 a
  la nueva, conservando los UTM de los anuncios.
- Guardar con datos viejos (otra pestaña) responde 409 en vez de pisar.
- Las imágenes huérfanas se borran al guardar, con 1 hora de gracia.

## Las páginas

`index.html` es **una sola plantilla** para la portada (`/`) y la landing de cada
curso (`/cursos/<id>`). Lo exclusivo de cada una lleva `data-solo="inicio"` o
`data-solo="curso"`; `worker/paginas.js` quita lo que no corresponde con
HTMLRewriter, reescribe título/descripción/og:image/canonical del curso (Meta y
WhatsApp no ejecutan JS) e incrusta el catálogo en `<script id="catalogo-datos">`.

- Portada: tarjetas de cursos, «Próximo workshop» elegido solo (fecha más
  cercana con cupo; sin fechas, el primer curso del orden del panel),
  calendario agrupado por curso, «Hablemos», preguntas.
- Landing de curso: portada con precio y botón de pago sin bajar, «Sobre el
  curso» con caja de precio, temario, por qué tomarlo, instructores, fechas,
  requisitos, formulario con el curso elegido. En celular, barra fija de compra.
  Sin banner de novedades.
- Todas las rutas de assets son absolutas (`/assets/...`): la plantilla se sirve
  también bajo `/cursos/`.
- `/sitemap.xml` lo genera el Worker con los cursos publicados.

Ver `docs/PANEL.md`.

## El Worker y su protección — 23 de septiembre de 2026

- **`run_worker_first` es una lista de rutas** en `wrangler.jsonc`, no `true`.
  Solo pasan por el Worker las páginas, `/api/*`, `/admin*`, `/media/*` y
  `/sitemap.xml`; los estáticos los entrega Cloudflare gratis y sin contar para
  las 100.000 solicitudes diarias. **Una ruta nueva del Worker hay que agregarla
  a esa lista**, o nunca se ejecuta.
- `worker/proteccion.js`: límite de intentos por IP (binding `ratelimits`:
  formulario 5/min, panel 20/min), chequeo de `Origin` en `/api/lead`, Turnstile
  opcional, cabeceras de seguridad con HSTS de 30 días en toda respuesta del
  Worker (las mismas que `_headers` pone a los estáticos: cambiar las dos) y
  `registrar()`.
- **Registro:** Workers Logs (*Observability*) con `invocation_logs: false`,
  porque las cabeceras de cada visita al panel llevan la clave. Solo se guarda lo
  que el código registra, con un campo `evento`. Nunca correos, nombres ni claves.
- Turnstile queda activo solo con las dos piezas: `config.turnstile_sitekey` en
  `data/cursos.json` (pública) y el secreto `TURNSTILE_SECRET`. Ver
  `docs/FORMULARIO.md`.
- Los correos de un lead salen con `ctx.waitUntil`: el formulario confirma apenas
  Brevo guarda el contacto.
- El MCP de Cloudflare ve Workers y KV, no la configuración del dominio (SSL,
  WAF, DNS, secretos). Eso se revisa desde afuera con curl y nslookup.

Pendiente — ver `docs/CONFIGURAR.md`:

1. ~~Always Use HTTPS~~ — ✅ `http://` ya redirige a `https://`. Tras el
   lanzamiento, subir HSTS a un año (`31536000`) en `worker/proteccion.js` y
   `_headers`
2. ~~Cargar el secreto `BREVO_API_KEY`~~ — ✅ hecho, `/api/lead` operativo
3. ~~Lista de novedades del banner~~ — ✅ hecha, es la id 7
4. ~~Secreto `ADMIN_CLAVE`~~ — ✅ creado, el panel pide clave
5. ~~Crear el almacén KV y conectarlo~~ — ✅ hecho, binding `CONFIG`
6. Armar la automatización de los correos 2 al 5 en Brevo
7. Links de pago de Flow: ✅ Pix4Dfields tiene el suyo. Falta uno por cada curso
   que se abra a la venta. Mercado Pago en pausa por decisión del dueño
8. IDs de GA4 y Píxel de Meta, antes de pautar
9. ~~Fecha del primer curso~~ — ✅ Pix4Dfields: 31 oct, 7 y 14 nov de 2026
10. Borrar en Brevo el contacto de prueba id 6 y la plantilla rota id 3
11. Opcional: activar Turnstile (widget en Cloudflare + secreto `TURNSTILE_SECRET`)
12. En unas semanas, con los reportes de DMARC limpios, pasar `_dmarc` de
    `p=none` a `p=quarantine`

## Siguientes etapas previstas

1. Publicar la landing y conectar `coatzadrone.cl`
2. Campañas de publicidad para captar leads del workshop de Pix4Dfields
3. Sitio corporativo completo (servicios, industrias, portafolio), espejo de
   coatzadrone.com adaptado a Chile

## Convenciones

- Todo el contenido de cara al público va en **español de Chile**
- El código (variables, funciones, comentarios) también está en español, para que
  el dueño pueda leerlo
- Gráfica corporativa heredada de coatzadrone.com: Teko + Mukta, rojo `#DD3330`,
  fondos oscuros. No inventar colores ni tipografías nuevas.
- Nunca publicar precios, fechas ni datos de contacto inventados: si el dato no
  está confirmado, el sitio debe degradar a "Consultar" o "Por confirmar"
- **Sin escapes `\uXXXX` en el código fuente.** Las herramientas de edición los
  convierten en el carácter real, y U+2028/U+2029 son saltos de línea que rompen
  el JavaScript. Usar `String.fromCharCode(...)` o clases como `\p{M}` con la
  bandera `u`
- `index.html` es plantilla compartida: una sección nueva exclusiva de una página
  lleva `data-solo`; si no, aparece en las dos
