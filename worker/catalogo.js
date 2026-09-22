/**
 * Catalogo: los cursos y los instructores.
 *
 * Todo se administra desde /admin y se guarda en Cloudflare KV bajo la clave
 * CLAVE_CATALOGO. data/cursos.json queda como catalogo INICIAL: se usa solo si
 * el panel nunca se ha guardado o si KV no responde, para que el sitio nunca se
 * caiga por esto.
 *
 * Lo unico que se sigue leyendo siempre del archivo es 'config' (WhatsApp,
 * correo, ids de analitica) y 'faq', que no se editan en el panel.
 *
 * Un curso es un producto con todo lo que se muestra de el: textos, imagen,
 * temario, instructores. Lo que se COMPRA es una edicion (una fecha con su
 * cupo, su precio y su link de pago), y por eso lo comercial vive en cada
 * cohorte y solo hereda lo del curso cuando la edicion no lo define.
 */

var CLAVE_CATALOGO = 'catalogo';

// Clave del formato anterior, que guardaba solo lo comercial. Se lee una unica
// vez para migrar lo que ya estaba cargado; el primer guardado del panel nuevo
// escribe CLAVE_CATALOGO y desde ahi esta se ignora.
var CLAVE_ANTERIOR = 'comercio';

var ESTADOS_CURSO   = ['inscripciones-abiertas', 'proximamente', 'cerrado'];
var ESTADOS_COHORTE = ['abierta', 'ultimos-cupos', 'agotada', 'cerrado'];

/**
 * Medios de pago habilitados hoy.
 *
 * Mercado Pago y PayPal quedan fuera por ahora, por decision del dueno. No se
 * borra el soporte: los campos siguen existiendo y volver a activarlos es
 * agregar el nombre a esta lista. Mientras esten fuera, el panel no muestra su
 * casilla, lo que llegue con esos medios se descarta y, al leer, se borra
 * cualquier link que ya estuviera guardado.
 */
var MEDIOS_PAGO = ['flow'];

var CAMPO_DE_MEDIO = {
  flow: 'flow_url',
  mercadopago: 'mercadopago_url',
  paypal: 'paypal_url'
};

var MAX_CURSOS = 50;
var MAX_INSTRUCTORES = 50;

/* ---------- Lectura ---------- */

export function hayKV(env) {
  return !!(env.CONFIG && typeof env.CONFIG.get === 'function');
}

// Si data/cursos.json no se puede leer (por ejemplo, una coma de mas al
// editarlo a mano), el sitio sigue con esto y con el catalogo del panel. Sin
// este respaldo, un error de tipeo en las preguntas frecuentes botaria todos
// los cursos, aunque vivan en KV.
var CONFIG_RESPALDO = {
  moneda_principal: 'CLP',
  whatsapp: '56957042650',
  whatsapp_texto: 'Hola, quiero información sobre los cursos Pix4D de CoatzaDrone Chile',
  email: 'contacto@coatzadrone.cl',
  formulario_endpoint: '/api/lead',
  ga4_id: '',
  meta_pixel_id: ''
};

export async function leerBase(env) {
  try {
    var r = await env.ASSETS.fetch('https://coatzadrone.cl/data/cursos.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    return { config: CONFIG_RESPALDO, faq: [], cursos: [], instructores: [], _respaldo: true };
  }
}

async function leerKV(env, clave) {
  if (!hayKV(env)) return null;
  var crudo = await env.CONFIG.get(clave);
  if (!crudo) return null;
  try { return JSON.parse(crudo); } catch (e) { return null; }
}

/**
 * El catalogo vigente, completo, incluidos los cursos ocultos.
 * Es lo que ve el panel. La pagina publica usa catalogoPublico().
 */
export async function leerCatalogo(env, base) {
  base = base || await leerBase(env);

  var guardado = await leerKV(env, CLAVE_CATALOGO);
  if (guardado && Array.isArray(guardado.cursos)) {
    return {
      actualizado: guardado.actualizado || null,
      cursos: guardado.cursos,
      instructores: guardado.instructores || []
    };
  }

  // Nunca se guardo con el panel nuevo: se arma desde el archivo, aplicando
  // encima lo que se hubiera cargado con el panel anterior.
  var inicial = desdeArchivo(base);
  var anterior = await leerKV(env, CLAVE_ANTERIOR);
  if (anterior) aplicarAnterior(inicial, anterior);
  return inicial;
}

/**
 * Lo que puede ver cualquiera: sin cursos ocultos y con los medios de pago
 * apagados borrados, venga el link de donde venga.
 *
 * incluirOcultos es solo para la vista previa del dueno: le deja revisar un
 * curso en borrador en su pagina real antes de publicarlo.
 */
export async function catalogoPublico(env, incluirOcultos) {
  var base = await leerBase(env);
  var cat;
  try {
    cat = await leerCatalogo(env, base);
  } catch (e) {
    // KV caido o dato corrupto: el sitio sigue con el archivo.
    cat = desdeArchivo(base);
  }

  var cursos = cat.cursos
    .filter(function (c) { return incluirOcultos || c.activo !== false; })
    .map(conMediosActivos);

  return {
    formato: 2,
    actualizado: cat.actualizado,
    config: base.config || {},
    faq: base.faq || [],
    instructores: cat.instructores,
    cursos: cursos
  };
}

export async function entregar(env) {
  var datos = await catalogoPublico(env);
  return new Response(JSON.stringify(datos), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Sin cache: si sube un precio o se agota un cupo, tiene que verse ya.
      'Cache-Control': 'no-store'
    }
  });
}

