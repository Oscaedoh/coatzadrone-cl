/**
 * Worker de coatzadrone.cl
 *
 * Atiende, en este orden:
 *
 *   Siempre, aunque el sitio este en mantenimiento:
 *     POST /api/lead            guarda el lead en Brevo
 *     GET  /api/cursos          el catalogo publico
 *     GET  /media/<id>          imagenes subidas desde el panel
 *     /admin y /api/admin/*     el panel comercial
 *
 *   Si el sitio esta en mantenimiento y no hay vista previa, la pagina de aviso.
 *
 *   Paginas:
 *     /                         la portada
 *     /cursos/<id>              la landing de un curso
 *     /sitemap.xml              generado con el catalogo del momento
 *     todo lo demas             el archivo estatico que corresponda
 *
 * Lo primero va antes del chequeo de mantenimiento a proposito: se sigue
 * captando leads y se puede seguir armando el catalogo con el sitio abajo.
 *
 * Las claves (BREVO_API_KEY, ADMIN_CLAVE) van como secretos cifrados en
 * Cloudflare. Nunca en este archivo: el repositorio es publico.
 */

import * as catalogo from './catalogo.js';
import * as admin from './admin.js';
import * as media from './media.js';
import * as paginas from './paginas.js';
import * as vista from './vista.js';

var BREVO = 'https://api.brevo.com/v3';

// Ids del panel de Brevo. Si algun dia se renumeran, se cambian aca.
var LISTA_LEADS = 3;        // "Leads - Cursos Pix4D"
var PLANTILLA_BIENVENIDA = 1;   // "01 · Bienvenida" — para el formulario
var PLANTILLA_NOVEDADES  = 7;   // "Banner · Confirmacion de novedades"

/**
 * Lista para las suscripciones del banner.
 *
 * Quien deja su correo en el banner tiene mucha menos intencion que quien
 * llena el formulario pidiendo que lo contacten por un curso de $275.000. Si
 * los dos reciben la misma secuencia de venta, los del banner marcan spam y
 * eso quema la reputacion del dominio para todos los envios, no solo esos.
 *
 * El id no es un secreto, asi que va aqui y no hay que configurar nada en el
 * panel. La variable LISTA_NOVEDADES de Cloudflare lo sobreescribe por si algun
 * dia hay que cambiarlo sin desplegar.
 */
var LISTA_NOVEDADES = 7;    // "Lista de Novedades"

function listaNovedades(env) {
  var id = parseInt(env.LISTA_NOVEDADES, 10);
  return id > 0 ? id : LISTA_NOVEDADES;
}

var REMITENTE = { name: 'CoatzaDrone Chile', email: 'contacto@coatzadrone.cl' };
var AVISO_INTERNO = 'contacto@coatzadrone.cl';
var WHATSAPP = '56957042650';

/**
 * MANTENIMIENTO — el sitio publico muestra la pagina de aviso.
 *
 * Para volver a publicarlo hay dos caminos:
 *   a) Poner esto en false y hacer push. Tarda lo que tarde el deploy.
 *   b) Sin tocar codigo: en Cloudflare, Settings -> Variables and Secrets,
 *      crear la variable SITIO_PUBLICO con valor 1. Manda por sobre esto.
 *
 * No hay dominio de excepcion a proposito: el sitio queda fuera de linea para
 * el publico. El dueno lo ve igual: al entrar al panel recibe una cookie de
 * vista previa firmada con su clave (worker/vista.js), y con ella navega el
 * sitio real en coatzadrone.cl.
 */
var MANTENIMIENTO = true;

