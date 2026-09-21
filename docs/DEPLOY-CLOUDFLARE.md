# Publicar el sitio: GitHub → Cloudflare Pages → coatzadrone.cl

Costo total: **$0**. Cloudflare no cobra por ancho de banda ni por visitas.

---

## Pasos 1 y 2 — ✅ completados el 21 de septiembre de 2026

- Repositorio: <https://github.com/Oscaedoh/coatzadrone-cl> (rama `main`)
- Deploy en vivo: <https://coatzadrone-cl.oscaedoh.workers.dev>
- Cada `git push` a `main` republica el sitio automáticamente

Para publicar cambios de aquí en adelante basta con:

```bash
git add . && git commit -m "Describe el cambio" && git push
```

Las credenciales de GitHub quedaron guardadas en Git Credential Manager, así que
el push ya no pide autenticación en este equipo.

<details>
<summary>Configuración usada, por si hay que rehacer el proyecto en Cloudflare</summary>

**Workers & Pages** → **Create** → **Pages** → **Connect to Git** → repositorio
`coatzadrone-cl`, con el build vacío:

| Campo | Valor |
|---|---|
| Framework preset | `None` |
| Build command | *(vacío)* |
| Build output directory | `/` |

</details>

En menos de un minuto el sitio queda en vivo en una URL tipo
`coatzadrone-cl.pages.dev`. Úsala para revisar antes de conectar el dominio.

Desde ahí, **cada `git push` a `main` republica el sitio automáticamente.**

---

## Paso 3 — Conectar el dominio coatzadrone.cl

### 3a. Agregar el dominio a Cloudflare

1. Panel de Cloudflare → **Add a site** → escribe `coatzadrone.cl`
2. Elige el plan **Free**
3. Cloudflare escanea los registros DNS existentes y te entrega **dos nameservers**,
   parecidos a:

   ```
   dana.ns.cloudflare.com
   rick.ns.cloudflare.com
   ```

   Anótalos.

### 3b. Cambiar los nameservers en NIC Chile

`coatzadrone.cl` está registrado **directo en NIC.cl**, así que el cambio se hace
ahí mismo (no hay revendedor de por medio).

1. Entra a <https://clientes.nic.cl> — el acceso es con **ClaveÚnica** o con tu
   usuario y contraseña de NIC
2. Ve a tus dominios y selecciona `coatzadrone.cl`
3. Busca la opción de **servidores de nombre / DNS** (según la versión del panel
   aparece como *"Cambiar servidores de nombre"* o *"Modificar DNS"*)
4. **Borra los servidores actuales** y deja únicamente los dos de Cloudflare, por
   ejemplo:

   ```
   dana.ns.cloudflare.com
   rick.ns.cloudflare.com
   ```

   NIC exige un mínimo de dos servidores y valida que respondan. Los de Cloudflare
   cumplen, así que no debería rechazarlos.

5. Guarda los cambios

La propagación suele tomar entre 30 minutos y algunas horas. Cloudflare envía un
correo cuando detecta el cambio y marca el dominio como **Active**.

> **Importante:** al mover los nameservers a Cloudflare, **todos** los registros DNS
> del dominio pasan a administrarse desde Cloudflare. Si `coatzadrone.cl` ya tenía
> correo o algún servicio apuntando ahí, verifica que Cloudflare haya copiado esos
> registros en el escaneo del paso 3a antes de guardar. Si el dominio estaba sin
> usar, no hay nada que preservar.

### 3c. Apuntar el dominio al sitio

Una vez que Cloudflare muestre el dominio como **Active**:

1. **Workers & Pages** → tu proyecto `coatzadrone-cl` → pestaña **Custom domains**
2. **Set up a custom domain** → escribe `coatzadrone.cl` → **Continue** → **Activate**
3. Repite con `www.coatzadrone.cl`

Cloudflare crea los registros DNS y emite el certificado SSL automáticamente.
No hay que configurar HTTPS: viene incluido y se renueva solo.

---

## Paso 4 — Redirigir www al dominio principal

Para que `www.coatzadrone.cl` y `coatzadrone.cl` no compitan en Google:

1. Cloudflare → tu dominio → **Rules** → **Redirect Rules** → **Create rule**
2. Nombre: `www a raíz`
3. **If** → Custom filter expression → Field `Hostname`, Operator `equals`,
   Value `www.coatzadrone.cl`
4. **Then** → Type: `Dynamic`, Expression:
   `concat("https://coatzadrone.cl", http.request.uri.path)`,
   Status code: `301`
5. **Deploy**

---

## Publicar cambios de aquí en adelante

```bash
git add . && git commit -m "Describe el cambio" && git push
```

Cloudflare detecta el push y republica solo. Puedes ver el estado de cada
publicación en **Workers & Pages → coatzadrone-cl → Deployments**.

Si algo sale mal, en esa misma pantalla puedes **volver a la versión anterior**
con un clic (*Rollback*).

---

## Correo del dominio (opcional pero recomendado)

Cloudflare incluye **Email Routing** gratis: te permite recibir correo en
`contacto@coatzadrone.cl` y reenviarlo a tu Gmail, sin costo.

Cloudflare → tu dominio → **Email** → **Email Routing** → seguir el asistente.

Para *enviar* desde esa dirección necesitas Google Workspace (de pago) o
configurar Gmail con "Enviar como" usando un servidor SMTP.