export async function guardarCatalogo(env, catalogo) {
  if (!hayKV(env)) throw new Error('falta_kv');
  await env.CONFIG.put(CLAVE_CATALOGO, JSON.stringify(catalogo));
}

/* ---------- Migracion ---------- */

/**
 * Convierte el archivo al formato del panel. Entiende tambien el formato
 * viejo, donde cada curso traia su instructor adentro en vez de referenciarlo.
 */
export function desdeArchivo(base) {
  var instructores = (base.instructores || []).slice();
  var ids = {};
  instructores.forEach(function (i) { ids[i.id] = true; });

  var cursos = (base.cursos || []).map(function (c) {
    var curso = Object.assign({}, c);
    if (!Array.isArray(curso.instructores)) {
      curso.instructores = [];
      var viejo = c.instructor;
      if (viejo && viejo.nombre) {
        var id = unico(slug(viejo.nombre), ids);
        ids[id] = true;
        instructores.push({
          id: id,
          nombre: viejo.nombre,
          cargo: viejo.cargo || '',
          bio: viejo.bio || '',
          foto: viejo.foto || '',
          enlaces: viejo.certificado_url
            ? [{ texto: 'Ver certificación Pix4D', url: viejo.certificado_url }]
            : []
        });
        curso.instructores = [id];
      }
    }
    delete curso.instructor;
    delete curso.destacado;
    return curso;
  });

  return { actualizado: null, cursos: cursos, instructores: instructores };
}

// El panel anterior solo guardaba nombre, observaciones y lo comercial.
function aplicarAnterior(cat, anterior) {
  var porCurso = anterior.cursos || {};
  cat.cursos.forEach(function (curso) {
    var c = porCurso[curso.id];
    if (!c) return;
    if (c.titulo) curso.titulo = c.titulo;
    if (typeof c.observaciones === 'string') curso.observaciones = c.observaciones;
    if (c.estado) curso.estado = c.estado;
    if (c.precio) curso.precio = Object.assign({}, curso.precio, c.precio);
    if (c.pagos)  curso.pagos  = Object.assign({}, curso.pagos,  c.pagos);
    if (Array.isArray(c.cohortes)) curso.cohortes = c.cohortes;
  });
  cat.actualizado = anterior.actualizado || null;
}

/* ---------- Medios de pago ---------- */

function soloMediosActivos(pagos) {
  var p = Object.assign({}, pagos || {});
  Object.keys(CAMPO_DE_MEDIO).forEach(function (medio) {
    if (MEDIOS_PAGO.indexOf(medio) === -1) p[CAMPO_DE_MEDIO[medio]] = '';
  });
  return p;
}

function conMediosActivos(curso) {
  var c = Object.assign({}, curso);
  c.pagos = soloMediosActivos(c.pagos);
  c.cohortes = (c.cohortes || []).map(function (ch) {
    return Object.assign({}, ch, { pagos: soloMediosActivos(ch.pagos) });
  });
  return c;
}

/* ---------- Utilidades de validacion ---------- */

function texto(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max || 200) : '';
}

// Texto largo: se conservan los saltos de linea, pero no mas de dos seguidos.
function parrafo(v, max) {
  return texto(v, max).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
}

function lista(v, maxItems, maxLargo) {
  if (!Array.isArray(v)) return [];
  return v.map(function (x) { return texto(x, maxLargo); })
    .filter(Boolean)
    .slice(0, maxItems);
}

