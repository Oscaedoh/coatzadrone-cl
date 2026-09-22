/**
 * Catalogo de cursos: la parte que se vende.
 *
 * La idea de fondo: un curso no es un producto. El producto es la EDICION —
 * "Pix4Dfields, del 20 al 22 de octubre, $275.000, este link de pago". Un mismo
 * curso puede tener varias ediciones al ano, cada una con su fecha, su cupo, su
 * precio y su propio boton de pago. Por eso lo comercial vive en cada cohorte y
 * no en el curso.
 *
 * De donde sale cada cosa:
 *
 *   data/cursos.json  -> el contenido: temario, instructor, textos, imagenes.
 *                        Cambia poco, conviene que quede con historial en git.
 *   Cloudflare KV     -> lo comercial: precio, fechas, cupos y links de pago.
 *                        Cambia seguido y tiene que poder editarse sin deploy.
 *
 * GET /api/cursos entrega la union de los dos, con KV mandando por sobre el
 * archivo. Si KV no esta configurado, entrega el archivo tal cual: el sitio
 * nunca se cae por esto.
 */

var CLAVE_KV = 'comercio';

// Lo unico que el panel puede tocar de un curso. Todo lo demas es del repositorio.
var CAMPOS_CURSO = ['titulo', 'observaciones', 'estado', 'precio', 'pagos', 'cohortes'];

var ESTADOS_CURSO   = ['inscripciones-abiertas', 'proximamente', 'cerrado'];
var ESTADOS_COHORTE = ['abierta', 'ultimos-cupos', 'agotada', 'cerrado'];

/**
 * Medios de pago habilitados hoy.
 *
 * Mercado Pago y PayPal quedan fuera por ahora, por decision del dueno. No se
 * borra el soporte: los campos siguen existiendo en el modelo y volver a
 * activarlos es agregar el nombre a esta lista. Mientras esten fuera, el panel
 * no muestra su casilla y lo que llegue con esos medios se descarta, asi que
 * no puede quedar un boton vivo de un medio apagado.
 */
var MEDIOS_PAGO = ['flow'];

var CAMPO_DE_MEDIO = {
  flow: 'flow_url',
  mercadopago: 'mercadopago_url',
  paypal: 'paypal_url'
};

/* ---------- Lectura ---------- */

export async function leerBase(env) {
  var r = await env.ASSETS.fetch('https://coatzadrone.cl/data/cursos.json');
  if (!r.ok) throw new Error('no se pudo leer data/cursos.json');
  return r.json();
}

export function hayKV(env) {
  return !!(env.CONFIG && typeof env.CONFIG.get === 'function');
}

export async function leerCambios(env) {
  if (!hayKV(env)) return null;
  var crudo = await env.CONFIG.get(CLAVE_KV);
  if (!crudo) return null;
  try { return JSON.parse(crudo); } catch (e) { return null; }
}

export async function guardarCambios(env, cambios) {
  if (!hayKV(env)) throw new Error('falta_kv');
  await env.CONFIG.put(CLAVE_KV, JSON.stringify(cambios));
}

/* ---------- Fusion ---------- */

/**
 * Lo de KV pisa lo del archivo, campo por campo. Las cohortes se reemplazan
 * completas y no se mezclan: si el panel manda una lista de fechas, esa es la
 * lista. Mezclarlas por posicion haria imposible borrar una.
 */
/**
 * Borra los links de los medios apagados.
 *
 * Se aplica al LEER, no solo al guardar. Filtrar unicamente a la entrada deja
 * viva cualquier URL que ya estuviera almacenada de antes, y entonces apagar un
 * medio no apaga su boton: sigue cobrando por un canal que se decidio no usar.
 * Aqui el estado de MEDIOS_PAGO manda siempre, sin importar que haya guardado.
 */
function soloMediosActivos(pagos) {
  var p = Object.assign({}, pagos || {});
  Object.keys(CAMPO_DE_MEDIO).forEach(function (medio) {
    if (MEDIOS_PAGO.indexOf(medio) === -1) p[CAMPO_DE_MEDIO[medio]] = '';
  });
  return p;
}

export function fusionar(base, cambios) {
  var porCurso = (cambios && cambios.cursos) || {};

  (base.cursos || []).forEach(function (curso) {
    var c = porCurso[curso.id];
    if (!c) return;
    // El titulo vacio no pisa: asi un campo que quedo en blanco por descuido
    // no deja el curso sin nombre.
    if (c.titulo) curso.titulo = c.titulo;
    if (typeof c.observaciones === 'string') curso.observaciones = c.observaciones;
    if (c.estado) curso.estado = c.estado;
    if (c.precio) curso.precio = Object.assign({}, curso.precio, c.precio);
    if (c.pagos)  curso.pagos  = Object.assign({}, curso.pagos,  c.pagos);
    if (Array.isArray(c.cohortes)) curso.cohortes = c.cohortes;
  });

  // Ultima palabra sobre los medios de pago, venga el link del archivo o de KV.
  (base.cursos || []).forEach(function (curso) {
    curso.pagos = soloMediosActivos(curso.pagos);
    (curso.cohortes || []).forEach(function (ch) {
      ch.pagos = soloMediosActivos(ch.pagos);
    });
  });

  base.actualizado = (cambios && cambios.actualizado) || null;
  return base;
}