export default {
  async fetch(request, env) {
    var url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'metodo_no_permitido' }, 405);
      }
      return manejarLead(request, env);
    }

    if (url.pathname === '/api/cursos') {
      try {
        return await catalogo.entregar(env);
      } catch (e) {
        // Si algo falla, que el sitio siga cargando con el catalogo inicial.
        return env.ASSETS.fetch(new URL('/data/cursos.json', url).toString());
      }
    }

    if (url.pathname.indexOf('/media/') === 0) {
      return media.servir(env, url.pathname.slice('/media/'.length));
    }

    var api = url.pathname.match(/^\/api\/admin\/(datos|media|vista|salir)$/);
    if (api) return admin.api(request, env, api[1]);

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return admin.pagina(request, env);
    }
    if (url.pathname.indexOf('/admin/') === 0) {
      var r = await env.ASSETS.fetch(request);
      var h = new Headers(r.headers);
      h.set('X-Robots-Tag', 'noindex, nofollow');
      h.set('Cache-Control', 'no-cache');
      return new Response(r.body, { status: r.status, headers: h });
    }

    // Con la cookie de vista previa, el dueno ve el sitio real aunque el
    // publico vea el aviso, y puede abrir cursos ocultos. Ver worker/vista.js.
    var mantenimiento = enMantenimiento(env);
    // Solo se verifica la firma cuando importa: con el sitio publicado, un CSS
    // o una imagen no necesitan saber si quien los pide es el dueno.
    var vistaPrevia = (mantenimiento || url.pathname.indexOf('/cursos/') === 0)
      ? await vista.valida(request, env)
      : false;
    if (mantenimiento && !vistaPrevia) return paginaMantenimiento();
    var opciones = { vistaPrevia: vistaPrevia, mantenimiento: mantenimiento };

    if (url.pathname === '/' || url.pathname === '/index.html') {
      if (url.pathname === '/index.html') {
        return Response.redirect(new URL('/' + url.search, url).toString(), 301);
      }
      try {
        return await paginas.inicio(request, env, opciones);
      } catch (e) {
        return env.ASSETS.fetch(request);
      }
    }

    if (url.pathname === '/cursos' || url.pathname === '/cursos/') {
      return Response.redirect(new URL('/#cursos', url).toString(), 301);
    }

    var ruta = url.pathname.match(/^\/cursos\/([a-z0-9-]{1,80})\/?$/);
    if (ruta) return paginas.curso(request, env, ruta[1], opciones);

    if (url.pathname === '/sitemap.xml') return paginas.sitemap(env);

    return env.ASSETS.fetch(request);
  }
};

function enMantenimiento(env) {
  if (env.SITIO_PUBLICO === '1') return false;
  return MANTENIMIENTO;
}

/**
 * Se responde 503, no 200, y es a proposito: le dice a Google que esto es
 * temporal y que vuelva mas tarde. Con un 200 corre el riesgo de indexar la
 * pagina de aviso como si fuera el sitio, y recuperar eso cuesta semanas.
 */
function paginaMantenimiento() {
  var html = '<!doctype html><html lang="es"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<meta name="robots" content="noindex">' +
    '<title>CoatzaDrone Chile — Volvemos pronto</title>' +
    '<link rel="icon" href="data:,">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Teko:wght@500;600&family=Mukta:wght@400;600&display=swap">' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'padding:32px 20px;background:#0D0D0D;color:#F1F1F1;' +
    'font-family:Mukta,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;line-height:1.65}' +
    '.caja{width:100%;max-width:560px;text-align:center}' +
    '.marca{font-family:Teko,Impact,sans-serif;font-size:clamp(34px,9vw,52px);letter-spacing:2px;' +
    'line-height:1;text-transform:uppercase;margin:0}' +
    '.marca span{color:#DD3330}' +
    '.credencial{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#8A8F94;margin:10px 0 0}' +
    '.linea{width:44px;height:3px;background:#DD3330;margin:30px auto}' +
    'h1{font-family:Teko,Impact,sans-serif;font-weight:500;text-transform:uppercase;' +
    'font-size:clamp(26px,7vw,36px);line-height:1.1;margin:0 0 14px}' +
    'p{margin:0 0 16px;color:#C9CDD1;font-size:16px}' +
    '.acciones{margin-top:30px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center}' +
    'a.btn{display:inline-block;text-decoration:none;font-size:12px;font-weight:600;' +
    'letter-spacing:1.5px;text-transform:uppercase;padding:15px 26px;border-radius:4px}' +
    '.btn--rojo{background:#DD3330;color:#fff}' +
    '.btn--borde{border:2px solid #5E646A;color:#F1F1F1}' +
    '.pie{margin-top:34px;font-size:12px;color:#5E646A}' +
    '.pie a{color:#8A8F94}' +
    '</style></head><body><div class="caja">' +
    '<p class="marca">Coatzadrone <span>Chile</span></p>' +
    '<p class="credencial">Centro de Entrenamiento Oficial Pix4D</p>' +
    '<div class="linea"></div>' +
    '<h1>Estamos preparando<br>algo mejor</h1>' +
    '<p>Nuestro sitio est&aacute; en mantenimiento por unos d&iacute;as mientras preparamos ' +
    'los nuevos cursos y workshops de Pix4D.</p>' +
    '<p>Si quieres informaci&oacute;n sobre los cursos, escr&iacute;benos: respondemos igual.</p>' +
    '<div class="acciones">' +
    '<a class="btn btn--rojo" href="https://wa.me/' + WHATSAPP +
    '?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20los%20cursos%20Pix4D">Escribir por WhatsApp</a>' +
    '<a class="btn btn--borde" href="mailto:' + AVISO_INTERNO + '">Enviar un correo</a>' +
    '</div>' +
    '<p class="pie">Verifica nuestra acreditaci&oacute;n en el ' +
    '<a href="https://training.pix4d.com/pages/locate-a-pix4d-trusted-training-center" ' +
    'target="_blank" rel="noopener">directorio oficial de Pix4D</a>.</p>' +
    '</div></body></html>';

  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '86400',
      'X-Robots-Tag': 'noindex'
    }
  });
}