function entero(v, max) {
  if (v === null || v === undefined || v === '') return null;
  var n = parseInt(v, 10);
  if (!isFinite(n) || n < 0 || n > max) return null;
  return n;
}

function fechaISO(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;
}

/**
 * Solo https, y sin espacios ni comillas. Asi un "javascript:..." no puede
 * terminar nunca en el href de un boton aunque alguien consiga entrar al panel.
 */
function enlace(v) {
  var s = texto(v, 500);
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : '';
}

/**
 * Imagenes: solo las subidas al panel (/media/...) o las que vienen con el
 * sitio (assets/img/...). Nada externo: una imagen de otro dominio puede
 * desaparecer o cambiar sin aviso, y deja la pagina rota en medio de una
 * campana.
 */
function imagen(v) {
  var s = texto(v, 200);
  if (/^\/media\/[a-z0-9]{12,40}\.(jpg|png|webp)$/.test(s)) return s;
  if (/^assets\/img\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|svg)$/.test(s)) return s;
  return '';
}

function deLista(v, opciones) {
  return opciones.indexOf(v) !== -1 ? v : opciones[0];
}

export function slug(v) {
  return String(v || '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

function esSlug(v) {
  return typeof v === 'string' && v.length >= 3 && v.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
}

function unico(base, usados) {
  var id = base || 'item';
  var n = 2;
  while (usados[id]) id = base + '-' + (n++);
  return id;
}

/* ---------- Validacion ---------- */

function limpiarPrecio(p) {
  p = p || {};
  return {
    clp: entero(p.clp, 99999999),
    clp_early: entero(p.clp_early, 99999999),
    early_hasta: fechaISO(p.early_hasta),
    nota: texto(p.nota, 300)
  };
}

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

  var fin = fechaISO(ch.fin);
  if (!fin || fin < inicio) fin = inicio;

  return {
    id: texto(ch.id, 40).replace(/[^a-zA-Z0-9-]/g, '') || ('ed-' + inicio.replace(/-/g, '') + '-' + (i + 1)),
    inicio: inicio,
    fin: fin,
    horario: texto(ch.horario, 120),
    sesiones: lista(ch.sesiones, 12, 80),
    cupos_totales: entero(ch.cupos_totales, 999),
    cupos_disponibles: entero(ch.cupos_disponibles, 999),
    estado: deLista(ch.estado, ESTADOS_COHORTE),
    confirmada: ch.confirmada !== false,
    observaciones: parrafo(ch.observaciones, 300),
    precio: limpiarPrecio(ch.precio),
    pagos: limpiarPagos(ch.pagos)
  };
}

function limpiarModulo(m, i) {
  m = m || {};
  var titulo = texto(m.titulo, 160);
  if (!titulo) return null;
  return {
    numero: i + 1,
    titulo: titulo,
    objetivo: parrafo(m.objetivo, 800),
    contenidos: lista(m.contenidos, 40, 300)
  };
}

function limpiarInstructor(ins) {
  ins = ins || {};
  return {
    id: ins.id,
    nombre: texto(ins.nombre, 120),
    cargo: texto(ins.cargo, 160),
    bio: parrafo(ins.bio, 2000),
    foto: imagen(ins.foto),
    enlaces: (Array.isArray(ins.enlaces) ? ins.enlaces : [])
      .map(function (e) {
        e = e || {};
        var url = enlace(e.url);
        return url ? { texto: texto(e.texto, 60) || 'Ver certificación Pix4D', url: url } : null;
      })
      .filter(Boolean)
      .slice(0, 6)
  };
}

function limpiarCurso(c, idsInstructor) {
  var req = c.requisitos_tecnicos || {};
  return {
    id: c.id,
    alias: c.alias,
    activo: c.activo !== false,
    estado: deLista(c.estado, ESTADOS_CURSO),
    titulo: texto(c.titulo, 140),
    subtitulo: texto(c.subtitulo, 240),
    software: texto(c.software, 40),
    nivel: texto(c.nivel, 60),
    modalidad: texto(c.modalidad, 60),
    duracion: texto(c.duracion, 80),
    idioma: texto(c.idioma, 40),
    imagen: imagen(c.imagen),
    resumen: parrafo(c.resumen, 600),
    objetivo: parrafo(c.objetivo, 1500),
    perfil_egresado: parrafo(c.perfil_egresado, 1500),
    dirigido_a: lista(c.dirigido_a, 30, 300),
    incluye: lista(c.incluye, 30, 300),
    beneficios: lista(c.beneficios, 30, 300),
    resultados: lista(c.resultados, 30, 300),
    modulos: (Array.isArray(c.modulos) ? c.modulos : [])
      .slice(0, 20).map(limpiarModulo).filter(Boolean)
      .map(function (m, i) { m.numero = i + 1; return m; }),
    requisitos_tecnicos: {
      nota: texto(req.nota, 300),
      items: lista(req.items, 20, 200)
    },
    instructores: lista(c.instructores, 10, 80)
      .filter(function (id) { return idsInstructor[id]; }),
    observaciones: parrafo(c.observaciones, 500),
    precio: limpiarPrecio(c.precio),
    pagos: limpiarPagos(c.pagos),
    cohortes: (Array.isArray(c.cohortes) ? c.cohortes : [])
      .slice(0, 24)
      .map(limpiarCohorte)
      .filter(Boolean)
      .sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; })
  };
}

