# Cómo agregar o editar un curso

**Todo se hace en el panel:** <https://coatzadrone.cl/admin>

1. *Cursos* → **+ Nuevo curso**, o clic en uno existente para editarlo
2. Completa la ficha: textos, imagen, temario, instructores, precio y fechas
3. Activa **Publicado en la página** cuando esté listo
4. **Guardar y publicar**

No se toca código ni hay que esperar un deploy. La guía completa, con qué hace
cada campo en la página, está en [PANEL.md](PANEL.md).

---

## Lo que sigue en el repositorio

`data/cursos.json` ya no es donde se editan los cursos. Quedan ahí tres cosas:

| Clave | Qué es | Se edita en |
|---|---|---|
| `config` | WhatsApp, correo, ids de GA4 y del Píxel de Meta | este archivo |
| `faq` | Las preguntas frecuentes | este archivo |
| `cursos`, `instructores` | El catálogo **inicial** | el panel manda por sobre esto |

El catálogo inicial es un respaldo: es lo que se muestra si el panel nunca se ha
guardado o si el almacén de Cloudflare no responde. Una vez que guardas desde el
panel, lo que está aquí en `cursos` e `instructores` deja de mostrarse.

Para editar `config` o `faq` desde GitHub:

1. Entra al repositorio en github.com y abre `data/cursos.json`
2. Clic en el lápiz ✏️ (*Edit this file*)
3. Edita y presiona **Commit changes**
4. En un par de minutos el cambio está publicado

> Ojo con las comillas y las comas. Un error de sintaxis en este archivo no bota
> los cursos —esos viven en el panel—, pero la página se queda sin preguntas
> frecuentes y usa datos de contacto de respaldo hasta que se corrija. Si GitHub
> marca una línea en rojo, algo quedó mal.
