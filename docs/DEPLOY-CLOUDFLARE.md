# Publicar el sitio: GitHub → Cloudflare Pages → coatzadrone.cl

Costo total: **$0**. Cloudflare Pages no cobra por ancho de banda ni por visitas.

---

## Paso 1 — Subir el proyecto a GitHub

Desde la carpeta del proyecto, en la terminal:

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Landing de cursos Pix4D — CoatzaDrone Chile"
```

Crea el repositorio vacío en <https://github.com/new>:

- **Repository name:** `coatzadrone-cl`
- **Visibility:** Private (puedes cambiarlo después)
- **No** marques "Add a README file"

Luego conecta y sube (reemplaza `TU-USUARIO`):

```bash
git remote add origin https://github.com/TU-USUARIO/coatzadrone-cl.git
```

```bash
git push -u origin main
```

GitHub pedirá autenticación la primera vez. Si te pide contraseña, usa un
**Personal Access Token**: github.com → Settings → Developer settings →
Personal access tokens → Tokens (classic) → Generate new token, con permiso `repo`.

---

## Paso 2 — Conectar Cloudflare Pages

1. Crea una cuenta gratuita en <https://dash.cloudflare.com/sign-up>
2. En el panel: **Workers & Pages** → **Create** → pestaña **Pages** →
   **Connect to Git**
3. Autoriza GitHub y selecciona el repositorio `coatzadrone-cl`
4. Configuración del build — **déjalo todo vacío**:

   | Campo | Valor |
   |---|---|
   | Framework preset | `None` |
   | Build command | *(vacío)* |
   | Build output directory | `/` |

5. **Save and Deploy**

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

Los dominios `.cl` se administran en NIC Chile, aunque los hayas comprado por
un revendedor.

1. Entra a <https://clientes.nic.cl> con tu cuenta
2. Busca `coatzadrone.cl` → **Modificar servidores de nombre** (DNS)
3. Reemplaza los servidores actuales por los dos de Cloudflare
4. Guarda

> **Ojo:** si compraste el dominio a través de un revendedor (GoDaddy, HostingPlus,
> Bluehosting, etc.), el cambio se hace en el panel de ese proveedor, no en NIC.cl.

La propagación tarda entre 15 minutos y 24 horas. Cloudflare te envía un correo
cuando el dominio queda activo.

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