/**
 * Todo lo que entra por el panel pasa por aca antes de guardarse. No es
 * desconfianza del dueno: lo guardado se renderiza despues en la pagina
 * publica, y un dato con forma rara ahi se ve como un sitio roto.
 *
 * Devuelve { ok, catalogo } o { ok: false, errores } con lo que hay que
 * corregir. Un error no se "arregla" en silencio borrando el dato: el panel
 * lo muestra y la persona decide.
 */
export function limpiarCatalogo(entrada) {
  entrada = entrada || {};
  var errores = [];

  /* Instructores primero: los cursos los referencian. */
  var usadosIns = {};
  var instructores = (Array.isArray(entrada.instructores) ? entrada.instructores : [])
    .slice(0, MAX_INSTRUCTORES)
    .map(function (ins, i) {
      var limpio = limpiarInstructor(ins);
      if (!limpio.nombre) {
        errores.push('El instructor número ' + (i + 1) + ' no tiene nombre.');
        return null;
      }
      var id = esSlug(limpio.id) ? limpio.id : slug(limpio.nombre);
      limpio.id = unico(id || 'instructor', usadosIns);
      usadosIns[limpio.id] = true;
      return limpio;
    })
    .filter(Boolean);

  /* Cursos. El id es la direccion de su pagina: coatzadrone.cl/cursos/<id>. */
  var usados = {};
  var cursos = (Array.isArray(entrada.cursos) ? entrada.cursos : [])
    .slice(0, MAX_CURSOS)
    .map(function (c, i) {
      c = c || {};
      var limpio = limpiarCurso(c, usadosIns);
      if (!limpio.titulo) {
        errores.push('El curso número ' + (i + 1) + ' no tiene nombre.');
        return null;
      }
      var id = esSlug(c.id) ? c.id : slug(limpio.titulo);
      if (usados[id]) {
        errores.push('Dos cursos usan la misma dirección: /cursos/' + id + '.');
        return null;
      }
      limpio.id = id;
      usados[id] = true;
      return limpio;
    })
    .filter(Boolean);

  /*
   * Alias: direcciones anteriores de un curso. Si se cambia la direccion de un
   * curso que ya tiene anuncios corriendo, esos anuncios siguen funcionando
   * porque la direccion vieja redirige a la nueva. Un alias no puede pisar la
   * direccion vigente de otro curso.
   */
  cursos.forEach(function (c) {
    c.alias = lista(c.alias, 20, 80)
      .filter(function (a) { return esSlug(a) && a !== c.id && !usados[a]; });
  });

  if (errores.length) return { ok: false, errores: errores };

  return {
    ok: true,
    catalogo: {
      formato: 2,
      actualizado: new Date().toISOString(),
      cursos: cursos,
      instructores: instructores
    }
  };
}

/* ---------- Busqueda ---------- */

/**
 * Busca un curso visible por su direccion. Si la direccion es vieja, devuelve
 * el curso con 'redirigir' para que la pagina responda un 301 a la nueva.
 */
export function buscarCurso(publico, id) {
  var cursos = publico.cursos || [];
  for (var i = 0; i < cursos.length; i++) {
    if (cursos[i].id === id) return { curso: cursos[i] };
  }
  for (var j = 0; j < cursos.length; j++) {
    if ((cursos[j].alias || []).indexOf(id) !== -1) return { curso: cursos[j], redirigir: true };
  }
  return null;
}

export { ESTADOS_CURSO, ESTADOS_COHORTE, MEDIOS_PAGO, CAMPO_DE_MEDIO };
