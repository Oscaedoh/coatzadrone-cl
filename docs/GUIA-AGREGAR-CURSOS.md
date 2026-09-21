# Cómo agregar o editar un curso

Todos los cursos viven en `data/cursos.json`. **No se toca HTML, CSS ni JavaScript.**
El sitio se arma solo a partir de ese archivo.

---

## La forma más simple: editar desde GitHub

1. Entra al repositorio en github.com
2. Abre `data/cursos.json`
3. Haz clic en el lápiz ✏️ (*Edit this file*)
4. Edita y presiona **Commit changes**
5. En menos de un minuto el cambio está publicado en coatzadrone.cl

No necesitas instalar nada.

---

## Agregar un curso nuevo

Copia el bloque completo de un curso existente (desde `{` hasta el `}` que le
corresponde), pégalo dentro de `"cursos": [ ... ]` separado por una coma, y cambia
los campos.

### Campos mínimos para que un curso se vea bien

```json
{
  "id": "pix4dcloud-inspeccion",
  "activo": true,
  "destacado": false,
  "estado": "inscripciones-abiertas",
  "titulo": "PIX4Dcloud para inspección de activos",
  "subtitulo": "Procesamiento en la nube y entrega de reportes al cliente",
  "software": "PIX4Dcloud",
  "nivel": "Intermedio",
  "modalidad": "Online en vivo",
  "duracion": "8 horas · 2 sesiones de 4 horas",
  "idioma": "Español",
  "imagen": "assets/img/Coatzadrone-energy.jpg",
  "resumen": "Una o dos frases que se leen en la tarjeta del curso.",
  "dirigido_a": ["Perfil 1", "Perfil 2"],
  "incluye": ["Certificado oficial Pix4D", "Material del curso"],
  "modulos": [],
  "cohortes": [],
  "precio": { "clp": null, "usd": null },
  "pagos": { "mercadopago_url": "", "flow_url": "", "paypal_url": "", "transferencia": true }
}
```

---

## Qué hace cada campo

| Campo | Qué controla |
|---|---|
| `id` | Identificador interno. Sin espacios ni tildes, usa guiones. Debe ser único. |
| `activo` | `true` lo muestra en el sitio, `false` lo oculta sin borrarlo. |
| `destacado` | El curso con `true` es el que se despliega completo (temario, instructor, fechas, precio) en la página. **Solo uno debe tenerlo.** |
| `estado` | `"inscripciones-abiertas"` (etiqueta verde) o `"proximamente"` (etiqueta gris). |
| `software` | Se muestra como etiqueta negra sobre la imagen. Ej: `PIX4Dfields`. |
| `imagen` | Ruta relativa dentro de `assets/img/`. |
| `resumen` | Texto de la tarjeta. Ideal: 150–200 caracteres. |
| `modulos` | El temario en acordeón. Si está vacío `[]`, esa sección no aparece. |
| `cohortes` | Las fechas. Si está vacío, se muestra "Por anunciar" con CTA de lead. |
| `precio` | Ver [CONFIGURAR.md](CONFIGURAR.md#3-precio-en-pesos-chilenos--obligatorio-para-publicidad). |

---

## Estructura de un módulo del temario

```json
{
  "numero": 1,
  "titulo": "Fundamentos y adquisición de datos",
  "objetivo": "Qué logra el participante al terminar este módulo.",
  "contenidos": [
    "Primer tema",
    "Segundo tema",
    "Tercer tema"
  ]
}
```

El primer módulo aparece abierto por defecto; los demás, plegados.

---

## Cambiar el curso destacado

Cuando termine el workshop de Pix4Dfields y quieras destacar otro:

1. En el curso actual: `"destacado": false`
2. En el curso nuevo: `"destacado": true`

La página completa (objetivo, temario, beneficios, instructor, fechas, precio, datos
estructurados para Google) cambia sola.

---

## Editar las preguntas frecuentes

Al final del archivo, en `"faq"`. Cada entrada tiene `p` (pregunta) y `r` (respuesta):

```json
{ "p": "¿Entregan factura?", "r": "Sí, emitimos documento tributario." }
```

Estas preguntas también se envían a Google como datos estructurados, así que pueden
aparecer directamente en los resultados de búsqueda.

---

## Errores comunes

**El sitio queda en blanco o dice "No se pudo cargar el contenido".**
El archivo JSON tiene un error de sintaxis. Causas típicas:

- Falta una coma entre dos cursos, o sobra una coma antes de `]` o `}`
- Faltan comillas en un texto
- Se usaron comillas curvas (`"` `"`) en vez de rectas (`"`) — pasa al copiar desde Word

Pega el contenido en <https://jsonlint.com> y te dirá exactamente la línea del error.

**Las tildes se ven raras (`Ã¡`).**
El archivo debe guardarse en UTF-8. En el Bloc de notas: *Guardar como* → Codificación **UTF-8**.
Editando desde GitHub esto nunca pasa.
