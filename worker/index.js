/**
 * Endpoint de captacion de leads — POST /api/lead
 *
 * Este Worker NO sirve el sitio: de eso se encargan los assets estaticos, que
 * Cloudflare entrega antes de ejecutar este codigo. Aqui solo llegan las rutas
 * que no corresponden a ningun archivo, y la unica que nos interesa es /api/lead.
 *
 * Lo que hace con cada lead:
 *   1. Lo guarda como contacto en Brevo, en la lista de leads, con sus atributos
 *   2. Le manda el correo de bienvenida (plantilla 1)
 *   3. Avisa a contacto@coatzadrone.cl para que el lead no dependa de revisar Brevo
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

export default {
  async fetch(request, env) {
    var url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'metodo_no_permitido' }, 405);
      }
      return manejarLead(request, env);
    }

    return new Response('No encontrado', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
};

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
