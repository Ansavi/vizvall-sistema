// ============================================================
// VIZVALL — venta.gs — Gestión de Ventas / Cobros
// Venta con detalle de servicios. Puede vincularse a una cita.
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR VENTAS (con nombre de paciente, comprobante, modo pago)
// ════════════════════════════════════════════════════════════
function listarVentas(params) {
  try {
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && String(v.ID_VENTA).trim() !== ''; });

    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var modosPago = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
    var comprobantes = leerHoja(HOJAS.TCOMPROBANTE).map(limpiarFila);

    if (params && params.fecha) {
      ventas = ventas.filter(function(v){ return String(v.FECHA_VENTA).indexOf(params.fecha) === 0; });
    }
    if (params && params.estado) {
      ventas = ventas.filter(function(v){ return v.ESTADO === params.estado; });
    }

    var enriched = ventas.map(function(v){
      var pacNombre = '—', modoNombre = '—', compNombre = '—';
      for (var i = 0; i < pacientes.length; i++) {
        if (pacientes[i].ID_PACIENTE === v.ID_PACIENTE) { pacNombre = (pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||''); break; }
      }
      for (var j = 0; j < modosPago.length; j++) {
        if (modosPago[j].ID_TMODO_PAGO === v.ID_TMODO_PAGO) { modoNombre = modosPago[j].NOMBRE || '—'; break; }
      }
      for (var k = 0; k < comprobantes.length; k++) {
        if (comprobantes[k].ID_TCOMPROBANTE === v.ID_TCOMPROBANTE) { compNombre = comprobantes[k].NOMBRE || '—'; break; }
      }
      return {
        ID_VENTA:           v.ID_VENTA,
        FECHA_VENTA:        v.FECHA_VENTA,
        NUMERO_COMPROBANTE: v.NUMERO_COMPROBANTE,
        COMPROBANTE_NOMBRE: compNombre,
        ID_PACIENTE:        v.ID_PACIENTE,
        PACIENTE_NOMBRE:    pacNombre,
        ID_CITA:            v.ID_CITA,
        MODO_PAGO_NOMBRE:   modoNombre,
        SUBTOTAL:           v.SUBTOTAL,
        DESCUENTO:          v.DESCUENTO,
        IGV:                v.IGV,
        TOTAL:              v.TOTAL,
        ESTADO:             v.ESTADO || 'EMITIDA',
        OBSERVACIONES:      v.OBSERVACIONES,
      };
    });

    enriched.sort(function(a,b){ return (a.FECHA_VENTA||'') > (b.FECHA_VENTA||'') ? -1 : 1; });
    return respuestaOK(enriched, enriched.length + ' venta(s).');
  } catch (err) {
    return respuestaError('Error al listar ventas: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  OBTENER DETALLE DE UNA VENTA
// ════════════════════════════════════════════════════════════
function obtenerDetalleVenta(params) {
  try {
    if (!params.ID_VENTA) return respuestaError('ID_VENTA requerido.');
    var detalle = leerHoja(HOJAS.DVENTA).map(limpiarFila)
      .filter(function(d){ return d.ID_VENTA === params.ID_VENTA; });
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);
    var enriched = detalle.map(function(d){
      var nombre = '—', tipo = d.TIPO || 'SERVICIO';
      if (tipo === 'PAQUETE') {
        for (var k = 0; k < paquetes.length; k++) {
          if (paquetes[k].ID_PAQUETE === d.ID_PAQUETE) { nombre = '📦 ' + (paquetes[k].NOMBRE_PAQUETE || '—'); break; }
        }
      } else {
        for (var i = 0; i < servicios.length; i++) {
          if (servicios[i].ID_SERVICIO === d.ID_SERVICIO) { nombre = servicios[i].NOMBRE_SERVICIO || '—'; break; }
        }
      }
      return {
        ID_DVENTA:       d.ID_DVENTA,
        TIPO:            tipo,
        ID_SERVICIO:     d.ID_SERVICIO,
        ID_PAQUETE:      d.ID_PAQUETE,
        SERVICIO_NOMBRE: nombre,
        CANTIDAD:        d.CANTIDAD,
        PRECIO_UNITARIO: d.PRECIO_UNITARIO,
        DESCUENTO:       d.DESCUENTO,
        SUBTOTAL:        d.SUBTOTAL,
      };
    });
    return respuestaOK(enriched);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR VENTA (con detalle de servicios)
//  params.items = JSON array de { ID_SERVICIO, CANTIDAD, PRECIO_UNITARIO, DESCUENTO }
// ════════════════════════════════════════════════════════════
function guardarVenta(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO', 'RECEPCION'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('No tiene permiso para registrar ventas.', 'ERR_PERMISO');
    }
    if (!params.ID_PACIENTE) return respuestaError('El paciente es requerido.');

    var items = params.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) { items = []; }
    }
    if (!Array.isArray(items) || !items.length) {
      return respuestaError('Debe agregar al menos un servicio a la venta.');
    }

    // Calcular totales
    var subtotal = 0, descuentoTotal = 0;
    for (var i = 0; i < items.length; i++) {
      var cant = parseFloat(items[i].CANTIDAD) || 1;
      var precio = parseFloat(items[i].PRECIO_UNITARIO) || 0;
      var desc = parseFloat(items[i].DESCUENTO) || 0;
      subtotal += cant * precio;
      descuentoTotal += desc;
    }
    var bruto = subtotal - descuentoTotal;
    var igvModo = params.igvModo || (params.aplicaIGV ? 'agregar' : 'ninguno');
    var baseImponible, igv, total;
    if (igvModo === 'agregar') {
      baseImponible = bruto;
      igv = +(bruto * 0.18).toFixed(2);
      total = +(bruto + igv).toFixed(2);
    } else if (igvModo === 'incluido') {
      baseImponible = +(bruto / 1.18).toFixed(2);
      igv = +(bruto - baseImponible).toFixed(2);
      total = +bruto.toFixed(2);
    } else {
      baseImponible = bruto;
      igv = 0;
      total = +bruto.toFixed(2);
    }

    // Número de comprobante
    var serie = params.serie || 'B001';
    var numComp = generarNumeroComprobante(serie);

    var idVenta = generarID(HOJAS.VENTA, 'ID_VENTA', 'VTA', 4);

    insertarFila(HOJAS.VENTA, {
      ID_VENTA:           idVenta,
      FECHA_VENTA:        getFecha('datetime'),
      ID_TCOMPROBANTE:    params.ID_TCOMPROBANTE || '-',
      NUMERO_COMPROBANTE: numComp,
      ID_PACIENTE:        params.ID_PACIENTE,
      ID_CITA:            params.ID_CITA || '-',
      ID_USUARIO:         params._sesion ? (params._sesion.ID_USUARIO || params._sesion.USUARIO || '-') : '-',
      ID_TMODO_PAGO:      params.ID_TMODO_PAGO || '-',
      SUBTOTAL:           baseImponible.toFixed(2),
      DESCUENTO:          descuentoTotal.toFixed(2),
      IGV:                igv.toFixed(2),
      TOTAL:              total.toFixed(2),
      ESTADO:             'EMITIDA',
      OBSERVACIONES:      params.OBSERVACIONES || '-',
    });

    // Insertar detalle
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var c = parseFloat(it.CANTIDAD) || 1;
      var p = parseFloat(it.PRECIO_UNITARIO) || 0;
      var d = parseFloat(it.DESCUENTO) || 0;
      insertarFila(HOJAS.DVENTA, {
        ID_DVENTA:       generarID(HOJAS.DVENTA, 'ID_DVENTA', 'DV', 4),
        ID_VENTA:        idVenta,
        TIPO:            it.TIPO || 'SERVICIO',
        ID_SERVICIO:     (it.TIPO === 'PAQUETE') ? '-' : (it.ID_SERVICIO || '-'),
        ID_PAQUETE:      (it.TIPO === 'PAQUETE') ? (it.ID_PAQUETE || '-') : '-',
        CANTIDAD:        c,
        PRECIO_UNITARIO: p.toFixed(2),
        DESCUENTO:       d.toFixed(2),
        SUBTOTAL:        (c * p - d).toFixed(2),
      });

      // Si es PAQUETE, crear registro en CONTROL_SESIONES
      if (it.TIPO === 'PAQUETE' && it.ID_PAQUETE) {
        try {
          var paqInfo = leerHoja(HOJAS.PAQUETE).map(limpiarFila).filter(function(pp){ return pp.ID_PAQUETE === it.ID_PAQUETE; })[0];
          var totSes = paqInfo ? (parseInt(paqInfo.TOTAL_SESIONES) || 0) : 0;
          insertarFila(HOJAS.CONTROL_SESIONES, {
            ID_CONTROL:        generarID(HOJAS.CONTROL_SESIONES, 'ID_CONTROL', 'CS', 4),
            ID_VENTA:          idVenta,
            FECHA_INICIO:      getFecha('fecha'),
            FECHA_FIN:         '-',
            ID_PACIENTE:       params.ID_PACIENTE,
            TIPO:              'PAQUETE',
            ID_PAQUETE:        it.ID_PAQUETE,
            TOTAL_SESIONES:    totSes,
            SESIONES_USADAS:   0,
            SESIONES_RESTANTES: totSes,
            PRECIO_TOTAL:      p.toFixed(2),
            MONTO_PAGADO:      (c * p - d).toFixed(2),
            SALDO:             '0.00',
            ID_MEDICO:         '-',
            PROXIMA_CITA:      '-',
            ESTADO:            'ACTIVO',
            OBSERVACIONES:     'Generado por venta ' + idVenta,
          });
        } catch(eCS) {}
      }
    }

    // Si la venta está vinculada a una cita, marcarla como pagada
    if (params.ID_CITA && params.ID_CITA !== '-') {
      try {
        actualizarFila(HOJAS.CITA, 'ID_CITA', params.ID_CITA, { ESTADO_PAGO: 'PAGADO', ID_VENTA: idVenta });
      } catch(e) {}
    }

    return respuestaOK({ ID_VENTA: idVenta, NUMERO_COMPROBANTE: numComp, TOTAL: total.toFixed(2) }, 'Venta registrada: ' + numComp);
  } catch (err) {
    return respuestaError('Error al guardar venta: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ANULAR VENTA
// ════════════════════════════════════════════════════════════
function anularVenta(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede anular ventas.', 'ERR_PERMISO');
    }
    if (!params.ID_VENTA) return respuestaError('ID_VENTA requerido.');
    actualizarFila(HOJAS.VENTA, 'ID_VENTA', params.ID_VENTA, { ESTADO: 'ANULADA' });
    return respuestaOK({}, 'Venta anulada.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  LISTAR CITAS PENDIENTES DE PAGO (para cobrar desde venta)
// ════════════════════════════════════════════════════════════
function listarCitasPendientesPago(params) {
  try {
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){
        return c.ID_CITA && String(c.ID_CITA).trim() !== '' &&
               (c.ESTADO_PAGO || 'PENDIENTE') === 'PENDIENTE' &&
               c.ESTADO_CITA !== 'CANCELADA';
      });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var enriched = citas.map(function(c){
      var pac = '—', med = '—';
      for (var i = 0; i < pacientes.length; i++) { if (pacientes[i].ID_PACIENTE === c.ID_PACIENTE) { pac = (pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||''); break; } }
      for (var j = 0; j < medicos.length; j++) { if (medicos[j].ID_MEDICO === c.ID_MEDICO) { med = (medicos[j].NOMBRES||'')+' '+(medicos[j].APELLIDOS||''); break; } }
      return { ID_CITA:c.ID_CITA, ID_PACIENTE:c.ID_PACIENTE, PACIENTE_NOMBRE:pac, MEDICO_NOMBRE:med, FECHA_CITA:c.FECHA_CITA, HORA_CITA:c.HORA_CITA };
    });
    return respuestaOK(enriched);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REPORTE DE VENTAS (totales)
// ════════════════════════════════════════════════════════════
function reporteVentas(params) {
  try {
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && String(v.ID_VENTA).trim() !== '' && v.ESTADO !== 'ANULADA'; });
    if (params && params.fecha) {
      ventas = ventas.filter(function(v){ return String(v.FECHA_VENTA).indexOf(params.fecha) === 0; });
    }
    var totalMonto = 0;
    for (var i = 0; i < ventas.length; i++) totalMonto += parseFloat(ventas[i].TOTAL) || 0;
    return respuestaOK({ cantidad: ventas.length, total: totalMonto.toFixed(2) });
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
