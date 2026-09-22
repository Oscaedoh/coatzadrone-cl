/* ==========================================================================
   Panel comercial — CoatzaDrone Chile

   Administra el catálogo completo: cursos (con todo lo que se muestra de
   ellos), sus fechas a la venta y los instructores. Todo se edita en memoria y
   se publica de una vez con "Guardar y publicar".

   Rutas (en el # de la dirección, para que el botón Atrás funcione):
     #/cursos              listado de cursos
     #/cursos/<k>          ficha de un curso (bloques plegables)
     #/instructores        listado de instructores
     #/instructores/<k>    ficha de un instructor

   <k> es una llave interna de esta sesión, no el id del curso: el id cambia si
   se edita la dirección, y la ficha abierta no debe perderse por eso.
   ========================================================================== */

(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var API = '/api/admin/';
  var clave = '';
  try { clave = sessionStorage.getItem('cd_admin') || ''; } catch (e) { /* modo privado */ }

  var E = {
    cursos: [],
    instructores: [],
    medios: ['flow'],
    kv: true,
    actualizado: null,
    imagenesSitio: []
  };
  var sucio = false;
  var siguienteLlave = 1;
  var idCampo = 0;

  var ESTADOS_CURSO = [
    ['inscripciones-abiertas', 'Inscripciones abiertas'],
    ['proximamente', 'Próximamente'],
    ['cerrado', 'Cerrado']
  ];
  var ESTADOS_FECHA = [
    ['abierta', 'Abierta'],
    ['ultimos-cupos', 'Últimos cupos'],
    ['agotada', 'Agotada'],
    ['cerrado', 'Oculta']
  ];
  var MEDIO_NOMBRE = {
    flow: 'Link de pago (Flow / Webpay)',
    mercadopago: 'Link de Mercado Pago',
    paypal: 'Link de PayPal'
  };
  var MEDIO_CAMPO = { flow: 'flow_url', mercadopago: 'mercadopago_url', paypal: 'paypal_url' };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /* ---------- Utilidades ---------- */

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // La misma regla que usa el servidor para armar direcciones.
  function slug(v) {
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

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  function leer(obj, ruta) {
    return ruta.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function escribir(obj, ruta, valor) {
    var partes = ruta.split('.');
    var o = obj;
    for (var i = 0; i < partes.length - 1; i++) {
      if (o[partes[i]] == null || typeof o[partes[i]] !== 'object') o[partes[i]] = {};
      o = o[partes[i]];
    }
    o[partes[partes.length - 1]] = valor;
  }

  // Las imágenes del sitio vienen como "assets/img/x.jpg"; el panel vive en
  // /admin/, así que sin la barra inicial se buscarían en /admin/assets/...
  function urlImagen(src) {
    if (!src) return '';
    return src.charAt(0) === '/' ? src : '/' + src;
  }

  function precioCLP(n) {
    return '$' + Number(n).toLocaleString('es-CL');
  }

  function hoy() { return new Date().toISOString().slice(0, 10); }

  function fechaCorta(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return (+p[2]) + ' ' + MESES[(+p[1]) - 1] + ' ' + p[0];
  }

  function rango(ch) {
    if (!ch.inicio) return 'Sin fecha';
    if (!ch.fin || ch.fin === ch.inicio) return fechaCorta(ch.inicio);
    return fechaCorta(ch.inicio) + ' → ' + fechaCorta(ch.fin);
  }

  function proximaEdicion(c) {
    var h = hoy();
    return (c.cohortes || [])
      .filter(function (ch) { return ch.inicio && ch.estado !== 'cerrado' && (ch.fin || ch.inicio) >= h; })
      .sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; })[0] || null;
  }

  function precioVisible(c) {
    var ed = proximaEdicion(c);
    var p = (ed && ed.precio && ed.precio.clp) ? ed.precio : (c.precio || {});
    return p.clp ? precioCLP(p.clp) : '—';
  }

  function etiquetaEstado(v) {
    for (var i = 0; i < ESTADOS_CURSO.length; i++) if (ESTADOS_CURSO[i][0] === v) return ESTADOS_CURSO[i][1];
    return '';
  }

  function iniciales(nombre) {
    return String(nombre || '?').replace(/^(Ing|Dr|Dra|Lic|Mg)\.?\s+/i, '')
      .split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
  }

  /* ---------- Constructores de campos ---------- */

  /**
   * Cada campo lleva data-c con la ruta del dato que edita dentro del objeto
   * al que se enlaza ("precio.clp", "pagos.flow_url"). enlazar() hace el
   * resto: carga el valor y lo escribe de vuelta en cada cambio.
   *
   * Tipos (data-t): txt, num, lineas (una idea por línea → lista), bool.
   */
  function campo(etiqueta, ruta, o) {
    o = o || {};
    var id = 'f' + (++idCampo);
    var tipo = o.tipo || 'txt';
    var attrs = 'id="' + id + '" data-c="' + ruta + '" data-t="' + tipo + '"' +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') +
      (o.requerido ? ' required' : '') + (o.extra ? ' ' + o.extra : '');
    var control;
    if (o.area || tipo === 'lineas') {
      control = '<textarea ' + attrs + (o.alto ? ' class="alto"' : '') + '></textarea>';
    } else {
      var tipoHtml = o.html || (tipo === 'num' ? 'number' : 'text');
      control = '<input type="' + tipoHtml + '" ' + attrs + '>';
    }
    return '<div class="campo"><label for="' + id + '">' + esc(etiqueta) + (o.requerido ? ' *' : '') + '</label>' +
      control + (o.pista ? '<p class="pista">' + o.pista + '</p>' : '') + '</div>';
  }

  function selector(etiqueta, ruta, opciones) {
    var id = 'f' + (++idCampo);
    return '<div class="campo"><label for="' + id + '">' + esc(etiqueta) + '</label>' +
      '<select id="' + id + '" data-c="' + ruta + '" data-t="txt">' +
      opciones.map(function (op) { return '<option value="' + esc(op[0]) + '">' + esc(op[1]) + '</option>'; }).join('') +
      '</select></div>';
  }

  function camposPago(prefijo) {
    return E.medios.map(function (m) {
      return campo(MEDIO_NOMBRE[m] || m, prefijo + MEDIO_CAMPO[m], { html: 'url', placeholder: 'https://…' });
    }).join('');
  }

  /**
   * Enlaza los campos de un contenedor a un objeto. Solo toma los campos que
   * le pertenecen: un bloque anidado (una fecha dentro del curso) se enlaza
   * aparte a su propio objeto, marcado con data-propio.
   */
  function enlazar(raiz, obj, alCambiar) {
    $$('[data-c]', raiz).forEach(function (el) {
      var dueno = el.closest('[data-propio]');
      if (dueno && dueno !== raiz && raiz.contains(dueno)) return;

      var ruta = el.getAttribute('data-c');
      var tipo = el.getAttribute('data-t');
      var v = leer(obj, ruta);

      if (tipo === 'bool') el.checked = v !== false;
      else if (tipo === 'lineas') el.value = (v || []).join('\n');
      else el.value = v == null ? '' : v;

      var evento = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
      el.addEventListener(evento, function () {
        var nuevo;
        if (tipo === 'bool') nuevo = el.checked;
        else if (tipo === 'num') nuevo = el.value === '' ? null : (parseInt(el.value, 10) || 0);
        else if (tipo === 'lineas') nuevo = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        else nuevo = el.value;
        escribir(obj, ruta, nuevo);
        el.classList.remove('con-error');
        marcarSucio();
        if (alCambiar) alCambiar(ruta, nuevo, el);
      });
    });
  }

  /* ---------- Estado de guardado ---------- */

  function decir(msg, clase) {
    var e = $('#estado');
    e.textContent = msg;
    e.className = 'pie__estado' + (clase ? ' ' + clase : '');
  }

  function marcarSucio() {
    if (sucio) return;
    sucio = true;
    decir('Cambios sin guardar', 'sucio');
    $('#descartar').hidden = false;
  }

  function marcarLimpio(msg) {
    sucio = false;
    decir(msg || 'Sin cambios', msg ? 'bien' : '');
    $('#descartar').hidden = true;
  }

  window.addEventListener('beforeunload', function (e) {
    if (!sucio) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* ---------- Servidor ---------- */

  function pedir(metodo, ruta, cuerpo, tipo) {
    var h = { 'X-Clave': clave };
    if (cuerpo !== undefined && !tipo) h['Content-Type'] = 'application/json';
    if (tipo) h['Content-Type'] = tipo;
    return fetch(API + ruta, {
      method: metodo,
      headers: h,
      credentials: 'same-origin',
      body: cuerpo === undefined ? undefined : (tipo ? cuerpo : JSON.stringify(cuerpo))
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        return { http: r.status, datos: j };
      });
    });
  }

  // Llaves internas y la dirección con la que se cargó cada curso, para saber
  // si cambió al guardar y dejar la anterior redirigiendo a la nueva.
  // Devuelve los cursos cuyos datos se reordenaron al cargarlos.
  function prepararDatos(cursos, instructores) {
    var reordenados = [];
    E.cursos = (cursos || []).map(function (c) {
      c._k = siguienteLlave++;
      c._orig = c.id;
      c.instructores = c.instructores || [];
      c.cohortes = c.cohortes || [];
      c.modulos = c.modulos || [];
      c.precio = c.precio || {};
      c.pagos = c.pagos || {};
      c.requisitos_tecnicos = c.requisitos_tecnicos || { nota: '', items: [] };
      if (normalizarCurso(c)) reordenados.push(c.titulo || c.id);
      return c;
    });
    E.instructores = (instructores || []).map(function (i) {
      i._k = siguienteLlave++;
      i.enlaces = i.enlaces || [];
      return i;
    });
    return reordenados;
  }

  function cargar() {
    return pedir('GET', 'datos').then(function (r) {
      if (!r.datos.ok) throw r.datos;
      var d = r.datos;
      E.kv = d.kv;
      E.actualizado = d.actualizado;
      E.imagenesSitio = d.imagenesSitio || [];
      if (Array.isArray(d.medios) && d.medios.length) E.medios = d.medios;
      var reordenados = prepararDatos(d.cursos, d.instructores);

      var aviso = $('#avisoGeneral');
      aviso.className = 'aviso aviso--mal';
      if (!E.kv) {
        aviso.hidden = false;
        aviso.innerHTML = '<strong>Falta el almacén.</strong> El espacio donde se guardan los datos ' +
          'no está conectado, así que no se podrá guardar ni subir imágenes.';
      } else if (reordenados.length) {
        aviso.hidden = false;
        aviso.className = 'aviso';
        aviso.innerHTML = '<strong>Datos de venta ordenados por edición.</strong> Lo que antes era general del curso ' +
          '(valor, link de pago, observaciones) o un horario aparte ahora está dentro de cada fecha, que es donde se edita: ' +
          esc(reordenados.join(', ')) + '. Revisa y pulsa «Guardar y publicar».';
      } else {
        aviso.hidden = true;
      }
      marcarLimpio();
      if (reordenados.length) marcarSucio();
      render();
    });
  }

  /* ---------- Rutas ---------- */

  function ruta() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    return { seccion: h[0] || 'cursos', k: h[1] ? parseInt(h[1], 10) : null };
  }

  function ir(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  window.addEventListener('hashchange', function () { render(); });

  function render() {
    if ($('#app').hidden) return;
    var r = ruta();
    $('#numCursos').textContent = E.cursos.length;
    $('#numInstructores').textContent = E.instructores.length;
    $$('[data-pestana]').forEach(function (a) {
      a.classList.toggle('activa', a.getAttribute('data-pestana') === r.seccion);
    });
    $('#avisoGeneral').classList.remove('aviso--bien');

    if (r.seccion === 'instructores') {
      var ins = r.k && E.instructores.filter(function (i) { return i._k === r.k; })[0];
      return ins ? vistaInstructor(ins) : vistaInstructores();
    }
    var c = r.k && E.cursos.filter(function (x) { return x._k === r.k; })[0];
    return c ? vistaCurso(c) : vistaCursos();
  }

  /* ---------- Listado de cursos ---------- */

  function vistaCursos() {
    var v = $('#vista');
    var filas = E.cursos.map(function (c, i) {
      var ed = proximaEdicion(c);
      return '<tr data-k="' + c._k + '">' +
        '<td>' + (c.imagen
          ? '<img class="miniatura" src="' + esc(urlImagen(c.imagen)) + '" alt="">'
          : '<div class="miniatura miniatura--vacia">Sin foto</div>') + '</td>' +
        '<td><div class="fila__titulo">' + esc(c.titulo || 'Curso sin nombre') + '</div>' +
          '<div class="fila__sub">/cursos/' + esc(c.id || '…') + (c.software ? ' · ' + esc(c.software) : '') + '</div></td>' +
        '<td><span class="pill ' + (c.activo !== false ? 'pill--visible">Publicado' : 'pill--oculto">Oculto') + '</span>' +
          '<div class="fila__sub" style="margin-top:4px">' + esc(etiquetaEstado(c.estado)) + '</div></td>' +
        '<td>' + (ed ? esc(rango(ed)) : '<span class="fila__sub">Por anunciar</span>') + '</td>' +
        '<td>' + esc(precioVisible(c)) + '</td>' +
        '<td class="fila__acciones">' +
          '<button class="btn btn--icono" data-mover="-1" data-i="' + i + '" title="Subir en la página"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="btn btn--icono" data-mover="1" data-i="' + i + '" title="Bajar en la página"' + (i === E.cursos.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="btn btn--mini" data-editar>Editar</button>' +
        '</td></tr>';
    }).join('');

    v.innerHTML =
      '<div class="cabecera"><h1>Cursos</h1>' +
        '<div class="cabecera__acciones"><button class="btn btn--rojo" id="nuevoCurso">+ Nuevo curso</button></div></div>' +
      (E.cursos.length
        ? '<table class="tabla"><thead><tr><th></th><th>Curso</th><th>Visibilidad</th><th>Próxima fecha</th><th>Precio</th><th></th></tr></thead>' +
          '<tbody>' + filas + '</tbody></table>' +
          '<p class="pista" style="margin-top:12px">El orden de esta lista es el orden en que aparecen en la página. ' +
          'Si ningún curso tiene fecha, el primero es el que se muestra como «Próximo workshop».</p>'
        : '<div class="vacio">Todavía no hay cursos. Crea el primero con «Nuevo curso».</div>');

    $('#nuevoCurso').addEventListener('click', nuevoCurso);

    $$('tbody tr', v).forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('[data-mover]')) return;
        ir('#/cursos/' + tr.getAttribute('data-k'));
      });
    });
    $$('[data-mover]', v).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var i = +b.getAttribute('data-i');
        var j = i + (+b.getAttribute('data-mover'));
        if (j < 0 || j >= E.cursos.length) return;
        var t = E.cursos[i]; E.cursos[i] = E.cursos[j]; E.cursos[j] = t;
        marcarSucio();
        vistaCursos();
      });
    });
  }

  function cursoVacio() {
    return {
      _k: siguienteLlave++,
      _orig: null,
      _slugAuto: true,
      id: '',
      activo: false,
      estado: 'proximamente',
      titulo: '', subtitulo: '', software: '', nivel: '',
      modalidad: 'Online en vivo', duracion: '', idioma: 'Español',
      imagen: '', resumen: '', objetivo: '', perfil_egresado: '',
      dirigido_a: [], incluye: [], beneficios: [], resultados: [],
      modulos: [], requisitos_tecnicos: { nota: '', items: [] },
      instructores: [], observaciones: '',
      precio: {}, pagos: {}, cohortes: [], alias: []
    };
  }

  function nuevoCurso() {
    var c = cursoVacio();
    E.cursos.push(c);
    marcarSucio();
    ir('#/cursos/' + c._k);
    setTimeout(function () { var t = $('[data-c="titulo"]'); if (t) t.focus(); }, 30);
  }

  /* ---------- Ficha de un curso ---------- */

  /**
   * Los bloques de la ficha se pliegan. Cuáles quedan abiertos se recuerda en
   * este navegador: quien entra siempre a cambiar fechas no tiene que abrir
   * ese bloque cada vez.
   */
  var SECCIONES_ABIERTAS = { basica: true, fechas: true };
  var abrirAlEntrar = null;   // bloque a abrir al llegar desde un error

  function seccionesAbiertas() {
    try {
      var guardado = JSON.parse(localStorage.getItem('cd_panel_secciones') || 'null');
      if (guardado && typeof guardado === 'object') return guardado;
    } catch (e) { /* sin almacenamiento */ }
    return clonar(SECCIONES_ABIERTAS);
  }

  function recordarSeccion(id, abierta) {
    var estado = seccionesAbiertas();
    estado[id] = abierta;
    try { localStorage.setItem('cd_panel_secciones', JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ }
  }

  function seccion(id, titulo, cuerpo, abiertas) {
    return '<details class="tarjeta plegable" data-seccion="' + id + '"' + (abiertas[id] ? ' open' : '') + '>' +
      '<summary><h2>' + titulo + '</h2><span class="plegable__dato" data-dato="' + id + '"></span></summary>' +
      '<div class="plegable__cuerpo">' + cuerpo + '</div></details>';
  }

  // El resumen que se ve con el bloque cerrado.
  function actualizarDatos(c) {
    var f = $('[data-dato="fechas"]');
    if (f) {
      var n = c.cohortes.length;
      var ed = proximaEdicion(c);
      f.textContent = n
        ? n + (n === 1 ? ' edición' : ' ediciones') + (ed ? ' · próxima ' + fechaCorta(ed.inicio) : '')
        : 'Por anunciar';
    }
    var t = $('[data-dato="temario"]');
    if (t) t.textContent = c.modulos.length
      ? c.modulos.length + (c.modulos.length === 1 ? ' módulo' : ' módulos')
      : 'Sin temario';
  }

  function vistaCurso(c) {
    var v = $('#vista');
    var publicado = c.activo !== false;
    var abiertas = seccionesAbiertas();
    var abrir = abrirAlEntrar;
    abrirAlEntrar = null;
    if (abrir) abiertas[abrir] = true;

    var basica =
      '<div class="basica">' +
        '<div class="basica__datos">' +
          '<h3>Información</h3>' +
          campo('Nombre del curso', 'titulo', { requerido: true, placeholder: 'Ej: Pix4Dfields aplicado a Agricultura de Precisión' }) +
          campo('Subtítulo', 'subtitulo', { placeholder: 'Una línea que explique qué logra quien lo toma' }) +
          campo('Resumen', 'resumen', { area: true,
            pista: 'Aparece en la tarjeta del curso y es el texto que muestran Google, Facebook y WhatsApp al compartir el enlace. Ideal: dos frases.' }) +
          '<h3>Ficha</h3>' +
          '<div class="rej">' +
            campo('Software', 'software', { placeholder: 'PIX4Dfields' }) +
            campo('Nivel', 'nivel', { placeholder: 'Intermedio' }) +
            campo('Modalidad', 'modalidad', { placeholder: 'Online en vivo' }) +
            campo('Duración', 'duracion', { placeholder: '12 horas · 3 sesiones' }) +
            campo('Idioma', 'idioma', { placeholder: 'Español' }) +
          '</div>' +
        '</div>' +
        '<div class="basica__lado">' +
          '<h3>Visibilidad</h3>' +
          '<label class="switch" style="margin-bottom:14px"><input type="checkbox" data-c="activo" data-t="bool"> Publicado en la página</label>' +
          selector('Estado de inscripción', 'estado', ESTADOS_CURSO) +
          '<p class="pista">Oculto: no aparece en ninguna parte y su dirección no funciona. ' +
            'Sirve para preparar un curso antes de lanzarlo, o para sacarlo sin borrarlo.</p>' +
          '<h3>Instructores</h3><div id="edInstructores"></div>' +
          '<h3>Dirección de la página</h3>' +
          '<div class="direccion"><span>coatzadrone.cl/cursos/</span>' +
            '<input id="edSlug" autocomplete="off" spellcheck="false" aria-label="Dirección de la página"></div>' +
          '<p class="pista" id="edSlugPista">Es el enlace que usarás en los anuncios.</p>' +
          '<h3>Imagen</h3><div id="edImagen"></div>' +
        '</div>' +
      '</div>';

    var fechas =
      '<p class="pista pista--intro">Cada edición es una versión del curso con sus propias fechas, cupos y precio: ' +
        'es lo que compran los participantes. Sin ediciones, el curso aparece como «Por anunciar», con el botón de avísenme.</p>' +
      '<div id="edHerencia"></div>' +
      '<div id="edFechas"></div>' +
      '<button type="button" class="btn btn--mini" id="edAgregarFecha">+ Agregar edición</button>';

    v.innerHTML =
      '<a class="migas" href="#/cursos">← Cursos</a>' +
      '<div class="cabecera">' +
        '<h1 id="edTitulo">' + esc(c.titulo || 'Curso nuevo') + '</h1>' +
        '<span class="pill ' + (publicado ? 'pill--visible">Publicado' : 'pill--oculto">Oculto') + '</span>' +
        '<div class="cabecera__acciones">' +
          '<a class="btn btn--mini" id="edVer" target="_blank" rel="noopener">Ver en el sitio ↗</a>' +
          '<button class="btn btn--mini" id="edDuplicar" type="button">Duplicar</button>' +
          '<button class="btn btn--mini btn--peligro" id="edEliminar" type="button">Eliminar</button>' +
        '</div>' +
      '</div>' +

      '<div class="plegables-acciones">' +
        '<button type="button" class="enlace" data-todas="1">Abrir todo</button>' +
        '<button type="button" class="enlace" data-todas="0">Cerrar todo</button>' +
      '</div>' +

      '<div class="editor editor--una">' +
        seccion('basica', 'Información básica', basica, abiertas) +
        seccion('fechas', 'Fechas', fechas, abiertas) +
        seccion('descripcion', 'Descripción',
          campo('Objetivo del programa', 'objetivo', { area: true, alto: true }) +
          campo('Enfoque del curso', 'perfil_egresado', { area: true }), abiertas) +
        seccion('contenido', 'Contenido <small>una idea por línea</small>',
          campo('¿A quién está dirigido?', 'dirigido_a', { tipo: 'lineas' }) +
          campo('Al finalizar serás capaz de…', 'resultados', { tipo: 'lineas', alto: true }) +
          campo('Qué incluye la inscripción', 'incluye', { tipo: 'lineas', alto: true,
            pista: 'Los cuatro primeros aparecen junto al precio: pon arriba los más convincentes.' }) +
          campo('Por qué tomarlo', 'beneficios', { tipo: 'lineas' }), abiertas) +
        seccion('temario', 'Temario',
          '<div id="edModulos"></div>' +
          '<button type="button" class="btn btn--mini" id="edAgregarModulo">+ Agregar módulo</button>', abiertas) +
        seccion('requisitos', 'Requisitos técnicos',
          campo('Nota', 'requisitos_tecnicos.nota', { placeholder: 'Puedes trabajar con tu propio equipo siempre que cumpla…' }) +
          campo('Requisitos', 'requisitos_tecnicos.items', { tipo: 'lineas', pista: 'Uno por línea. Si lo dejas vacío, la sección no aparece.' }), abiertas) +
      '</div>';

    /* Bloques plegables */
    $$('details[data-seccion]', v).forEach(function (d) {
      d.addEventListener('toggle', function () { recordarSeccion(d.getAttribute('data-seccion'), d.open); });
    });
    $$('[data-todas]', v).forEach(function (b) {
      b.addEventListener('click', function () {
        var abrirTodo = b.getAttribute('data-todas') === '1';
        $$('details[data-seccion]', v).forEach(function (d) { d.open = abrirTodo; });
      });
    });
    if (abrir) {
      var destino = $('details[data-seccion="' + abrir + '"]', v);
      if (destino) setTimeout(function () { destino.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30);
    }

    enlazar(v, c, function (ruta, valor) {
      if (ruta === 'titulo') {
        $('#edTitulo').textContent = valor || 'Curso nuevo';
        if (c._slugAuto) {
          c.id = slug(valor);
          $('#edSlug').value = c.id;
          actualizarSlug();
        }
      }
      if (ruta === 'activo') {
        var pill = $('.cabecera .pill');
        pill.className = 'pill ' + (valor ? 'pill--visible' : 'pill--oculto');
        pill.textContent = valor ? 'Publicado' : 'Oculto';
      }
    });

    /* Dirección */
    var inSlug = $('#edSlug');
    inSlug.value = c.id || '';
    function actualizarSlug() {
      var p = $('#edSlugPista');
      var ver = $('#edVer');
      if (!esSlug(c.id)) {
        p.innerHTML = 'Solo minúsculas, números y guiones, de 3 a 80 caracteres.';
        p.style.color = '#FF7B77';
      } else if (c._orig && c.id !== c._orig) {
        p.innerHTML = 'La dirección anterior (<strong>/cursos/' + esc(c._orig) + '</strong>) seguirá funcionando: ' +
          'redirige sola a la nueva, así que los anuncios que ya la usan no se rompen.';
        p.style.color = '';
      } else {
        p.innerHTML = 'Es el enlace que usarás en los anuncios.';
        p.style.color = '';
      }
      // "Ver en el sitio" abre lo último GUARDADO: un curso que nunca se
      // guardó todavía no tiene página.
      if (c._orig) {
        ver.href = '/cursos/' + c._orig;
        ver.removeAttribute('aria-disabled');
        ver.style.pointerEvents = '';
        ver.style.opacity = '';
        ver.title = 'Se abre con tu vista previa, aunque el sitio esté en mantenimiento';
      } else {
        ver.removeAttribute('href');
        ver.setAttribute('aria-disabled', 'true');
        ver.style.pointerEvents = 'none';
        ver.style.opacity = '.45';
      }
    }
    inSlug.addEventListener('input', function () {
      var limpio = inSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-');
      if (limpio !== inSlug.value) inSlug.value = limpio;
      c.id = limpio;
      c._slugAuto = false;
      inSlug.classList.remove('con-error');
      marcarSucio();
      actualizarSlug();
    });
    actualizarSlug();

    $('#edVer').addEventListener('click', function (e) {
      if (sucio && !confirm('Tienes cambios sin guardar. El sitio muestra la última versión guardada. ¿Abrir igual?')) {
        e.preventDefault();
      }
    });

    /* Acciones */
    $('#edDuplicar').addEventListener('click', function () {
      var copia = clonar(c);
      var usados = {};
      E.cursos.forEach(function (x) { usados[x.id] = true; });
      copia._k = siguienteLlave++;
      copia._orig = null;
      copia._slugAuto = false;
      copia.titulo = (c.titulo || 'Curso') + ' (copia)';
      copia.id = unico((c.id || 'curso') + '-copia', usados);
      copia.activo = false;
      copia.alias = [];
      // Las ediciones y los links de pago son de cada producto: no se copian,
      // para no terminar con dos cursos cobrando en el mismo botón de Flow.
      copia.cohortes = [];
      copia.pagos = {};
      E.cursos.splice(E.cursos.indexOf(c) + 1, 0, copia);
      marcarSucio();
      ir('#/cursos/' + copia._k);
    });

    $('#edEliminar').addEventListener('click', function () {
      var nombre = c.titulo || 'este curso';
      if (!confirm('¿Eliminar «' + nombre + '»?\n\nAl guardar, su página deja de existir. ' +
          'Si solo quieres sacarlo de la página por un tiempo, desmarca «Publicado en la página».')) return;
      E.cursos.splice(E.cursos.indexOf(c), 1);
      marcarSucio();
      ir('#/cursos');
    });

    /* Bloques */
    controlImagen($('#edImagen'), c, 'imagen', { lado: 1600, sitio: true });
    pintarInstructoresDeCurso(c);
    pintarModulos(c);
    pintarHerencia(c);
    pintarFechas(c);

    $('#edAgregarModulo').addEventListener('click', function () {
      c.modulos.push({ titulo: '', objetivo: '', contenidos: [] });
      marcarSucio();
      pintarModulos(c);
      var bloques = $$('#edModulos [data-propio]');
      var ult = bloques[bloques.length - 1];
      ult.scrollIntoView({ block: 'center', behavior: 'smooth' });
      $('[data-c="titulo"]', ult).focus();
    });

    $('#edAgregarFecha').addEventListener('click', function () {
      c.cohortes.push(nuevaEdicion(c));
      marcarSucio();
      pintarHerencia(c);
      pintarFechas(c);
      var bloques = $$('#edFechas [data-propio]');
      var ult = bloques[bloques.length - 1];
      ult.scrollIntoView({ block: 'center', behavior: 'smooth' });
      $('[data-sesion="0"]', ult).focus();
    });
  }

  function pintarInstructoresDeCurso(c) {
    var cont = $('#edInstructores');
    if (!E.instructores.length) {
      cont.innerHTML = '<p class="pista" style="margin:0">Todavía no hay instructores. ' +
        '<a href="#/instructores" class="enlace">Crear uno</a></p>';
      return;
    }
    cont.innerHTML = '<div class="casillas">' + E.instructores.map(function (ins) {
      return '<label><input type="checkbox" value="' + esc(ins.id) + '"' +
        (c.instructores.indexOf(ins.id) !== -1 ? ' checked' : '') + '> ' +
        esc(ins.nombre || 'Instructor sin nombre') + '</label>';
    }).join('') + '</div>' +
      '<p class="pista"><a href="#/instructores" class="enlace">Administrar instructores</a></p>';

    $$('input', cont).forEach(function (chk) {
      chk.addEventListener('change', function () {
        c.instructores = $$('input:checked', cont).map(function (x) { return x.value; });
        marcarSucio();
      });
    });
  }

  function pintarModulos(c) {
    var cont = $('#edModulos');
    cont.innerHTML = c.modulos.map(function (m, i) {
      return '<div class="bloque" data-propio data-i="' + i + '">' +
        '<div class="bloque__top"><strong>Módulo ' + (i + 1) + '</strong><span class="acciones">' +
          '<button type="button" class="btn btn--icono" data-mover="-1"' + (i === 0 ? ' disabled' : '') + ' title="Subir">↑</button>' +
          '<button type="button" class="btn btn--icono" data-mover="1"' + (i === c.modulos.length - 1 ? ' disabled' : '') + ' title="Bajar">↓</button>' +
          '<button type="button" class="btn btn--mini btn--peligro" data-quitar>Eliminar</button>' +
        '</span></div>' +
        campo('Título del módulo', 'titulo') +
        campo('Objetivo', 'objetivo', { area: true }) +
        campo('Contenidos', 'contenidos', { tipo: 'lineas', alto: true, pista: 'Un tema por línea.' }) +
        '</div>';
    }).join('') || '<p class="pista" style="margin:0 0 12px">Sin temario. Si lo dejas vacío, la sección no aparece en la página.</p>';

    $$('[data-propio]', cont).forEach(function (b) {
      var i = +b.getAttribute('data-i');
      enlazar(b, c.modulos[i]);
      $('[data-quitar]', b).addEventListener('click', function () {
        if (!confirm('¿Eliminar el módulo ' + (i + 1) + '?')) return;
        c.modulos.splice(i, 1);
        marcarSucio();
        pintarModulos(c);
      });
      $$('[data-mover]', b).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var j = i + (+btn.getAttribute('data-mover'));
          var t = c.modulos[i]; c.modulos[i] = c.modulos[j]; c.modulos[j] = t;
          marcarSucio();
          pintarModulos(c);
        });
      });
    });
    actualizarDatos(c);
  }

  /* ---------- Ediciones (fechas a la venta) ---------- */

  function esFecha(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  }

  // Solo fechas razonables: mientras se escribe el año a mano, el campo pasa
  // por valores como 0002-10-31, que no deben mover nada.
  function fechaUsable(v) {
    return esFecha(v) && +v.slice(0, 4) >= 2000 && +v.slice(0, 4) <= 2100;
  }

  function sumarDias(iso, n) {
    var p = iso.split('-');
    var d = new Date(Date.UTC(2000, 0, 1));
    d.setUTCFullYear(+p[0], +p[1] - 1, +p[2] + n);
    return d.toISOString().slice(0, 10);
  }

  function diasEntre(a, b) {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  }

  function linkDe(pagos) {
    return E.medios.some(function (m) { return (pagos || {})[MEDIO_CAMPO[m]]; });
  }

  /**
   * Una edición se edita como una lista de días de clase: la sesión 1 es la
   * fecha de inicio. Las de versiones anteriores traían "desde / hasta"; ese
   * rango se convierte en días seguidos, que es como se usaba.
   */
  function normalizarEdicion(ch) {
    var cambio = false;
    ch.precio = ch.precio || {};
    ch.pagos = ch.pagos || {};
    var dias = (ch.sesiones || []).filter(esFecha);
    if (!dias.length && esFecha(ch.inicio)) {
      dias = [ch.inicio];
      if (esFecha(ch.fin) && ch.fin > ch.inicio) {
        if (diasEntre(ch.inicio, ch.fin) < 12) {
          while (dias[dias.length - 1] < ch.fin) dias.push(sumarDias(dias[dias.length - 1], 1));
        } else {
          dias.push(ch.fin);
        }
      }
    } else if (esFecha(ch.inicio) && dias.indexOf(ch.inicio) === -1) {
      dias.push(ch.inicio);
    }
    dias.sort();
    ch.sesiones = dias.length ? dias : [''];
    sincronizarEdicion(ch);

    // El horario ya no es un campo aparte: si había uno, pasa a las
    // observaciones de la fecha para que no se pierda.
    if (ch.horario) {
      ch.observaciones = (ch.observaciones ? ch.observaciones + ' · ' : '') + 'Horario: ' + ch.horario;
      cambio = true;
    }
    delete ch.horario;
    delete ch.cupos_disponibles;
    return cambio;
  }

  function sincronizarEdicion(ch) {
    var validas = ch.sesiones.filter(esFecha).sort();
    ch.inicio = ch.sesiones[0] || '';
    ch.fin = validas.length ? validas[validas.length - 1] : ch.inicio;
  }

  /**
   * El panel anterior tenía un valor, un link de pago y observaciones para
   * todo el curso. Ahora eso es de cada edición: si el curso ya tiene fechas,
   * se copia a las que no tengan lo suyo, que es exactamente lo que la página
   * mostraba. Si no tiene fechas, se deja donde está hasta que tenga una.
   */
  function normalizarCurso(c) {
    var cambio = false;
    c.cohortes.forEach(function (ch) { if (normalizarEdicion(ch)) cambio = true; });
    if (!c.cohortes.length) return cambio;

    var p = c.precio || {};
    var obs = (c.observaciones || '').trim();
    c.cohortes.forEach(function (ch) {
      if (!(ch.precio.clp || ch.precio.clp_early) && (p.clp || p.clp_early)) {
        ch.precio = { clp: p.clp || null, clp_early: p.clp_early || null, early_hasta: p.early_hasta || null };
        cambio = true;
      }
      if (!linkDe(ch.pagos) && linkDe(c.pagos)) {
        ch.pagos = clonar(c.pagos);
        cambio = true;
      }
      if (!(ch.observaciones || '').trim() && obs) {
        ch.observaciones = obs;
        cambio = true;
      }
    });
    if (p.clp || p.clp_early || linkDe(c.pagos) || obs) cambio = true;
    c.precio = {};
    c.pagos = {};
    c.observaciones = '';
    return cambio;
  }

  function herenciaDe(c) {
    var p = c.precio || {};
    var partes = [];
    if (p.clp || p.clp_early) partes.push('un valor de ' + precioCLP(p.clp || p.clp_early));
    if (linkDe(c.pagos)) partes.push('un link de pago');
    if ((c.observaciones || '').trim()) partes.push('observaciones');
    return partes.length ? partes : null;
  }

  function pintarHerencia(c) {
    var cont = $('#edHerencia');
    var partes = herenciaDe(c);
    if (!partes || c.cohortes.length) { cont.innerHTML = ''; return; }
    var lista = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0];
    cont.innerHTML = '<div class="aviso">Este curso tiene ' + esc(lista) + ' generales, de la versión anterior del panel. ' +
      'La página los muestra mientras el curso no tenga ediciones; al agregar la primera, pasan a ella. ' +
      '<button type="button" class="enlace" data-quitar-herencia>Quitarlos</button></div>';
    $('[data-quitar-herencia]', cont).addEventListener('click', function () {
      if (!confirm('¿Quitar el valor, el link de pago y las observaciones generales de este curso?')) return;
      c.precio = {};
      c.pagos = {};
      c.observaciones = '';
      marcarSucio();
      pintarHerencia(c);
    });
  }

  // Una edición nueva parte con el valor y los cupos de la anterior: es lo
  // más probable, y se ve y se cambia ahí mismo. El link de pago no se copia:
  // cada edición debería cobrar con su propio botón.
  function nuevaEdicion(c) {
    var ultima = c.cohortes[c.cohortes.length - 1];
    var ch = {
      estado: 'abierta', confirmada: true,
      sesiones: [''], inicio: '', fin: '',
      cupos_totales: ultima ? ultima.cupos_totales : null,
      precio: { clp: ultima ? (ultima.precio.clp || null) : null },
      pagos: {}, observaciones: ''
    };
    if (!ultima && herenciaDe(c)) {
      var p = c.precio || {};
      ch.precio = { clp: p.clp || null, clp_early: p.clp_early || null, early_hasta: p.early_hasta || null };
      ch.pagos = clonar(c.pagos || {});
      ch.observaciones = c.observaciones || '';
      c.precio = {};
      c.pagos = {};
      c.observaciones = '';
    }
    return ch;
  }

  function rotuloEdicion(ch, i) {
    var n = ch.sesiones.filter(esFecha).length;
    return 'Edición ' + (i + 1) + (ch.inicio ? ' · ' + rango(ch) : '') + (n > 1 ? ' · ' + n + ' sesiones' : '');
  }

  function campoSuelto(etiqueta, attrs, pista) {
    var id = 'f' + (++idCampo);
    return '<div class="campo"><label for="' + id + '">' + esc(etiqueta) + '</label>' +
      '<input id="' + id + '" ' + attrs + '>' + (pista ? '<p class="pista">' + pista + '</p>' : '') + '</div>';
  }

  /**
   * Una edición en una sola tarjeta: cuándo (inicio y sesiones), cuántos
   * cupos, cuánto cuesta y con qué link se paga.
   */
  function pintarFechas(c) {
    var cont = $('#edFechas');
    cont.innerHTML = c.cohortes.map(function (ch, i) {
      return '<div class="bloque" data-propio data-i="' + i + '">' +
        '<div class="bloque__top"><strong data-rotulo>' + esc(rotuloEdicion(ch, i)) + '</strong>' +
          '<span class="acciones"><button type="button" class="btn btn--mini btn--peligro" data-quitar>Eliminar</button></span></div>' +
        '<div class="rej rej--fechas">' +
          campoSuelto('Fecha de inicio', 'type="date" data-sesion="0"') +
          campoSuelto('Sesiones', 'type="number" min="1" max="12" step="1" data-num-sesiones', 'Días de clase.') +
          selector('Estado', 'estado', ESTADOS_FECHA) +
          campo('Cupos', 'cupos_totales', { tipo: 'num', html: 'number', extra: 'min="0" max="999"', placeholder: '0',
            pista: 'En 0 no se mencionan.' }) +
        '</div>' +
        '<div class="rej rej--fechas" data-extras></div>' +
        '<div class="rej">' +
          campo('Valor (CLP)', 'precio.clp', { tipo: 'num', html: 'number', extra: 'min="0" step="1000"', placeholder: 'Consultar' }) +
          campo('Precio rebajado (CLP)', 'precio.clp_early', { tipo: 'num', html: 'number', extra: 'min="0" step="1000"' }) +
          campo('Precio rebajado hasta', 'precio.early_hasta', { html: 'date' }) +
        '</div>' +
        '<p class="pista" style="margin:-4px 0 14px">Con precio rebajado, la página lo destaca y muestra el valor como referencia. ' +
          'Pasada la fecha «hasta», vuelve solo al valor.</p>' +
        camposPago('pagos.') +
        campo('Observaciones de esta fecha', 'observaciones', { area: true, placeholder: 'Ej: horario 18:00 a 22:00 · cupos limitados' }) +
        '</div>';
    }).join('') || '<p class="pista" style="margin:0 0 12px">Sin ediciones todavía.</p>';

    $$('[data-propio]', cont).forEach(function (b) {
      var i = +b.getAttribute('data-i');
      var ch = c.cohortes[i];
      enlazar(b, ch);
      enlazarSesiones(b, ch, i, c);
      $('[data-quitar]', b).addEventListener('click', function () {
        if (!confirm('¿Eliminar la edición ' + (i + 1) + '? Deja de aparecer en la página al guardar.')) return;
        c.cohortes.splice(i, 1);
        marcarSucio();
        pintarHerencia(c);
        pintarFechas(c);
      });
    });
    actualizarDatos(c);
  }

  /**
   * La fecha de inicio es la sesión 1. Al subir el número de sesiones
   * aparecen los campos de las siguientes, propuestas en días seguidos; al
   * mover el inicio, las demás se corren los mismos días, para cambiar una
   * edición de semana sin reescribir cada fecha.
   */
  function enlazarSesiones(b, ch, i, c) {
    var extras = $('[data-extras]', b);
    var inicio = $('[data-sesion="0"]', b);
    var num = $('[data-num-sesiones]', b);
    var ultimoInicio = fechaUsable(ch.sesiones[0]) ? ch.sesiones[0] : null;

    function pintarExtras() {
      extras.innerHTML = ch.sesiones.slice(1).map(function (d, k) {
        return campoSuelto('Fecha sesión ' + (k + 2), 'type="date" data-sesion="' + (k + 1) + '" value="' + esc(d) + '"');
      }).join('');
      extras.hidden = ch.sesiones.length < 2;
    }

    function alCambiar() {
      sincronizarEdicion(ch);
      $('[data-rotulo]', b).textContent = rotuloEdicion(ch, i);
      actualizarDatos(c);
      marcarSucio();
    }

    inicio.value = ch.sesiones[0] || '';
    num.value = ch.sesiones.length;
    pintarExtras();

    b.addEventListener('input', function (e) {
      var el = e.target;
      if (el.hasAttribute('data-sesion')) {
        var k = +el.getAttribute('data-sesion');
        var nuevo = el.value;
        ch.sesiones[k] = nuevo;
        el.classList.remove('con-error');
        if (k === 0 && fechaUsable(nuevo)) {
          if (ultimoInicio && nuevo !== ultimoInicio) {
            var delta = diasEntre(ultimoInicio, nuevo);
            for (var j = 1; j < ch.sesiones.length; j++) {
              if (fechaUsable(ch.sesiones[j])) ch.sesiones[j] = sumarDias(ch.sesiones[j], delta);
            }
            pintarExtras();
          }
          ultimoInicio = nuevo;
        }
        alCambiar();
      } else if (el.hasAttribute('data-num-sesiones')) {
        if (el.value === '') return;   // borrando para escribir otro número
        var n = Math.max(1, Math.min(12, parseInt(el.value, 10) || 1));
        if (+el.value !== n) el.value = n;
        while (ch.sesiones.length < n) {
          var ult = ch.sesiones[ch.sesiones.length - 1];
          ch.sesiones.push(fechaUsable(ult) ? sumarDias(ult, 1) : '');
        }
        ch.sesiones.length = n;
        pintarExtras();
        alCambiar();
      }
    });

    num.addEventListener('blur', function () {
      if (num.value === '') num.value = ch.sesiones.length;
    });
  }

  /* ---------- Imágenes ---------- */

  /**
   * La imagen se achica en el navegador antes de subirla. Una foto de celular
   * pesa 4 o 5 MB; en la página se ve igual a 1600 px y pesa diez veces
   * menos, que es lo que decide si la landing carga rápido en 4G.
   */
  function prepararImagen(archivo, lado) {
    return new Promise(function (ok, mal) {
      var img = new Image();
      var url = URL.createObjectURL(archivo);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * escala);
        var h = Math.round(img.naturalHeight * escala);
        var lienzo = document.createElement('canvas');
        lienzo.width = w; lienzo.height = h;
        var cx = lienzo.getContext('2d');
        cx.fillStyle = '#141414';
        cx.fillRect(0, 0, w, h);
        cx.drawImage(img, 0, 0, w, h);
        lienzo.toBlob(function (b) { if (b) ok(b); else mal(new Error('conversion')); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('formato')); };
      img.src = url;
    });
  }

  function controlImagen(cont, obj, prop, o) {
    function pintar() {
      var src = obj[prop];
      cont.innerHTML =
        '<div class="imagen-caja' + (o.cuadrada ? ' imagen-caja--cuadrada' : '') + '">' +
          (src ? '<img src="' + esc(urlImagen(src)) + '" alt="">' : 'Sin imagen') + '</div>' +
        '<div class="imagen-acciones">' +
          '<label class="btn btn--mini" style="position:relative">Subir imagen' +
            '<input class="archivo" type="file" accept="image/jpeg,image/png,image/webp"></label>' +
          (o.sitio ? '<button type="button" class="btn btn--mini" data-elegir>Elegir existente</button>' : '') +
          (src ? '<button type="button" class="btn btn--mini btn--peligro" data-quitar>Quitar</button>' : '') +
        '</div>' +
        '<p class="pista">JPG, PNG o WebP. Se ajusta sola a ' + o.lado + ' px antes de subir.</p>';

      $('input[type=file]', cont).addEventListener('change', function (e) {
        var archivo = e.target.files[0];
        if (!archivo) return;
        var caja = $('.imagen-caja', cont);
        caja.classList.add('cargando');
        prepararImagen(archivo, o.lado)
          .then(function (blob) { return pedir('POST', 'media', blob, 'image/jpeg'); })
          .then(function (r) {
            if (!r.datos.ok) throw new Error(r.datos.error || ('HTTP ' + r.http));
            obj[prop] = r.datos.url;
            marcarSucio();
            pintar();
          })
          .catch(function (err) {
            caja.classList.remove('cargando');
            alert(err.message === 'formato'
              ? 'Ese archivo no se pudo abrir como imagen. Prueba con un JPG o PNG.'
              : 'No se pudo subir la imagen (' + err.message + ').');
          });
      });

      var quitar = $('[data-quitar]', cont);
      if (quitar) quitar.addEventListener('click', function () {
        obj[prop] = '';
        marcarSucio();
        pintar();
      });

      var elegir = $('[data-elegir]', cont);
      if (elegir) elegir.addEventListener('click', function () {
        elegirImagen(function (src) { obj[prop] = src; marcarSucio(); pintar(); });
      });
    }
    pintar();
  }

  // Imágenes que ya existen: las que vienen con el sitio y las subidas antes.
  function elegirImagen(alElegir) {
    var vistas = {};
    var todas = [];
    E.imagenesSitio.concat(
      E.cursos.map(function (c) { return c.imagen; }),
      E.instructores.map(function (i) { return i.foto; })
    ).forEach(function (src) {
      if (src && !vistas[src]) { vistas[src] = true; todas.push(src); }
    });

    var dlg = $('#dlgImagenes');
    var gal = $('#galeria');
    gal.innerHTML = todas.map(function (src) {
      return '<button type="button" data-src="' + esc(src) + '"><img src="' + esc(urlImagen(src)) + '" alt=""></button>';
    }).join('') || '<p class="pista">No hay imágenes todavía.</p>';
    $$('button[data-src]', gal).forEach(function (b) {
      b.addEventListener('click', function () {
        alElegir(b.getAttribute('data-src'));
        dlg.close();
      });
    });
    dlg.showModal();
  }

  /* ---------- Instructores ---------- */

  function cursosDe(ins) {
    return E.cursos.filter(function (c) { return c.instructores.indexOf(ins.id) !== -1; });
  }

  function vistaInstructores() {
    var v = $('#vista');
    v.innerHTML =
      '<div class="cabecera"><h1>Instructores</h1>' +
        '<div class="cabecera__acciones"><button class="btn btn--rojo" id="nuevoInstructor">+ Nuevo instructor</button></div></div>' +
      (E.instructores.length
        ? '<div class="grilla">' + E.instructores.map(function (ins) {
            var n = cursosDe(ins).length;
            return '<button type="button" class="ficha" data-k="' + ins._k + '">' +
              '<span class="avatar">' + (ins.foto ? '<img src="' + esc(urlImagen(ins.foto)) + '" alt="">' : esc(iniciales(ins.nombre))) + '</span>' +
              '<span><span class="ficha__nombre">' + esc(ins.nombre || 'Sin nombre') + '</span><br>' +
              '<span class="ficha__sub">' + esc(ins.cargo || '') + '</span><br>' +
              '<span class="ficha__sub">' + (n ? n + (n === 1 ? ' curso' : ' cursos') : 'Sin cursos asignados') + '</span></span>' +
              '</button>';
          }).join('') + '</div>'
        : '<div class="vacio">Todavía no hay instructores.</div>');

    $('#nuevoInstructor').addEventListener('click', function () {
      var usados = {};
      E.instructores.forEach(function (i) { usados[i.id] = true; });
      var ins = {
        _k: siguienteLlave++,
        // Id provisorio para poder asignarlo a un curso antes de guardar. Al
        // guardar se cambia por uno armado con el nombre.
        id: unico('nuevo-' + siguienteLlave, usados),
        _nuevo: true,
        nombre: '', cargo: '', bio: '', foto: '', enlaces: []
      };
      E.instructores.push(ins);
      marcarSucio();
      ir('#/instructores/' + ins._k);
      setTimeout(function () { var t = $('[data-c="nombre"]'); if (t) t.focus(); }, 30);
    });

    $$('[data-k]', v).forEach(function (b) {
      b.addEventListener('click', function () { ir('#/instructores/' + b.getAttribute('data-k')); });
    });
  }

  function vistaInstructor(ins) {
    var v = $('#vista');
    var cursos = cursosDe(ins);

    v.innerHTML =
      '<a class="migas" href="#/instructores">← Instructores</a>' +
      '<div class="cabecera"><h1 id="insTitulo">' + esc(ins.nombre || 'Instructor nuevo') + '</h1>' +
        '<div class="cabecera__acciones"><button class="btn btn--mini btn--peligro" id="insEliminar" type="button">Eliminar</button></div></div>' +
      '<div class="editor">' +
        '<div class="editor__principal">' +
          '<section class="tarjeta"><h2>Información</h2>' +
            campo('Nombre', 'nombre', { requerido: true, placeholder: 'Ej: Ing. Arturo Salaises Chairez' }) +
            campo('Cargo', 'cargo', { placeholder: 'Instructor certificado Pix4D · PIX4Dfields' }) +
            campo('Biografía', 'bio', { area: true, alto: true,
              pista: 'Formación, experiencia y en qué es especialista. Es lo que convence de que sabe de lo que habla.' }) +
          '</section>' +
          '<section class="tarjeta"><h2>Enlaces de verificación <small>opcionales</small></h2>' +
            '<div id="insEnlaces"></div>' +
            '<button type="button" class="btn btn--mini" id="insAgregarEnlace">+ Agregar enlace</button>' +
            '<p class="pista">Por ejemplo, su certificado en training.pix4d.com. Solo direcciones que empiecen con https://.</p>' +
          '</section>' +
        '</div>' +
        '<aside class="editor__lateral">' +
          '<section class="tarjeta"><h2>Foto</h2><div id="insFoto"></div></section>' +
          '<section class="tarjeta"><h2>Cursos que dicta</h2>' +
            (cursos.length
              ? '<div class="casillas">' + cursos.map(function (c) {
                  return '<a class="enlace" href="#/cursos/' + c._k + '">' + esc(c.titulo || 'Curso sin nombre') + '</a>';
                }).join('') + '</div>'
              : '<p class="pista" style="margin:0">No está asignado a ningún curso. Se asigna desde la ficha de cada curso.</p>') +
          '</section>' +
        '</aside>' +
      '</div>';

    enlazar(v, ins, function (ruta, valor) {
      if (ruta === 'nombre') $('#insTitulo').textContent = valor || 'Instructor nuevo';
    });
    controlImagen($('#insFoto'), ins, 'foto', { lado: 800, cuadrada: true });
    pintarEnlaces(ins);

    $('#insAgregarEnlace').addEventListener('click', function () {
      ins.enlaces.push({ texto: 'Ver certificación Pix4D', url: '' });
      marcarSucio();
      pintarEnlaces(ins);
      var campos = $$('#insEnlaces [data-c="url"]');
      campos[campos.length - 1].focus();
    });

    $('#insEliminar').addEventListener('click', function () {
      var aviso = cursos.length
        ? '\n\nDicta ' + cursos.length + (cursos.length === 1 ? ' curso' : ' cursos') + ', que quedarán sin este instructor.'
        : '';
      if (!confirm('¿Eliminar a ' + (ins.nombre || 'este instructor') + '?' + aviso)) return;
      E.cursos.forEach(function (c) {
        c.instructores = c.instructores.filter(function (id) { return id !== ins.id; });
      });
      E.instructores.splice(E.instructores.indexOf(ins), 1);
      marcarSucio();
      ir('#/instructores');
    });
  }

  function pintarEnlaces(ins) {
    var cont = $('#insEnlaces');
    cont.innerHTML = ins.enlaces.map(function (e, i) {
      return '<div class="bloque" data-propio data-i="' + i + '">' +
        '<div class="bloque__top"><strong>Enlace ' + (i + 1) + '</strong>' +
          '<span class="acciones"><button type="button" class="btn btn--mini btn--peligro" data-quitar>Quitar</button></span></div>' +
        '<div class="rej">' +
          campo('Texto del botón', 'texto', { placeholder: 'Ver certificación Pix4D' }) +
          campo('Dirección', 'url', { html: 'url', placeholder: 'https://training.pix4d.com/certificates/…' }) +
        '</div></div>';
    }).join('');

    $$('[data-propio]', cont).forEach(function (b) {
      var i = +b.getAttribute('data-i');
      enlazar(b, ins.enlaces[i]);
      $('[data-quitar]', b).addEventListener('click', function () {
        ins.enlaces.splice(i, 1);
        marcarSucio();
        pintarEnlaces(ins);
      });
    });
  }

  /* ---------- Guardar ---------- */

  /**
   * Se revisa todo antes de mandar. El servidor valida igual, pero descartaría
   * en silencio un link sin https o una fecha sin día de inicio; aquí se
   * avisa y se marca el campo, para que nada se pierda sin que lo sepas.
   */
  function revisar() {
    var errores = [];
    var usados = {};

    E.instructores.forEach(function (ins, i) {
      if (!ins.nombre || !ins.nombre.trim()) errores.push({ msg: 'El instructor número ' + (i + 1) + ' no tiene nombre.', ir: '#/instructores/' + ins._k });
      ins.enlaces.forEach(function (e) {
        if (e.url && !/^https:\/\/[^\s"'<>]+$/.test(e.url.trim())) {
          errores.push({ msg: 'Un enlace de ' + (ins.nombre || 'un instructor') + ' no empieza con https://.', ir: '#/instructores/' + ins._k });
        }
      });
    });

    E.cursos.forEach(function (c) {
      var nombre = c.titulo || 'Un curso sin nombre';
      var aqui = '#/cursos/' + c._k;
      function error(msg, sec) { errores.push({ msg: '«' + nombre + '»: ' + msg, ir: aqui, sec: sec }); }
      if (!c.titulo || !c.titulo.trim()) errores.push({ msg: 'Hay un curso sin nombre.', ir: aqui, sec: 'basica' });
      if (!esSlug(c.id)) error('la dirección de la página no es válida.', 'basica');
      else if (usados[c.id]) errores.push({ msg: 'Dos cursos usan la dirección /cursos/' + c.id + '.', ir: aqui, sec: 'basica' });
      usados[c.id] = true;

      function linkMalo(p) {
        return E.medios.some(function (m) {
          var u = (p || {})[MEDIO_CAMPO[m]];
          return u && !/^https:\/\/[^\s"'<>]+$/.test(u.trim());
        });
      }
      if (linkMalo(c.pagos)) error('el link de pago general no empieza con https://.', 'fechas');

      c.cohortes.forEach(function (ch, i) {
        var ed = 'en la edición ' + (i + 1) + ', ';
        if (!esFecha(ch.sesiones[0])) error(ed + 'falta la fecha de inicio.', 'fechas');
        for (var k = 1; k < ch.sesiones.length; k++) {
          if (!esFecha(ch.sesiones[k])) error(ed + 'falta la fecha de la sesión ' + (k + 1) + '.', 'fechas');
          else if (esFecha(ch.sesiones[k - 1]) && ch.sesiones[k] <= ch.sesiones[k - 1]) {
            error(ed + 'la sesión ' + (k + 1) + ' tiene que ser después de la sesión ' + k + '.', 'fechas');
          }
        }
        var p = ch.precio || {};
        if (p.clp_early && !p.clp) error(ed + 'hay precio rebajado pero falta el valor.', 'fechas');
        else if (p.clp_early && p.clp_early >= p.clp) error(ed + 'el precio rebajado tiene que ser menor que el valor.', 'fechas');
        if (linkMalo(ch.pagos)) error(ed + 'el link de pago no empieza con https://.', 'fechas');
      });

      c.modulos.forEach(function (m, i) {
        if (!(m.titulo || '').trim() && ((m.contenidos || []).length || (m.objetivo || '').trim())) {
          error('el módulo ' + (i + 1) + ' tiene contenido pero no título.', 'temario');
        }
      });
    });

    return errores;
  }

  function mostrarErrores(errores) {
    var aviso = $('#avisoGeneral');
    aviso.className = 'aviso aviso--mal';
    aviso.hidden = false;
    aviso.innerHTML = '<strong>No se guardó. Corrige esto primero:</strong><ul>' +
      errores.map(function (e) {
        var txt = typeof e === 'string' ? e : e.msg;
        var destino = typeof e === 'string' ? '' : e.ir;
        return '<li>' + (destino
          ? '<a href="' + esc(destino) + '" data-sec="' + esc(e.sec || '') + '">' + esc(txt) + '</a>'
          : esc(txt)) + '</li>';
      }).join('') + '</ul>';
    // El enlace abre la ficha con el bloque del error desplegado.
    $$('a[data-sec]', aviso).forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        abrirAlEntrar = a.getAttribute('data-sec') || null;
        ir(a.getAttribute('href'));
      });
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Lo que viaja al servidor: sin las marcas internas de esta sesión.
  function paraEnviar() {
    // Los instructores nuevos reciben un id armado con su nombre, y los
    // cursos que ya los tenían asignados se actualizan con ese id.
    var usados = {};
    E.instructores.forEach(function (i) { if (!i._nuevo) usados[i.id] = true; });
    E.instructores.forEach(function (ins) {
      if (!ins._nuevo) return;
      var nuevo = unico(slug(ins.nombre) || 'instructor', usados);
      usados[nuevo] = true;
      E.cursos.forEach(function (c) {
        c.instructores = c.instructores.map(function (id) { return id === ins.id ? nuevo : id; });
      });
      ins.id = nuevo;
      delete ins._nuevo;
    });

    // Si cambió la dirección de un curso, la anterior queda como alias y
    // redirige a la nueva.
    E.cursos.forEach(function (c) {
      c.alias = (c.alias || []).filter(function (a) { return a !== c.id; });
      if (c._orig && c._orig !== c.id && c.alias.indexOf(c._orig) === -1) c.alias.push(c._orig);
      c.cohortes.forEach(sincronizarEdicion);
    });

    function limpiar(o) {
      var copia = clonar(o);
      Object.keys(copia).forEach(function (k) { if (k.charAt(0) === '_') delete copia[k]; });
      return copia;
    }
    return {
      base: E.actualizado,
      cursos: E.cursos.map(limpiar),
      instructores: E.instructores.map(limpiar)
    };
  }

  function guardar() {
    var errores = revisar();
    if (errores.length) { mostrarErrores(errores); return; }
    $('#avisoGeneral').hidden = true;

    var boton = $('#guardar');
    boton.disabled = true;
    decir('Guardando…');

    // Para volver a la misma ficha después de recargar los datos.
    var r = ruta();
    var abierto = null;
    if (r.k) {
      var lista = r.seccion === 'instructores' ? E.instructores : E.cursos;
      abierto = lista.filter(function (x) { return x._k === r.k; })[0];
    }
    var cuerpo = paraEnviar();
    var idAbierto = abierto ? abierto.id : null;

    pedir('POST', 'datos', cuerpo).then(function (res) {
      var d = res.datos;
      if (d.ok) {
        E.actualizado = d.actualizado;
        prepararDatos(d.cursos, d.instructores);
        var nuevaRuta = '#/' + r.seccion;
        if (idAbierto) {
          var lista2 = r.seccion === 'instructores' ? E.instructores : E.cursos;
          var mismo = lista2.filter(function (x) { return x.id === idAbierto; })[0];
          if (mismo) nuevaRuta += '/' + mismo._k;
        }
        // KV tarda hasta un minuto en llegar a todos los servidores del mundo.
        marcarLimpio('Publicado. Se ve en la página en menos de un minuto.');
        if (location.hash === nuevaRuta) render(); else location.hash = nuevaRuta;
        return;
      }
      if (d.error === 'conflicto') {
        decir('No se guardó: hubo cambios desde otra ventana.', 'mal');
        if (confirm('Alguien guardó cambios desde otra ventana o pestaña después de que abriste esta.\n\n' +
            'Para no borrar esos cambios, hay que recargar. Lo que no guardaste aquí se perderá.\n\n¿Recargar ahora?')) {
          sucio = false;
          location.reload();
        }
        return;
      }
      if (d.error === 'datos_invalidos') { mostrarErrores(d.errores || []); decir('No se guardó.', 'mal'); return; }
      if (d.error === 'falta_kv') { decir('No se guardó: falta conectar el almacén en Cloudflare.', 'mal'); return; }
      if (res.http === 401) { decir('La sesión expiró. Vuelve a entrar.', 'mal'); return; }
      decir('No se pudo guardar (' + (d.error || res.http) + ').', 'mal');
    }).catch(function () {
      decir('No se pudo conectar con el servidor. Tus cambios siguen aquí: intenta de nuevo.', 'mal');
    }).then(function () {
      boton.disabled = false;
    });
  }

  $('#guardar').addEventListener('click', guardar);

  // Ctrl+S / Cmd+S guarda, como en cualquier editor.
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('#app').hidden) {
      e.preventDefault();
      guardar();
    }
  });

  $('#descartar').addEventListener('click', function () {
    if (!confirm('¿Descartar todos los cambios sin guardar?')) return;
    cargar().then(function () { ir('#/cursos'); });
  });

  /* ---------- Entrada y salida ---------- */

  function entrar() {
    return cargar().then(function () {
      try { sessionStorage.setItem('cd_admin', clave); } catch (e) { /* modo privado */ }
      $('#puerta').hidden = true;
      $('#app').hidden = false;
      render();
      // Cookie de vista previa: deja ver el sitio real aunque esté en
      // mantenimiento. Si falla, el panel funciona igual.
      pedir('POST', 'vista', {}).catch(function () {});
    });
  }

  $('#formClave').addEventListener('submit', function (e) {
    e.preventDefault();
    clave = $('#clave').value;
    entrar().catch(function (err) {
      var caja = $('#puertaError');
      caja.hidden = false;
      caja.textContent = err && err.error === 'sin_clave_configurada'
        ? 'El panel todavía no tiene clave configurada en Cloudflare. Mientras no exista, nadie puede entrar.'
        : (err && err.error === 'clave_incorrecta' ? 'Clave incorrecta.' : 'No se pudo conectar con el servidor.');
    });
  });

  $('#salir').addEventListener('click', function () {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir igual?')) return;
    sucio = false;
    try { sessionStorage.removeItem('cd_admin'); } catch (e) { /* modo privado */ }
    pedir('POST', 'salir', {}).catch(function () {}).then(function () { location.reload(); });
  });

  if (clave) {
    entrar().catch(function () {
      try { sessionStorage.removeItem('cd_admin'); } catch (e) { /* modo privado */ }
      clave = '';
    });
  }
})();
