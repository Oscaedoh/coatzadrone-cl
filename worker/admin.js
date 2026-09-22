/**
 * Panel comercial — /admin
 *
 * Una sola pagina, sin dependencias, para editar precios, fechas y links de
 * pago sin tocar codigo ni esperar un deploy. Guarda en Cloudflare KV; la
 * pagina publica lee lo mismo a traves de /api/cursos.
 *
 * Entra con la clave del secreto ADMIN_CLAVE (Cloudflare -> Settings ->
 * Variables and Secrets, tipo Secret). Si el secreto no existe, el panel queda
 * cerrado a proposito: sin clave no hay entrada, no una entrada libre.
 *
 * El panel no esta enlazado desde ninguna parte del sitio y responde con
 * noindex, asi que no aparece en buscadores.
 */

import { leerBase, leerCambios, guardarCambios, fusionar, limpiarCambios, hayKV } from './catalogo.js';

/* ---------- Puerta ---------- */

/**
 * Comparacion en tiempo constante. Un == normal corta apenas encuentra una
 * letra distinta, y ese microsegundo de diferencia deja adivinar la clave
 * caracter por caracter. Aqui siempre se recorre entera.
 */
function claveOk(env, recibida) {
  var real = env.ADMIN_CLAVE;
  if (!real || typeof recibida !== 'string') return false;
  if (recibida.length !== real.length) return false;
  var d = 0;
  for (var i = 0; i < real.length; i++) {
    d |= real.charCodeAt(i) ^ recibida.charCodeAt(i);
  }
  return d === 0;
}

function json(cuerpo, estado) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

/* ---------- API ---------- */

export async function api(request, env) {
  if (!env.ADMIN_CLAVE) {
    return json({ ok: false, error: 'sin_clave_configurada' }, 503);
  }
  if (!claveOk(env, request.headers.get('X-Clave'))) {
    // Un retardo fijo hace que probar claves a ciegas sea lentisimo.
    await new Promise(function (r) { setTimeout(r, 600); });
    return json({ ok: false, error: 'clave_incorrecta' }, 401);
  }

  var base = await leerBase(env);
  var ids = (base.cursos || []).map(function (c) { return c.id; });

  if (request.method === 'GET') {
    var datos = fusionar(base, await leerCambios(env));
    return json({
      ok: true,
      kv: hayKV(env),
      actualizado: datos.actualizado,
      cursos: (datos.cursos || []).map(function (c) {
        return {
          id: c.id,
          titulo: c.titulo,
          software: c.software,
          estado: c.estado,
          precio: c.precio || {},
          pagos: c.pagos || {},
          cohortes: c.cohortes || []
        };
      })
    });
  }

  if (request.method === 'POST') {
    var entrada;
    try { entrada = await request.json(); }
    catch (e) { return json({ ok: false, error: 'json_invalido' }, 400); }

    var limpio = limpiarCambios(entrada, ids);

    if (!hayKV(env)) {
      // Sin KV no hay donde guardar, pero el trabajo no se pierde: se devuelve
      // ya validado para poder pegarlo cuando el almacen este configurado.
      return json({ ok: false, error: 'falta_kv', cambios: limpio }, 503);
    }

    await guardarCambios(env, limpio);
    return json({ ok: true, actualizado: limpio.actualizado, cambios: limpio });
  }

  return json({ ok: false, error: 'metodo_no_permitido' }, 405);
}

/* ---------- Pagina ---------- */

