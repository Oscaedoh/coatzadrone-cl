/**
 * Proteccion del sitio: limites de intentos, verificacion anti-robots,
 * cabeceras de seguridad y registro de errores.
 *
 * Nada de esto guarda datos personales. Los registros van a Workers Logs
 * (Cloudflare -> coatzadrone-cl -> Observability) y llevan solo el tipo de
 * error, nunca el correo, el nombre ni la clave de quien escribio.
 */

/* ---------- Limites de intentos ---------- */

/**
 * Cuenta un intento y dice si todavia esta dentro del limite.
 *
 * Los limites se definen en wrangler.jsonc (seccion "ratelimits"). Son por
 * direccion IP y por centro de datos de Cloudflare: frenan a quien dispara el
 * formulario o prueba claves en serie, sin molestar a una persona normal.
 *
 * Si el limitador no existe (servidor local) o falla, se deja pasar. Un tropiezo
 * de Cloudflare no puede costar un lead.
 */
export async function dentroDelLimite(limitador, clave) {
  if (!limitador || typeof limitador.limit !== 'function') return true;
  try {
    var r = await limitador.limit({ key: clave });
    return r.success !== false;
  } catch (e) {
    registrar('limitador_fallo', { mensaje: String(e && e.message || e) });
    return true;
  }
}

export function ipDe(request) {
  return request.headers.get('CF-Connecting-IP') || 'sin-ip';
}

/* ---------- Origen ---------- */

var ORIGENES = ['https://coatzadrone.cl', 'https://www.coatzadrone.cl'];

/**
 * Un navegador siempre manda la cabecera Origin en un POST. Si viene de otro
 * sitio, es alguien usando nuestro formulario desde afuera para mandar correos
 * con nuestro remitente. Sin Origin (un script de servidor) se deja pasar: para
 * eso estan el limite de intentos y la verificacion anti-robots.
 */
export function origenPermitido(request) {
  var origen = request.headers.get('Origin');
  return !origen || ORIGENES.indexOf(origen) !== -1;
}

/* ---------- Verificacion anti-robots (Cloudflare Turnstile) ---------- */

var SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Turnstile queda activo solo cuando existen las dos piezas:
 *   - la clave publica (turnstile_sitekey) en data/cursos.json, que hace
 *     aparecer la verificacion en los formularios, y
 *   - el secreto TURNSTILE_SECRET en Cloudflare, con el que se comprueba aqui.
 * Con una sola de las dos no se exige nada. Asi el orden en que se configuren
 * no puede dejar el formulario rechazando a todo el mundo.
 */
export function turnstileActivo(env, config) {
  return !!(env.TURNSTILE_SECRET && config && config.turnstile_sitekey);
}

export async function verificarTurnstile(env, token, ip) {
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  var cuerpo = new FormData();
  cuerpo.append('secret', env.TURNSTILE_SECRET);
  cuerpo.append('response', token);
  if (ip && ip !== 'sin-ip') cuerpo.append('remoteip', ip);
  try {
    var r = await fetch(SITEVERIFY, { method: 'POST', body: cuerpo });
    var j = await r.json();
    if (!j.success) registrar('turnstile_rechazo', { codigos: j['error-codes'] || [] });
    return !!j.success;
  } catch (e) {
    // Si el verificador de Cloudflare no responde, se deja pasar y queda
    // registrado. Perder un lead real es peor que dejar pasar un robot.
    registrar('turnstile_sin_respuesta', { mensaje: String(e && e.message || e) });
    return true;
  }
}

/* ---------- Cabeceras de seguridad ---------- */

/**
 * Las mismas que pone _headers en los archivos estaticos, para que tambien
 * las lleven las respuestas que arma el Worker (portada, cursos, API, aviso de
 * mantenimiento, redirecciones).
 *
 * HSTS le dice al navegador que este dominio va siempre por HTTPS, incluso si
 * alguien escribe http://. Arranca en 30 dias; con el sitio lanzado y estable
 * se puede subir a un ano (31536000) aqui y en _headers.
 */
var SEGURIDAD = {
  'Strict-Transport-Security': 'max-age=2592000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};

export function conCabeceras(respuesta) {
  // Las respuestas de Response.redirect() y de fetch() traen cabeceras de
  // solo lectura: se copian a una respuesta nueva para poder agregarlas.
  var r = new Response(respuesta.body, respuesta);
  Object.keys(SEGURIDAD).forEach(function (nombre) {
    if (!r.headers.has(nombre)) r.headers.set(nombre, SEGURIDAD[nombre]);
  });
  return r;
}

/* ---------- Registro ---------- */

/**
 * Deja una linea en Workers Logs. Se busca por el campo "evento".
 * Solo datos tecnicos: jamas correos, nombres, telefonos ni claves.
 */
export function registrar(evento, datos) {
  try {
    console.error(JSON.stringify(Object.assign({ evento: evento }, datos || {})));
  } catch (e) { /* registrar nunca puede romper la respuesta */ }
}
