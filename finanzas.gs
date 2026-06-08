// ============================================================
// VIZVALL — finanzas.gs — Obligaciones (cuentas por pagar) + Pagos
// ============================================================

// ════════════ OBLIGACIONES ════════════
function listarObligaciones(params) {
  try {
    var obls = leerHoja(HOJAS.OBLIGACION).map(limpiarFila)
      .filter(function(o){ return o.ID_OBLIGACION && String(o.ID_OBLIGACION).trim() !== ''; });
    var proveedores = leerHoja(HOJAS.PROVEEDOR).map(limpiarFila);
    var tipos = leerHoja(HOJAS.TIPO_OBLIGACION).map(limpiarFila);
    var hoy = getFecha('fecha');

    // Filtros
    if (params && params.estado) {
      obls = obls.filter(function(o){ return String(o.ESTADO||'').toUpperCase() === String(params.estado).toUpperCase(); });
    }
    if (params && params.vencidas) {
      obls = obls.filter(function(o){
        var pend = parseFloat(o.MONTO_PENDIENTE)||0;
        return pend > 0 && String(o.FECHA_VENCIMIENTO||'') < hoy && o.ESTADO !== 'PAGADO' && o.ESTADO !== 'ANULADO';
      });
    }

    var enriched = obls.map(function(o){
      var provNom = o.ID_PROVEEDOR, tipoNom = o.ID_TIPO_OBLIGACION;
      for (var i = 0; i < proveedores.length; i++) { if (proveedores[i].ID_PROVEEDOR === o.ID_PROVEEDOR) { provNom = proveedores[i].RAZON_SOCIAL; break; } }
      for (var j = 0; j < tipos.length; j++) { if (tipos[j].ID_TIPO_OBLIGACION === o.ID_TIPO_OBLIGACION) { tipoNom = tipos[j].NOMBRE; break; } }
      var pend = parseFloat(o.MONTO_PENDIENTE)||0;
      var vencida = pend > 0 && String(o.FECHA_VENCIMIENTO||'') < hoy && o.ESTADO !== 'PAGADO' && o.ESTADO !== 'ANULADO';
      return {
        ID_OBLIGACION:     o.ID_OBLIGACION,
        PROVEEDOR_NOMBRE:  provNom,
        TIPO_NOMBRE:       tipoNom,
        NUMERO_COMPROBANTE:o.NUMERO_COMPROBANTE,
        FECHA_EMISION:     o.FECHA_EMISION,
        FECHA_VENCIMIENTO: o.FECHA_VENCIMIENTO,
        DESCRIPCION:       o.DESCRIPCION,
        MONTO_TOTAL:       o.MONTO_TOTAL,
        MONTO_PENDIENTE:   o.MONTO_PENDIENTE,
        ESTADO:            o.ESTADO,
        VENCIDA:           vencida,
        OBSERVACION:       o.OBSERVACION,
      };
    });
    enriched.sort(function(a,b){ return String(a.FECHA_VENCIMIENTO||'') > String(b.FECHA_VENCIMIENTO||'') ? 1 : -1; });
    return respuestaOK(enriched, enriched.length + ' obligación(es).');
  } catch (err) {
    return respuestaError('Error al listar obligaciones: ' + err.message);
  }
}

function guardarObligacion(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_PROVEEDOR) { lock.releaseLock(); return respuestaError('Seleccione un proveedor.'); }
    var monto = parseFloat(params.MONTO_TOTAL);
    if (isNaN(monto) || monto <= 0) { lock.releaseLock(); return respuestaError('El monto total debe ser mayor a 0.'); }
    // Fecha emisión no futura
    var fEmision = params.FECHA_EMISION || getFecha('fecha');
    if (fEmision > getFecha('fecha')) { lock.releaseLock(); return respuestaError('La fecha de emisión no puede ser futura.'); }
    // Vencimiento >= emisión
    var fVenc = params.FECHA_VENCIMIENTO || fEmision;
    if (fVenc < fEmision) { lock.releaseLock(); return respuestaError('El vencimiento debe ser igual o posterior a la emisión.'); }
    // N° comprobante único por proveedor (si se ingresa)
    var numComp = String(params.NUMERO_COMPROBANTE || '').trim();
    if (numComp && numComp !== '-') {
      var oblsExist = leerHoja(HOJAS.OBLIGACION).map(limpiarFila);
      for (var oe = 0; oe < oblsExist.length; oe++) {
        if (oblsExist[oe].ID_PROVEEDOR === params.ID_PROVEEDOR &&
            String(oblsExist[oe].NUMERO_COMPROBANTE||'').trim() === numComp &&
            oblsExist[oe].ESTADO !== 'ANULADO') {
          lock.releaseLock();
          return respuestaError('Ya existe una obligación con ese N° de comprobante para este proveedor.');
        }
      }
    }

    var id = generarID(HOJAS.OBLIGACION, 'ID_OBLIGACION', 'OBL', 4);
    insertarFila(HOJAS.OBLIGACION, {
      ID_OBLIGACION:      id,
      ID_TIPO_OBLIGACION: params.ID_TIPO_OBLIGACION || '-',
      ID_PROVEEDOR:       params.ID_PROVEEDOR,
      ID_TCOMPROBANTE:    params.ID_TCOMPROBANTE || '-',
      NUMERO_COMPROBANTE: params.NUMERO_COMPROBANTE || '-',
      FECHA_EMISION:      params.FECHA_EMISION || getFecha('fecha'),
      FECHA_VENCIMIENTO:  params.FECHA_VENCIMIENTO || getFecha('fecha'),
      DESCRIPCION:        params.DESCRIPCION || '-',
      MONTO_TOTAL:        monto.toFixed(2),
      MONTO_PENDIENTE:    monto.toFixed(2),
      ARCHIVO_ADJUNTO:    params.ARCHIVO_ADJUNTO || '-',
      ESTADO:             'PENDIENTE',
      OBSERVACION:        params.OBSERVACION || '-',
      FECHA_REGISTRO:     getFecha('datetime'),
    });
    lock.releaseLock();
    return respuestaOK({ ID_OBLIGACION: id }, 'Obligación registrada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar obligación: ' + err.message);
  }
}