export function pagina() {
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

var HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Panel comercial · CoatzaDrone Chile</title>
<style>
  :root {
    --rojo:#DD3330; --negro:#0E0E10; --carbon:#17171A; --linea:#2A2A30;
    --texto:#EDEDEF; --gris:#9A9AA5; --ok:#3FB950;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body {
    margin:0; background:var(--negro); color:var(--texto);
    font:15px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif;
    padding: env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0);
  }
  .barra {
    position:sticky; top:0; z-index:9; background:rgba(14,14,16,.94);
    backdrop-filter:blur(8px); border-bottom:1px solid var(--linea);
    padding:14px 20px; display:flex; gap:14px; align-items:center; flex-wrap:wrap;
  }
  .barra h1 { margin:0; font-size:1rem; font-weight:600; letter-spacing:.02em; }
  .barra h1 span { color:var(--rojo); }
  .barra .sep { flex:1 1 auto; }
  .env { max-width:980px; margin:0 auto; padding:26px 20px 90px; }
  .curso {
    background:var(--carbon); border:1px solid var(--linea); border-radius:12px;
    padding:20px; margin-bottom:20px;
  }
  .curso > header { display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; margin-bottom:6px; }
  .curso h2 { margin:0; font-size:1.05rem; font-weight:600; }
  .tag {
    font-size:.68rem; text-transform:uppercase; letter-spacing:.09em;
    color:var(--gris); border:1px solid var(--linea); border-radius:99px; padding:3px 10px;
  }
  h3 {
    font-size:.72rem; text-transform:uppercase; letter-spacing:.12em;
    color:var(--gris); margin:24px 0 10px; font-weight:600;
  }
  .rej { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; }
  label { display:block; font-size:.74rem; color:var(--gris); margin-bottom:5px; }
  input, select, textarea {
    width:100%; background:#0A0A0C; color:var(--texto);
    border:1px solid var(--linea); border-radius:7px; padding:9px 11px;
    font:inherit; font-size:.92rem;
  }
  input:focus, select:focus, textarea:focus { outline:2px solid var(--rojo); outline-offset:1px; }
  .fecha {
    border:1px solid var(--linea); border-left:3px solid var(--rojo);
    border-radius:9px; padding:16px; margin-bottom:12px; background:#121215;
  }
  .fecha__top { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .fecha__top strong { font-size:.85rem; }
  button {
    font:inherit; cursor:pointer; border-radius:7px; border:1px solid var(--linea);
    background:#1F1F24; color:var(--texto); padding:9px 16px;
  }
  button:hover { border-color:var(--gris); }
  .btn-rojo { background:var(--rojo); border-color:var(--rojo); color:#fff; font-weight:600; }
  .btn-mini { padding:5px 11px; font-size:.78rem; }
  .btn-borrar { color:#FF7B77; border-color:#4A2422; background:transparent; }
  .aviso {
    border-radius:9px; padding:13px 16px; margin-bottom:20px; font-size:.9rem;
    border:1px solid var(--linea); background:var(--carbon);
  }
  .aviso--mal { border-color:#5A2422; background:#2A1514; }
  .aviso--bien { border-color:#1E4227; background:#13251A; }
  .puerta { max-width:400px; margin:14vh auto; padding:0 20px; text-align:center; }
  .puerta p { color:var(--gris); font-size:.9rem; }
  .pie {
    position:fixed; bottom:0; left:0; right:0; background:rgba(14,14,16,.96);
    backdrop-filter:blur(8px); border-top:1px solid var(--linea);
    padding:12px 20px calc(12px + env(safe-area-inset-bottom,0px));
    display:flex; gap:14px; align-items:center; justify-content:flex-end;
  }
  .pie small { color:var(--gris); margin-right:auto; font-size:.8rem; }
  textarea { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:.78rem; min-height:170px; }
  [hidden] { display:none !important; }
  @media (max-width:560px) { .pie { flex-wrap:wrap; } .pie small { width:100%; margin-bottom:4px; } }
</style>
</head>
<body>

<div id="puerta" class="puerta">
  <h1 style="font-size:1.1rem">Panel comercial</h1>
  <p>Precios, fechas y links de pago de <strong>coatzadrone.cl</strong></p>
  <form id="formClave" style="margin-top:22px">
    <label for="clave" style="text-align:left">Clave de acceso</label>
    <input id="clave" type="password" autocomplete="current-password" required>
    <button class="btn-rojo" style="width:100%;margin-top:12px;padding:11px">Entrar</button>
  </form>
  <div id="puertaError" class="aviso aviso--mal" hidden style="margin-top:16px;text-align:left"></div>
</div>

<div id="app" hidden>
  <div class="barra">
    <h1>Panel <span>comercial</span></h1>
    <span class="tag" id="sello">—</span>
    <span class="sep"></span>
    <button class="btn-mini" id="recargar">Recargar</button>
    <button class="btn-mini" id="salir">Salir</button>
  </div>

  <div class="env">
    <div id="avisoKV" class="aviso aviso--mal" hidden></div>
    <div id="cursos"></div>

    <details id="cajaJson" style="margin-top:26px">
      <summary style="cursor:pointer;color:var(--gris);font-size:.85rem">Ver los datos en crudo</summary>
      <textarea id="json" readonly style="margin-top:12px"></textarea>
    </details>
  </div>

  <div class="pie">
    <small id="estado">Los cambios se publican al guardar.</small>
    <button class="btn-rojo" id="guardar">Guardar y publicar</button>
  </div>
</div>

<script>
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var API = '/api/admin/datos';
  var clave = sessionStorage.getItem('cd_admin') || '';
  var DATOS = null;

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

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function campo(etiqueta, clase, valor, tipo, extra) {
    return '<div><label>' + esc(etiqueta) + '</label>' +
      '<input class="' + clase + '" type="' + (tipo || 'text') + '" ' +
      (extra || '') + ' value="' + esc(valor == null ? '' : valor) + '"></div>';
  }

  function selector(etiqueta, clase, valor, opciones) {
    return '<div><label>' + esc(etiqueta) + '</label><select class="' + clase + '">' +
      opciones.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' +
          (o[0] === valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select></div>';
  }

  function bloquePagos(p, clase) {
    p = p || {};
    return '<div class="rej">' +
      campo('Link de Mercado Pago', clase + ' mp', p.mercadopago_url, 'url', 'placeholder="https://..."') +
      campo('Link de Flow / Webpay', clase + ' fl', p.flow_url, 'url', 'placeholder="https://..."') +
      campo('Link de PayPal (opcional)', clase + ' pp', p.paypal_url, 'url', 'placeholder="https://..."') +
      '</div>';
  }

  function bloquePrecio(p, clase) {
    p = p || {};
    return '<div class="rej">' +
      campo('Valor en pesos', clase + ' clp', p.clp, 'number', 'min="0" step="1000" placeholder="275000"') +
      campo('Valor preventa (opcional)', clase + ' ear', p.clp_early, 'number', 'min="0" step="1000"') +
      campo('Preventa hasta', clase + ' eah', p.early_hasta, 'date') +
      '</div>';
  }

  function bloqueFecha(ch, i) {
    ch = ch || {};
    return '<div class="fecha" data-fecha>' +
      '<div class="fecha__top">' +
        '<strong>Edición ' + (i + 1) + '</strong>' +
        '<button type="button" class="btn-mini btn-borrar" data-quitar>Eliminar</button>' +
      '</div>' +
      '<div class="rej">' +
        campo('Primer día', 'f-ini', ch.inicio, 'date') +
        campo('Último día', 'f-fin', ch.fin, 'date') +
        campo('Horario', 'f-hor', ch.horario, 'text', 'placeholder="18:00 a 22:00 (hora de Chile)"') +
      '</div>' +
      '<div class="rej" style="margin-top:12px">' +
        campo('Cupos totales', 'f-ct', ch.cupos_totales, 'number', 'min="0"') +
        campo('Cupos disponibles', 'f-cd', ch.cupos_disponibles, 'number', 'min="0"') +
        selector('Estado', 'f-est', ch.estado || 'abierta', ESTADOS_FECHA) +
      '</div>' +
      '<h3 style="margin-top:20px">Precio de esta edición</h3>' +
      bloquePrecio(ch.precio, 'f-p') +
      '<h3>Links de pago de esta edición</h3>' +
      bloquePagos(ch.pagos, 'f-g') +
      '<p style="color:var(--gris);font-size:.78rem;margin:10px 0 0">' +
        'Si dejas el precio o los links vacíos, se usan los generales del curso.</p>' +
      '</div>';
  }

  function pintar() {
    $('#sello').textContent = DATOS.actualizado
      ? 'Publicado ' + new Date(DATOS.actualizado).toLocaleString('es-CL')
      : 'Sin cambios publicados';

    if (!DATOS.kv) {
      $('#avisoKV').hidden = false;
      $('#avisoKV').innerHTML = '<strong>Falta el almacén.</strong> Todavía no está creado el ' +
        'espacio donde se guardan estos datos, así que el botón de guardar no va a funcionar. ' +
        'Puedes editar igual y copiar el resultado desde «Ver los datos en crudo».';
    }

    $('#cursos').innerHTML = DATOS.cursos.map(function (c) {
      return '<section class="curso" data-curso="' + esc(c.id) + '">' +
        '<header><h2>' + esc(c.titulo) + '</h2>' +
          '<span class="tag">' + esc(c.software) + '</span></header>' +
        '<div class="rej" style="margin-top:14px">' +
          selector('Estado del curso', 'c-est', c.estado, ESTADOS_CURSO) +
        '</div>' +
        '<h3>Precio general</h3>' + bloquePrecio(c.precio, 'c-p') +
        '<h3>Links de pago generales</h3>' + bloquePagos(c.pagos, 'c-g') +
        '<h3>Fechas a la venta</h3>' +
        '<div data-fechas>' + (c.cohortes || []).map(bloqueFecha).join('') + '</div>' +
        '<button type="button" class="btn-mini" data-agregar>+ Agregar una fecha</button>' +
        '</section>';
    }).join('');

    $$('[data-agregar]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cont = $('[data-fechas]', b.closest('[data-curso]'));
        cont.insertAdjacentHTML('beforeend', bloqueFecha({}, cont.children.length));
        conectarBorrar();
      });
    });
    conectarBorrar();
    volcarJson();
  }

  function conectarBorrar() {
    $$('[data-quitar]').forEach(function (b) {
      b.onclick = function () {
        if (confirm('¿Eliminar esta fecha? Deja de aparecer en la página al guardar.')) {
          b.closest('[data-fecha]').remove();
          volcarJson();
        }
      };
    });
  }

  function val(sel, cont) { var e = $(sel, cont); return e ? e.value.trim() : ''; }
  function num(sel, cont) { var v = val(sel, cont); return v === '' ? null : parseInt(v, 10); }

  function leerPrecio(cont, pre) {
    return {
      clp: num('.' + pre + '.clp', cont),
      clp_early: num('.' + pre + '.ear', cont),
      early_hasta: val('.' + pre + '.eah', cont) || null,
      nota: ''
    };
  }

  function leerPagos(cont, pre) {
    return {
      mercadopago_url: val('.' + pre + '.mp', cont),
      flow_url: val('.' + pre + '.fl', cont),
      paypal_url: val('.' + pre + '.pp', cont),
      transferencia: true
    };
  }

  function recolectar() {
    var cursos = {};
    $$('[data-curso]').forEach(function (sec) {
      cursos[sec.getAttribute('data-curso')] = {
        estado: val('.c-est', sec),
        precio: leerPrecio(sec, 'c-p'),
        pagos: leerPagos(sec, 'c-g'),
        cohortes: $$('[data-fecha]', sec).map(function (f, i) {
          return {
            id: 'ed-' + (val('.f-ini', f) || String(i + 1)).replace(/-/g, '').slice(0, 8),
            inicio: val('.f-ini', f),
            fin: val('.f-fin', f),
            horario: val('.f-hor', f),
            sesiones: [],
            cupos_totales: num('.f-ct', f),
            cupos_disponibles: num('.f-cd', f),
            estado: val('.f-est', f),
            confirmada: true,
            precio: leerPrecio(f, 'f-p'),
            pagos: leerPagos(f, 'f-g')
          };
        })
      };
    });
    return { cursos: cursos };
  }

  function volcarJson() {
    $('#json').value = JSON.stringify(recolectar(), null, 2);
  }

  function decir(msg, malo) {
    var e = $('#estado');
    e.textContent = msg;
    e.style.color = malo ? '#FF7B77' : 'var(--ok)';
    if (!malo) setTimeout(function () { e.style.color = ''; }, 6000);
  }

  function pedir(metodo, cuerpo) {
    return fetch(API, {
      method: metodo,
      headers: { 'X-Clave': clave, 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    }).then(function (r) {
      return r.json().then(function (j) { return { http: r.status, datos: j }; });
    });
  }

  function cargar() {
    return pedir('GET').then(function (r) {
      if (!r.datos.ok) throw r.datos;
      DATOS = r.datos;
      $('#puerta').hidden = true;
      $('#app').hidden = false;
      pintar();
    });
  }

  $('#formClave').addEventListener('submit', function (e) {
    e.preventDefault();
    clave = $('#clave').value;
    cargar().then(function () {
      sessionStorage.setItem('cd_admin', clave);
    }).catch(function (err) {
      var caja = $('#puertaError');
      caja.hidden = false;
      caja.textContent = err && err.error === 'sin_clave_configurada'
        ? 'El panel todavía no tiene clave configurada en Cloudflare. Mientras no exista, nadie puede entrar.'
        : 'Clave incorrecta.';
    });
  });

  $('#recargar').addEventListener('click', function () {
    cargar().then(function () { decir('Recargado desde el servidor.'); });
  });

  $('#salir').addEventListener('click', function () {
    sessionStorage.removeItem('cd_admin');
    location.reload();
  });

  $('#guardar').addEventListener('click', function () {
    volcarJson();
    decir('Guardando…');
    pedir('POST', recolectar()).then(function (r) {
      if (r.datos.ok) {
        DATOS.actualizado = r.datos.actualizado;
        $('#sello').textContent = 'Publicado ' + new Date(r.datos.actualizado).toLocaleString('es-CL');
        decir('Listo. Ya está publicado en la página.');
      } else if (r.datos.error === 'falta_kv') {
        decir('Falta crear el almacén en Cloudflare. Los datos quedaron abajo para copiarlos.', true);
        $('#cajaJson').open = true;
        $('#json').value = JSON.stringify(r.datos.cambios, null, 2);
      } else {
        decir('No se pudo guardar: ' + (r.datos.error || r.http), true);
      }
    }).catch(function () {
      decir('No se pudo conectar con el servidor.', true);
    });
  });

  document.addEventListener('input', function (e) {
    if ($('#app').hidden) return;
    if (e.target.closest('#cursos')) volcarJson();
  });

  if (clave) {
    cargar().catch(function () {
      sessionStorage.removeItem('cd_admin');
      clave = '';
    });
  }
})();
</script>
</body>
</html>`;
