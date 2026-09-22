/* ==========================================================================
   Panel comercial — CoatzaDrone Chile

   Administra el catálogo completo: cursos (con todo lo que se muestra de
   ellos), sus fechas a la venta y los instructores. Todo se edita en memoria y
   se publica de una vez con "Guardar y publicar".

   Rutas (en el # de la dirección, para que el botón Atrás funcione):
     #/cursos              listado de cursos
     #/cursos/<k>          ficha de un curso
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
  function prepararDatos(cursos, instructores) {
    E.cursos = (cursos || []).map(function (c) {
      c._k = siguienteLlave++;
      c._orig = c.id;
      c.instructores = c.instructores || [];
      c.cohortes = c.cohortes || [];
      c.modulos = c.modulos || [];
      c.precio = c.precio || {};
      c.pagos = c.pagos || {};
      c.requisitos_tecnicos = c.requisitos_tecnicos || { nota: '', items: [] };
      return c;
    });
    E.instructores = (instructores || []).map(function (i) {
      i._k = siguienteLlave++;
      i.enlaces = i.enlaces || [];
      return i;
    });
  }

  function cargar() {
    return pedir('GET', 'datos').then(function (r) {
      if (!r.datos.ok) throw r.datos;
      var d = r.datos;
      E.kv = d.kv;
      E.actualizado = d.actualizado;
      E.imagenesSitio = d.imagenesSitio || [];
      if (Array.isArray(d.medios) && d.medios.length) E.medios = d.medios;
      prepararDatos(d.cursos, d.instructores);

      var aviso = $('#avisoGeneral');
      if (!E.kv) {
        aviso.hidden = false;
        aviso.innerHTML = '<strong>Falta el almacén.</strong> El espacio donde se guardan los datos ' +
          'no está conectado, así que no se podrá guardar ni subir imágenes.';
      } else {
        aviso.hidden = true;
      }
      marcarLimpio();
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

  function vistaCurso(c) {
    var v = $('#vista');
    var publicado = c.activo !== false;

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

      '<div class="editor">' +
        '<div class="editor__principal">' +

          '<section class="tarjeta"><h2>Información</h2>' +
            campo('Nombre del curso', 'titulo', { requerido: true, placeholder: 'Ej: Pix4Dfields aplicado a Agricultura de Precisión' }) +
            campo('Subtítulo', 'subtitulo', { placeholder: 'Una línea que explique qué logra quien lo toma' }) +
            campo('Resumen', 'resumen', { area: true,
              pista: 'Aparece en la tarjeta del curso y es el texto que muestran Google, Facebook y WhatsApp al compartir el enlace. Ideal: dos frases.' }) +
          '</section>' +

          '<section class="tarjeta"><h2>Ficha</h2><div class="rej">' +
            campo('Software', 'software', { placeholder: 'PIX4Dfields' }) +
            campo('Nivel', 'nivel', { placeholder: 'Intermedio' }) +
            campo('Modalidad', 'modalidad', { placeholder: 'Online en vivo' }) +
            campo('Duración', 'duracion', { placeholder: '12 horas · 3 sesiones' }) +
            campo('Idioma', 'idioma', { placeholder: 'Español' }) +
          '</div></section>' +

          '<section class="tarjeta"><h2>Descripción</h2>' +
            campo('Objetivo del programa', 'objetivo', { area: true, alto: true }) +
            campo('Enfoque del curso', 'perfil_egresado', { area: true }) +
          '</section>' +

          '<section class="tarjeta"><h2>Contenido <small>una idea por línea</small></h2>' +
            campo('¿A quién está dirigido?', 'dirigido_a', { tipo: 'lineas' }) +
            campo('Al finalizar serás capaz de…', 'resultados', { tipo: 'lineas', alto: true }) +
            campo('Qué incluye la inscripción', 'incluye', { tipo: 'lineas', alto: true,
              pista: 'Los cuatro primeros aparecen junto al precio: pon arriba los más convincentes.' }) +
            campo('Por qué tomarlo', 'beneficios', { tipo: 'lineas' }) +
          '</section>' +

          '<section class="tarjeta"><h2>Temario</h2>' +
            '<div id="edModulos"></div>' +
            '<button type="button" class="btn btn--mini" id="edAgregarModulo">+ Agregar módulo</button>' +
          '</section>' +

          '<section class="tarjeta" id="fechas"><h2>Fechas a la venta</h2>' +
            '<div id="edFechas"></div>' +
            '<button type="button" class="btn btn--mini" id="edAgregarFecha">+ Agregar una fecha</button>' +
            '<p class="pista">En cada fecha, lo que dejes vacío (valor, link de pago) usa lo del curso.</p>' +
          '</section>' +

          '<section class="tarjeta"><h2>Requisitos técnicos</h2>' +
            campo('Nota', 'requisitos_tecnicos.nota', { placeholder: 'Puedes trabajar con tu propio equipo siempre que cumpla…' }) +
            campo('Requisitos', 'requisitos_tecnicos.items', { tipo: 'lineas', pista: 'Uno por línea. Si lo dejas vacío, la sección no aparece.' }) +
          '</section>' +
        '</div>' +

        '<aside class="editor__lateral">' +
          '<section class="tarjeta"><h2>Visibilidad</h2>' +
            '<label class="switch" style="margin-bottom:14px"><input type="checkbox" data-c="activo" data-t="bool"> Publicado en la página</label>' +
            selector('Estado de inscripción', 'estado', ESTADOS_CURSO) +
            '<p class="pista">Oculto: no aparece en ninguna parte y su dirección no funciona. ' +
              'Sirve para preparar un curso antes de lanzarlo, o para sacarlo sin borrarlo.</p>' +
          '</section>' +

          '<section class="tarjeta"><h2>Imagen</h2><div id="edImagen"></div></section>' +

          '<section class="tarjeta"><h2>Precio y pago</h2>' +
            '<div class="rej">' +
              campo('Valor (CLP)', 'precio.clp', { tipo: 'num', html: 'number', placeholder: 'Consultar', extra: 'min="0" step="1000"' }) +
              campo('Preventa (CLP)', 'precio.clp_early', { tipo: 'num', html: 'number', extra: 'min="0" step="1000"' }) +
            '</div>' +
            campo('Preventa hasta', 'precio.early_hasta', { html: 'date', pista: 'Pasada esta fecha vuelve sola al valor normal.' }) +
            camposPago('pagos.') +
            campo('Observaciones', 'observaciones', { area: true, placeholder: 'Ej: incluye factura · descuentos para equipos',
              pista: 'Se muestran junto al precio, en un recuadro aparte.' }) +
          '</section>' +

          '<section class="tarjeta"><h2>Instructores</h2><div id="edInstructores"></div></section>' +

          '<section class="tarjeta"><h2>Dirección de la página</h2>' +
            '<div class="direccion"><span>coatzadrone.cl/cursos/</span>' +
              '<input id="edSlug" autocomplete="off" spellcheck="false"></div>' +
            '<p class="pista" id="edSlugPista">Es el enlace que usarás en los anuncios.</p>' +
          '</section>' +
        '</aside>' +
      '</div>';

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
      // Las fechas y los links de pago son de cada producto: no se copian,
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
      c.cohortes.push({ estado: 'abierta', precio: {}, pagos: {}, confirmada: true });
      marcarSucio();
      pintarFechas(c);
      var bloques = $$('#edFechas [data-propio]');
      var ult = bloques[bloques.length - 1];
      ult.scrollIntoView({ block: 'center', behavior: 'smooth' });
      $('[data-c="inicio"]', ult).focus();
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
  }

  /**
   * Una fecha en una sola tarjeta. Todo lo que define esa edición se ve y se
   * edita de una pasada, sin secciones anidadas.
   */
  function pintarFechas(c) {
    var cont = $('#edFechas');
    cont.innerHTML = c.cohortes.map(function (ch, i) {
      return '<div class="bloque" data-propio data-i="' + i + '">' +
        '<div class="bloque__top"><strong data-rotulo>Edición ' + (i + 1) +
          (ch.inicio ? ' · ' + esc(rango(ch)) : '') + '</strong>' +
          '<span class="acciones"><button type="button" class="btn btn--mini btn--peligro" data-quitar>Eliminar</button></span></div>' +
        '<div class="rej">' +
          campo('Desde', 'inicio', { html: 'date' }) +
          campo('Hasta', 'fin', { html: 'date' }) +
          campo('Horario', 'horario', { placeholder: '18:00 a 22:00' }) +
          campo('Cupos', 'cupos_totales', { tipo: 'num', html: 'number', extra: 'min="0"', placeholder: '12' }) +
          campo('Disponibles', 'cupos_disponibles', { tipo: 'num', html: 'number', extra: 'min="0"' }) +
          selector('Estado', 'estado', ESTADOS_FECHA) +
        '</div>' +
        '<div class="rej">' +
          campo('Valor (CLP)', 'precio.clp', { tipo: 'num', html: 'number', extra: 'min="0" step="1000"', placeholder: 'el del curso' }) +
          campo('Preventa', 'precio.clp_early', { tipo: 'num', html: 'number', extra: 'min="0" step="1000"' }) +
          campo('Preventa hasta', 'precio.early_hasta', { html: 'date' }) +
          camposPago('pagos.') +
        '</div>' +
        campo('Observaciones de esta fecha', 'observaciones', { area: true, placeholder: 'Ej: cupos limitados · última edición del año' }) +
        '</div>';
    }).join('') || '<p class="pista" style="margin:0 0 12px">Sin fechas: el curso aparece como «Por anunciar», con el botón de avísenme.</p>';

    $$('[data-propio]', cont).forEach(function (b) {
      var i = +b.getAttribute('data-i');
      var ch = c.cohortes[i];
      enlazar(b, ch, function (ruta) {
        if (ruta === 'inicio' || ruta === 'fin') {
          $('[data-rotulo]', b).textContent = 'Edición ' + (i + 1) + (ch.inicio ? ' · ' + rango(ch) : '');
        }
      });
      $('[data-quitar]', b).addEventListener('click', function () {
        if (!confirm('¿Eliminar esta fecha? Deja de aparecer en la página al guardar.')) return;
        c.cohortes.splice(i, 1);
        marcarSucio();
        pintarFechas(c);
      });
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
      if (!c.titulo || !c.titulo.trim()) errores.push({ msg: 'Hay un curso sin nombre.', ir: aqui });
      if (!esSlug(c.id)) errores.push({ msg: '«' + nombre + '»: la dirección de la página no es válida.', ir: aqui });
      else if (usados[c.id]) errores.push({ msg: 'Dos cursos usan la dirección /cursos/' + c.id + '.', ir: aqui });
      usados[c.id] = true;

      function linkMalo(p) {
        return E.medios.some(function (m) {
          var u = (p || {})[MEDIO_CAMPO[m]];
          return u && !/^https:\/\/[^\s"'<>]+$/.test(u.trim());
        });
      }
      if (linkMalo(c.pagos)) errores.push({ msg: '«' + nombre + '»: el link de pago no empieza con https://.', ir: aqui });

      c.cohortes.forEach(function (ch, i) {
        if (!ch.inicio) errores.push({ msg: '«' + nombre + '»: la edición ' + (i + 1) + ' no tiene fecha de inicio.', ir: aqui });
        else if (ch.fin && ch.fin < ch.inicio) errores.push({ msg: '«' + nombre + '»: en la edición ' + (i + 1) + ' el último día es anterior al primero.', ir: aqui });
        if (linkMalo(ch.pagos)) errores.push({ msg: '«' + nombre + '»: el link de pago de la edición ' + (i + 1) + ' no empieza con https://.', ir: aqui });
      });

      c.modulos.forEach(function (m, i) {
        if (!(m.titulo || '').trim() && ((m.contenidos || []).length || (m.objetivo || '').trim())) {
          errores.push({ msg: '«' + nombre + '»: el módulo ' + (i + 1) + ' tiene contenido pero no título.', ir: aqui });
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
        return '<li>' + (destino ? '<a href="' + esc(destino) + '">' + esc(txt) + '</a>' : esc(txt)) + '</li>';
      }).join('') + '</ul>';
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