// ════════════ PAGOS (abonos parciales) ════════════
function registrarPagoObligacion(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_OBLIGACION) { lock.releaseLock(); return respuestaError('Obligación requerida.'); }
    var monto = parseFloat(params.MONTO);
    if (isNaN(monto) || monto <= 0) { lock.releaseLock(); return respuestaError('El monto debe ser mayor a 0.'); }

    // Leer obligación
    var obls = leerHoja(HOJAS.OBLIGACION).map(limpiarFila);
    var obl = null;
    for (var i = 0; i < obls.length; i++) { if (obls[i].ID_OBLIGACION === params.ID_OBLIGACION) { obl = obls[i]; break; } }
    if (!obl) { lock.releaseLock(); return respuestaError('Obligación no encontrada.'); }
    if (obl.ESTADO === 'PAGADO') { lock.releaseLock(); return respuestaError('Esta obligación ya está pagada.'); }
    if (obl.ESTADO === 'ANULADO') { lock.releaseLock(); return respuestaError('Esta obligación está anulada.'); }

    var pendiente = parseFloat(obl.MONTO_PENDIENTE) || 0;
    if (monto > pendiente + 0.001) {
      lock.releaseLock();
      return respuestaError('El monto (S/ ' + monto.toFixed(2) + ') excede el saldo pendiente (S/ ' + pendiente.toFixed(2) + ').');
    }

    // Determinar modo de pago (nombre) para saber si es efectivo
    var modoNombre = '';
    if (params.ID_TMODO_PAGO) {
      var modos = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
      for (var m = 0; m < modos.length; m++) { if (modos[m].ID_TMODO_PAGO === params.ID_TMODO_PAGO) { modoNombre = String(modos[m].NOMBRE||'').toUpperCase(); break; } }
    }

    // Si es efectivo, requiere caja abierta y genera egreso
    var idCajaMov = '-';
    if (modoNombre.indexOf('EFECTIVO') >= 0) {
      var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
      var cajaAbierta = null;
      for (var a = 0; a < aperturas.length; a++) { if (aperturas[a].ESTADO === 'ABIERTA') { cajaAbierta = aperturas[a]; break; } }
      if (!cajaAbierta) {
        lock.releaseLock();
        return respuestaError('Debe abrir la caja para pagar en efectivo.', 'ERR_CAJA_CERRADA');
      }
      idCajaMov = generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4);
      insertarFila(HOJAS.CAJA, {
        ID_CAJA:           idCajaMov,
        ID_APERTURA:       cajaAbierta.ID_APERTURA,
        FECHA:             getFecha('fecha'),
        HORA:              getFecha('hora'),
        TURNO:             cajaAbierta.TURNO || 'ÚNICO',
        TIPO:              'EGRESO',
        ID_TCONCEPTO_CAJA: '-',
        ID_VENTA:          '-',
        MODO_PAGO:         'EFECTIVO',
        MONTO:             monto.toFixed(2),
        USUARIO:           params.usuario || '-',
        ESTADO:            'ACTIVO',
        OBSERVACIONES:     'Pago obligación ' + params.ID_OBLIGACION,
      });
    }

    // Registrar el pago
    var idPago = generarID(HOJAS.PAGO_OBLIGACION, 'ID_PAGO_OBLIGACION', 'PGO', 4);
    insertarFila(HOJAS.PAGO_OBLIGACION, {
      ID_PAGO_OBLIGACION: idPago,
      ID_OBLIGACION:      params.ID_OBLIGACION,
      ID_CAJA:            idCajaMov,
      ID_TMODO_PAGO:      params.ID_TMODO_PAGO || '-',
      FECHA_PAGO:         getFecha('fecha'),
      MONTO:              monto.toFixed(2),
      OBSERVACION:        String(params.OBSERVACION || '-').toUpperCase(),
      ESTADO:             'ACTIVO',
      FECHA_REGISTRO:     getFecha('datetime'),
    });
    // Detalle del pago según medio (transferencia/Yape/tarjeta)
    if (params.NUMERO_OPERACION || params.BANCO || params.CELULAR || params.VOUCHER || params.ENTIDAD) {
      insertarFila(HOJAS.PAGO_OBLIGACION_DETALLE, {
        ID_PAGO_DETALLE:    generarID(HOJAS.PAGO_OBLIGACION_DETALLE, 'ID_PAGO_DETALLE', 'PGD', 4),
        ID_PAGO_OBLIGACION: idPago,
        NUMERO_OPERACION:   String(params.NUMERO_OPERACION || '-').toUpperCase(),
        BANCO:              String(params.BANCO || '-').toUpperCase(),
        CELULAR:            params.CELULAR || '-',
        VOUCHER:            String(params.VOUCHER || '-').toUpperCase(),
        ENTIDAD:            String(params.ENTIDAD || '-').toUpperCase(),
        OBSERVACION:        '-',
      });
    }

    // Actualizar saldo y estado de la obligación
    var nuevoPendiente = pendiente - monto;
    if (nuevoPendiente < 0.01) nuevoPendiente = 0;
    var nuevoEstado = (nuevoPendiente <= 0) ? 'PAGADO' : 'PARCIAL';
    actualizarFila(HOJAS.OBLIGACION, 'ID_OBLIGACION', params.ID_OBLIGACION, {
      MONTO_PENDIENTE: nuevoPendiente.toFixed(2),
      ESTADO:          nuevoEstado,
    });

    lock.releaseLock();
    return respuestaOK({ MONTO_PENDIENTE: nuevoPendiente.toFixed(2), ESTADO: nuevoEstado },
      'Pago registrado. Saldo: S/ ' + nuevoPendiente.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar pago: ' + err.message);
  }
}

