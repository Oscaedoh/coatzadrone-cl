# COATZADRONE — Kit gráfico Chile

## Archivos listos para subir

| Archivo | Medidas | Uso |
|---|---|---|
| `perfil-whatsapp-oscuro.png` | 1000×1000 | Foto de perfil WhatsApp Business (recomendada) |
| `perfil-whatsapp-claro.png`  | 1000×1000 | Foto de perfil, versión clara |
| `portada-oscura.png`         | 1640×624  | Portada (recomendada) |
| `portada-clara.png`          | 1640×624  | Portada, versión clara |

WhatsApp recorta la foto de perfil en **círculo**: todo el contenido está dentro del
círculo seguro (radio 470 px), por eso no se corta nada.

La portada está en 1640×624 (estándar de portada de Facebook/Meta Business, que es
el que alimenta el perfil de WhatsApp Business). Todo el texto está centrado dentro
de los 1000 px centrales para que sobreviva al recorte en móvil.

## Fuentes editables

- `logo.svg` — logo original convertido a UTF-8 (el original venía en UTF-16).
- `logo-wordmark-negro.svg` / `logo-wordmark-blanco.svg` — el mismo logo recortado
  al borde exacto del trazo (relación 5.61:1), para colocarlo en cualquier pieza.
- `perfil-a.html`, `perfil-b.html`, `portada-a.html`, `portada-b.html` — el diseño
  fuente. Se editan como texto plano.

## Volver a exportar tras editar

```bash
./_render.sh perfil-a.html  1000 1000 perfil-whatsapp-oscuro.png
./_render.sh portada-a.html 1640 624  portada-oscura.png
```

## Paleta

| Color | Hex | Uso |
|---|---|---|
| Azul noche | `#102846` | Fondo oscuro / logo sobre claro |
| Azul Chile | `#0B4DA2` | Acento bandera |
| Rojo Chile | `#D32A1E` | Acento bandera / estrella |
| Celeste dato | `#7FD4FF` | Cono de escaneo, mallas |
| Negro logo | `#222124` | Color original del logotipo |

## Pendiente de completar

No incluí teléfono, web ni redes porque no tengo los datos chilenos reales.
Cuando los tengas, se agregan en el bloque `.srv` del HTML de la portada.