async function manejarLead(request, env) {
  var datos;
  try {
    datos = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'json_invalido' }, 400);
  }

  // Trampa para bots: el campo esta oculto por CSS, una persona nunca lo llena.
  // Respondemos 200 a proposito para que el bot crea que funciono y no reintente.
  if (texto(datos._gotcha)) {
    return json({ ok: true });
  }

  // El banner solo pide correo; el formulario pide bastante mas.
  var esNovedades = texto(datos.tipo) === 'novedades';

  var nombre = texto(datos.nombre);
  var email = texto(datos.email).toLowerCase();

  if (!emailValido(email) || (!esNovedades && !nombre)) {
    return json({ ok: false, error: 'datos_incompletos' }, 400);
  }

  if (!env.BREVO_API_KEY) {
    // Sin la clave no hay nada que hacer, pero el 503 le dice al formulario que
    // muestre la alternativa de WhatsApp en vez de tragarse el lead en silencio.
    return json({ ok: false, error: 'sin_configurar' }, 503);
  }

  var telefono = normalizarTelefono(texto(datos.telefono), texto(datos.pais));
  var curso = texto(datos.curso_nombre) || texto(datos.curso);

  // Atributos que Brevo acepta siempre: texto plano sin validaciones propias.
  var atributos = {
    NOMBRE: nombre,
    CURSO_INTERES: curso,
    PAIS: texto(datos.pais),
    PERFIL: texto(datos.perfil),
    ORIGEN: texto(datos.origen) || 'directo',
    CAMPANA: texto(datos.campana),
    FECHA_LEAD: hoy(),
    WHATSAPP: telefono
  };

  // Estos dos si los puede rechazar: SMS exige formato E.164 y ESTADO es un
  // atributo de categoria, que solo admite uno de sus valores definidos. Van
  // aparte para poder reintentar sin ellos y no perder el lead por un telefono
  // mal escrito.
  var atributosFragiles = { ESTADO: 'Nuevo' };
  if (esE164(telefono)) atributosFragiles.SMS = telefono;

  var lista = esNovedades ? listaNovedades(env) : LISTA_LEADS;

  var guardado = await guardarContacto(env, email, atributos, atributosFragiles, lista);
  if (!guardado.ok) {
    return json({ ok: false, error: 'brevo_rechazo', detalle: guardado.detalle }, 502);
  }

  // Los correos son secundarios: si fallan, el contacto ya quedo guardado y no
  // tiene sentido decirle a la persona que algo salio mal.
  //
  // El del banner no recibe la bienvenida del curso ni genera aviso interno:
  // pidio que lo mantuvieran informado, no que lo contactaran. Tratarlo como
  // un lead caliente es la forma mas rapida de que se de de baja.
  var pendientes = esNovedades
    ? [confirmarNovedades(env, email)]
    : [
        enviarBienvenida(env, email, nombre),
        avisarInterno(env, { nombre: nombre, email: email, telefono: telefono, curso: curso, datos: datos })
      ];

  var correos = await Promise.allSettled(pendientes);

  return json({
    ok: true,
    tipo: esNovedades ? 'novedades' : 'contacto',
    contacto: guardado.modo,
    correos: correos.map(function (r) { return r.status; })
  });
}

