// ════════════════════════════════════════════════════════════
//  ALERTAS INTELIGENTES — stock bajo, productos por vencer, citas hoy
//  Función única que consume la campanita 🔔 de la cabecera.
// ════════════════════════════════════════════════════════════
function obtenerAlertas(params) {
  try {
    var hoy = getFecha('fecha'); // yyyy-MM-dd
    var hoyD = new Date(hoy + 'T00:00:00');
    // Umbral de vencimiento configurable (ScriptProperties, default 15 días)
    var diasVenc = 15;
    try { var _dv = parseInt(PropertiesService.getScriptProperties().getProperty('ALERTA_DIAS_VENCIMIENTO')); if (!isNaN(_dv) && _dv > 0) diasVenc = _dv; } catch(eDV) {}
    var limite = new Date(hoyD); limite.setDate(limite.getDate() + diasVenc);

    // ── 1. STOCK: AGOTADO (crítico) vs BAJO (advertencia) ──
    var productos = [];
    var agotado = [];    // stock en cero → crítico, no se puede atender
    var stockBajo = [];  // 0 < stock <= mínimo → advertencia, reordenar
    try {
      productos = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
      for (var i = 0; i < productos.length; i++) {
        var p = productos[i];
        if (!p.ID_PRODUCTO || p.ESTADO === 'INACTIVO') continue;
        var stock = parseFloat(p.STOCK) || 0;
        var minimo = parseFloat(p.STOCK_MINIMO) || 0;
        if (stock <= 0) {
          // Agotado: aunque no tenga mínimo definido, cero es crítico
          agotado.push({ nombre: p.NOMBRE, stock: stock, minimo: minimo, unidad: p.UNIDAD_MEDIDA || '' });
        } else if (minimo > 0 && stock <= minimo) {
          stockBajo.push({ nombre: p.NOMBRE, stock: stock, minimo: minimo, unidad: p.UNIDAD_MEDIDA || '' });
        }
      }
    } catch (e1) { /* si falla, queda vacío */ }

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

    var total = agotado.length + stockBajo.length + porVencer.length + citasHoy.length;

    return respuestaOK({
      total: total,
      agotado: agotado,
      stockBajo: stockBajo,
      porVencer: porVencer,
      citasHoy: citasHoy,
      diasVencimiento: diasVenc
    }, 'Alertas obtenidas.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}


// ════════════════════════════════════════════════════════════
//  UMBRAL DE VENCIMIENTO CONFIGURABLE (días de anticipación)
// ════════════════════════════════════════════════════════════
function obtenerDiasVencimiento(params) {
  try {
    var dv = 15;
    var _dv = parseInt(PropertiesService.getScriptProperties().getProperty('ALERTA_DIAS_VENCIMIENTO'));
    if (!isNaN(_dv) && _dv > 0) dv = _dv;
    return respuestaOK({ dias: dv }, 'Umbral de vencimiento.');
  } catch (e) { return respuestaError('Error: ' + e.message); }
}

function guardarDiasVencimiento(params) {
  try {
    var rol = (params._sesion && params._sesion.ROL) ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') return respuestaError('Solo el administrador puede cambiar este umbral.', 'ERR_PERMISO');
    var dias = parseInt(params.DIAS);
    if (isNaN(dias) || dias < 1 || dias > 365) return respuestaError('Ingrese un número de días entre 1 y 365.');
    PropertiesService.getScriptProperties().setProperty('ALERTA_DIAS_VENCIMIENTO', String(dias));
    registrarAuditoria((params._sesion ? params._sesion.ID_USUARIO : '-'), 'INVENTARIO', 'CONFIG_ALERTA_VENCIMIENTO', 'Umbral de vencimiento: ' + dias + ' días');
    return respuestaOK({ dias: dias }, 'Umbral actualizado a ' + dias + ' días.');
  } catch (e) { return respuestaError('Error: ' + e.message); }
}
