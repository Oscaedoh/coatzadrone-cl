/**
 * Vista previa para el dueno mientras el sitio esta en mantenimiento.
 *
 * Al entrar al panel con la clave, el navegador recibe una cookie firmada que
 * deja ver el sitio real durante 8 horas. El publico sigue viendo la pagina de
 * aviso. Asi se revisa un curso recien cargado en el sitio de verdad, con su
 * direccion de verdad, sin publicar nada ni levantar un servidor local.
 *
 * La cookie no contiene la clave. Lleva solo la hora en que vence y una firma
 * HMAC de esa hora hecha con ADMIN_CLAVE. No se puede falsificar sin la clave,
 * y si la clave se cambia en Cloudflare, todas las cookies emitidas dejan de
 * servir en el acto.
 */

var NOMBRE = 'cd_vista';
var DURACION_S = 8 * 60 * 60;

var codificador = new TextEncoder();

async function llave(env) {
  return crypto.subtle.importKey(
    'raw', codificador.encode('vista-previa:' + env.ADMIN_CLAVE),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

function aBase64url(buf) {
  var s = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  var bin = atob(s);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function emitir(env) {
  var vence = Math.floor(Date.now() / 1000) + DURACION_S;
  var firma = await crypto.subtle.sign('HMAC', await llave(env), codificador.encode(String(vence)));
  var valor = vence + '.' + aBase64url(firma);
  return NOMBRE + '=' + valor + '; Max-Age=' + DURACION_S +
    '; Path=/; HttpOnly; Secure; SameSite=Lax';
}

export function borrar() {
  return NOMBRE + '=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax';
}

/**
 * crypto.subtle.verify compara en tiempo constante: no filtra por cuanto
 * tarda si la firma "casi" coincide.
 */
export async function valida(request, env) {
  if (!env.ADMIN_CLAVE) return false;
  var galletas = request.headers.get('Cookie') || '';
  var m = galletas.match(new RegExp('(?:^|;\\s*)' + NOMBRE + '=(\\d+)\\.([A-Za-z0-9_-]+)'));
  if (!m) return false;

  var vence = parseInt(m[1], 10);
  if (!(vence > Date.now() / 1000)) return false;

  try {
    return await crypto.subtle.verify('HMAC', await llave(env), deBase64url(m[2]), codificador.encode(m[1]));
  } catch (e) {
    return false;
  }
}
