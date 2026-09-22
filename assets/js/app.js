/* ==========================================================================
   COATZADRONE CHILE — Landing de cursos
   Todo el contenido se renderiza desde data/cursos.json.
   Para agregar o editar un curso NO se toca este archivo.
   ========================================================================== */

(function () {
  'use strict';

  var DATOS = null;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Utilidades ---------- */

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function precioCLP(n) {
    return '$' + Number(n).toLocaleString('es-CL') + ' CLP';
  }

  // Devuelve { texto, nota } listos para mostrar
  function textoPrecio(curso) {
    var p = curso.precio || {};
    if (p.clp_early && p.clp) {
      return {
        texto: precioCLP(p.clp_early),
        nota: 'Precio preventa. Valor general ' + precioCLP(p.clp) +
              (p.early_hasta ? ' · Preventa hasta el ' + fechaLarga(p.early_hasta) : '')
      };
    }
    if (p.clp) return { texto: precioCLP(p.clp), nota: p.nota || '' };
    if (p.usd) {
      return {
        texto: 'Consultar',
        nota: 'Valor de referencia internacional: USD $' + p.usd +
              '. Te confirmamos el valor en pesos chilenos y las formas de pago al momento de la inscripción.'
      };
    }
    return { texto: 'Consultar', nota: 'Escríbenos y te enviamos el valor y las formas de pago vigentes.' };
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

  function cursoPorId(id) {
    var lista = (DATOS && DATOS.cursos) || [];
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }

  function cursoDestacado() {
    var lista = (DATOS.cursos || []).filter(function (c) { return c.activo; });
    var d = lista.filter(function (c) { return c.destacado; })[0];
    return d || lista[0] || null;
  }

  function enlaceWhatsApp(texto) {
    var cfg = DATOS.config || {};
    var msg = texto || cfg.whatsapp_texto || '';
    return 'https://wa.me/' + String(cfg.whatsapp || '').replace(/\D/g, '') +
           '?text=' + encodeURIComponent(msg);
  }

  /* ---------- Analítica (GA4 / Meta Pixel, si están configurados) ---------- */

  function evento(nombre, params) {
    if (typeof window.gtag === 'function') window.gtag('event', nombre, params || {});
    if (typeof window.fbq === 'function') window.fbq('trackCustom', nombre, params || {});
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
    return { ini: '18:00', fin: '22:00' };
  }

  function descargarICS(curso, cohorte) {
    var h = horasDeCohorte(cohorte);
    var uid = curso.id + '-' + cohorte.id + '@coatzadrone.cl';
    var desc = (curso.resumen || '').replace(/\n/g, ' ') +
               '\\n\\nModalidad: ' + curso.modalidad +
               '\\nDuración: ' + curso.duracion +
               '\\nHorario: ' + (cohorte.horario || '') +
               '\\n\\nMás información: https://coatzadrone.cl/';

    var ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CoatzaDrone Chile//Cursos Pix4D//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
      'DTSTART:' + aUTC(cohorte.inicio, h.ini),
      'DTEND:' + aUTC(cohorte.fin || cohorte.inicio, h.fin),
      'SUMMARY:' + curso.titulo + ' — CoatzaDrone Chile',
      'DESCRIPTION:' + desc,
      'LOCATION:Online en vivo',
      'URL:https://coatzadrone.cl/',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:Tu curso comienza mañana',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

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
    var h = horasDeCohorte(cohorte);
    var params = [
      'action=TEMPLATE',
      'text=' + encodeURIComponent(curso.titulo + ' — CoatzaDrone Chile'),
      'dates=' + aUTC(cohorte.inicio, h.ini) + '/' + aUTC(cohorte.fin || cohorte.inicio, h.fin),
      'details=' + encodeURIComponent((curso.resumen || '') + '\n\nhttps://coatzadrone.cl/'),
      'location=' + encodeURIComponent('Online en vivo')
    ];
    return 'https://calendar.google.com/calendar/render?' + params.join('&');
  }

  /* ---------- Render ---------- */

  function renderCursos() {
    var cont = $('#gridCursos');
    if (!cont) return;
    var lista = (DATOS.cursos || []).filter(function (c) { return c.activo; });

    cont.innerHTML = lista.map(function (c) {
      var abierto = c.estado === 'inscripciones-abiertas';
      var p = textoPrecio(c);
      var cohorte = (c.cohortes || [])[0];
      var meta = [c.modalidad, c.duracion, c.nivel].filter(Boolean);

      return '' +
        '<article class="curso-card">' +
          '<div class="curso-card__media">' +
            (c.imagen ? '<img src="' + esc(c.imagen) + '" alt="' + esc(c.titulo) + '" loading="lazy" width="640" height="360">' : '') +
            '<span class="curso-card__software">' + esc(c.software) + '</span>' +
          '</div>' +
          '<div class="curso-card__cuerpo">' +
            '<span class="pill ' + (abierto ? 'pill--abierto pill--punto' : 'pill--proximo') + '">' +
              (abierto ? 'Inscripciones abiertas' : 'Próximamente') +
            '</span>' +
            '<h3>' + esc(c.titulo) + '</h3>' +
            '<p class="curso-card__resumen">' + esc(c.resumen) + '</p>' +
            '<div class="curso-card__meta">' +
              meta.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') +
              (cohorte ? '<span>' + esc(rangoFechas(cohorte)) + '</span>' : '') +
            '</div>' +
            '<div class="curso-card__pie">' +
              '<div class="curso-card__precio">' + esc(p.texto) +
                '<small>' + (abierto ? 'Por participante' : 'Valor por definir') + '</small>' +
              '</div>' +
              '<a class="btn ' + (abierto ? 'btn--primario' : 'btn--fantasma') + '" href="' +
                (abierto ? '#inscripcion' : '#inscripcion') + '" data-curso="' + esc(c.id) + '">' +
                (abierto ? 'Inscribirme' : 'Avísenme') +
              '</a>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');

    // Al pulsar el CTA de una tarjeta, preseleccionamos ese curso en el formulario
    $$('[data-curso]', cont).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sel = $('#curso');
        if (sel) sel.value = btn.getAttribute('data-curso');
        evento('click_cta_curso', { curso: btn.getAttribute('data-curso') });
      });
    });
  }

  function renderDestacado(c) {
    $('#destacadoTitulo').innerHTML = esc(c.titulo);
    $('#destacadoSubtitulo').textContent = c.subtitulo || '';
    $('#destacadoObjetivo').textContent = c.objetivo || c.resumen || '';

    $('#destacadoDirigido').innerHTML = (c.dirigido_a || [])
      .map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');

    $('#destacadoResultados').innerHTML = (c.resultados || [])
      .map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');

    var p = textoPrecio(c);
    $('#precioMonto').textContent = p.texto;
    $('#precioNota').textContent = p.nota;
    $('#precioIncluye').innerHTML = (c.incluye || []).slice(0, 5)
      .map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');

    renderBotonesPago(c);
  }

  // Si hay links de pago cargados en el JSON, se muestran como botones de pago
  // directo. Si no, se mantiene el flujo de reserva por formulario.
  function renderBotonesPago(c) {
    var pagos = c.pagos || {};
    var cont = $('#botonesPago');
    if (!cont) return;

    var opciones = [
      { url: pagos.mercadopago_url, texto: 'Pagar con Mercado Pago', medio: 'mercadopago' },
      { url: pagos.flow_url,        texto: 'Pagar con Flow / Webpay', medio: 'flow' },
      { url: pagos.paypal_url,      texto: 'Pagar con PayPal',        medio: 'paypal' }
    ].filter(function (o) { return o.url; });

    if (!opciones.length) { cont.hidden = true; return; }

    cont.hidden = false;
    cont.innerHTML = opciones.map(function (o, i) {
      return '<a class="btn ' + (i === 0 ? 'btn--primario' : 'btn--fantasma') + ' btn--bloque" ' +
             'href="' + esc(o.url) + '" target="_blank" rel="noopener" ' +
             'data-pago="' + esc(o.medio) + '" style="margin-bottom:10px">' + esc(o.texto) + '</a>';
    }).join('') +
    '<p style="font-size:.8rem;color:var(--gris);text-align:center;margin:6px 0 0">' +
      'Pago seguro. Recibirás la confirmación y el acceso por correo.</p>';

    $$('[data-pago]', cont).forEach(function (a) {
      a.addEventListener('click', function () {
        evento('iniciar_pago', { curso: c.id, medio: a.getAttribute('data-pago') });
        if (typeof window.fbq === 'function') window.fbq('track', 'InitiateCheckout');
      });
    });

    // Con pago directo disponible, el CTA de reserva pasa a segundo plano.
    var ctaReserva = $('[data-evento="cta_precio"]');
    if (ctaReserva) {
      ctaReserva.classList.remove('btn--primario');
      ctaReserva.classList.add('btn--fantasma');
      ctaReserva.textContent = 'Prefiero que me contacten';
    }
  }

  function renderModulos(c) {
    var cont = $('#modulos');
    var mods = c.modulos || [];
    if (!mods.length) { $('#temario').hidden = true; return; }

    cont.innerHTML = mods.map(function (m, i) {
      return '' +
        '<details class="modulo"' + (i === 0 ? ' open' : '') + '>' +
          '<summary>' +
            '<span class="modulo__num">0' + m.numero + '</span>' +
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
  }

  function renderBeneficios(c) {
    var cont = $('#beneficios');
    var bs = c.beneficios || [];
    cont.innerHTML = bs.map(function (b, i) {
      var partes = String(b).split('. ');
      var titulo = partes[0];
      var resto = partes.slice(1).join('. ');
      return '' +
        '<div class="beneficio">' +
          '<span class="beneficio__num">0' + (i + 1) + '</span>' +
          '<div><h4>' + esc(titulo) + '</h4>' +
          (resto ? '<p>' + esc(resto) + '</p>' : '') + '</div>' +
        '</div>';
    }).join('');

    $('#incluye').innerHTML = (c.incluye || [])
      .map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
  }

  function renderInstructor(c) {
    var ins = c.instructor || {};
    if (!ins.nombre) { $('#instructor').hidden = true; return; }

    var iniciales = ins.nombre.replace(/^Ing\.?\s*/i, '')
      .split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();

    $('#instructorBloque').innerHTML = '' +
      '<div class="instructor__foto">' +
        (ins.foto
          ? '<img src="' + esc(ins.foto) + '" alt="' + esc(ins.nombre) + '" loading="lazy">'
          : '<span class="instructor__iniciales">' + esc(iniciales) + '</span>') +
      '</div>' +
      '<div>' +
        '<h3>' + esc(ins.nombre) + '</h3>' +
        '<p class="instructor__cargo">' + esc(ins.cargo) + '</p>' +
        '<p class="instructor__bio">' + esc(ins.bio) + '</p>' +
        (ins.certificado_url
          ? '<a class="enlace-verificar" href="' + esc(ins.certificado_url) + '" target="_blank" rel="noopener noreferrer">Ver certificación Pix4D →</a>'
          : '') +
      '</div>';
  }

  function renderCohortes(c) {
    var cont = $('#cohortes');
    var chs = (c.cohortes || []).filter(function (x) { return x.estado !== 'cerrado'; });

    if (!chs.length) {
      cont.innerHTML = '<div class="cohorte"><div class="cohorte__fecha">Por anunciar</div>' +
        '<div class="cohorte__detalle">Estamos cerrando el calendario de la próxima versión. ' +
        'Déjanos tus datos y serás el primero en conocer la fecha de inicio, con prioridad ' +
        'para reservar cupo antes de que se abra la inscripción pública.</div>' +
        '<div class="cohorte__acciones"><a class="btn btn--primario" href="#inscripcion">Avísenme</a></div></div>';
      return;
    }

    cont.innerHTML = chs.map(function (ch, i) {
      var sesiones = (ch.sesiones || []).join(' · ');
      var cupos = ch.cupos_disponibles != null
        ? ch.cupos_disponibles + ' cupos disponibles de ' + ch.cupos_totales
        : '';
      return '' +
        '<div class="cohorte">' +
          '<div class="cohorte__fecha">' + esc(rangoFechas(ch)) +
            (ch.confirmada === false ? '<div style="font-family:var(--texto);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gris);margin-top:6px">Fecha referencial</div>' : '') +
          '</div>' +
          '<div class="cohorte__detalle">' +
            (ch.horario ? '<strong>' + esc(ch.horario) + '</strong><br>' : '') +
            (sesiones ? esc(sesiones) + '<br>' : '') +
            (cupos ? esc(cupos) : '') +
          '</div>' +
          '<div class="cohorte__acciones">' +
            '<button type="button" class="btn-mini" data-ics="' + i + '">Descargar .ics</button>' +
            '<a class="btn-mini" href="' + esc(enlaceGoogleCalendar(c, ch)) + '" target="_blank" rel="noopener">Google Calendar</a>' +
            '<a class="btn btn--primario" href="#inscripcion" style="padding:9px 20px;font-size:.7rem">Reservar</a>' +
          '</div>' +
        '</div>';
    }).join('');

    $$('[data-ics]', cont).forEach(function (btn) {
      btn.addEventListener('click', function () {
        descargarICS(c, chs[+btn.getAttribute('data-ics')]);
      });
    });
  }

  function renderRequisitos(c) {
    var r = c.requisitos_tecnicos || {};
    var caja = $('#requisitos');
    if (!r.items || !r.items.length) { caja.hidden = true; return; }
    caja.innerHTML = '' +
      '<h4>Requisitos técnicos del equipo</h4>' +
      (r.nota ? '<p style="color:var(--gris);font-size:.94rem">' + esc(r.nota) + '</p>' : '') +
      '<ul class="lista-check" style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px 28px">' +
        r.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
      '</ul>';
  }

  function renderFaq() {
    var cont = $('#faqLista');
    cont.innerHTML = (DATOS.faq || []).map(function (f) {
      return '<details><summary>' + esc(f.p) + '</summary><div class="faq__r">' + esc(f.r) + '</div></details>';
    }).join('');
  }

  function renderSelectCurso() {
    var sel = $('#curso');
    if (!sel) return;
    var lista = (DATOS.cursos || []).filter(function (c) { return c.activo; });
    sel.innerHTML = lista.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.titulo) +
             (c.estado === 'proximamente' ? ' (próximamente)' : '') + '</option>';
    }).join('') + '<option value="otro">Otro / aún no lo sé</option>';
  }

  function renderFooterYContacto() {
    var cfg = DATOS.config || {};
    var mailto = 'mailto:' + (cfg.email || '');
    var wa = enlaceWhatsApp();

    $('#footerCursos').innerHTML = (DATOS.cursos || [])
      .filter(function (c) { return c.activo; })
      .map(function (c) { return '<li><a href="#cursos">' + esc(c.software) + '</a></li>'; }).join('');

    [['#footerMail', mailto], ['#enlaceMail', mailto]].forEach(function (par) {
      var el = $(par[0]); if (el) { el.href = par[1]; }
    });
    if ($('#footerMail')) $('#footerMail').textContent = cfg.email || '';

    [['#footerWa', wa], ['#enlaceWa', wa], ['#waFlotante', wa]].forEach(function (par) {
      var el = $(par[0]); if (el) el.href = par[1];
    });

    $('#anio').textContent = new Date().getFullYear();
  }

  function inyectarSchema(c) {
    var cohorte = (c.cohortes || [])[0];
    var schema = {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: c.titulo,
      description: c.resumen,
      inLanguage: 'es',
      provider: {
        '@type': 'EducationalOrganization',
        name: 'CoatzaDrone Chile',
        url: 'https://coatzadrone.cl/'
      },
      hasCourseInstance: cohorte ? [{
        '@type': 'CourseInstance',
        courseMode: 'online',
        courseWorkload: 'PT12H',
        startDate: cohorte.inicio,
        endDate: cohorte.fin,
        instructor: c.instructor && c.instructor.nombre
          ? { '@type': 'Person', name: c.instructor.nombre } : undefined
      }] : undefined
    };

    var faq = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (DATOS.faq || []).map(function (f) {
        return {
          '@type': 'Question',
          name: f.p,
          acceptedAnswer: { '@type': 'Answer', text: f.r }
        };
      })
    };

    [schema, faq].forEach(function (obj) {
      var s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(obj);
      document.head.appendChild(s);
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
      datos._subject = 'Nueva inscripción — ' + datos.curso_nombre;
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

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          form.reset();
          renderSelectCurso();
          estado.className = 'form-estado ok';
          estado.textContent = '¡Listo! Recibimos tu solicitud. Te contactamos dentro de las próximas 24 horas hábiles.';
          evento('lead_confirmado', { curso: datos.curso });
          if (typeof window.fbq === 'function') window.fbq('track', 'Lead');
        })
        .catch(function () {
          estado.className = 'form-estado error';
          estado.innerHTML = 'No pudimos enviar el formulario. Escríbenos por ' +
            '<a href="' + enlaceWhatsApp() + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">WhatsApp</a> ' +
            'o a <a href="mailto:' + esc(cfg.email) + '" style="color:inherit;text-decoration:underline">' + esc(cfg.email) + '</a>.';
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Enviar inscripción';
        });
    });
  }

  /* ---------- Interacciones de la página ---------- */

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
      var abierto = nav.classList.toggle('abierto');
      menuBtn.setAttribute('aria-expanded', String(abierto));
      menuBtn.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('abierto');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });

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
          $$('.nav a').forEach(function (a) {
            a.classList.toggle('activo', a.getAttribute('href') === '#' + en.target.id);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      secciones.forEach(function (s) { io2.observe(s); });
    }
  }

  function errorCarga(msg) {
    var main = document.querySelector('main');
    if (!main) return;
    main.insertAdjacentHTML('afterbegin',
      '<div style="background:#DD3330;color:#fff;padding:16px 20px;text-align:center;font-size:.95rem">' +
      'No se pudo cargar el contenido de los cursos. ' + esc(msg) + '</div>');
  }

  /* ---------- Arranque ---------- */

  fetch('data/cursos.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (json) {
      DATOS = json;
      cargarAnalitica();

      var destacado = cursoDestacado();
      renderCursos();
      if (destacado) {
        renderDestacado(destacado);
        renderModulos(destacado);
        renderBeneficios(destacado);
        renderInstructor(destacado);
        renderCohortes(destacado);
        renderRequisitos(destacado);
        inyectarSchema(destacado);
      }
      renderFaq();
      renderSelectCurso();
      renderFooterYContacto();
      configurarFormulario();
      configurarUI();
    })
    .catch(function (e) {
      errorCarga(e.message);
      configurarUI();
    });

})();
