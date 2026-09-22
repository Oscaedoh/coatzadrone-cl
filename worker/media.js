/**
 * Imagenes subidas desde el panel: fotos de cursos e instructores.
 *
 * Se guardan en el mismo almacen KV que el catalogo, con la clave
 * "media:<id>", y se sirven en /media/<id>. KV admite archivos de hasta 25 MB;
 * el panel las achica antes de subir, asi que cada una queda en unos cientos
 * de KB.
 *
 * El id es aleatorio y la imagen nunca cambia: reemplazar una foto sube otra
 * con otro id. Por eso se pueden servir con cache de un ano sin miedo a que un
 * visitante vea la version vieja.
 */

var PREFIJO = 'media:';
var MAX_BYTES = 3 * 1024 * 1024;

// Una imagen recien subida todavia no esta en el catalogo hasta que se guarda.
// Este margen evita borrarla si justo en ese momento se limpia.
var GRACIA_MS = 60 * 60 * 1000;

/**
 * El tipo se decide por los primeros bytes del archivo, no por lo que declare
 * quien lo sube. SVG queda fuera a proposito: es texto que puede llevar
 * JavaScript adentro, y servirlo desde el dominio del sitio seria abrirle la
 * puerta.
 */
function tipoReal(bytes) {
  var b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

function idAleatorio() {
  var b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
}

export async function subir(request, env) {
  var bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, error: 'archivo_vacio', http: 400 };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, error: 'archivo_grande', http: 413 };

  var tipo = tipoReal(bytes);
  if (!tipo) return { ok: false, error: 'formato_no_admitido', http: 415 };

  var nombre = idAleatorio() + '.' + tipo.ext;
  await env.CONFIG.put(PREFIJO + nombre, bytes, {
    metadata: { tipo: tipo.mime, subido: Date.now(), bytes: bytes.byteLength }
  });
  return { ok: true, url: '/media/' + nombre };
}

export async function servir(env, nombre) {
  if (!/^[a-z0-9]{12,40}\.(jpg|png|webp)$/.test(nombre) || !env.CONFIG) {
    return new Response('No encontrado', { status: 404 });
  }
  var r = await env.CONFIG.getWithMetadata(PREFIJO + nombre, { type: 'arrayBuffer', cacheTtl: 86400 });
  if (!r || !r.value) return new Response('No encontrado', { status: 404 });

  return new Response(r.value, {
    headers: {
      'Content-Type': (r.metadata && r.metadata.tipo) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

/**
 * Borra las imagenes que ya no usa ningun curso ni instructor. Se llama al
 * guardar el catalogo, que es el unico momento en que una imagen deja de
 * usarse. Sin esto, cada foto reemplazada quedaria ocupando espacio para
 * siempre.
 */
export async function limpiarHuerfanas(env, catalogo) {
  var usadas = {};
  (catalogo.cursos || []).forEach(function (c) { if (c.imagen) usadas[c.imagen] = true; });
  (catalogo.instructores || []).forEach(function (i) { if (i.foto) usadas[i.foto] = true; });

  var ahora = Date.now();
  var borradas = 0;
  var cursor;
  do {
    var pagina = await env.CONFIG.list({ prefix: PREFIJO, cursor: cursor });
    for (var k = 0; k < pagina.keys.length; k++) {
      var clave = pagina.keys[k];
      var url = '/media/' + clave.name.slice(PREFIJO.length);
      var subido = (clave.metadata && clave.metadata.subido) || 0;
      if (!usadas[url] && ahora - subido > GRACIA_MS) {
        await env.CONFIG.delete(clave.name);
        borradas++;
      }
    }
    cursor = pagina.list_complete ? null : pagina.cursor;
  } while (cursor);
  return borradas;
}
