# Datos que faltan antes de salir al aire

Todo se edita en **un solo archivo**: `data/cursos.json`.
Ábrelo con el Bloc de notas, VS Code o directamente en GitHub desde el navegador.

## Estado al 21 de septiembre de 2026

| # | Dato | Estado |
|---|---|---|
| 1 | Teléfono de WhatsApp | ✅ +56 9 5704 2650 |
| 2 | Correo de contacto | ✅ `contacto@coatzadrone.cl` recibe y envía |
| 3 | Precio en CLP | ✅ $275.000 fijo, sin preventa |
| 4 | Fechas del curso | ✅ deliberadamente en "Por anunciar" |
| 5 | Formulario a Brevo | ⚠️ falta el secreto `BREVO_API_KEY` |
| 6 | GA4 y Píxel de Meta | ❌ pendiente, necesario antes de pautar |
| 7 | Links de pago | ❌ Flow en creación |

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

Definido: **$275.000 CLP fijo, sin preventa.**

```json
"precio": {
  "clp": 275000,
  "clp_early": null,
  "early_hasta": null,
  "usd": null
}
```

Si más adelante quieres hacer una preventa real:

- `clp` — valor general.
- `clp_early` — valor preventa. Al llenarlo, el sitio muestra el precio preventa
  destacado y el general como referencia.
- `early_hasta` — hasta cuándo rige, formato `AAAA-MM-DD`.

> **Ojo con los descuentos.** Mostrar un "precio normal" que nunca se cobró es
> publicidad engañosa bajo la Ley 19.496 y SERNAC ha multado por eso. El precio de
> referencia debe haber sido el cobrado efectivamente antes. Una preventa que
> realmente sube de precio al vencer sí es válida.

---

## 4. Fechas del curso — ✅ por ahora, "Por anunciar"

Decisión actual: sin fecha fija. `"cohortes": []` hace que la sección de calendario
muestre "Por anunciar" y capte leads con prioridad de cupo.

Cuando tengas la fecha, agrega la cohorte dentro del arreglo:

```json
"cohortes": [
  {
    "id": "cohorte-oct-2026",
    "confirmada": true,
    "etiqueta": "Octubre 2026",
    "inicio": "2026-10-20",
    "fin": "2026-10-22",
    "horario": "18:00 a 22:00 h (hora de Chile)",
    "sesiones": ["Martes 20 de octubre", "Miércoles 21 de octubre", "Jueves 22 de octubre"],
    "cupos_totales": 15,
    "cupos_disponibles": 15,
    "estado": "abierto"
  }
]
```

El sitio genera solo los botones **Descargar .ics** y **Google Calendar** a partir de
estas fechas. No hay que crear nada a mano.

Para cerrar una cohorte llena: cambia `"estado": "cerrado"` y desaparece de la web.

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

```json
"pagos": {
  "mercadopago_url": "https://mpago.la/xxxxx",
  "flow_url": "https://www.flow.cl/btn.php?token=xxxxx",
  "paypal_url": "",
  "transferencia": true
}
```

Ver [PAGOS.md](PAGOS.md) para cómo generar cada link.

---

## Verificación final

Antes de anunciar el sitio, revisa en <https://coatzadrone.cl>:

- [ ] El botón de WhatsApp abre un chat con el número correcto
- [ ] El precio se ve como esperas
- [ ] Las fechas del calendario son las definitivas
- [ ] Enviar el formulario de prueba llega a tu correo
- [ ] El link "Verificar en Pix4D.com" abre el directorio oficial
- [ ] Se ve bien en tu teléfono
