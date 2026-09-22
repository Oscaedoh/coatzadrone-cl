/**
 * Armado de las paginas en el servidor.
 *
 * Hay una sola plantilla, index.html, para la portada y para la landing de
 * cada curso. Las secciones exclusivas de cada una llevan data-solo="inicio" o
 * data-solo="curso", y aqui se quitan las que no corresponden antes de
 * entregar la pagina. Asi el encabezado, el formulario, las preguntas y el pie
 * existen una sola vez y no se desincronizan entre paginas.
 *
 * Ademas, en la landing de un curso se reescriben el titulo, la descripcion y
 * la imagen para redes. Es lo que leen Meta y WhatsApp al mostrar el enlace, y
 * no ejecutan JavaScript: si esto se hiciera en el navegador, todos los cursos
 * se compartirian con el titulo generico de la portada.
 *
 * En las dos paginas se incrusta el catalogo como JSON, para que el navegador
 * no tenga que pedirlo aparte. Una peticion menos antes de pintar importa en
 * celular, que es de donde llega casi todo el trafico de los anuncios.
 */

import { catalogoPublico, buscarCurso } from './catalogo.js';

var SITIO = 'https://coatzadrone.cl';
var IMAGEN_POR_DEFECTO = SITIO + '/assets/img/Coatzadrone-hero-bg.jpg';

function urlAbsoluta(src) {
  if (!src) return IMAGEN_POR_DEFECTO;
  if (src.charAt(0) === '/') return SITIO + src;
  return SITIO + '/' + src;
}

