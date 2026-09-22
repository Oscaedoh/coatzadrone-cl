/**
 * Worker de coatzadrone.cl
 *
 * Hace tres cosas, en este orden:
 *   1. Si el sitio esta en mantenimiento, responde la pagina de aviso a todo
 *      el mundo salvo a la URL de trabajo (ver MANTENIMIENTO mas abajo)
 *   2. Atiende POST /api/lead, que guarda el lead en Brevo
 *   3. Para todo lo demas, entrega el archivo estatico que corresponda
 *
 * La clave de Brevo va como secreto cifrado en Cloudflare (BREVO_API_KEY).
 * Nunca en este archivo: el repositorio es publico.
 */

var BREVO = 'https://api.brevo.com/v3';

// Ids del panel de Brevo. Si algun dia se renumeran, se cambian aca.
var LISTA_LEADS = 3;        // "Leads - Cursos Pix4D"
var PLANTILLA_BIENVENIDA = 1;
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
 * El dominio de trabajo (*.workers.dev) nunca ve el aviso: ahi seguimos
 * revisando el sitio real mientras el publico ve la pagina de aviso.
 */
var MANTENIMIENTO = true;
var DOMINIO_DE_TRABAJO = '.workers.dev';

export default {
  async fetch(request, env) {
    var url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'metodo_no_permitido' }, 405);
      }
      return manejarLead(request, env);
    }

    if (enMantenimiento(env) && !esDominioDeTrabajo(url)) {
      return paginaMantenimiento();
    }

    var respuesta = await env.ASSETS.fetch(request);

    // En el dominio de trabajo el sitio real esta visible mientras dura el
    // mantenimiento. Que ningun buscador lo indexe y termine compitiendo
    // con coatzadrone.cl en los resultados.
    if (esDominioDeTrabajo(url)) {
      respuesta = new Response(respuesta.body, respuesta);
      respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    return respuesta;
  }
};

function enMantenimiento(env) {
  if (env.SITIO_PUBLICO === '1') return false;
  return MANTENIMIENTO;
}

function esDominioDeTrabajo(url) {
  return url.hostname.indexOf(DOMINIO_DE_TRABAJO) !== -1;
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

  var nombre = texto(datos.nombre);
  var email = texto(datos.email).toLowerCase();

  if (!nombre || !emailValido(email)) {
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

  var guardado = await guardarContacto(env, email, atributos, atributosFragiles);
  if (!guardado.ok) {
    return json({ ok: false, error: 'brevo_rechazo', detalle: guardado.detalle }, 502);
  }

  // Los dos correos son secundarios: si fallan, el lead ya quedo guardado y no
  // tiene sentido decirle a la persona que algo salio mal.
  var correos = await Promise.allSettled([
    enviarBienvenida(env, email, nombre),
    avisarInterno(env, { nombre: nombre, email: email, telefono: telefono, curso: curso, datos: datos })
  ]);

  return json({
    ok: true,
    contacto: guardado.modo,
    correos: correos.map(function (r) { return r.status; })
  });
}

/* ---------- Brevo ---------- */

async function guardarContacto(env, email, atributos, atributosFragiles) {
  var completo = Object.assign({}, atributos, atributosFragiles);

  var r1 = await brevo(env, '/contacts', {
    email: email,
    attributes: completo,
    listIds: [LISTA_LEADS],
    updateEnabled: true
  });
  if (r1.ok) return { ok: true, modo: 'completo' };

  // Reintento solo con lo que no puede fallar por validacion.
  var r2 = await brevo(env, '/contacts', {
    email: email,
    attributes: atributos,
    listIds: [LISTA_LEADS],
    updateEnabled: true
  });
  if (r2.ok) return { ok: true, modo: 'sin_sms_ni_estado' };

  return { ok: false, detalle: r2.detalle || r1.detalle };
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
