# El formulario y la captación de leads

Qué pasa cuando alguien aprieta **Enviar inscripción** en `coatzadrone.cl`.

```
Formulario  →  POST /api/lead  →  Worker  →  Brevo
                                     ├─ guarda el contacto en "Leads - Cursos Pix4D"
                                     ├─ le manda el correo de bienvenida
                                     └─ te avisa a contacto@coatzadrone.cl
```

El Worker vive en `worker/index.js`. No sirve el sitio: los archivos estáticos se
entregan antes de que el código se ejecute, así que solo corre para rutas que no
existen como archivo. Hoy la única es `/api/lead`.

---

## Paso obligatorio: la clave de Brevo

**Sin esto el formulario no guarda nada** y le muestra al visitante la alternativa
de WhatsApp.

### 1. Generar la clave en Brevo

<https://app.brevo.com/settings/keys/api> → pestaña **API keys** → **Generar una
nueva clave API**. Nómbrala `worker-coatzadrone-cl`.

Ojo, esta vez sí es la de **API** (empieza con `xkeysib-`), no la SMTP. Son cosas
distintas: la SMTP la usa Gmail para enviar tus respuestas, esta la usa el sitio
para escribir en tu base de contactos.

Cópiala al generarla: Brevo la muestra una sola vez.

### 2. Guardarla en Cloudflare como secreto

Panel de Cloudflare → **Workers & Pages** → `coatzadrone-cl` → **Settings** →
**Variables and Secrets** → **Add**:

| Campo | Valor |
|---|---|
| Type | **Secret** (no *Text*) |
| Variable name | `BREVO_API_KEY` |
| Value | la clave `xkeysib-…` |

**Deploy** para que tome efecto.

> Tiene que ser de tipo *Secret*. Una variable de texto queda visible en el panel
> y en los logs; un secreto queda cifrado y ni Cloudflare te la vuelve a mostrar.

La clave **no va en este repositorio**, que es público. Si alguna vez se filtra,
se revoca en Brevo y se crea otra: solo hay que actualizar este secreto.

---

## De dónde viene cada lead

El sitio guarda el origen apenas carga la página y lo manda junto con el
formulario. No hay que hacer nada para que funcione, pero sí hay que **etiquetar
los anuncios** para que sirva de algo.

Un anuncio de Instagram debería apuntar a una URL así:

```
https://coatzadrone.cl/?utm_source=meta&utm_medium=cpc&utm_campaign=pix4dfields-octubre
```

Con eso, el contacto entra a Brevo con `ORIGEN = meta / cpc` y
`CAMPANA = pix4dfields-octubre`, y puedes ver qué campaña trajo qué inscripción.

Sin UTM, el sitio se defiende solo: detecta `gclid` (Google) y `fbclid` (Meta), y
si no hay nada, guarda el dominio desde el que llegó la visita, o `directo`.

El dato se guarda en `sessionStorage`, así que sobrevive si la persona recorre la
página un rato antes de inscribirse.

---

## Qué queda guardado en Brevo

| Atributo | De dónde sale |
|---|---|
| `NOMBRE` | campo del formulario |
| `CURSO_INTERES` | título del curso elegido |
| `PAIS`, `PERFIL` | campos del formulario |
| `ORIGEN`, `CAMPANA` | UTM del anuncio |
| `FECHA_LEAD` | fecha del envío |
| `ESTADO` | `Nuevo` — lo vas moviendo tú a medida que avanza |
| `WHATSAPP` | teléfono tal como se pueda normalizar |
| `SMS` | solo si el teléfono quedó en formato internacional válido |

`SMS` y `ESTADO` son los dos que Brevo puede rechazar: el primero exige formato
E.164, el segundo solo acepta uno de sus valores de categoría. Por eso el Worker
los manda aparte y, si la primera escritura falla, **reintenta sin ellos**. Es
preferible un contacto sin teléfono para SMS que perder el lead completo.

---

## Los correos 2 al 5

El Worker manda **solo el correo de bienvenida** (plantilla 1). Es el único que
es realmente transaccional: confirma algo que la persona acaba de hacer.

Los otros cuatro son seguimiento comercial y van por una **automatización** de
Brevo, que se arma una vez en el panel:

*Automations* → **Create an automation** → *Welcome message* o *Custom workflow*

| Paso | Configuración |
|---|---|
| Disparador | *A contact is added to a list* → `Leads - Cursos Pix4D` |
| Espera | 2 días |
| Enviar | plantilla `02 · Valor` |
| Espera | 3 días |
| Enviar | plantilla `03 · Resultados` |
| Espera | 3 días |
| Enviar | plantilla `04 · Credencial` |
| Espera | 4 días |
| Enviar | plantilla `05 · Oferta` |

Esa separación no es un capricho técnico. Un correo transaccional puede salir
siempre; uno comercial necesita que la persona haya aceptado recibirlos, y por eso
lleva el enlace para darse de baja. Mezclarlos es la vía rápida a que te marquen
como spam y arruines la reputación del dominio.

---

## Probar que funciona

Después de guardar el secreto y desplegar:

1. Entra a <https://coatzadrone.cl/?utm_source=prueba&utm_campaign=test> e inscríbete
   con un correo tuyo distinto del de la cuenta
2. Revisa que llegue el correo de bienvenida
3. Revisa que llegue el aviso a `contacto@coatzadrone.cl`
4. En Brevo → *Contacts*, busca ese correo y confirma que trae `ORIGEN = prueba`
5. Bórrate de la lista para no ensuciar las estadísticas

Si el formulario muestra el mensaje de error con la alternativa de WhatsApp, el
Worker no pudo escribir en Brevo. Las causas, en orden de probabilidad:

| Causa | Cómo se ve |
|---|---|
| Falta el secreto `BREVO_API_KEY` | responde `503` |
| La clave es la SMTP y no la de API | responde `502` |
| Se reactivó el bloqueo de IPs en Brevo | responde `502` |
| Se renumeró la lista de leads en Brevo | responde `502` |

Los logs en vivo están en Cloudflare → `coatzadrone-cl` → **Logs**.

> El bloqueo de IPs desconocidas de Brevo (*cuenta → Seguridad → IPs autorizadas*)
> tiene que seguir **desactivado**. El Worker sale desde la red de Cloudflare, con
> IP variable, igual que Gmail. Ver [CONFIGURAR.md](CONFIGURAR.md#2-correo-de-contacto--operativo).
