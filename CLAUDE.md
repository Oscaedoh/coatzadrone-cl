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

La landing de **cursos y workshops Pix4D** para `coatzadrone.cl`. Primera pieza del
plan: partir ofreciendo capacitación con fuerza y desde ahí traer leads.

Sitio estático sin build: HTML + CSS + JS plano. Todo el contenido se maneja desde
`data/cursos.json`.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Hosting | Cloudflare (Worker con assets estáticos, no Pages) | Gratis sin límite de tráfico, incluye DNS para `.cl`, SSL y CDN |
| Repositorio | GitHub, deploy automático por push | Sin costo, con historial y rollback |
| Pagos | **Flow.cl** (Mercado Pago en pausa) | Reconocido en Chile y cubre Webpay; link de pago sin backend. El soporte de Mercado Pago sigue en el código, apagado en `MEDIOS_PAGO` |
| Arquitectura | Estático, sin framework | No hay Node instalado en la máquina; cero mantención y cero costo |
| Contenido | Un solo JSON | El dueño debe poder agregar cursos sin tocar código |
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
- **No hay dominio de excepción.** El sitio está completamente fuera de línea.
  Se revisa en local con `scripts/servidor-local.ps1` → <http://localhost:8899>,
  que no expone nada a internet ni necesita DNS.
- Las URLs `*.workers.dev` quedaron desactivadas en el panel: llevaban el nombre
  de la cuenta en la dirección.
- `/api/lead` sigue funcionando en `coatzadrone.cl` pese al mantenimiento.

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

## El catálogo: contenido vs. comercio — 22 de septiembre de 2026

Lo que se vende **no es el curso, es la edición**: una fecha concreta con su
cupo, su precio y su propio link de pago. Un curso puede tener varias al año.

Por eso el catálogo está partido en dos mitades con ritmos distintos:

| | Dónde vive | Cómo se cambia |
|---|---|---|
| Temario, instructor, textos, fotos | `data/cursos.json` | commit + push |
| Precio, fechas, cupos, links de pago | Cloudflare KV | en `/admin`, al instante |

`GET /api/cursos` entrega las dos unidas, con KV mandando por sobre el archivo.
Si el panel nunca se usó o KV no está, sale el archivo tal cual: el sitio nunca
depende de esto para funcionar. El sitio cae al archivo directo si el endpoint
falla, que es también lo que pasa en `localhost:8899`, donde no hay Worker.

El panel solo puede tocar el nombre, las observaciones, `estado`, `precio`,
`pagos` y `cohortes`. Hoy el unico medio de pago habilitado es Flow: ver
`MEDIOS_PAGO` en `worker/catalogo.js`. El contenido largo
va por commit, con historial. Ver `docs/PANEL.md`.

Pendiente — ver `docs/CONFIGURAR.md`:

1. En el panel de Cloudflare: activar **Always Use HTTPS** (la redirección
   `www` → raíz ya quedó creada y funcionando)
2. ~~Cargar el secreto `BREVO_API_KEY`~~ — ✅ hecho, `/api/lead` operativo
3. ~~Lista de novedades del banner~~ — ✅ hecha, es la id 7
4. **Crear el secreto `ADMIN_CLAVE`** en Cloudflare (tipo *Secret*). Sin él el
   panel `/admin` queda cerrado
5. ~~Crear el almacén KV y conectarlo~~ — ✅ hecho, binding `CONFIG`
6. Armar la automatización de los correos 2 al 5 en Brevo
7. Link de pago: **Botón de Pago** en Flow. Ya no va al JSON — se pega en
   `/admin`. Mercado Pago quedó en pausa por decisión del dueño
8. IDs de GA4 y Píxel de Meta, antes de pautar
9. Fecha del primer curso, antes de abrir el cobro
10. Borrar en Brevo el contacto de prueba id 6 y la plantilla rota id 3

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