function recortar(t, max) {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/**
 * JSON dentro de <script>: se escapan '<' y los separadores de linea de
 * Unicode. Sin eso, un texto del catalogo con "</script>" cortaria la etiqueta
 * y lo que siga se ejecutaria como codigo.
 */
var BARRA = String.fromCharCode(92);

function jsonIncrustable(datos) {
  // Se arman con fromCharCode y no con escapes en el codigo fuente: un editor
  // puede convertir esos escapes en el caracter real, y el caracter real es
  // justo un salto de linea que rompe el archivo.
  return JSON.stringify(datos)
    .split('<').join(BARRA + 'u003c')
    .split(String.fromCharCode(0x2028)).join(BARRA + 'u2028')
    .split(String.fromCharCode(0x2029)).join(BARRA + 'u2029');
}

/**
 * La plantilla se pide siempre sin cabeceras condicionales. Si se reenviara
 * el If-None-Match del navegador, el servidor de archivos podria responder 304
 * y el navegador reusaria una copia vieja con el catalogo de otro momento, o
 * la portada en lugar del curso.
 */
async function plantilla(request, env) {
  var r = await env.ASSETS.fetch(new Request(new URL('/', request.url).toString()));
  if (!r.ok) throw new Error('no se pudo leer index.html');
  return r;
}

function cabecerasHTML(origen) {
  var h = new Headers(origen.headers);
  ['ETag', 'Last-Modified', 'Content-Length'].forEach(function (n) { h.delete(n); });
  h.set('Content-Type', 'text/html; charset=utf-8');
  h.set('Cache-Control', 'no-cache');
  return h;
}

/**
 * Aviso para el dueno cuando ve algo que el publico no ve: el sitio completo
 * durante el mantenimiento, o un curso oculto. Sin esto es facil olvidar que
 * se esta mirando con la vista previa y creer que algo ya esta publicado.
 */
function aviso(opciones, cursoOculto) {
  var texto = '';
  if (opciones.vistaPrevia && opciones.mantenimiento) texto = 'VISTA PREVIA · el público ve el aviso de mantenimiento';
  else if (opciones.vistaPrevia && cursoOculto) texto = 'VISTA PREVIA · este curso está oculto y el público no lo ve';
  if (!texto) return '';
  return '<div style="position:fixed;left:12px;bottom:12px;z-index:9999;background:#DD3330;color:#fff;' +
    'font:600 12px/1.3 -apple-system,Segoe UI,sans-serif;letter-spacing:.04em;padding:9px 13px;' +
    'border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,.4);pointer-events:none">' + texto + '</div>';
}

/* ---------- Portada ---------- */

export async function inicio(request, env, opciones) {
  opciones = opciones || {};
  var datos = await catalogoPublico(env);
  var base = await plantilla(request, env);

  var html = new HTMLRewriter()
    .on('[data-solo="curso"]', { element: function (el) { el.remove(); } })
    .on('body', {
      element: function (el) {
        el.setAttribute('data-pagina', 'inicio');
        el.append(aviso(opciones, false), { html: true });
      }
    })
    .on('head', {
      element: function (el) {
        el.append('<script id="catalogo-datos" type="application/json">' +
          jsonIncrustable(datos) + '</script>', { html: true });
      }
    })
    .transform(base);

  return new Response(html.body, { status: 200, headers: cabecerasHTML(base) });
}

/* ---------- Landing de un curso ---------- */

export async function curso(request, env, id, opciones) {
  opciones = opciones || {};
  // Con vista previa se encuentran tambien los cursos ocultos: es la forma de
  // revisar un borrador en su pagina real antes de publicarlo.
  var datos = await catalogoPublico(env, opciones.vistaPrevia);
  var hallado = buscarCurso(datos, id);

  if (!hallado) return pagina404();

  // Direccion vieja: 301 a la nueva, conservando los parametros. Los anuncios
  // llevan UTM en la URL y perderlos aqui borraria de donde vino la visita.
  if (hallado.redirigir) {
    var destino = new URL('/cursos/' + hallado.curso.id, request.url);
    destino.search = new URL(request.url).search;
    return Response.redirect(destino.toString(), 301);
  }

  var c = hallado.curso;
  var url = SITIO + '/cursos/' + c.id;
  var titulo = c.titulo + ' | CoatzaDrone Chile';
  var descripcion = recortar(c.resumen || c.subtitulo || c.titulo, 158);
  var imagen = urlAbsoluta(c.imagen);
  var base = await plantilla(request, env);

  function contenido(valor) {
    return { element: function (el) { el.setAttribute('content', valor); } };
  }

  var html = new HTMLRewriter()
    .on('[data-solo="inicio"]', { element: function (el) { el.remove(); } })
    .on('title', { element: function (el) { el.setInnerContent(titulo); } })
    .on('meta[name="description"]', contenido(descripcion))
    .on('meta[property="og:title"]', contenido(titulo))
    .on('meta[property="og:description"]', contenido(descripcion))
    .on('meta[property="og:url"]', contenido(url))
    .on('meta[property="og:image"]', contenido(imagen))
    .on('link[rel="canonical"]', { element: function (el) { el.setAttribute('href', url); } })
    .on('body', {
      element: function (el) {
        el.setAttribute('data-pagina', 'curso');
        el.setAttribute('data-curso', c.id);
        el.append(aviso(opciones, c.activo === false), { html: true });
      }
    })
    .on('head', {
      element: function (el) {
        el.append('<script id="catalogo-datos" type="application/json">' +
          jsonIncrustable(datos) + '</script>', { html: true });
      }
    })
    .transform(base);

  return new Response(html.body, { status: 200, headers: cabecerasHTML(base) });
}

/* ---------- Sitemap ---------- */

/**
 * Se arma con el catalogo del momento: un curso nuevo aparece aqui apenas se
 * guarda en el panel, y uno oculto desaparece. Un archivo fijo quedaria
 * desactualizado al primer cambio.
 */
export async function sitemap(env) {
  var datos = await catalogoPublico(env);
  var fecha = (datos.actualizado || new Date().toISOString()).slice(0, 10);

  var urls = [SITIO + '/'].concat((datos.cursos || []).map(function (c) {
    return SITIO + '/cursos/' + c.id;
  }));

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(function (u) {
      return '  <url><loc>' + u + '</loc><lastmod>' + fecha + '</lastmod></url>';
    }).join('\n') +
    '\n</urlset>\n';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

/* ---------- No encontrado ---------- */

export function pagina404() {
  var html = '<!doctype html><html lang="es-CL"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    '<title>Curso no encontrado | CoatzaDrone Chile</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0D0D0D;color:#fff;' +
    'font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;padding:24px;text-align:center}' +
    'h1{font-size:1.6rem;margin:0 0 10px}p{color:#9A9A9A;margin:0 0 26px}' +
    'a{display:inline-block;background:#DD3330;color:#fff;text-decoration:none;font-weight:700;' +
    'letter-spacing:.08em;text-transform:uppercase;font-size:.8rem;padding:14px 26px;border-radius:4px}</style>' +
    '</head><body><main><h1>Este curso ya no está disponible</h1>' +
    '<p>Puede que haya terminado o que la dirección haya cambiado.</p>' +
    '<a href="/#cursos">Ver los cursos disponibles</a></main></body></html>';

  return new Response(html, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
  });
}