// Historial de pagos de una obligación (o todos)
function listarPagosObligacion(params) {
  try {
    var pagos = leerHoja(HOJAS.PAGO_OBLIGACION).map(limpiarFila)
      .filter(function(p){ return p.ID_PAGO_OBLIGACION && String(p.ID_PAGO_OBLIGACION).trim() !== '' && p.ESTADO !== 'ANULADO'; });
    if (params && params.ID_OBLIGACION) {
      pagos = pagos.filter(function(p){ return p.ID_OBLIGACION === params.ID_OBLIGACION; });
    }
    if (params && params.fechaDesde) {
      pagos = pagos.filter(function(p){ return String(p.FECHA_PAGO||'') >= params.fechaDesde; });
    }
    if (params && params.fechaHasta) {
      pagos = pagos.filter(function(p){ return String(p.FECHA_PAGO||'') <= params.fechaHasta; });
    }
    var modos = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
    var obls = leerHoja(HOJAS.OBLIGACION).map(limpiarFila);
    var enriched = pagos.map(function(p){
      var modoNom = p.ID_TMODO_PAGO, oblDesc = p.ID_OBLIGACION;
      for (var i = 0; i < modos.length; i++) { if (modos[i].ID_TMODO_PAGO === p.ID_TMODO_PAGO) { modoNom = modos[i].NOMBRE; break; } }
      for (var j = 0; j < obls.length; j++) { if (obls[j].ID_OBLIGACION === p.ID_OBLIGACION) { oblDesc = obls[j].NUMERO_COMPROBANTE || obls[j].DESCRIPCION; break; } }
      return {
        ID_PAGO_OBLIGACION: p.ID_PAGO_OBLIGACION,
        ID_OBLIGACION:      p.ID_OBLIGACION,
        OBLIGACION_DESC:    oblDesc,
        MODO_PAGO:          modoNom,
        FECHA_PAGO:         p.FECHA_PAGO,
        MONTO:              p.MONTO,
        OBSERVACION:        p.OBSERVACION,
      };
    });
    enriched.sort(function(a,b){ return String(a.FECHA_PAGO||'') > String(b.FECHA_PAGO||'') ? -1 : 1; });
    return respuestaOK(enriched, enriched.length + ' pago(s).');
  } catch (err) {
    return respuestaError('Error al listar pagos: ' + err.message);
  }
}


// ════════════ ANULAR OBLIGACIÓN ════════════
function anularObligacion(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('Solo el administrador puede anular obligaciones.', 'ERR_PERMISO');
    }
    if (!params.ID_OBLIGACION) { lock.releaseLock(); return respuestaError('Obligación requerida.'); }
    // No anular si ya tiene pagos
    var pagos = leerHoja(HOJAS.PAGO_OBLIGACION).map(limpiarFila)
      .filter(function(p){ return p.ID_OBLIGACION === params.ID_OBLIGACION && p.ESTADO !== 'ANULADO'; });
    if (pagos.length > 0) {
      lock.releaseLock();
      return respuestaError('No se puede anular: la obligación ya tiene pagos registrados.');
    }
    actualizarFila(HOJAS.OBLIGACION, 'ID_OBLIGACION', params.ID_OBLIGACION, {
      ESTADO: 'ANULADO',
      OBSERVACION: String(params.MOTIVO || 'Anulada').toUpperCase(),
    });
    lock.releaseLock();
    return respuestaOK({}, 'Obligación anulada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al anular obligación: ' + err.message);
  }
}
