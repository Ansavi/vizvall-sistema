// ════════════════════════════════════════════════════════════
//  ALERTAS INTELIGENTES — stock bajo, productos por vencer, citas hoy
//  Función única que consume la campanita 🔔 de la cabecera.
// ════════════════════════════════════════════════════════════
function obtenerAlertas(params) {
  try {
    var hoy = getFecha('fecha'); // yyyy-MM-dd
    var hoyD = new Date(hoy + 'T00:00:00');
    var limite = new Date(hoyD); limite.setDate(limite.getDate() + 15); // próximos 15 días

    // ── 1. STOCK BAJO ──
    var productos = [];
    var stockBajo = [];
    try {
      productos = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
      for (var i = 0; i < productos.length; i++) {
        var p = productos[i];
        if (!p.ID_PRODUCTO || p.ESTADO === 'INACTIVO') continue;
        var stock = parseFloat(p.STOCK) || 0;
        var minimo = parseFloat(p.STOCK_MINIMO) || 0;
        if (minimo > 0 && stock <= minimo) {
          stockBajo.push({ nombre: p.NOMBRE, stock: stock, minimo: minimo, unidad: p.UNIDAD_MEDIDA || '' });
        }
      }
    } catch (e1) { /* si falla, stockBajo queda vacío */ }

    // ── 2. PRODUCTOS POR VENCER (15 días) ──
    var porVencer = [];
    try {
    var lotes = leerHoja(HOJAS.LOTE_PRODUCTO).map(limpiarFila);
    for (var j = 0; j < lotes.length; j++) {
      var l = lotes[j];
      if (!l.ID_LOTE || l.ESTADO !== 'ACTIVO') continue;
      var disp = parseFloat(l.CANTIDAD_DISPONIBLE) || 0;
      if (disp <= 0) continue;
      if (!l.FECHA_VENCIMIENTO || l.FECHA_VENCIMIENTO === '-') continue;
      var fv = new Date(String(l.FECHA_VENCIMIENTO).substring(0,10) + 'T00:00:00');
      if (isNaN(fv.getTime())) continue;
      if (fv >= hoyD && fv <= limite) {
        // nombre del producto
        var pNom = l.ID_PRODUCTO;
        for (var k = 0; k < productos.length; k++) { if (productos[k].ID_PRODUCTO === l.ID_PRODUCTO) { pNom = productos[k].NOMBRE; break; } }
        var diasRest = Math.ceil((fv - hoyD) / 86400000);
        porVencer.push({ nombre: pNom, lote: l.NUMERO_LOTE || '-', vence: String(l.FECHA_VENCIMIENTO).substring(0,10), dias: diasRest, cantidad: disp });
      }
    }
    porVencer.sort(function(a,b){ return a.dias - b.dias; });
    } catch (e2) { /* si falla, porVencer queda vacío */ }

    // ── 3. CITAS DE HOY ──
    var citasHoy = [];
    try {
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    for (var m = 0; m < citas.length; m++) {
      var ci = citas[m];
      if (!ci.ID_CITA) continue;
      var fc = String(ci.FECHA_CITA || '').substring(0,10);
      var est = String(ci.ESTADO_CITA || '').toUpperCase();
      if (fc === hoy && est !== 'CANCELADA' && est !== 'ATENDIDA') {
        var nomPac = ci.ID_PACIENTE;
        for (var n = 0; n < pacientes.length; n++) { if (pacientes[n].ID_PACIENTE === ci.ID_PACIENTE) { nomPac = ((pacientes[n].NOMBRES||'')+' '+(pacientes[n].APELLIDOS||'')).trim(); break; } }
        citasHoy.push({ paciente: nomPac, hora: ci.HORA_CITA || '-', estado: ci.ESTADO_CITA || 'PROGRAMADA' });
      }
    }
    citasHoy.sort(function(a,b){ return String(a.hora).localeCompare(String(b.hora)); });
    } catch (e3) { /* si falla, citasHoy queda vacío */ }

    var total = stockBajo.length + porVencer.length + citasHoy.length;

    return respuestaOK({
      total: total,
      stockBajo: stockBajo,
      porVencer: porVencer,
      citasHoy: citasHoy
    }, 'Alertas obtenidas.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}