/* ---------- Brevo ---------- */

async function guardarContacto(env, email, atributos, atributosFragiles, lista) {
  var completo = Object.assign({}, atributos, atributosFragiles);

  var r1 = await brevo(env, '/contacts', {
    email: email,
    attributes: completo,
    listIds: [lista],
    updateEnabled: true
  });
  if (r1.ok) return { ok: true, modo: 'completo' };

  // Reintento solo con lo que no puede fallar por validacion.
  var r2 = await brevo(env, '/contacts', {
    email: email,
    attributes: atributos,
    listIds: [lista],
    updateEnabled: true
  });
  if (r2.ok) return { ok: true, modo: 'sin_sms_ni_estado' };

  return { ok: false, detalle: r2.detalle || r1.detalle };
}

/**
 * Confirmacion del banner. Corta y sin venta: la persona pidio que la
 * mantuvieran informada, no que le ofrecieran un curso.
 */
function confirmarNovedades(env, email) {
  return brevo(env, '/smtp/email', {
    to: [{ email: email }],
    templateId: PLANTILLA_NOVEDADES
  });
}

function enviarBienvenida(env, email, nombre) {
  return brevo(env, '/smtp/email', {
    to: [{ email: email, name: nombre }],
    templateId: PLANTILLA_BIENVENIDA,
    params: { NOMBRE: nombre }
  });
}

function avisarInterno(env, lead) {
  var d = lead.datos;
  var filas = [
    ['Nombre', lead.nombre],
    ['Email', lead.email],
    ['Telefono', lead.telefono],
    ['Pais', texto(d.pais)],
    ['Curso', lead.curso],
    ['Perfil', texto(d.perfil)],
    ['Origen', texto(d.origen) || 'directo'],
    ['Campana', texto(d.campana)],
    ['Mensaje', texto(d.mensaje)]
  ];

  var html = '<h2 style="font-family:Arial,sans-serif;">Nuevo lead desde coatzadrone.cl</h2>' +
    '<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse;">' +
    filas.map(function (f) {
      return '<tr><td style="padding:6px 14px 6px 0;color:#5E646A;vertical-align:top;">' + escapar(f[0]) +
             '</td><td style="padding:6px 0;"><strong>' + (escapar(f[1]) || '—') + '</strong></td></tr>';
    }).join('') +
    '</table>';

  return brevo(env, '/smtp/email', {
    sender: REMITENTE,
    to: [{ email: AVISO_INTERNO }],
    replyTo: { email: lead.email, name: lead.nombre },
    subject: 'Lead: ' + lead.nombre + ' — ' + (lead.curso || 'sin curso'),
    htmlContent: html
  });
}

async function brevo(env, ruta, cuerpo) {
  var res;
  try {
    res = await fetch(BREVO + ruta, {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(cuerpo)
    });
  } catch (e) {
    return { ok: false, detalle: 'red: ' + e.message };
  }

  if (res.ok) return { ok: true };

  var detalle = '';
  try { detalle = (await res.text()).slice(0, 300); } catch (e) { /* da igual */ }
  return { ok: false, detalle: res.status + ' ' + detalle };
}

/* ---------- Utilidades ---------- */

function texto(v) {
  return typeof v === 'string' ? v.trim().slice(0, 500) : '';
}

function emailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function esE164(v) {
  return /^\+[1-9]\d{7,14}$/.test(v);
}

/**
 * Deja el telefono en E.164 cuando se puede deducir sin inventar.
 * Si queda la duda, se devuelve tal cual: se guarda igual en WHATSAPP y
 * simplemente no se usa para SMS.
 */
function normalizarTelefono(valor, pais) {
  var limpio = valor.replace(/[\s().-]/g, '');
  if (!limpio) return '';
  if (limpio.charAt(0) === '+') return limpio;

  var digitos = limpio.replace(/\D/g, '');
  if (!digitos) return '';

  if (digitos.length === 11 && digitos.indexOf('56') === 0) return '+' + digitos;
  // Movil chileno escrito sin codigo de pais: 9 digitos partiendo en 9.
  if (pais === 'Chile' && digitos.length === 9 && digitos.charAt(0) === '9') return '+56' + digitos;

  return digitos;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function escapar(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(cuerpo, estado) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
