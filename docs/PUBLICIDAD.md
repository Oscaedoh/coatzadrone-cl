# Medición y preparación de campañas

El siguiente paso después de publicar la landing es traer leads. Este documento
describe lo que el sitio **ya trae listo** y lo que hay que activar.

---

## Eventos que el sitio ya mide

Apenas cargues `ga4_id` y `meta_pixel_id` en `data/cursos.json`, estos eventos
empiezan a registrarse solos:

| Evento GA4 | Evento Meta | Cuándo se dispara |
|---|---|---|
| `view_item` | `ViewContent` | Alguien abre la página de un curso |
| `iniciar_pago` | `InitiateCheckout` | Pulsa un botón de pago (va al checkout de Flow) |
| `click_cta_curso` | — | Pulsa un botón que baja al formulario con el curso elegido |
| `agregar_calendario` | — | Descarga el `.ics` o abre Google Calendar |
| `enviar_inscripcion` | — | Envía el formulario |
| `lead_confirmado` | `Lead` | El formulario se envió con éxito |

Cada evento lleva el `id` del curso, y los de Meta también el valor en CLP, para
que puedas saber qué curso responde mejor y optimizar por valor.

---

## A dónde apuntar cada anuncio

A la **página del curso**, no a la portada: `coatzadrone.cl/cursos/<curso>`.

Esa página está pensada para quien llega desde un anuncio. Arriba de todo, sin
bajar, están el nombre, la fecha, el precio y el botón de pago; en celular, una
barra fija mantiene el precio y el botón a la mano mientras se lee el temario. Y
al compartirla, Facebook y WhatsApp muestran el título, la descripción y la
imagen de ese curso, no los genéricos del sitio.

La dirección de cada curso está en su ficha del panel. Fíjala antes de la
primera campaña: si después cambia, la anterior redirige a la nueva y los
anuncios no se rompen, pero lo prolijo es no tocarla.

---

## Antes de pautar el primer peso

1. **Instalar GA4 y el Píxel de Meta** → ver [CONFIGURAR.md](CONFIGURAR.md#6-analítica--necesaria-antes-de-pautar)
2. **Verificar el dominio en Meta Business** — Administrador de eventos →
   Orígenes de datos → Dominios. Sin esto, las campañas de conversión pierden
   alcance por las restricciones de iOS.
3. **Marcar `lead_confirmado` como conversión en GA4** — Administrar → Eventos →
   activar "Marcar como conversión".
4. **Probar el formulario tú mismo** y confirmar que el lead llega a tu correo.

---

## Estructura de campaña sugerida

El curso de Pix4Dfields tiene un público muy definido, así que conviene empezar
angosto y con presupuesto bajo antes de escalar.

**Meta Ads (Facebook + Instagram)**

- Objetivo: **Clientes potenciales** (no "Tráfico" — trae clics baratos que no convierten)
- Ubicación: Chile. Regiones con más peso agrícola: O'Higgins, Maule, Ñuble,
  Biobío, Valparaíso y la Región Metropolitana
- Edad: 25 a 55
- Intereses: agricultura de precisión, agronomía, drones, DJI, QGIS, teledetección
- Presupuesto de prueba: CLP $8.000 – $12.000 diarios por conjunto de anuncios,
  durante 5 a 7 días antes de juzgar resultados

**Google Ads (Búsqueda)**

Palabras con intención de compra, no informativas:

- `curso pix4d chile`
- `curso agricultura de precisión drones`
- `certificación pix4d`
- `curso ndvi drones`
- `capacitación fotogrametría drones chile`

Presupuesto de prueba: CLP $6.000 – $10.000 diarios. Son búsquedas de bajo volumen
pero altísima intención.

**LinkedIn**

Caro por clic, pero es donde está el decisor cuando la empresa paga la capacitación.
Vale la pena solo para el mensaje B2B: "capacita a tu equipo técnico".

---

## Qué necesita el anuncio

Los tres argumentos más fuertes de esta oferta, en orden:

1. **Certificado oficial Pix4D** — no es un curso genérico de YouTube. CoatzaDrone
   está listado en el directorio mundial de Pix4D para Chile, y eso es verificable.
2. **Licencia de software incluida por 30 días** — elimina la barrera de entrada.
3. **Aplicado, no teórico** — se trabaja con datasets reales y se termina con un
   proyecto integrador listo para usar en campo.

Para creatividades: las imágenes de mapas NDVI con la paleta rojo-amarillo-verde
sobre un cultivo son el activo visual más potente y reconocible del rubro.

---

## Seguimiento de leads

Con 50 leads al mes el correo alcanza. Si pasa de ahí, conviene una hoja de cálculo
compartida o un CRM gratuito (HubSpot Free, Notion). Lo importante es registrar de
qué curso y de qué canal vino cada lead, para saber dónde poner el presupuesto.
