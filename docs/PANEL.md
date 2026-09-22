# El panel comercial — `/admin`

Donde se administran los cursos y los instructores: todo lo que se muestra de
ellos en el sitio, sin tocar código ni esperar un deploy.

<https://coatzadrone.cl/admin>

---

## Cómo está organizado

Funciona como el panel de una tienda. Arriba, dos pestañas:

| Pestaña | Qué hay |
|---|---|
| **Cursos** | El listado de productos: foto, nombre, visibilidad, próxima fecha y precio. Clic en uno para abrir su ficha |
| **Instructores** | Quiénes dictan los cursos, con foto, biografía y enlaces para verificar su certificación |

Todo lo que cambias queda en borrador en la pantalla hasta que pulsas **Guardar y
publicar** (o `Ctrl+S`). La barra de abajo avisa en amarillo cuando hay cambios sin
guardar, y el navegador te advierte si intentas cerrar la pestaña con cambios
pendientes.

> Al guardar, el cambio llega a la página en **menos de un minuto**. No es
> instantáneo en todo el mundo: Cloudflare replica los datos a sus servidores y
> eso toma unos segundos.

---

## La ficha de un curso

A la izquierda, el contenido; a la derecha, lo comercial.

**Información** — nombre, subtítulo y resumen. El resumen es el texto de la
tarjeta del curso y también el que muestran Google, Facebook y WhatsApp cuando
alguien comparte el enlace.

**Ficha** — software, nivel, modalidad, duración, idioma.

**Descripción** — el objetivo del programa y el enfoque. Una línea en blanco
separa párrafos.

**Contenido** — a quién está dirigido, qué logras al terminar, qué incluye y por
qué tomarlo. **Una idea por línea.** Los cuatro primeros de «Qué incluye» salen
junto al precio: pon arriba los más convincentes.

**Temario** — un bloque por módulo, con título, objetivo y contenidos. Se pueden
reordenar con las flechas.

**Fechas a la venta** — una tarjeta por edición, con todo lo de esa fecha en una
pasada: días, horario, cupos, estado, valor, preventa, link de pago y
observaciones. Lo que dejes vacío usa lo del curso.

**Requisitos técnicos** — opcional. Si lo dejas vacío, la sección no aparece.

Y a la derecha:

| Bloque | Para qué |
|---|---|
| **Visibilidad** | *Publicado en la página* lo muestra u oculta. El estado dice si las inscripciones están abiertas o próximas |
| **Imagen** | La foto del curso. *Subir imagen* o *Elegir existente* |
| **Precio y pago** | Valor general, preventa, link de pago de Flow y observaciones junto al precio |
| **Instructores** | Quiénes lo dictan. Se marcan de la lista |
| **Dirección de la página** | `coatzadrone.cl/cursos/...` — el enlace para los anuncios |

Arriba de la ficha: **Ver en el sitio**, **Duplicar** y **Eliminar**.

---

## Crear un curso

1. *Cursos* → **+ Nuevo curso**
2. Escribe el nombre. La dirección de la página se arma sola a partir de él
3. Completa lo que tengas. Nada es obligatorio salvo el nombre
4. **Guardar y publicar**

Un curso nuevo nace **oculto**, a propósito: puedes armarlo con calma y revisarlo
en su página real antes de que nadie más lo vea. Cuando esté listo, activa
*Publicado en la página* y guarda.

**Duplicar** sirve para crear uno parecido a otro: copia todo el contenido, pero
no las fechas ni el link de pago, que son de cada producto. Si los copiara,
terminarías con dos cursos cobrando en el mismo botón de Flow.

---

## Sacar un curso de la página

Dos formas, según lo que quieras:

- **Ocultarlo** (desmarcar *Publicado en la página*): desaparece del sitio y su
  dirección deja de funcionar, pero todo queda guardado para volver a
  publicarlo. Es lo que conviene casi siempre
- **Eliminarlo**: se borra definitivamente al guardar

---

## Fechas, precios y pago

Lo que se vende no es el curso: es la **edición**. Una fecha concreta, con su
cupo, su precio y su link de pago. Un curso puede tener varias al año.

| En el panel | En la página |
|---|---|
| Cargas un link de pago | Los botones llevan directo al checkout de Flow |
| Dejas el link vacío | Los botones llevan al formulario de contacto |
| Preventa con fecha tope | Se muestra el precio rebajado y **vuelve solo al normal** al pasar esa fecha |
| Marcas una fecha *Agotada* | Desaparece el botón de pago y queda *Avísenme de la próxima* |
| Marcas una fecha *Oculta* | Deja de aparecer, sin borrarla |
| Un curso sin fechas | Sale como **«Por anunciar»**, con el botón *Avísenme* |

Las fechas que ya terminaron se esconden solas: no hay que borrarlas.

### El «Próximo workshop» de la portada se elige solo

