/**
 * Panel comercial — la API.
 *
 * La interfaz vive en admin/ como archivos estaticos (index.html, panel.css,
 * panel.js). Que sean publicos no es un problema: no llevan ningun secreto, y
 * todo lo que lee o escribe datos pasa por aqui, detras de la clave.
 *
 *   GET  /api/admin/datos   el catalogo completo, ocultos incluidos
 *   POST /api/admin/datos   guarda el catalogo completo
 *   POST /api/admin/media   sube una imagen
 *   POST /api/admin/vista   entrega la cookie de vista previa
 *   POST /api/admin/salir   la borra
 *
 * Entra con la clave del secreto ADMIN_CLAVE (Cloudflare -> Settings ->
 * Variables and Secrets, tipo Secret). Si el secreto no existe, el panel queda
 * cerrado a proposito: sin clave no hay entrada, no una entrada libre.
 */

import { leerBase, leerCatalogo, guardarCatalogo, limpiarCatalogo, hayKV, MEDIOS_PAGO } from './catalogo.js';
import * as media from './media.js';
import * as vista from './vista.js';

/* ---------- Puerta ---------- */

/**
 * Comparacion en tiempo constante. Un == normal corta apenas encuentra una
 * letra distinta, y ese microsegundo de diferencia deja adivinar la clave
 * caracter por caracter. Aqui siempre se recorre entera.
 */
function claveOk(env, recibida) {
  var real = env.ADMIN_CLAVE;
  if (!real || typeof recibida !== 'string') return false;
  if (recibida.length !== real.length) return false;
  var d = 0;
  for (var i = 0; i < real.length; i++) {
    d |= real.charCodeAt(i) ^ recibida.charCodeAt(i);
  }
  return d === 0;
}

function json(cuerpo, estado, extra) {
  var h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow'
  };
  Object.assign(h, extra || {});
  return new Response(JSON.stringify(cuerpo), { status: estado || 200, headers: h });
}

/* ---------- Interfaz ---------- */

export async function pagina(request, env) {
  var r = await env.ASSETS.fetch(new Request(new URL('/admin/', request.url).toString()));
  var h = new Headers(r.headers);
  h.set('Cache-Control', 'no-store');
  h.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(r.body, { status: r.status, headers: h });
}

/* ---------- API ---------- */

export async function api(request, env, ruta) {
  if (!env.ADMIN_CLAVE) {
    // Mientras el panel no tenga clave, esta respuesta hace de diagnostico:
    // dice si el almacen quedo enlazado. No revela nada: sin clave no se entra.
    return json({ ok: false, error: 'sin_clave_configurada', kv: hayKV(env) }, 503);
  }
  if (!claveOk(env, request.headers.get('X-Clave'))) {
    // Un retardo fijo hace que probar claves a ciegas sea lentisimo.
    await new Promise(function (r) { setTimeout(r, 600); });
    return json({ ok: false, error: 'clave_incorrecta' }, 401);
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ ok: false, error: 'metodo_no_permitido' }, 405);
  }

  if (ruta === 'vista' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': await vista.emitir(env) });
  }
  if (ruta === 'salir' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': vista.borrar() });
  }

  if (ruta === 'media' && request.method === 'POST') {
    if (!hayKV(env)) return json({ ok: false, error: 'falta_kv' }, 503);
    var subida = await media.subir(request, env);
    return json(subida, subida.ok ? 200 : subida.http);
  }

  if (ruta === 'datos' && request.method === 'GET') {
    var base = await leerBase(env);
    var cat = await leerCatalogo(env, base);
    return json({
      ok: true,
      kv: hayKV(env),
      // El panel dibuja una casilla por medio habilitado. Asi apagar uno es
      // cambiar una lista en catalogo.js, sin tocar la interfaz.
      medios: MEDIOS_PAGO,
      actualizado: cat.actualizado,
      cursos: cat.cursos,
      instructores: cat.instructores,
      // Imagenes que vienen con el sitio, para poder elegirlas sin subirlas.
      imagenesSitio: (base.imagenes_sitio || [])
    });
  }

  if (ruta === 'datos' && request.method === 'POST') {
    var entrada;
    try { entrada = await request.json(); }
    catch (e) { return json({ ok: false, error: 'json_invalido' }, 400); }

    var limpio = limpiarCatalogo(entrada);
    if (!limpio.ok) return json({ ok: false, error: 'datos_invalidos', errores: limpio.errores }, 422);

    if (!hayKV(env)) {
      return json({ ok: false, error: 'falta_kv' }, 503);
    }

    /*
     * Guardado con dos pestanas abiertas: si el catalogo cambio desde que este
     * panel lo cargo, no se pisa. Se avisa y la persona recarga. Sin esto, la
     * pestana olvidada del lunes borraria en silencio lo que se hizo el martes.
     */
    var actual = await leerCatalogo(env);
    if (actual.actualizado && entrada.base !== actual.actualizado) {
      return json({ ok: false, error: 'conflicto', actualizado: actual.actualizado }, 409);
    }

    await guardarCatalogo(env, limpio.catalogo);

    var borradas = 0;
    try { borradas = await media.limpiarHuerfanas(env, limpio.catalogo); }
    catch (e) { /* limpiar es mantencion; si falla, el guardado ya esta hecho */ }

    return json({
      ok: true,
      actualizado: limpio.catalogo.actualizado,
      cursos: limpio.catalogo.cursos,
      instructores: limpio.catalogo.instructores,
      imagenesBorradas: borradas
    });
  }

  return json({ ok: false, error: 'no_encontrado' }, 404);
}
