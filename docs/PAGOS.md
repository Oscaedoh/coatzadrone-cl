# Cobrar los cursos: Mercado Pago y Flow

El sitio es estático (no tiene servidor propio), así que el cobro se resuelve con
**links de pago**: una URL que generas una vez por edición y que el alumno abre
para pagar. No requiere programación ni mantención.

> **Dónde se pegan esos links:** en el panel <https://coatzadrone.cl/admin>, en la
> edición que corresponda. Ya no van a `data/cursos.json`. Ver [PANEL.md](PANEL.md).
>
> En Flow lo que necesitas es el **Botón de Pago** (reutilizable, se incrusta en
> el sitio, acepta fecha de vencimiento), no el *Link de Pago*, que es de un solo
> cliente y se manda por WhatsApp o correo.

---

## Comparación rápida

| | Mercado Pago Chile | Flow.cl |
|---|---|---|
| Medios | Tarjetas crédito/débito, cuotas, saldo MP | Webpay (Transbank), Servipag, Khipu, Mercado Pago |
| Comisión | ~3,49% + IVA | ~3,19% + IVA |
| Costo fijo | $0 | $0 |
| Retiro del dinero | Inmediato o programado | A cuenta bancaria |
| Requisito | RUT (persona o empresa) | RUT empresa + cuenta bancaria |
| Alumnos fuera de Chile | Limitado | No |

**Recomendación:** activa los dos. Mercado Pago convierte mejor con tarjetas
extranjeras y cuotas; Flow es el que la gente en Chile reconoce como "pago seguro"
por su integración con Webpay.

---

## Mercado Pago — crear un link de pago

1. Entra a <https://www.mercadopago.cl> con tu cuenta (o créala con tu RUT)
2. Menú **Tu negocio** → **Link de pago** → **Crear link de pago**
3. Completa:
   - **Título:** `Workshop Pix4Dfields aplicado a Agricultura de Precisión`
   - **Precio:** el valor en CLP
   - **Cantidad disponible:** los cupos del curso (así se cierra solo al llenarse)
   - **Fecha de vencimiento:** el día anterior al inicio del curso
4. Copia la URL corta que te entrega (tipo `https://mpago.la/xxxxx`)

> **Mercado Pago está en pausa** por decisión del dueño: el panel no muestra su
> casilla. Para volver a activarlo hay que agregar `mercadopago` a `MEDIOS_PAGO`
> en `worker/catalogo.js`; desde ahí aparece su campo en el panel, junto al de Flow.

---

## Flow.cl — crear un botón de pago

1. Regístrate en <https://www.flow.cl> (necesitas RUT de empresa y cuenta bancaria)
2. Espera la validación de la cuenta (1 a 2 días hábiles)
3. Panel → **Botón de pago** → **Crear botón**
4. Completa nombre del curso, monto y descripción
5. Flow entrega una URL tipo `https://www.flow.cl/btn.php?token=xxxxx`
6. Pégala en el panel, en la ficha del curso → bloque **Fechas** → la edición
   que corresponde → **Link de pago**. Cada edición lleva el suyo: el monto del
   botón tiene que coincidir con el valor de esa edición
7. **Guardar y publicar**. Desde ese momento los botones de esa edición llevan
   directo al checkout de Flow.

---

## Alumnos fuera de Chile

CoatzaDrone ya cobra en el extranjero por PayPal y transferencia internacional.
Para mantener ese canal, agrega el link de PayPal:

```json
  "paypal_url": "https://paypal.me/coatzadrone/180",
```

Si prefieres una sola pasarela para todo LATAM, **Stripe** soporta CLP y tarjetas
internacionales con Payment Links (igual de simple, sin servidor). Queda como
opción a evaluar más adelante.

---

## Cómo se ve en el sitio

Mientras los links estén vacíos (`""`), el sitio muestra los medios de pago como
información y deriva la inscripción al formulario. Es el flujo correcto para un
curso con cupos limitados: primero confirmas el cupo, después envías el link de
pago al alumno.

**Apenas pegues un link, el sitio cambia solo.** No hay que tocar código:

- Aparecen los botones **Pagar con Mercado Pago** y **Pagar con Flow / Webpay**
  dentro del bloque de precio
- El botón "Reservar mi cupo" pasa a segundo plano como *"Prefiero que me contacten"*,
  para no competir con el pago directo
- Se registra el evento `iniciar_pago` en GA4 y `InitiateCheckout` en el Píxel de
  Meta, que es lo que permite optimizar las campañas hacia compras reales

Para volver al flujo de reserva, basta con dejar los links en `""` otra vez.

---

## Recomendación de flujo operativo

Para cursos B2B con cupos limitados y factura, este orden funciona mejor que el
pago inmediato:

1. El alumno completa el formulario de la landing → llega el lead a tu correo
2. Respondes con el link de pago (Mercado Pago o Flow, según el caso)
3. Al confirmarse el pago, envías la invitación a las sesiones y el acceso al material
4. Si necesita factura, la emites contra el comprobante de pago

Así mantienes control de cupos y puedes cotizar distinto a empresas que inscriben
a varias personas.

---

## Seguridad

**Nunca** subas a GitHub llaves privadas, tokens de API ni credenciales de las
pasarelas. El archivo `.gitignore` ya bloquea `.env` y `secrets.json`, pero la
regla práctica es simple: los links de pago públicos sí van en el repositorio;
cualquier cosa que diga *secret*, *private* o *token de producción*, no.