export async function entregar(env) {
  var base = await leerBase(env);
  var datos = fusionar(base, await leerCambios(env));
  return new Response(JSON.stringify(datos), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Sin cache: si sube un precio o se agota un cupo, tiene que verse ya.
      'Cache-Control': 'no-store'
    }
  });
}

/* ---------- Validacion de lo que manda el panel ---------- */

function texto(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max || 200) : '';
}

function entero(v, max) {
  var n = parseInt(v, 10);
  if (!isFinite(n) || n < 0 || n > max) return null;
  return n;
}

function fechaISO(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;
}

/**
 * Solo https, y sin espacios ni comillas. Un link de pago siempre cumple eso.
 * Asi un "javascript:..." no puede terminar nunca en el href de un boton,
 * aunque alguien consiga entrar al panel.
 */
function enlace(v) {
  var s = texto(v, 500);
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : '';
}

function deLista(v, lista) {
  return lista.indexOf(v) !== -1 ? v : lista[0];
}

function limpiarPrecio(p) {
  p = p || {};
  return {
    clp: entero(p.clp, 99999999),
    clp_early: entero(p.clp_early, 99999999),
    early_hasta: fechaISO(p.early_hasta),
    nota: texto(p.nota, 300)
  };
}

/**
 * Solo se conservan los links de los medios habilitados. Un medio apagado se
 * guarda vacio aunque venga con valor: asi apagarlo apaga de verdad el boton,
 * y no queda uno cobrando por un canal que se decidio no usar.
 */
function limpiarPagos(p) {
  p = p || {};
  var salida = { mercadopago_url: '', flow_url: '', paypal_url: '', transferencia: p.transferencia !== false };
  MEDIOS_PAGO.forEach(function (medio) {
    var campo = CAMPO_DE_MEDIO[medio];
    if (campo) salida[campo] = enlace(p[campo]);
  });
  return salida;
}

function limpiarCohorte(ch, i) {
  ch = ch || {};
  var inicio = fechaISO(ch.inicio);
  if (!inicio) return null;   // una edicion sin fecha de inicio no es un producto

  return {
    id: texto(ch.id, 40).replace(/[^a-zA-Z0-9-]/g, '') || ('ed' + (i + 1)),
    inicio: inicio,
    fin: fechaISO(ch.fin) || inicio,
    horario: texto(ch.horario, 120),
    sesiones: Array.isArray(ch.sesiones)
      ? ch.sesiones.slice(0, 12).map(function (s) { return texto(s, 80); }).filter(Boolean)
      : [],
    cupos_totales: entero(ch.cupos_totales, 999),
    cupos_disponibles: entero(ch.cupos_disponibles, 999),
    estado: deLista(ch.estado, ESTADOS_COHORTE),
    confirmada: ch.confirmada !== false,
    observaciones: texto(ch.observaciones, 300),
    precio: limpiarPrecio(ch.precio),
    pagos: limpiarPagos(ch.pagos)
  };
}

/**
 * Todo lo que entra por el panel pasa por aca antes de guardarse. No es
 * desconfianza del dueno: es que lo guardado se renderiza despues en la pagina
 * publica, y un dato con forma rara ahi se ve como un sitio roto.
 */
export function limpiarCambios(entrada, idsValidos) {
  var cursos = {};
  var origen = (entrada && entrada.cursos) || {};

  idsValidos.forEach(function (id) {
    var c = origen[id];
    if (!c) return;
    cursos[id] = {
      titulo: texto(c.titulo, 140),
      observaciones: texto(c.observaciones, 500),
      estado: deLista(c.estado, ESTADOS_CURSO),
      precio: limpiarPrecio(c.precio),
      pagos: limpiarPagos(c.pagos),
      cohortes: (Array.isArray(c.cohortes) ? c.cohortes : [])
        .slice(0, 24)
        .map(limpiarCohorte)
        .filter(Boolean)
        .sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; })
    };
  });

  return { actualizado: new Date().toISOString(), cursos: cursos };
}

export { CAMPOS_CURSO, ESTADOS_CURSO, ESTADOS_COHORTE, MEDIOS_PAGO, CAMPO_DE_MEDIO };
