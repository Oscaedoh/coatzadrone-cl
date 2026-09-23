/* ==========================================================================
   COATZADRONE CHILE — Sitio de cursos

   Un solo archivo para las dos páginas que salen de index.html:
     · la portada (/)
     · la landing de cada curso (/cursos/<curso>)

   Todo el contenido viene del catálogo que se administra en /admin. El
   servidor lo incrusta en la página (<script id="catalogo-datos">); si no está
   ahí, se pide a /api/cursos, y si eso falla, se lee el catálogo inicial.
   ========================================================================== */

(function () {
  'use strict';

  var DATOS = null;
  var PAGINA = 'inicio';     // 'inicio' o 'curso'
  var CURSO = null;          // el curso de la landing
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Utilidades ---------- */

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Texto del panel con párrafos: una línea en blanco separa párrafos y un
  // salto simple se respeta dentro del párrafo.
  function parrafos(t) {
    return String(t || '').split(/\n{2,}/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .map(function (s) { return '<p>' + esc(s).replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  function precioCLP(n) {
    return '$' + Number(n).toLocaleString('es-CL') + ' CLP';
  }

  function hoyISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function enLocal() {
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  }

  // En el servidor local no hay Worker que atienda /cursos/<curso>: ahí la
  // landing se abre como index.html?curso=<curso>.
  function enlaceCurso(id) {
    return enLocal() ? '/index.html?curso=' + encodeURIComponent(id) : '/cursos/' + id;
  }

  // Las imágenes del sitio vienen como "assets/img/x.jpg". Sin la barra
  // inicial, en /cursos/<curso> se buscarían en /cursos/assets/...
  function urlImagen(src) {
    if (!src) return '';
    return src.charAt(0) === '/' ? src : '/' + src;
  }

  var MESES = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function partesFecha(iso) {
    var p = String(iso).split('-');
    return { a: +p[0], m: +p[1], d: +p[2] };
  }

  function fechaLarga(iso) {
    if (!iso) return '';
    var f = partesFecha(iso);
    return f.d + ' de ' + MESES[f.m - 1] + ' de ' + f.a;
  }

  function fechaCorta(iso) {
    if (!iso) return '';
    var f = partesFecha(iso);
    return f.d + ' ' + MESES[f.m - 1].slice(0, 3);
  }

  function rangoFechas(c) {
    if (!c.inicio) return c.etiqueta || 'Por confirmar';
    if (!c.fin || c.fin === c.inicio) return fechaLarga(c.inicio);
    var i = partesFecha(c.inicio), f = partesFecha(c.fin);
    if (i.m === f.m) return i.d + ' al ' + f.d + ' de ' + MESES[f.m - 1];
    return fechaCorta(c.inicio) + ' al ' + fechaCorta(c.fin);
  }

  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  // Los días de clase de una edición, cuando se cargaron uno por uno.
  function diasDe(ch) {
    return (ch.sesiones || []).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
  }

  // "sáb 31 oct · sáb 7 nov · sáb 14 nov". Vacío si es una sola sesión.
  function textoSesiones(ch) {
    var dias = diasDe(ch);
    if (dias.length < 2) return '';
    return dias.map(function (d) {
      var f = partesFecha(d);
      return DIAS[new Date(Date.UTC(f.a, f.m - 1, f.d)).getUTCDay()] + ' ' + fechaCorta(d);
    }).join(' · ');
  }

  /* ---------- Catálogo ---------- */

  function cursosVisibles() {
    return (DATOS.cursos || []).filter(function (c) { return c.activo !== false; });
  }

  function cursoPorId(id) {
    var lista = (DATOS && DATOS.cursos) || [];
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }

  function instructoresDe(c) {
    var todos = DATOS.instructores || [];
    return (c.instructores || []).map(function (id) {
      for (var i = 0; i < todos.length; i++) if (todos[i].id === id) return todos[i];
      return null;
    }).filter(Boolean);
  }

  function abierto(c) {
    return c.estado === 'inscripciones-abiertas';
  }

  /* ---------- Qué se está vendiendo ---------- */

  /**
   * Lo que se compra no es "el curso" en abstracto: es una edición con fecha,
   * cupo y precio propios. Por eso el precio y los botones de pago salen de la
   * edición y solo heredan los del curso cuando ella no los define.
   */

  // Las fechas que se ofrecen: visibles y que todavía no terminan.
  function edicionesVisibles(c) {
    var hoy = hoyISO();
    return (c.cohortes || [])
      .filter(function (ch) { return ch.inicio && ch.estado !== 'cerrado' && (ch.fin || ch.inicio) >= hoy; })
      .sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
  }

  // La que manda en el precio: la primera con cupo; si todas están agotadas, la primera.
  function cohorteVigente(c) {
    var eds = edicionesVisibles(c);
    return eds.filter(function (ch) { return ch.estado !== 'agotada'; })[0] || eds[0] || null;
  }

  function precioDe(curso, cohorte) {
    var p = (cohorte && cohorte.precio) || {};
    return (p.clp || p.clp_early) ? p : (curso.precio || {});
  }

  function pagosDe(curso, cohorte) {
    var g = (cohorte && cohorte.pagos) || {};
    return (g.mercadopago_url || g.flow_url || g.paypal_url) ? g : (curso.pagos || {});
  }

  // El precio rebajado vence solo. Sin esto, un descuento quedaría vigente para siempre.
  function enPreventa(p) {
    return !!(p.clp_early && p.clp && (!p.early_hasta || p.early_hasta >= hoyISO()));
  }

  function montoVigente(curso, cohorte) {
    var p = precioDe(curso, cohorte);
    return enPreventa(p) ? p.clp_early : (p.clp || null);
  }

  function textoPrecio(curso, cohorte) {
    var p = precioDe(curso, cohorte);
    if (enPreventa(p)) {
      return {
        texto: precioCLP(p.clp_early),
        nota: 'Precio rebajado. Valor normal ' + precioCLP(p.clp) +
              (p.early_hasta ? ' · Rebaja válida hasta el ' + fechaLarga(p.early_hasta) : '')
      };
    }
    if (p.clp) return { texto: precioCLP(p.clp), nota: p.nota || (curso.precio || {}).nota || '' };
    return { texto: 'Consultar', nota: 'Escríbenos y te enviamos el valor y las formas de pago vigentes.' };
  }

  var MEDIOS = [
    { campo: 'flow_url',        medio: 'flow',        nombre: 'Flow / Webpay' },
    { campo: 'mercadopago_url', medio: 'mercadopago', nombre: 'Mercado Pago' },
    { campo: 'paypal_url',      medio: 'paypal',      nombre: 'PayPal' }
  ];

  /**
   * Links de pago disponibles para una edición. Vacío si no hay nada que
   * cobrar de verdad: curso sin inscripciones abiertas o edición agotada.
   * Cobrar un cupo que no existe es una devolución seguida de un cliente perdido.
   */
  function opcionesPago(curso, cohorte) {
    if (!abierto(curso)) return [];
    if (cohorte && cohorte.estado === 'agotada') return [];
    var pagos = pagosDe(curso, cohorte);
    return MEDIOS.filter(function (m) { return pagos[m.campo]; })
      .map(function (m) { return { url: pagos[m.campo], medio: m.medio, nombre: m.nombre }; });
  }

  function atributosPago(curso, op) {
    return ' href="' + esc(op.url) + '" target="_blank" rel="noopener" data-pago="' + esc(curso.id) + '" data-medio="' + esc(op.medio) + '"';
  }

  /* ---------- Analítica (GA4 / Meta Pixel, si están configurados) ---------- */

  function evento(nombre, params) {
    if (typeof window.gtag === 'function') window.gtag('event', nombre, params || {});
  }

  function cargarAnalitica() {
    var cfg = DATOS.config || {};

    if (cfg.ga4_id) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga4_id);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', cfg.ga4_id);
    }

    if (cfg.meta_pixel_id) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', cfg.meta_pixel_id);
      window.fbq('track', 'PageView');
    }
  }

  /* ---------- Calendario (.ics + Google Calendar) ---------- */

  function aUTC(iso, hora) {
    // hora: "HH:MM" en horario de Chile (UTC-3 en verano / UTC-4 en invierno).
    // Usamos -03:00 como referencia; el archivo .ics incluye la zona en el texto.
    var f = partesFecha(iso);
    var hm = String(hora || '18:00').split(':');
    var d = new Date(Date.UTC(f.a, f.m - 1, f.d, +hm[0] + 3, +hm[1]));
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function horasDeCohorte(cohorte) {
    var m = String(cohorte.horario || '').match(/(\d{1,2}):(\d{2})[^\d]+(\d{1,2}):(\d{2})/);
    if (m) return { ini: m[1] + ':' + m[2], fin: m[3] + ':' + m[4] };
    return null;
  }

  // "20261031": el formato de día completo de los calendarios.
  function diaCompacto(iso) {
    return String(iso).replace(/-/g, '');
  }

  function diaSiguiente(iso) {
    var f = partesFecha(iso);
    return new Date(Date.UTC(f.a, f.m - 1, f.d + 1)).toISOString().slice(0, 10);
  }

  /**
   * Los tramos que ocupa una edición en el calendario: uno por día de clase.
   * Sin horario cargado van como días completos; inventar una hora sería
   * publicar un dato que nadie confirmó.
   */
  function tramosDeCohorte(cohorte) {
    var h = horasDeCohorte(cohorte);
    var dias = diasDe(cohorte);
    var bloques = dias.length
      ? dias.map(function (d) { return { ini: d, fin: d }; })
      : [{ ini: cohorte.inicio, fin: cohorte.fin || cohorte.inicio }];
    return bloques.map(function (b) {
      return h
        ? { inicio: 'DTSTART:' + aUTC(b.ini, h.ini), fin: 'DTEND:' + aUTC(b.fin, h.fin), g: aUTC(b.ini, h.ini) + '/' + aUTC(b.fin, h.fin) }
        : { inicio: 'DTSTART;VALUE=DATE:' + diaCompacto(b.ini), fin: 'DTEND;VALUE=DATE:' + diaCompacto(diaSiguiente(b.fin)),
            g: diaCompacto(b.ini) + '/' + diaCompacto(diaSiguiente(b.fin)) };
    });
  }

  function urlPublicaCurso(curso) {
    return 'https://coatzadrone.cl/cursos/' + curso.id;
  }

  function descargarICS(curso, cohorte) {
    var sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var sesiones = textoSesiones(cohorte);
    var desc = (curso.resumen || '').replace(/\n/g, ' ') +
               '\\n\\nModalidad: ' + (curso.modalidad || '') +
               '\\nDuración: ' + (curso.duracion || '') +
               (cohorte.horario ? '\\nHorario: ' + cohorte.horario : '') +
               (sesiones ? '\\nSesiones: ' + sesiones : '') +
               '\\n\\nMás información: ' + urlPublicaCurso(curso);

    // Un evento por día de clase: si las sesiones no son seguidas, un solo
    // evento de punta a punta bloquearía días en que no hay clase.
    var eventos = [];
    tramosDeCohorte(cohorte).forEach(function (t, n) {
      eventos.push(
        'BEGIN:VEVENT',
        'UID:' + curso.id + '-' + cohorte.id + '-' + (n + 1) + '@coatzadrone.cl',
        'DTSTAMP:' + sello,
        t.inicio,
        t.fin,
        'SUMMARY:' + curso.titulo + ' — CoatzaDrone Chile',
        'DESCRIPTION:' + desc,
        'LOCATION:' + (curso.modalidad || 'Online en vivo'),
        'URL:' + urlPublicaCurso(curso),
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        'DESCRIPTION:' + (n === 0 ? 'Tu curso comienza mañana' : 'Mañana tienes clase'),
        'END:VALARM',
        'END:VEVENT'
      );
    });

    var ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CoatzaDrone Chile//Cursos Pix4D//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ].concat(eventos, ['END:VCALENDAR']).join('\r\n');

    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = curso.id + '-' + cohorte.id + '.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    evento('agregar_calendario', { curso: curso.id, cohorte: cohorte.id });
  }

  function enlaceGoogleCalendar(curso, cohorte) {
    // Google Calendar recibe un solo evento por enlace: el primer día de
    // clase, con todas las sesiones escritas en el detalle.
    var sesiones = textoSesiones(cohorte);
    var params = [
      'action=TEMPLATE',
      'text=' + encodeURIComponent(curso.titulo + ' — CoatzaDrone Chile'),
      'dates=' + tramosDeCohorte(cohorte)[0].g,
      'details=' + encodeURIComponent((curso.resumen || '') +
        (sesiones ? '\n\nSesiones: ' + sesiones : '') + '\n\n' + urlPublicaCurso(curso)),
      'location=' + encodeURIComponent(curso.modalidad || 'Online en vivo')
    ];
    return 'https://calendar.google.com/calendar/render?' + params.join('&');
  }

  /* ---------- Piezas comunes ---------- */

  // Los datos clave de un curso en una lista corta: cuándo, cómo, cuánto dura.
  function htmlHechos(c, ch) {
    var items = [
      ['Fecha', ch ? rangoFechas(ch) : 'Por anunciar'],
      ['Sesiones', ch && textoSesiones(ch)],
      ['Horario', ch && ch.horario],
      ['Modalidad', c.modalidad],
      ['Duración', c.duracion],
      ['Nivel', c.nivel]
    ];
    if (ch && ch.estado === 'agotada') items.push(['Cupos', 'Agotados']);
    else if (ch && ch.estado === 'ultimos-cupos') items.push(['Cupos', 'Últimos cupos']);
    else if (ch && ch.cupos_totales) items.push(['Cupos', ch.cupos_totales + ' por edición']);

    return items.filter(function (x) { return x[1]; }).map(function (x) {
      return '<li><span>' + esc(x[0]) + '</span><strong>' + esc(x[1]) + '</strong></li>';
    }).join('');
  }

  /**
   * La caja de precio, igual en la portada y en la landing. El botón de pago
   * aparece solo si hay algo que cobrar de verdad; si no, el camino es el
   * formulario, con un texto que dice qué va a pasar.
   */
  function htmlPrecioCaja(c, ch) {
    var p = textoPrecio(c, ch);
    var nota = (ch ? 'Edición del ' + rangoFechas(ch) + '. ' : '') + p.nota;
    var ops = opcionesPago(c, ch);
    var agotada = ch && ch.estado === 'agotada';

    var botones = ops.map(function (op, i) {
      return '<a class="btn ' + (i === 0 ? 'btn--primario' : 'btn--fantasma') + ' btn--bloque"' +
        atributosPago(c, op) + ' style="margin-bottom:10px">' +
        (i === 0 ? 'Inscribirme y pagar' : 'Pagar con ' + esc(op.nombre)) + '</a>';
    }).join('');

    var contacto;
    if (ops.length) contacto = '<a class="btn btn--fantasma btn--bloque" href="#inscripcion" data-avisenme="' + esc(c.id) + '">Prefiero que me contacten</a>';
    else if (agotada) contacto = '<a class="btn btn--primario btn--bloque" href="#inscripcion" data-avisenme="' + esc(c.id) + '">Avísenme de la próxima fecha</a>';
    else if (abierto(c)) contacto = '<a class="btn btn--primario btn--bloque" href="#inscripcion" data-avisenme="' + esc(c.id) + '">Reservar mi cupo</a>';
    else contacto = '<a class="btn btn--primario btn--bloque" href="#inscripcion" data-avisenme="' + esc(c.id) + '">Avísenme cuando abra</a>';

    // Las observaciones son de cada edición; las del curso quedan de la
    // versión anterior del panel, para cursos que aún no tienen fechas.
    var obs = ((ch && ch.observaciones) || c.observaciones || '').trim();

    return '<div class="precio-caja">' +
      '<p class="eyebrow" style="margin-bottom:10px">Inversión</p>' +
      '<div class="precio-caja__monto">' + esc(p.texto) + '</div>' +
      '<p class="precio-caja__nota">' + esc(nota) + '</p>' +
      (obs ? '<p class="precio-caja__obs">' + esc(obs) + '</p>' : '') +
      ((c.incluye || []).length
        ? '<ul>' + c.incluye.slice(0, 4).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
        : '') +
      botones +
      contacto +
      (ops.length ? '<p class="precio-caja__seguro">Pago seguro. Recibirás la confirmación y el acceso por correo.</p>' : '') +
      '<div class="medios-pago">' +
        '<span class="medio">Flow / Webpay</span>' +
        '<span class="medio">Transferencia</span>' +
        '<span class="medio">Pago internacional</span>' +
      '</div>' +
      '</div>';
  }

  function htmlCohorte(c, ch, i) {
    var sesiones = textoSesiones(ch);
    var agotada = ch.estado === 'agotada';
    // Cupos en 0 o vacío: la edición no habla de cupos.
    var cupos = agotada ? 'Sin cupos disponibles'
      : ch.estado === 'ultimos-cupos' ? 'Últimos cupos'
      : ch.cupos_totales ? ch.cupos_totales + ' cupos' : '';

    var ops = opcionesPago(c, ch);
    var precio = textoPrecio(c, ch);

    var cta = agotada
      ? '<a class="btn btn--fantasma" href="#inscripcion" data-avisenme="' + esc(c.id) + '" style="padding:9px 20px;font-size:.7rem">Avísenme de la próxima</a>'
      : ops.length
        ? '<a class="btn btn--primario"' + atributosPago(c, ops[0]) + ' style="padding:9px 20px;font-size:.7rem">Inscribirme y pagar</a>'
        : '<a class="btn btn--primario" href="#inscripcion" data-avisenme="' + esc(c.id) + '" style="padding:9px 20px;font-size:.7rem">Reservar cupo</a>';

    return '' +
      '<div class="cohorte' + (agotada ? ' cohorte--agotada' : '') + '">' +
        '<div class="cohorte__fecha">' + esc(rangoFechas(ch)) +
          (ch.confirmada === false ? '<div class="cohorte__referencial">Fecha referencial</div>' : '') +
        '</div>' +
        '<div class="cohorte__detalle">' +
          (ch.horario ? '<strong>' + esc(ch.horario) + '</strong><br>' : '') +
          (sesiones ? esc(sesiones) + '<br>' : '') +
          (cupos ? esc(cupos) + '<br>' : '') +
          '<span class="cohorte__precio">' + esc(precio.texto) + '</span>' +
          (ch.observaciones ? '<span class="cohorte__obs">' + esc(ch.observaciones) + '</span>' : '') +
        '</div>' +
        '<div class="cohorte__acciones">' +
          '<button type="button" class="btn-mini" data-ics="' + esc(c.id) + '" data-i="' + i + '">Descargar .ics</button>' +
          '<a class="btn-mini" href="' + esc(enlaceGoogleCalendar(c, ch)) + '" target="_blank" rel="noopener">Google Calendar</a>' +
          cta +
        '</div>' +
      '</div>';
  }

  function htmlPorAnunciar(c) {
    return '<div class="cohorte cohorte--anunciar">' +
      '<div class="cohorte__fecha">Por anunciar</div>' +
      '<div class="cohorte__detalle">Estamos cerrando el calendario de la próxima versión. ' +
        'Déjanos tus datos y serás el primero en conocer la fecha de inicio, con prioridad ' +
        'para reservar cupo antes de que se abra la inscripción pública.</div>' +
      '<div class="cohorte__acciones"><a class="btn btn--primario" href="#inscripcion" data-avisenme="' + esc(c.id) + '">Avísenme</a></div>' +
      '</div>';
  }

  function htmlFechasDeCurso(c) {
    var eds = edicionesVisibles(c);
    return eds.length
      ? eds.map(function (ch, i) { return htmlCohorte(c, ch, i); }).join('')
      : htmlPorAnunciar(c);
  }

  function renderMenuCursos() {
    var lista = $('#menuCursosLista');
    if (!lista) return;
    lista.innerHTML = cursosVisibles().map(function (c) {
      return '<a href="' + esc(enlaceCurso(c.id)) + '"' +
        (CURSO && CURSO.id === c.id ? ' aria-current="page"' : '') + '>' +
        (c.software ? '<span class="nav__soft">' + esc(c.software) + '</span>' : '') +
        '<span class="nav__nombre">' + esc(c.titulo) + '</span></a>';
    }).join('');
  }

  function renderFaq() {
    var cont = $('#faqLista');
    if (!cont) return;
    cont.innerHTML = (DATOS.faq || []).map(function (f) {
      return '<details><summary>' + esc(f.p) + '</summary><div class="faq__r">' + esc(f.r) + '</div></details>';
    }).join('');
  }

  function renderSelectCurso(preseleccion) {
    var sel = $('#curso');
    if (!sel) return;
    sel.innerHTML = cursosVisibles().map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.titulo) +
             (c.estado === 'proximamente' ? ' (próximamente)' : '') + '</option>';
    }).join('') + '<option value="otro">Otro / aún no lo sé</option>';
    if (preseleccion) sel.value = preseleccion;
  }

  function enlaceWhatsApp(texto) {
    var cfg = DATOS.config || {};
    var msg = texto || cfg.whatsapp_texto || '';
    return 'https://wa.me/' + String(cfg.whatsapp || '').replace(/\D/g, '') +
           '?text=' + encodeURIComponent(msg);
  }

  function renderFooterYContacto() {
    var cfg = DATOS.config || {};
    var mailto = 'mailto:' + (cfg.email || '');
    var wa = enlaceWhatsApp(CURSO
      ? 'Hola, quiero información sobre el curso ' + CURSO.titulo + ' de CoatzaDrone Chile'
      : null);

    $('#footerCursos').innerHTML = cursosVisibles()
      .map(function (c) {
        return '<li><a href="' + esc(enlaceCurso(c.id)) + '">' + esc(c.software || c.titulo) + '</a></li>';
      }).join('');

    [['#footerMail', mailto], ['#enlaceMail', mailto]].forEach(function (par) {
      var el = $(par[0]); if (el) { el.href = par[1]; }
    });
    if ($('#footerMail')) $('#footerMail').textContent = cfg.email || '';

    [['#footerWa', wa], ['#enlaceWa', wa], ['#waFlotante', wa]].forEach(function (par) {
      var el = $(par[0]); if (el) el.href = par[1];
    });

    $('#anio').textContent = new Date().getFullYear();
  }

  /* ---------- Portada ---------- */

  function renderCursos() {
    var cont = $('#gridCursos');
    if (!cont) return;

    cont.innerHTML = cursosVisibles().map(function (c) {
      var esAbierto = abierto(c);
      var ch = cohorteVigente(c);
      var p = textoPrecio(c, ch);
      var meta = [c.modalidad, c.duracion, c.nivel].filter(Boolean);
      var ops = opcionesPago(c, ch);
      var pagina = enlaceCurso(c.id);

      // Con link de pago, el botón lleva directo a pagar. Sin él, a la página
      // del curso. El título y la imagen siempre llevan a la página.
      var cta = ops.length
        ? '<a class="btn btn--primario"' + atributosPago(c, ops[0]) + '>Inscribirme</a>'
        : '<a class="btn ' + (esAbierto ? 'btn--primario' : 'btn--fantasma') + '" href="' + esc(pagina) + '">Ver curso</a>';

      return '' +
        '<article class="curso-card">' +
          '<a class="curso-card__media" href="' + esc(pagina) + '" tabindex="-1" aria-hidden="true">' +
            (c.imagen ? '<img src="' + esc(urlImagen(c.imagen)) + '" alt="" loading="lazy" width="640" height="360">' : '') +
            (c.software ? '<span class="curso-card__software">' + esc(c.software) + '</span>' : '') +
          '</a>' +
          '<div class="curso-card__cuerpo">' +
            '<span class="pill ' + (esAbierto ? 'pill--abierto pill--punto' : 'pill--proximo') + '">' +
              (esAbierto ? 'Inscripciones abiertas' : 'Próximamente') +
            '</span>' +
            '<h3><a href="' + esc(pagina) + '">' + esc(c.titulo) + '</a></h3>' +
            '<p class="curso-card__resumen">' + esc(c.resumen) + '</p>' +
            '<div class="curso-card__meta">' +
              meta.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') +
              (ch ? '<span>' + esc(rangoFechas(ch)) + '</span>' : '') +
            '</div>' +
            '<a class="curso-card__ver" href="' + esc(pagina) + '">Ver temario, fechas e instructor →</a>' +
            '<div class="curso-card__pie">' +
              '<div class="curso-card__precio">' + esc(p.texto) +
                '<small>' + (p.texto === 'Consultar' ? 'Valor por definir' : 'Por participante') + '</small>' +
              '</div>' +
              cta +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  /**
   * El "Próximo workshop" se elige solo: la fecha más cercana entre los cursos
   * publicados con inscripción abierta o próxima. Si ningún curso tiene fecha,
   * se muestra el primero del orden del panel, con fecha por anunciar.
   */
  function elegirProximo() {
    var candidatos = [];
    cursosVisibles().forEach(function (c) {
      if (c.estado === 'cerrado') return;
      edicionesVisibles(c).forEach(function (ch) { candidatos.push({ curso: c, cohorte: ch }); });
    });
    candidatos.sort(function (a, b) { return a.cohorte.inicio < b.cohorte.inicio ? -1 : 1; });

    var conCupo = candidatos.filter(function (x) { return x.cohorte.estado !== 'agotada'; })[0];
    if (conCupo) return conCupo;
    if (candidatos[0]) return candidatos[0];

    var lista = cursosVisibles().filter(function (c) { return c.estado !== 'cerrado'; });
    var primero = lista.filter(abierto)[0] || lista[0];
    return primero ? { curso: primero, cohorte: null } : null;
  }

  function renderProximo() {
    var seccion = $('#destacado');
    if (!seccion) return;
    var p = elegirProximo();
    if (!p) { seccion.hidden = true; return; }

    var c = p.curso;
    $('#destacadoTitulo').textContent = c.titulo;
    $('#destacadoResumen').textContent = c.resumen || c.subtitulo || '';
    $('#destacadoHechos').innerHTML = htmlHechos(c, p.cohorte);
    $('#destacadoVer').href = enlaceCurso(c.id);
    $('#precioDestacado').innerHTML = htmlPrecioCaja(c, p.cohorte);
  }

  // Todos los cursos con sus fechas. Primero los que tienen fecha, del más
  // próximo al más lejano; al final los que están por anunciar.
  function renderCalendario() {
    var cont = $('#cohortes');
    if (!cont) return;

    var grupos = cursosVisibles()
      .filter(function (c) { return c.estado !== 'cerrado'; })
      .map(function (c) { return { curso: c, eds: edicionesVisibles(c) }; });

    grupos.sort(function (a, b) {
      if (a.eds.length && !b.eds.length) return -1;
      if (!a.eds.length && b.eds.length) return 1;
      if (!a.eds.length) return 0;
      return a.eds[0].inicio < b.eds[0].inicio ? -1 : 1;
    });

    cont.innerHTML = grupos.map(function (g) {
      var c = g.curso;
      return '<div class="cal-curso">' +
        '<div class="cal-curso__cab">' +
          (c.software ? '<span class="cal-curso__soft">' + esc(c.software) + '</span>' : '') +
          '<h3><a href="' + esc(enlaceCurso(c.id)) + '">' + esc(c.titulo) + '</a></h3>' +
          '<a class="cal-curso__ver" href="' + esc(enlaceCurso(c.id)) + '">Ver curso →</a>' +
        '</div>' +
        '<div class="cohortes">' + htmlFechasDeCurso(c) + '</div>' +
        '</div>';
    }).join('');
  }

  function inyectarSchemaInicio() {
    var lista = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: cursosVisibles().map(function (c, i) {
        return { '@type': 'ListItem', position: i + 1, url: urlPublicaCurso(c), name: c.titulo };
      })
    };
    var faq = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (DATOS.faq || []).map(function (f) {
        return { '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } };
      })
    };
    [lista, faq].forEach(ponerSchema);
  }

  /* ---------- Landing de un curso ---------- */

  function ocultarSiVacio(sel, vacio) {
    var el = $(sel);
    if (el) el.hidden = !!vacio;
  }

  function renderCurso(c) {
    var ch = cohorteVigente(c);
    var ops = opcionesPago(c, ch);
    var p = textoPrecio(c, ch);

    document.title = c.titulo + ' | CoatzaDrone Chile';

    /* Portada del curso */
    if (c.imagen) {
      $('#cursoFondo').style.backgroundImage = 'url("' + urlImagen(c.imagen).replace(/["\\]/g, '') + '")';
    }
    $('#cursoEyebrow').textContent = (c.software ? c.software + ' · ' : '') + 'Centro de Entrenamiento Oficial Pix4D';
    $('#cursoTitulo').textContent = c.titulo;
    $('#cursoSubtitulo').textContent = c.subtitulo || c.resumen || '';
    $('#cursoHechos').innerHTML = htmlHechos(c, ch);

    var agotada = ch && ch.estado === 'agotada';
    $('#cursoCompra').innerHTML =
      '<div class="hero__precio"><span>' + esc(p.texto) + '</span>' +
        '<small>' + esc(p.texto === 'Consultar' ? 'Valor por confirmar' : (enPreventa(precioDe(c, ch)) ? 'Precio rebajado · por participante' : 'Por participante')) + '</small></div>' +
      '<div class="hero__acciones">' +
        (ops.length
          ? '<a class="btn btn--primario"' + atributosPago(c, ops[0]) + '>Inscribirme y pagar</a>' +
            '<a class="btn btn--fantasma" href="#inscripcion" data-avisenme="' + esc(c.id) + '">Quiero que me contacten</a>'
          : '<a class="btn btn--primario" href="#inscripcion" data-avisenme="' + esc(c.id) + '">' +
              (agotada ? 'Avísenme de la próxima fecha' : (abierto(c) ? 'Quiero inscribirme' : 'Avísenme cuando abra')) + '</a>' +
            '<a class="btn btn--fantasma" href="#temario">Ver el temario</a>') +
      '</div>';

    /* Sobre el curso */
    var descripcion = parrafos(c.objetivo) + parrafos(c.perfil_egresado);
    $('#cursoObjetivo').innerHTML = descripcion || parrafos(c.resumen);
    $('#cursoDirigido').innerHTML = (c.dirigido_a || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    $('#cursoResultados').innerHTML = (c.resultados || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    ocultarSiVacio('#cursoDirigidoBloque', !(c.dirigido_a || []).length);
    ocultarSiVacio('#cursoResultadosBloque', !(c.resultados || []).length);
    $('#precioCurso').innerHTML = htmlPrecioCaja(c, ch);

    /* Temario */
    var mods = c.modulos || [];
    ocultarSiVacio('#temario', !mods.length);
    $('#modulos').innerHTML = mods.map(function (m, i) {
      var num = i + 1;
      return '' +
        '<details class="modulo"' + (i === 0 ? ' open' : '') + '>' +
          '<summary>' +
            '<span class="modulo__num">' + (num < 10 ? '0' : '') + num + '</span>' +
            '<span class="modulo__titulo">' + esc(m.titulo) + '</span>' +
            '<span class="modulo__flecha" aria-hidden="true"></span>' +
          '</summary>' +
          '<div class="modulo__cuerpo">' +
            (m.objetivo ? '<p class="modulo__objetivo">' + esc(m.objetivo) + '</p>' : '') +
            '<ul class="lista-check">' +
              (m.contenidos || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
            '</ul>' +
          '</div>' +
        '</details>';
    }).join('');

    /* Por qué tomarlo */
    var bs = c.beneficios || [];
    var inc = c.incluye || [];
    ocultarSiVacio('#beneficiosSeccion', !bs.length && !inc.length);
    ocultarSiVacio('#beneficios', !bs.length);
    ocultarSiVacio('#incluyeBloque', !inc.length);
    $('#beneficios').innerHTML = bs.map(function (b, i) {
      var partes = String(b).split('. ');
      var titulo = partes[0];
      var resto = partes.slice(1).join('. ');
      var num = i + 1;
      return '' +
        '<div class="beneficio">' +
          '<span class="beneficio__num">' + (num < 10 ? '0' : '') + num + '</span>' +
          '<div><h4>' + esc(titulo) + '</h4>' +
          (resto ? '<p>' + esc(resto) + '</p>' : '') + '</div>' +
        '</div>';
    }).join('');
    $('#incluye').innerHTML = inc.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');

    /* Instructores */
    var ins = instructoresDe(c);
    ocultarSiVacio('#instructor', !ins.length);
    $('#instructorTitulo').innerHTML = ins.length > 1
      ? 'Instructores <span class="rojo">certificados</span>'
      : 'Instructor <span class="rojo">certificado</span>';
    $('#instructorBloque').innerHTML = ins.map(function (i) {
      var ini = i.nombre.replace(/^(Ing|Dr|Dra|Lic|Mg)\.?\s+/i, '')
        .split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
      return '<div class="instructor revelar">' +
        '<div class="instructor__foto">' +
          (i.foto
            ? '<img src="' + esc(urlImagen(i.foto)) + '" alt="' + esc(i.nombre) + '" loading="lazy">'
            : '<span class="instructor__iniciales">' + esc(ini) + '</span>') +
        '</div>' +
        '<div>' +
          '<h3>' + esc(i.nombre) + '</h3>' +
          (i.cargo ? '<p class="instructor__cargo">' + esc(i.cargo) + '</p>' : '') +
          '<div class="instructor__bio">' + parrafos(i.bio) + '</div>' +
          '<div class="instructor__enlaces">' + (i.enlaces || []).map(function (e) {
            return '<a class="enlace-verificar" href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer">' + esc(e.texto) + ' →</a>';
          }).join('') + '</div>' +
        '</div>' +
        '</div>';
    }).join('');

    /* Fechas y requisitos */
    $('#cohortes').innerHTML = '<div class="cohortes">' + htmlFechasDeCurso(c) + '</div>';
    var r = c.requisitos_tecnicos || {};
    var caja = $('#requisitos');
    if (r.items && r.items.length) {
      caja.hidden = false;
      caja.innerHTML = '' +
        '<h4>Requisitos técnicos del equipo</h4>' +
        (r.nota ? '<p style="color:var(--gris);font-size:.94rem">' + esc(r.nota) + '</p>' : '') +
        '<ul class="lista-check" style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px 28px">' +
          r.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
        '</ul>';
    }

    /* Botones del encabezado y de "Hablemos" */
    var cta = $('#navCta');
    if (ops.length) {
      cta.href = ops[0].url;
      cta.target = '_blank';
      cta.rel = 'noopener';
      cta.setAttribute('data-pago', c.id);
      cta.setAttribute('data-medio', ops[0].medio);
    } else {
      cta.href = '#sobre';
    }
    var directo = $('#enlacePagoDirecto');
    if (directo) directo.href = ops.length ? ops[0].url : '#sobre';
    if (directo && ops.length) {
      directo.target = '_blank';
      directo.rel = 'noopener';
      directo.setAttribute('data-pago', c.id);
      directo.setAttribute('data-medio', ops[0].medio);
    }

    renderBarraCompra(c, ch, ops, p);
    inyectarSchemaCurso(c);

    var monto = montoVigente(c, ch);
    evento('view_item', { curso: c.id, valor: monto || 0 });
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'ViewContent', {
        content_ids: [c.id], content_name: c.titulo, content_type: 'product',
        value: monto || 0, currency: 'CLP'
      });
    }
  }

  function renderBarraCompra(c, ch, ops, p) {
    var barra = $('#barraCompra');
    if (!barra) return;
    $('#barraPrecio').textContent = p.texto;
    $('#barraFecha').textContent = ch ? rangoFechas(ch) : 'Fecha por anunciar';
    var btn = $('#barraBtn');
    if (ops.length) {
      btn.href = ops[0].url;
      btn.target = '_blank';
      btn.rel = 'noopener';
      btn.textContent = 'Inscribirme';
      btn.setAttribute('data-pago', c.id);
      btn.setAttribute('data-medio', ops[0].medio);
    } else {
      btn.href = '#inscripcion';
      btn.textContent = abierto(c) ? 'Quiero inscribirme' : 'Avísenme';
      btn.setAttribute('data-avisenme', c.id);
    }
    barra.hidden = false;
  }

  /**
   * Cada edición se declara como una oferta con precio y disponibilidad. Es lo
   * que permite que Google muestre el curso con su valor y sus fechas.
   */
  function ofertaDe(c, ch) {
    var monto = montoVigente(c, ch);
    if (!monto) return undefined;
    var ops = opcionesPago(c, ch);
    return {
      '@type': 'Offer',
      category: 'Paid',
      price: monto,
      priceCurrency: 'CLP',
      availability: (ch && ch.estado === 'agotada')
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url: ops.length ? ops[0].url : urlPublicaCurso(c),
      validThrough: ch ? (ch.fin || ch.inicio) : undefined
    };
  }

  function ponerSchema(obj) {
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  function inyectarSchemaCurso(c) {
    var ins = instructoresDe(c);
    var instructor = ins.length
      ? ins.map(function (i) { return { '@type': 'Person', name: i.nombre }; })
      : undefined;

    var instancias = edicionesVisibles(c).map(function (ch) {
      return {
        '@type': 'CourseInstance',
        courseMode: 'online',
        startDate: ch.inicio,
        endDate: ch.fin || ch.inicio,
        offers: ofertaDe(c, ch),
        instructor: instructor
      };
    });

    ponerSchema({
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: c.titulo,
      description: c.resumen || c.subtitulo,
      url: urlPublicaCurso(c),
      image: c.imagen ? 'https://coatzadrone.cl' + urlImagen(c.imagen) : undefined,
      inLanguage: 'es',
      provider: {
        '@type': 'EducationalOrganization',
        name: 'CoatzaDrone Chile',
        url: 'https://coatzadrone.cl/'
      },
      offers: ofertaDe(c, cohorteVigente(c)),
      hasCourseInstance: instancias.length ? instancias : undefined
    });
  }

  /* ---------- Clics comunes ---------- */

  // Un solo escuchador para los botones que se dibujan desde el catálogo.
  function configurarClics() {
    document.addEventListener('click', function (e) {
      var ics = e.target.closest('[data-ics]');
      if (ics) {
        var c = cursoPorId(ics.getAttribute('data-ics'));
        var ch = c && edicionesVisibles(c)[+ics.getAttribute('data-i')];
        if (c && ch) descargarICS(c, ch);
        return;
      }

      var pago = e.target.closest('[data-pago]');
      if (pago) {
        var cp = cursoPorId(pago.getAttribute('data-pago'));
        var monto = cp ? montoVigente(cp, cohorteVigente(cp)) : 0;
        evento('iniciar_pago', { curso: pago.getAttribute('data-pago'), medio: pago.getAttribute('data-medio') });
        if (typeof window.fbq === 'function') {
          window.fbq('track', 'InitiateCheckout', {
            content_ids: [pago.getAttribute('data-pago')], value: monto || 0, currency: 'CLP'
          });
        }
        return;
      }

      // Los botones que bajan al formulario dejan el curso ya elegido.
      var aviso = e.target.closest('[data-avisenme]');
      if (aviso) {
        var sel = $('#curso');
        if (sel) sel.value = aviso.getAttribute('data-avisenme');
        evento('click_cta_curso', { curso: aviso.getAttribute('data-avisenme') });
      }
    });
  }

  /* ---------- Formulario ---------- */

  /**
   * De donde viene la visita. Se lee de los parametros UTM que agregan los
   * anuncios y se guarda en sessionStorage, porque la persona normalmente
   * navega un rato por la pagina antes de llegar al formulario y para entonces
   * la URL ya perdio los parametros.
   */
  function origenDeVisita() {
    var guardado = null;
    try { guardado = JSON.parse(sessionStorage.getItem('cd_origen') || 'null'); } catch (e) { /* modo privado */ }

    var p = new URLSearchParams(window.location.search);
    var fuente = p.get('utm_source') || '';
    var campana = p.get('utm_campaign') || '';

    // Sin UTM, los identificadores de clic delatan igual de donde viene.
    if (!fuente && p.get('gclid')) fuente = 'google';
    if (!fuente && p.get('fbclid')) fuente = 'meta';

    if (!fuente) {
      if (guardado) return guardado;
      var ref = document.referrer;
      if (ref) {
        try {
          var host = new URL(ref).hostname.replace(/^www\./, '');
          fuente = host === window.location.hostname ? 'directo' : host;
        } catch (e) { fuente = 'directo'; }
      } else {
        fuente = 'directo';
      }
    }

    var medio = p.get('utm_medium') || '';
    var origen = {
      origen: medio ? fuente + ' / ' + medio : fuente,
      campana: campana
    };
    try { sessionStorage.setItem('cd_origen', JSON.stringify(origen)); } catch (e) { /* modo privado */ }
    return origen;
  }

  /* ---------- Verificación anti-robots (Cloudflare Turnstile) ---------- */

  /**
   * Solo existe si data/cursos.json trae config.turnstile_sitekey. Sin eso los
   * formularios funcionan como siempre.
   *
   * El script de Cloudflare se carga recién cuando la persona toca el
   * formulario, no con la página: así no pesa en la primera carga. En modo
   * "interaction-only" casi nunca se ve; solo pide un clic si duda.
   */
  var turnstileCargado = null;

  function cargarTurnstile() {
    if (!turnstileCargado) {
      turnstileCargado = new Promise(function (ok, mal) {
        window.cdTurnstileListo = function () { ok(window.turnstile); };
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=cdTurnstileListo';
        s.async = true;
        s.onerror = function () { turnstileCargado = null; mal(new Error('turnstile')); };
        document.head.appendChild(s);
      });
    }
    return turnstileCargado;
  }

  function verificador(form) {
    var sitekey = (DATOS.config || {}).turnstile_sitekey;
    if (!sitekey) return null;

    var caja = document.createElement('div');
    caja.className = 'verificador';
    var boton = form.querySelector('[type="submit"]');
    boton.parentNode.insertBefore(caja, boton);

    var id = null;
    var token = '';
    var iniciado = false;
    var esperando = [];

    function avisar() {
      esperando.splice(0).forEach(function (f) { f(token); });
    }

    function iniciar() {
      if (iniciado) return;
      iniciado = true;
      cargarTurnstile().then(function (ts) {
        id = ts.render(caja, {
          sitekey: sitekey,
          appearance: 'interaction-only',
          language: 'es',
          action: form.id,
          'response-field': false,
          'refresh-expired': 'auto',
          callback: function (t) { token = t; avisar(); },
          'expired-callback': function () { token = ''; },
          'error-callback': function () { token = ''; avisar(); }
        });
      }).catch(function () { iniciado = false; avisar(); });
    }

    form.addEventListener('focusin', iniciar);

    return {
      // Espera el comprobante hasta 10 s. Si no llega, se envía igual y el
      // servidor decide: mejor un error con WhatsApp que un botón colgado.
      token: function () {
        iniciar();
        if (token) return Promise.resolve(token);
        return new Promise(function (ok) {
          esperando.push(ok);
          setTimeout(function () { ok(token); }, 10000);
        });
      },
      // Cada comprobante sirve una sola vez.
      reiniciar: function () {
        token = '';
        if (id !== null && window.turnstile) window.turnstile.reset(id);
      }
    };
  }

  function configurarFormulario() {
    var form = $('#formInscripcion');
    if (!form) return;

    // Se captura apenas carga la pagina, no al enviar: asi el origen sobrevive
    // aunque la persona recargue mas tarde sin los parametros de la campana.
    origenDeVisita();
    var estado = $('#formEstado');
    var btn = $('#btnEnviar');
    var cfg = DATOS.config || {};
    var endpoint = cfg.formulario_endpoint || '';
    var endpointListo = endpoint && endpoint.indexOf('TU_ID_AQUI') === -1;
    var humano = endpointListo ? verificador(form) : null;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      estado.className = 'form-estado';
      estado.textContent = '';

      if (!form.checkValidity()) {
        estado.className = 'form-estado error';
        estado.textContent = 'Revisa los campos obligatorios antes de enviar.';
        form.reportValidity();
        return;
      }

      var datos = {};
      new FormData(form).forEach(function (v, k) { datos[k] = v; });
      var curso = cursoPorId(datos.curso);
      datos.curso_nombre = curso ? curso.titulo : datos.curso;
      datos._subject = 'Nueva solicitud de contacto — ' + datos.curso_nombre;
      var proc = origenDeVisita();
      datos.origen = proc.origen;
      datos.campana = proc.campana;

      evento('enviar_inscripcion', { curso: datos.curso, pais: datos.pais });

      if (!endpointListo) {
        // Sin endpoint configurado: derivamos el lead a WhatsApp con los datos precargados.
        var msg = 'Hola, quiero inscribirme en: ' + datos.curso_nombre +
                  '\nNombre: ' + datos.nombre +
                  '\nEmail: ' + datos.email +
                  '\nTeléfono: ' + datos.telefono +
                  '\nPaís: ' + datos.pais +
                  (datos.perfil ? '\nPerfil: ' + datos.perfil : '') +
                  (datos.mensaje ? '\nMensaje: ' + datos.mensaje : '');
        window.open(enlaceWhatsApp(msg), '_blank', 'noopener');
        estado.className = 'form-estado ok';
        estado.textContent = 'Abrimos WhatsApp con tus datos para que envíes la solicitud. ' +
                             'Si no se abrió, escríbenos a ' + (cfg.email || '') + '.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Enviando…';

      (humano ? humano.token() : Promise.resolve(''))
        .then(function (t) {
          if (t) datos.verificacion = t;
          return fetch(endpoint, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
          });
        })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          form.reset();
          renderSelectCurso(CURSO ? CURSO.id : null);
          estado.className = 'form-estado ok';
          estado.textContent = '¡Listo! Recibimos tus datos. Te contactamos dentro de las próximas 24 horas hábiles.';
          evento('lead_confirmado', { curso: datos.curso });
          if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_ids: [datos.curso] });
        })
        .catch(function () {
          estado.className = 'form-estado error';
          estado.innerHTML = 'No pudimos enviar el formulario. Escríbenos por ' +
            '<a href="' + esc(enlaceWhatsApp()) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">WhatsApp</a> ' +
            'o a <a href="mailto:' + esc(cfg.email) + '" style="color:inherit;text-decoration:underline">' + esc(cfg.email) + '</a>.';
        })
        .finally(function () {
          if (humano) humano.reiniciar();
          btn.disabled = false;
          btn.textContent = 'Quiero que me contacten';
        });
    });
  }

  /* ---------- Banner de novedades ---------- */

  /**
   * Barra inferior para captar el correo de quien todavia no esta listo para
   * inscribirse. Es un publico distinto al del formulario: entra a otra lista
   * y no recibe la secuencia de venta.
   *
   * No aparece al cargar la pagina a proposito. Google penaliza en movil los
   * avisos que tapan el contenido apenas entras, y ademas molesta antes de que
   * la persona haya visto nada que le interese.
   */
  function configurarBanner() {
    var banner = $('#bannerNovedades');
    if (!banner) return;

    var cfg = DATOS.config || {};
    var endpoint = cfg.formulario_endpoint || '';
    if (!endpoint || endpoint.indexOf('TU_ID_AQUI') !== -1) return;

    var CLAVE = 'cd_banner';
    var DIAS_DE_ESPERA = 30;

    if (yaRespondio()) return;

    var form = $('#bannerForm');
    var input = $('#bannerEmail');
    var btn = $('#bannerBtn');
    var estado = $('#bannerEstado');
    var visible = false;
    var humano = verificador(form);

    function yaRespondio() {
      try {
        var guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
        if (!guardado) return false;
        if (guardado.suscrito) return true;
        var dias = (Date.now() - guardado.fecha) / 86400000;
        return dias < DIAS_DE_ESPERA;
      } catch (e) {
        return false;   // modo privado o storage bloqueado: mostrarlo igual
      }
    }

    function recordar(datos) {
      try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* da igual */ }
    }

    function mostrar() {
      if (visible) return;
      visible = true;
      banner.hidden = false;
      // Forzar un reflujo antes de animar. Con requestAnimationFrame el banner
      // se quedaba a medias cuando la pestaña no estaba pintando, porque en ese
      // caso el navegador no ejecuta esos callbacks. Leer offsetHeight obliga a
      // aplicar el estado inicial en el acto y la transicion siempre arranca.
      void banner.offsetHeight;
      banner.classList.add('visible');
      document.body.classList.add('con-banner');
      evento('banner_visto', {});
      quitarDisparadores();
    }

    function cerrar(suscrito) {
      visible = false;
      banner.classList.remove('visible');
      document.body.classList.remove('con-banner');
      recordar({ fecha: Date.now(), suscrito: !!suscrito });
      setTimeout(function () { banner.hidden = true; }, 260);
    }

    // Se muestra a la mitad de la pagina: para entonces ya vio los cursos.
    function alDesplazar() {
      var alto = document.documentElement.scrollHeight - window.innerHeight;
      if (alto <= 0) return;
      if ((window.scrollY || window.pageYOffset) / alto > 0.5) mostrar();
    }

    // El mouse saliendo por arriba suele significar que se va. En tactil no
    // existe este gesto, por eso el scroll es el disparador principal.
    function alSalir(e) {
      if (e.clientY <= 0) mostrar();
    }

    function quitarDisparadores() {
      window.removeEventListener('scroll', alDesplazar);
      document.removeEventListener('mouseout', alSalir);
    }

    window.addEventListener('scroll', alDesplazar, { passive: true });
    document.addEventListener('mouseout', alSalir);

    $('#bannerCerrar').addEventListener('click', function () { cerrar(false); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && visible) cerrar(false);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      estado.className = 'banner__estado';
      estado.textContent = '';

      if (!form.checkValidity()) {
        estado.className = 'banner__estado error';
        estado.textContent = 'Revisa el correo, parece incompleto.';
        input.focus();
        return;
      }

      var proc = origenDeVisita();
      btn.disabled = true;
      btn.textContent = 'Enviando…';

      (humano ? humano.token() : Promise.resolve(''))
        .then(function (t) {
          return fetch(endpoint, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'novedades',
              email: input.value.trim(),
              nombre: '',
              origen: proc.origen,
              campana: proc.campana,
              verificacion: t || '',
              _gotcha: form._gotcha ? form._gotcha.value : ''
            })
          });
        })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          estado.className = 'banner__estado ok';
          estado.textContent = '¡Listo! Te avisamos apenas abramos fechas.';
          evento('suscripcion_novedades', { origen: proc.origen });
          setTimeout(function () { cerrar(true); }, 2200);
        })
        .catch(function () {
          estado.className = 'banner__estado error';
          estado.textContent = 'No pudimos registrarte. Intenta de nuevo o escríbenos por WhatsApp.';
        })
        .finally(function () {
          if (humano) humano.reiniciar();
          btn.disabled = false;
          btn.textContent = 'Avísenme';
        });
    });
  }

  /* ---------- Interacciones de la página ---------- */

  function configurarMenuCursos() {
    var grupo = $('#navCursos');
    if (!grupo) return;
    var boton = $('.nav__boton', grupo);

    function abrir(si) {
      grupo.classList.toggle('abierto', si);
      boton.setAttribute('aria-expanded', String(si));
    }

    boton.addEventListener('click', function (e) {
      e.stopPropagation();
      abrir(!grupo.classList.contains('abierto'));
    });
    document.addEventListener('click', function (e) {
      if (!grupo.contains(e.target)) abrir(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && grupo.classList.contains('abierto')) { abrir(false); boton.focus(); }
    });
  }

  /**
   * La barra de compra del celular aparece cuando el botón de la portada del
   * curso ya quedó atrás, y se esconde sobre el formulario, donde ya hay
   * botones de sobra.
   */
  function configurarBarraCompra() {
    var barra = $('#barraCompra');
    var portada = $('.hero--curso');
    var form = $('#inscripcion');
    if (!barra || barra.hidden || !portada) return;

    var visible = false;
    function actualizar() {
      var pasoPortada = portada.getBoundingClientRect().bottom < 0;
      var r = form ? form.getBoundingClientRect() : null;
      var enForm = r ? (r.top < window.innerHeight && r.bottom > 0) : false;
      var ver = pasoPortada && !enForm;
      if (ver === visible) return;
      visible = ver;
      barra.classList.toggle('visible', ver);
      document.body.classList.toggle('con-barra', ver);
    }
    window.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    actualizar();
  }

  function configurarUI() {
    var header = $('#header');
    var menuBtn = $('#menuBtn');
    var nav = $('#nav');

    function alScroll() {
      header.classList.toggle('compacto', window.scrollY > 40);
    }
    window.addEventListener('scroll', alScroll, { passive: true });
    alScroll();

    menuBtn.addEventListener('click', function () {
      var abiertoMenu = nav.classList.toggle('abierto');
      menuBtn.setAttribute('aria-expanded', String(abiertoMenu));
      menuBtn.setAttribute('aria-label', abiertoMenu ? 'Cerrar menú' : 'Abrir menú');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('abierto');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });

    configurarMenuCursos();

    // Revelado progresivo al hacer scroll, con degradado seguro: si el navegador
    // no soporta IntersectionObserver, se muestra todo de inmediato.
    function revelarTodo() {
      $$('.revelar').forEach(function (el) { el.classList.add('visible'); });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
        });
      // threshold 0: basta con que asome un píxel. Así nunca queda oculto un bloque
      // más alto que la pantalla, que es lo que pasa en móvil con umbrales altos.
      }, { threshold: 0, rootMargin: '0px 0px -60px 0px' });
      $$('.revelar').forEach(function (el) { io.observe(el); });
    } else {
      revelarTodo();
    }

    // Enlace activo en el menú según sección visible
    var secciones = $$('main section[id]');
    if ('IntersectionObserver' in window && secciones.length) {
      var io2 = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (en) {
          if (!en.isIntersecting) return;
          $$('.nav > a').forEach(function (a) {
            a.classList.toggle('activo', a.getAttribute('href') === '#' + en.target.id);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      secciones.forEach(function (s) { io2.observe(s); });
    }

    configurarBarraCompra();
  }

  function errorCarga(msg) {
    var main = document.querySelector('main');
    if (!main) return;
    main.insertAdjacentHTML('afterbegin',
      '<div style="background:#DD3330;color:#fff;padding:16px 20px;text-align:center;font-size:.95rem;margin-top:var(--header-h)">' +
      esc(msg) + '</div>');
  }

  /* ---------- Arranque ---------- */

  /**
   * El catálogo viene incrustado en la página por el servidor. Si no está —el
   * servidor local no tiene Worker, o hubo una falla— se pide a /api/cursos y,
   * como último recurso, se lee el catálogo inicial del repositorio.
   */
  function cargarCatalogo() {
    var incrustado = document.getElementById('catalogo-datos');
    if (incrustado) {
      try { return Promise.resolve(JSON.parse(incrustado.textContent)); } catch (e) { /* sigue abajo */ }
    }
    function leerJson(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }
    return fetch('/api/cursos', { cache: 'no-store' })
      .then(leerJson)
      .catch(function () {
        return fetch('/data/cursos.json', { cache: 'no-cache' }).then(leerJson);
      });
  }

  /**
   * En producción el servidor ya quitó las secciones de la otra página. En el
   * servidor local no hay quien lo haga, así que se hace aquí: la landing se
   * abre como index.html?curso=<curso>.
   */
  function prepararPagina() {
    var id = document.body.getAttribute('data-curso');
    if (!id && enLocal()) id = new URLSearchParams(location.search).get('curso');
    PAGINA = id ? 'curso' : 'inicio';

    $$('[data-solo]').forEach(function (el) {
      if (el.getAttribute('data-solo') !== PAGINA) el.parentNode.removeChild(el);
    });
    return id;
  }

  var idCurso = prepararPagina();
  configurarClics();

  cargarCatalogo()
    .then(function (json) {
      DATOS = json;
      if (idCurso) {
        CURSO = cursoPorId(idCurso);
        if (!CURSO) throw new Error('Este curso no está disponible.');
      }
      cargarAnalitica();
      renderMenuCursos();

      if (PAGINA === 'curso') {
        renderCurso(CURSO);
      } else {
        renderCursos();
        renderProximo();
        renderCalendario();
        inyectarSchemaInicio();
      }

      renderFaq();
      renderSelectCurso(CURSO ? CURSO.id : null);
      renderFooterYContacto();
      configurarFormulario();
      configurarBanner();
      configurarUI();
    })
    .catch(function (e) {
      errorCarga(e.message && e.message.indexOf('HTTP') === 0
        ? 'No se pudo cargar el contenido de los cursos.'
        : e.message);
      configurarUI();
    });

})();