Es la fecha más cercana entre los cursos publicados que todavía tiene cupos. Si
ningún curso tiene fecha, se muestra el primero del listado del panel. Por eso el
**orden del listado importa**: es el orden de la página, y define qué curso se
destaca cuando no hay calendario.

### Medios de pago

Hoy solo **Flow / Webpay**. Mercado Pago y PayPal están apagados: no aparecen en
el panel y, si hubiera un link guardado de esos medios, no sale en la página.
Volver a encender uno es agregar su nombre a `MEDIOS_PAGO` en `worker/catalogo.js`.

En Flow lo que corresponde es el **Botón de Pago** (reutilizable, se incrusta en
el sitio), no el *Link de Pago*, que es de un solo cliente. Ver [PAGOS.md](PAGOS.md).

---

## La dirección de cada curso

Cada curso tiene su propia página: `coatzadrone.cl/cursos/<dirección>`. Es la que
se usa en los anuncios de Meta y Google, con los parámetros de campaña:

```
https://coatzadrone.cl/cursos/pix4dfields-agricultura-precision?utm_source=meta&utm_medium=cpc&utm_campaign=pix4dfields-octubre
```

**Cambiar la dirección no rompe los anuncios.** La anterior queda redirigiendo a
la nueva, conservando los parámetros de campaña. Aun así, conviene fijarla antes
de lanzar la primera campaña y no volver a tocarla.

---

## Instructores

*Instructores* → **+ Nuevo instructor**: foto, nombre, cargo, biografía y enlaces
de verificación (por ejemplo, su certificado en training.pix4d.com). Después, en
la ficha de cada curso, se marca quién lo dicta.

Un instructor puede dictar varios cursos, y un curso puede tener varios
instructores. Si eliminas un instructor, los cursos que dictaba quedan sin él.

---

## Imágenes

Se suben desde el panel y el navegador las **achica antes de subir**: 1600 px
para los cursos, 800 px para las fotos de instructores. Una foto de celular pesa
4 o 5 MB; así queda en unos 200 KB y se ve igual, que es lo que decide si la
página carga rápido en 4G.

Se aceptan JPG, PNG y WebP. Las imágenes que dejan de usarse se borran solas al
guardar.

*Elegir existente* muestra las imágenes del sitio y las que ya subiste, para
reusarlas sin volver a subirlas.

---

## Ver el sitio mientras está en mantenimiento

Al entrar al panel, tu navegador queda habilitado por 8 horas para ver el sitio
**real** en `coatzadrone.cl`, aunque el público siga viendo el aviso de
mantenimiento. Una etiqueta roja abajo a la izquierda te recuerda que estás en
vista previa.

Lo mismo sirve para los cursos ocultos: *Ver en el sitio* abre su página real,
solo para ti.

Técnicamente es una cookie firmada con tu clave: no contiene la clave, no se
puede falsificar, y si cambias la clave en Cloudflare deja de servir en el acto.

---

## Lo que el panel no edita

Las **preguntas frecuentes** y los datos de contacto (WhatsApp, correo, ids de
analítica) siguen en `data/cursos.json`, en `faq` y `config`. Cambian muy rara vez.

`data/cursos.json` también guarda el **catálogo inicial**: lo que se muestra si el
panel nunca se ha guardado o si el almacén no responde. El sitio nunca queda en
blanco por una falla del panel.

---

## Seguridad

- Se entra con la clave del secreto `ADMIN_CLAVE` de Cloudflare. Sin ese secreto,
  el panel queda **cerrado**, no abierto
- La clave se compara en tiempo constante, y cada intento fallido espera 600 ms
- Todo lo que se guarda se valida en el servidor: los links tienen que ser
  `https://`, las imágenes solo pueden ser las subidas al panel o las del sitio,
  y un archivo se acepta como imagen por su contenido real, no por su nombre
- Si alguien guarda desde otra pestaña, la tuya no pisa esos cambios: te avisa
  y te pide recargar
- El panel responde `noindex` y no está enlazado desde el sitio. No se agregó a
  `robots.txt` a propósito: ese archivo es público y sería un cartel diciendo
  dónde está la puerta

---

## Si algo falla

| Qué ves | Qué pasa |
|---|---|
| «El panel todavía no tiene clave configurada» | Falta el secreto `ADMIN_CLAVE` |
| «Falta el almacén» | El binding `CONFIG` de KV no está conectado en `wrangler.jsonc` |
| «Clave incorrecta» | Eso mismo. No hay recuperación: se cambia el secreto en Cloudflare |
| «Hubo cambios desde otra ventana» | Guardaste desde otra pestaña. Recarga |
| La lista de errores al guardar | Un curso sin nombre, una fecha sin día de inicio o un link sin `https://`. Clic en cada error para ir al campo |
| La página no refleja un cambio | Espera un minuto y recarga con `Ctrl+F5` |

Ver también [PAGOS.md](PAGOS.md) para crear los links de pago.
