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
| Hosting | Cloudflare Pages | Gratis sin límite de tráfico, incluye DNS para `.cl`, SSL y CDN |
| Repositorio | GitHub, deploy automático por push | Sin costo, con historial y rollback |
| Pagos | Mercado Pago Chile + Flow.cl | Los dos más reconocidos en Chile; links de pago sin backend |
| Arquitectura | Estático, sin framework | No hay Node instalado en la máquina; cero mantención y cero costo |
| Contenido | Un solo JSON | El dueño debe poder agregar cursos sin tocar código |
| Idioma | Solo español | Alcance definido para la primera entrega |

## Entorno de la máquina

- Windows 10, PowerShell + Git Bash
- **git disponible**; **no hay Node, npm, gh CLI ni Python**
- Por eso el sitio no usa build y el servidor local es un script de PowerShell
  (`scripts/servidor-local.ps1`, puerto 8899)

## Estado actual

La landing está construida y funcionando en local. Pendientes antes de salir al aire,
todos en `data/cursos.json` — ver `docs/CONFIGURAR.md`:

1. Número de WhatsApp real (hoy `56900000000`, de ejemplo)
2. Correo de contacto del dominio
3. Precio en CLP (hoy `null` → el sitio muestra "Consultar")
4. Confirmar las fechas de la cohorte de octubre (hoy marcada como referencial)
5. Endpoint del formulario (hoy deriva a WhatsApp)
6. IDs de GA4 y Píxel de Meta
7. Links de pago de Mercado Pago y Flow

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
