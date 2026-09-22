# El panel comercial — `/admin`

Para cambiar precios, fechas y links de pago sin tocar código ni esperar un
deploy.

<https://coatzadrone.cl/admin>

---

## La idea de fondo: lo que se vende es la fecha

Un curso no es un producto. El producto es la **edición**:

> *Pix4Dfields, del 10 al 12 de noviembre, 12 cupos, $275.000, este link de pago.*

El mismo curso puede tener tres ediciones al año, cada una con su fecha, su cupo,
su precio y su propio botón de pago. Por eso todo lo comercial vive en la edición
y no en el curso.

Eso separa el proyecto en dos mitades que cambian a ritmos distintos:

| | Dónde vive | Quién lo cambia | Cada cuánto |
|---|---|---|---|
| Temario, instructor, textos, fotos | `data/cursos.json`, en el repositorio | con un commit | rara vez |
| **Precio, fechas, cupos, links de pago** | **el panel** | **tú, en el navegador** | **seguido** |

La página pide `/api/cursos`, que entrega las dos mitades unidas. Si el panel
nunca se usó, sale el archivo tal cual: **nada se rompe por no tocarlo**.

---

## Lo que falta para que guarde

Son dos cosas en el panel de Cloudflare. Mientras no estén, el panel abre, deja
editar y muestra el resultado para copiar, pero el botón de guardar no publica.

### 1. La clave de acceso

*Workers & Pages* → `coatzadrone-cl` → *Settings* → *Variables and Secrets* → **Add**

| Campo | Valor |
|---|---|
| Type | **Secret** |
| Variable name | `ADMIN_CLAVE` |
| Value | la clave que elijas |

**Deploy** para que tome efecto.

> Que sea larga y que no la uses en ningún otro lado. Esta clave abre los precios
> de tu sitio: quien entre puede poner un curso en $1.
>
> Sin este secreto el panel queda **cerrado**, no abierto. Es a propósito: un
> panel sin clave configurada que dejara entrar sería peor que no tenerlo.

### 2. El almacén

*Storage & Databases* → *KV* → **Create** → nombre `coatzadrone-comercio`

Eso entrega un **id**. Pásamelo y lo conecto: hay que descomentar tres líneas en
`wrangler.jsonc` y hacer push. El id no es un secreto —solo identifica el
almacén, y sin tu cuenta no sirve de nada—, así que puede ir al repositorio.

---

## Cómo se usa

Entras, escribes la clave y ves cada curso con tres bloques.

**Estado del curso.** *Inscripciones abiertas* o *Próximamente*. Cambia la
etiqueta de la tarjeta y si el botón invita a comprar o a dejar datos.

**Precio y links generales.** El valor por defecto del curso. Se usa cuando una
edición no define el suyo, así que sirve para no repetir lo mismo en cada fecha.

**Fechas a la venta.** Una tarjeta por edición. *Agregar una fecha* crea otra.
Cada una tiene:

- primer y último día, y horario
- cupos totales y disponibles
- estado: *Abierta*, *Últimos cupos*, *Agotada* u *Oculta*
- su propio precio y sus propios links de pago

> Si dejas el precio o los links de una edición vacíos, hereda los generales del
> curso. Solo los llenas cuando esa fecha vale distinto.

*Guardar y publicar* lo deja online al instante. No hay deploy de por medio.

---

## Qué hace cada cosa en la página

| En el panel | En la página |
|---|---|
| Cargas un link de pago | El botón deja de ir al formulario y lleva directo al checkout |
| Dejas los links vacíos | El botón baja al formulario de contacto, como antes |
| Pones precio de preventa y una fecha tope | Se muestra el precio rebajado, y **vuelve solo al normal** al pasar esa fecha |
| Marcas una edición *Agotada* | Desaparecen los botones de pago y queda *Avísenme de la próxima* |
| Marcas una edición *Oculta* | Deja de aparecer, sin borrarla |
| Agregas una fecha | Sale en el calendario, con su `.ics` y su enlace a Google Calendar |

La preventa venciendo sola es el detalle que más se agradece: sin eso, un
descuento de lanzamiento se queda puesto para siempre porque nadie se acuerda de
sacarlo.

---

## Lo que el panel no deja hacer

Por diseño solo puede tocar `estado`, `precio`, `pagos` y las fechas. **No** puede
cambiar el temario, el instructor ni los textos: eso va por commit, con historial,
porque es contenido que se redacta y se revisa, no un número que se ajusta.

Todo lo que entra se valida antes de guardarse:

- los links de pago tienen que empezar con `https://` — así un enlace raro no
  puede terminar nunca en el botón de comprar
- una fecha sin día de inicio se descarta: sin fecha no hay producto
- los montos se guardan como números enteros, y los estados solo aceptan los
  valores de la lista

---

## Seguridad

- La clave se compara **en tiempo constante**. Una comparación normal corta apenas
  encuentra una letra distinta, y esa diferencia de microsegundos deja adivinarla
  carácter por carácter.
- Cada intento fallido espera 600 ms antes de responder. Probar claves a ciegas
  pasa a tomar años.
- El panel responde `noindex` y no está enlazado desde ninguna parte del sitio.
  **No lo agregamos a `robots.txt` a propósito**: ese archivo es público y
  listarlo ahí sería un cartel diciendo dónde está la puerta.
- La clave queda en `sessionStorage`: se borra al cerrar la pestaña.

---

## Si algo falla

| Qué ves | Qué pasa |
|---|---|
| «El panel todavía no tiene clave configurada» | Falta el secreto `ADMIN_CLAVE` |
| «Falta crear el almacén» al guardar | Falta el KV, o falta conectar su id |
| «Clave incorrecta» | Eso mismo. No hay recuperación: se cambia el secreto en Cloudflare |
| La página no refleja un cambio | Recarga con Ctrl+F5. `/api/cursos` no se cachea, pero el navegador sí puede guardar la página |

Ver también [PAGOS.md](PAGOS.md) para crear los links de pago, y
[GUIA-AGREGAR-CURSOS.md](GUIA-AGREGAR-CURSOS.md) para el contenido de un curso nuevo.
