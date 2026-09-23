# Datos que faltan antes de salir al aire

Los **cursos, fechas, precios, links de pago e instructores** se editan en el panel
<https://coatzadrone.cl/admin> — ver [PANEL.md](PANEL.md).

Lo que sigue en `data/cursos.json` es poco y cambia rara vez: los datos de
contacto, los ids de analítica (`config`) y las preguntas frecuentes (`faq`).

## Estado al 23 de septiembre de 2026

| # | Dato | Estado |
|---|---|---|
| 1 | Teléfono de WhatsApp | ✅ +56 9 5704 2650 |
| 2 | Correo de contacto | ✅ `contacto@coatzadrone.cl` recibe y envía |
| 3 | Precio en CLP | ✅ $275.000, en la edición del panel |
| 4 | Fechas del curso | ✅ Pix4Dfields: 31 oct, 7 y 14 nov |
| 5 | Formulario a Brevo | ✅ operativo |
| 6 | GA4 y Píxel de Meta | ❌ pendiente, necesario antes de pautar |
| 7 | Links de pago | ✅ Pix4Dfields en Flow; falta uno por curso que se abra |
| 8 | Verificación anti-robots (Turnstile) | ✅ Site Key cargada; el secreto `TURNSTILE_SECRET` va en Cloudflare |

---

## 1. Teléfono de WhatsApp — ✅ listo

```json
"config": {
  "whatsapp": "56957042650",
```

Formato: código de país + número, **sin** el signo `+`, sin espacios ni guiones.
Chile es `56` y el móvil parte con `9`. Ejemplo: +56 9 1234 5678 → `56912345678`.

---

## 2. Correo de contacto — ✅ operativo

```json
  "email": "contacto@coatzadrone.cl",
```

La casilla funciona en los dos sentidos:

- **Recibe** por **Cloudflare Email Routing**, que reenvía todo a `coatzachile@gmail.com`.
- **Envía** desde ese mismo Gmail, con *Cuentas e importación → Enviar como*, usando el
  relay SMTP de Brevo (`smtp-relay.brevo.com`, puerto 587, TLS).

> Para que Gmail pudiera autenticarse hubo que **desactivar "Bloquear direcciones IP
> desconocidas"** en Brevo (*tu cuenta → Seguridad → IPs autorizadas*). Gmail envía desde
> los servidores de Google, cuyas IP rotan, así que la lista blanca es incompatible con
> este flujo. Síntoma si alguien vuelve a activarlo: `525 5.7.1 Unauthorized IP address`.

La clave SMTP **no va en este repositorio** — es pública. Vive solo en la configuración
de Gmail; si se filtra, se revoca y se genera otra en Brevo → *SMTP & API → SMTP*.

---

## 3. Precio en pesos chilenos — ✅ listo

Definido para Pix4Dfields: **$275.000 CLP.**

El precio es de cada **edición** y se edita en el panel, en el bloque *Fechas* del
curso: *Valor*, y si quieres una rebaja por tiempo limitado, *Precio rebajado* y
*Precio rebajado hasta*. Pasada esa fecha, la página vuelve sola al valor.
Ver [PANEL.md](PANEL.md#ediciones-precios-y-pago).

> **Ojo con los descuentos.** Mostrar un "precio normal" que nunca se cobró es
> publicidad engañosa bajo la Ley 19.496 y SERNAC ha multado por eso. El valor de
> referencia debe haber sido el cobrado efectivamente antes. Una rebaja que
> realmente termina y vuelve al valor sí es válida.

---

## 4. Fechas del curso

Se cargan en el panel, en el bloque *Fechas* del curso: una edición por cada
versión, con su fecha de inicio y el número de sesiones (cada sesión con su
fecha). Un curso sin ediciones muestra "Por anunciar" y capta leads con
prioridad de cupo.

El sitio genera solo los botones **Descargar .ics** y **Google Calendar** a partir
de esas fechas. No hay que crear nada a mano.

Para cerrar una edición llena: estado **Agotada**. Para sacarla sin borrarla:
**Oculta**.

---

## 5. Formulario de inscripción — ⚠️ falta un paso

El formulario ya no deriva a WhatsApp: envía a `/api/lead`, un endpoint propio
dentro del mismo Worker que publica el sitio, que guarda el lead en Brevo, le manda
el correo de bienvenida y te avisa a `contacto@coatzadrone.cl`.

```json
  "formulario_endpoint": "/api/lead",
```

**Falta cargar la clave de Brevo como secreto en Cloudflare.** Mientras no esté,
el formulario muestra la alternativa de WhatsApp y no guarda nada.

El procedimiento completo, con cómo etiquetar los anuncios y cómo armar la
automatización de los correos 2 al 5, está en **[FORMULARIO.md](FORMULARIO.md)**.

---

## 6. Analítica — necesaria antes de pautar

Sin esto no sabrás qué anuncio trajo qué inscripción.

```json
  "ga4_id": "G-XXXXXXXXXX",
  "meta_pixel_id": "1234567890123456",
```

- `ga4_id` — Google Analytics 4. Gratis. Se obtiene en analytics.google.com.
- `meta_pixel_id` — Píxel de Meta, para campañas de Facebook e Instagram.
  Se obtiene en business.facebook.com → Administrador de eventos.

Déjalos en `""` si aún no los tienes: el sitio simplemente no carga esos scripts.

Ver [PUBLICIDAD.md](PUBLICIDAD.md) para el detalle de los eventos que ya están medidos.

---

## 7. Links de pago

Se pegan en el panel, en cada edición del curso (*Link de pago*). Ver
[PAGOS.md](PAGOS.md) para cómo generar el botón en Flow.

---

## Verificación final

Antes de anunciar el sitio, revisa en <https://coatzadrone.cl>:

- [ ] El botón de WhatsApp abre un chat con el número correcto
- [ ] El precio se ve como esperas
- [ ] Las fechas del calendario son las definitivas
- [ ] Enviar el formulario de prueba llega a tu correo
- [ ] El link "Verificar en Pix4D.com" abre el directorio oficial
- [ ] Se ve bien en tu teléfono
