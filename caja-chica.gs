// ════════════════════════════════════════════════════════════
//  CAJA CHICA — fondo fijo separado de la caja de ventas
//  Flujo: Abrir fondo (Admin) → Gastos (Cajero) → Reponer (Admin) → Cerrar
//  NO toca la caja de ventas. Tabla propia CAJA_CHICA.
// ════════════════════════════════════════════════════════════

var CC_RECIBO_OBLIGATORIO_DESDE = 20; // recibo obligatorio si gasto > S/ 20

// ── Estado actual de la caja chica (fondo abierto, saldo, totales) ──
function ccEstado(params) {
  try {
    var aperturas = leerHoja(HOJAS.APERTURA_CC).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    if (!abierta) {
      return respuestaOK({ abierta: false }, 'No hay fondo de caja chica abierto.');
    }
    // Calcular saldo: fondo + reposiciones - gastos (de los movimientos ACTIVOS de esta apertura)
    var movs = leerHoja(HOJAS.CAJA_CHICA).map(limpiarFila)
      .filter(function(m){ return m.ID_APERTURA_CC === abierta.ID_APERTURA_CC && m.ESTADO === 'ACTIVO'; });
    var fondo = parseFloat(abierta.MONTO_FONDO) || 0;
    var gastos = 0, reposiciones = 0;
    movs.forEach(function(m){
      var monto = parseFloat(m.MONTO) || 0;
      if (m.TIPO === 'GASTO') gastos += monto;
      else if (m.TIPO === 'REPOSICION') reposiciones += monto;
    });
    var saldo = fondo + reposiciones - gastos;
    return respuestaOK({
      abierta: true,
      idApertura: abierta.ID_APERTURA_CC,
      fondo: fondo.toFixed(2),
      totalGastos: gastos.toFixed(2),
      totalReposiciones: reposiciones.toFixed(2),
      saldo: saldo.toFixed(2),
      fechaApertura: abierta.FECHA_APERTURA,
      usuarioApertura: abierta.USUARIO_APERTURA,
      reciboDesde: CC_RECIBO_OBLIGATORIO_DESDE
    }, 'Estado de caja chica.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

// ── Abrir el fondo (solo ADMINISTRADOR) ──
function ccAbrirFondo(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el administrador puede abrir el fondo.', 'ERR_PERMISO'); }

    // ¿Ya hay una abierta?
    var aperturas = leerHoja(HOJAS.APERTURA_CC).map(limpiarFila);
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { lock.releaseLock(); return respuestaError('Ya hay un fondo de caja chica abierto. Ciérrelo antes de abrir otro.'); }
    }
    var monto = parseFloat(params.MONTO_FONDO);
    if (isNaN(monto) || monto <= 0) { lock.releaseLock(); return respuestaError('El monto del fondo debe ser mayor a 0.'); }

    var idAp = generarID(HOJAS.APERTURA_CC, 'ID_APERTURA_CC', 'ACC', 4);
    insertarFila(HOJAS.APERTURA_CC, {
      ID_APERTURA_CC:   idAp,
      FECHA_APERTURA:   getFecha('fecha'),
      HORA_APERTURA:    getFecha('hora'),
      MONTO_FONDO:      monto.toFixed(2),
      TOTAL_GASTOS:     '0.00',
      TOTAL_REPOSICIONES:'0.00',
      SALDO_ESPERADO:   monto.toFixed(2),
      SALDO_CONTADO:    '-',
      DIFERENCIA:       '-',
      FECHA_CIERRE:     '-',
      HORA_CIERRE:      '-',
      USUARIO_APERTURA: params.usuario || '-',
      USUARIO_CIERRE:   '-',
      ESTADO:           'ABIERTA',
      OBSERVACIONES:    params.OBSERVACIONES || '-'
    });
    // Registrar el movimiento de apertura del fondo
    insertarFila(HOJAS.CAJA_CHICA, {
      ID_CC:           generarID(HOJAS.CAJA_CHICA, 'ID_CC', 'CC', 5),
      FECHA:           getFecha('fecha'),
      HORA:            getFecha('hora'),
      TIPO:            'APERTURA',
      ID_CONCEPTO_CC:  '-',
      CONCEPTO_LIBRE:  'Apertura de fondo de caja chica',
      MONTO:           monto.toFixed(2),
      NUM_RECIBO:      '-',
      BENEFICIARIO:    '-',
      ORIGEN_FONDO:    params.ORIGEN_FONDO || 'CAJA VENTAS',
      ID_APERTURA_CC:  idAp,
      USUARIO:         params.usuario || '-',
      ESTADO:          'ACTIVO',
      OBSERVACIONES:   params.OBSERVACIONES || '-'
    });
    lock.releaseLock();
    return respuestaOK({ idApertura: idAp }, 'Fondo de caja chica abierto: S/ ' + monto.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al abrir fondo: ' + err.message);
  }
}

// ── Registrar un gasto (ADMINISTRADOR o CAJERO) ──
function ccRegistrarGasto(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR' && rol !== 'CAJERO') { lock.releaseLock(); return respuestaError('No tiene permiso para registrar gastos.', 'ERR_PERMISO'); }

    // Buscar fondo abierto
    var aperturas = leerHoja(HOJAS.APERTURA_CC).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    if (!abierta) { lock.releaseLock(); return respuestaError('No hay fondo de caja chica abierto.'); }

    var monto = parseFloat(params.MONTO);
    if (isNaN(monto) || monto <= 0) { lock.releaseLock(); return respuestaError('El monto debe ser mayor a 0.'); }

    // Validar saldo suficiente
    var est = ccEstado(params);
    if (est.ok && est.datos.abierta) {
      var saldoActual = parseFloat(est.datos.saldo) || 0;
      if (monto > saldoActual) { lock.releaseLock(); return respuestaError('Saldo insuficiente. Disponible: S/ ' + saldoActual.toFixed(2)); }
    }

    // Recibo obligatorio si supera el umbral
    var recibo = String(params.NUM_RECIBO || '').trim();
    if (monto > CC_RECIBO_OBLIGATORIO_DESDE && !recibo) {
      lock.releaseLock();
      return respuestaError('Para montos mayores a S/ ' + CC_RECIBO_OBLIGATORIO_DESDE + ' el número de recibo es obligatorio.');
    }

    insertarFila(HOJAS.CAJA_CHICA, {
      ID_CC:           generarID(HOJAS.CAJA_CHICA, 'ID_CC', 'CC', 5),
      FECHA:           getFecha('fecha'),
      HORA:            getFecha('hora'),
      TIPO:            'GASTO',
      ID_CONCEPTO_CC:  params.ID_CONCEPTO_CC || '-',
      CONCEPTO_LIBRE:  params.CONCEPTO_LIBRE || '-',
      MONTO:           monto.toFixed(2),
      NUM_RECIBO:      recibo || '-',
      BENEFICIARIO:    params.BENEFICIARIO || '-',
      ORIGEN_FONDO:    '-',
      ID_APERTURA_CC:  abierta.ID_APERTURA_CC,
      USUARIO:         params.usuario || '-',
      ESTADO:          'ACTIVO',
      OBSERVACIONES:   params.OBSERVACIONES || '-'
    });
    lock.releaseLock();
    return respuestaOK({}, 'Gasto registrado: S/ ' + monto.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar gasto: ' + err.message);
  }
}

// ── Reponer el fondo (solo ADMINISTRADOR) ──
function ccReponer(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el administrador puede reponer el fondo.', 'ERR_PERMISO'); }

    var aperturas = leerHoja(HOJAS.APERTURA_CC).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    if (!abierta) { lock.releaseLock(); return respuestaError('No hay fondo de caja chica abierto.'); }

    var monto = parseFloat(params.MONTO);
    if (isNaN(monto) || monto <= 0) { lock.releaseLock(); return respuestaError('El monto a reponer debe ser mayor a 0.'); }

    insertarFila(HOJAS.CAJA_CHICA, {
      ID_CC:           generarID(HOJAS.CAJA_CHICA, 'ID_CC', 'CC', 5),
      FECHA:           getFecha('fecha'),
      HORA:            getFecha('hora'),
      TIPO:            'REPOSICION',
      ID_CONCEPTO_CC:  '-',
      CONCEPTO_LIBRE:  'Reposición de fondo',
      MONTO:           monto.toFixed(2),
      NUM_RECIBO:      '-',
      BENEFICIARIO:    '-',
      ORIGEN_FONDO:    params.ORIGEN_FONDO || 'CAJA VENTAS',
      ID_APERTURA_CC:  abierta.ID_APERTURA_CC,
      USUARIO:         params.usuario || '-',
      ESTADO:          'ACTIVO',
      OBSERVACIONES:   params.OBSERVACIONES || '-'
    });
    lock.releaseLock();
    return respuestaOK({}, 'Fondo repuesto: S/ ' + monto.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al reponer: ' + err.message);
  }
}

// ── Listar movimientos del fondo abierto (o de una apertura dada) ──
function ccListar(params) {
  try {
    var aperturas = leerHoja(HOJAS.APERTURA_CC).map(limpiarFila);
    var idAp = params.ID_APERTURA_CC;
    if (!idAp) {
      for (var i = 0; i < aperturas.length; i++) {
        if (aperturas[i].ESTADO === 'ABIERTA') { idAp = aperturas[i].ID_APERTURA_CC; break; }
      }
    }
    if (!idAp) return respuestaOK([], 'Sin fondo abierto.');

    var conceptos = leerHoja(HOJAS.CONCEPTO_CC).map(limpiarFila);
    var movs = leerHoja(HOJAS.CAJA_CHICA).map(limpiarFila)
      .filter(function(m){ return m.ID_APERTURA_CC === idAp; })
      .map(function(m){
        var cn = '-';
        for (var j = 0; j < conceptos.length; j++) { if (conceptos[j].ID_CONCEPTO_CC === m.ID_CONCEPTO_CC) { cn = conceptos[j].NOMBRE; break; } }
        m.CONCEPTO_NOMBRE = cn;
        return m;
      });
    movs.sort(function(a,b){ return String(b.ID_CC).localeCompare(String(a.ID_CC)); });
    return respuestaOK(movs, 'Movimientos de caja chica.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

// ── Anular un movimiento (solo ADMINISTRADOR; nunca borrar) ──
function ccAnularMovimiento(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el administrador puede anular.', 'ERR_PERMISO'); }
    if (!params.ID_CC) { lock.releaseLock(); return respuestaError('Falta el ID del movimiento.'); }

    var movs = leerHoja(HOJAS.CAJA_CHICA);
    var cab = movs[0];
    var iId = cab.indexOf('ID_CC'), iEst = cab.indexOf('ESTADO'), iTipo = cab.indexOf('TIPO');
    var hoja = getHoja(HOJAS.CAJA_CHICA);
    for (var r = 1; r < movs.length; r++) {
      if (String(movs[r][iId]) === String(params.ID_CC)) {
        if (String(movs[r][iTipo]) === 'APERTURA') { lock.releaseLock(); return respuestaError('No se puede anular la apertura del fondo.'); }
        hoja.getRange(r + 1, iEst + 1).setValue('ANULADO');
        lock.releaseLock();
        return respuestaOK({}, 'Movimiento anulado.');
      }
    }
    lock.releaseLock();
    return respuestaError('Movimiento no encontrado.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al anular: ' + err.message);
  }
}

// ── Cerrar el fondo con arqueo (solo ADMINISTRADOR) ──
function ccCerrar(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el administrador puede cerrar el fondo.', 'ERR_PERMISO'); }

    var est = ccEstado(params);
    if (!est.ok || !est.datos.abierta) { lock.releaseLock(); return respuestaError('No hay fondo abierto.'); }
    var saldoEsperado = parseFloat(est.datos.saldo) || 0;
    var saldoContado = parseFloat(params.SALDO_CONTADO);
    if (isNaN(saldoContado) || saldoContado < 0) { lock.releaseLock(); return respuestaError('Ingrese el saldo contado (efectivo real).'); }
    var diferencia = saldoContado - saldoEsperado;

    var movs = leerHoja(HOJAS.APERTURA_CC);
    var cab = movs[0];
    var iId = cab.indexOf('ID_APERTURA_CC');
    var hoja = getHoja(HOJAS.APERTURA_CC);
    for (var r = 1; r < movs.length; r++) {
      if (String(movs[r][iId]) === String(est.datos.idApertura)) {
        hoja.getRange(r + 1, cab.indexOf('TOTAL_GASTOS') + 1).setValue(est.datos.totalGastos);
        hoja.getRange(r + 1, cab.indexOf('TOTAL_REPOSICIONES') + 1).setValue(est.datos.totalReposiciones);
        hoja.getRange(r + 1, cab.indexOf('SALDO_ESPERADO') + 1).setValue(saldoEsperado.toFixed(2));
        hoja.getRange(r + 1, cab.indexOf('SALDO_CONTADO') + 1).setValue(saldoContado.toFixed(2));
        hoja.getRange(r + 1, cab.indexOf('DIFERENCIA') + 1).setValue(diferencia.toFixed(2));
        hoja.getRange(r + 1, cab.indexOf('FECHA_CIERRE') + 1).setValue(getFecha('fecha'));
        hoja.getRange(r + 1, cab.indexOf('HORA_CIERRE') + 1).setValue(getFecha('hora'));
        hoja.getRange(r + 1, cab.indexOf('USUARIO_CIERRE') + 1).setValue(params.usuario || '-');
        hoja.getRange(r + 1, cab.indexOf('ESTADO') + 1).setValue('CERRADA');
        break;
      }
    }
    lock.releaseLock();
    return respuestaOK({ diferencia: diferencia.toFixed(2) }, 'Fondo cerrado. Diferencia: S/ ' + diferencia.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al cerrar: ' + err.message);
  }
}

// ── Listar conceptos/categorías de gasto activos ──
function ccListarConceptos(params) {
  try {
    var conceptos = leerHoja(HOJAS.CONCEPTO_CC).map(limpiarFila)
      .filter(function(c){ return c.ID_CONCEPTO_CC && c.ESTADO === 'ACTIVO'; });
    return respuestaOK(conceptos, 'Conceptos de caja chica.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}
