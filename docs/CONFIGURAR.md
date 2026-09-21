# Datos que faltan antes de salir al aire

Todo se edita en **un solo archivo**: `data/cursos.json`.
Ábrelo con el Bloc de notas, VS Code o directamente en GitHub desde el navegador.

> El sitio funciona hoy sin estos datos: muestra "Consultar" en el precio y deriva las
> inscripciones a WhatsApp. Pero para hacer publicidad conviene completarlos todos.

---

## 1. Teléfono de WhatsApp — **obligatorio**

Hoy está el número de ejemplo `56900000000`. Todos los botones de WhatsApp apuntan ahí.

```json
"config": {
  "whatsapp": "56912345678",
```

Formato: código de país + número, **sin** el signo `+`, sin espacios ni guiones.
Chile es `56` y el móvil parte con `9`. Ejemplo: +56 9 1234 5678 → `56912345678`.

---

## 2. Correo de contacto — **obligatorio**

```json
  "email": "contacto@coatzadrone.cl",
```

Si aún no tienes correo del dominio `.cl`, usa uno que revises a diario. Se puede
cambiar después en 10 segundos.

---

## 3. Precio en pesos chilenos — **obligatorio para publicidad**

Mientras `clp` esté en `null`, el sitio muestra **"Consultar"**. Es honesto y sirve
para captar leads, pero convierte mejor con precio visible.

```json
"precio": {
  "clp": 249000,
  "clp_early": 199000,
  "early_hasta": "2026-10-10",
  "usd": 180
}
```

- `clp` — valor general.
- `clp_early` — valor preventa. Si lo llenas, el sitio muestra el precio preventa
  destacado y el general tachado como referencia. Déjalo en `null` si no hay preventa.
- `early_hasta` — hasta cuándo rige la preventa, formato `AAAA-MM-DD`.
- `usd` — referencia para alumnos fuera de Chile.

**Referencia:** en México el curso se cobra $3.000 MXN / USD $180.

---

## 4. Fechas confirmadas del curso

Hoy hay una cohorte de ejemplo marcada como **fecha referencial** (se muestra ese
aviso en el sitio). Al confirmar, cambia `confirmada` a `true` y ajusta las fechas:

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

## 5. Formulario de inscripción

Hoy, al enviar el formulario, se abre WhatsApp con los datos precargados. Funciona,
pero no te deja registro ordenado de los leads.

Para recibirlos por correo, crea una cuenta gratuita en **[Formspree](https://formspree.io)**
(50 envíos al mes gratis), copia el ID del formulario y pégalo:

```json
  "formulario_endpoint": "https://formspree.io/f/xdorkpqz",
```

Alternativa igual de buena y con más envíos gratis: **[Web3Forms](https://web3forms.com)**
(250/mes). Usa la misma línea, cambiando la URL.

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
