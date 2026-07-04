// ============================================================
// VIZVALL — caja.gs — Caja diaria (apertura, movimientos, cierre con arqueo)
// Una caja por día. Ventas en efectivo entran automático.
// ============================================================

// ════════════════════════════════════════════════════════════
//  ESTADO DE CAJA — ¿hay una caja abierta hoy?
// ════════════════════════════════════════════════════════════
function estadoCaja(params) {
  try {
    var hoy = getFecha('fecha');
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    if (!abierta) {
      return respuestaOK({ ABIERTA: false, FECHA_HOY: hoy }, 'No hay caja abierta.');
    }
    // Calcular totales en vivo de los movimientos de esa apertura
    var movs = leerHoja(HOJAS.CAJA).map(limpiarFila)
      .filter(function(m){ return m.ID_APERTURA === abierta.ID_APERTURA && m.ESTADO !== 'ANULADO'; });
    var ingresos = 0, egresos = 0;
    movs.forEach(function(m){
      var monto = parseFloat(m.MONTO) || 0;
      if (m.TIPO === 'INGRESO') ingresos += monto;
      else if (m.TIPO === 'EGRESO') egresos += monto;
    });
    var montoInicial = parseFloat(abierta.MONTO_INICIAL) || 0;
    var esperado = montoInicial + ingresos - egresos;
    return respuestaOK({
      ABIERTA: true,
      ID_APERTURA: abierta.ID_APERTURA,
      FECHA: abierta.FECHA,
      TURNO: abierta.TURNO,
      MONTO_INICIAL: montoInicial.toFixed(2),
      TOTAL_INGRESOS: ingresos.toFixed(2),
      TOTAL_EGRESOS: egresos.toFixed(2),
      EFECTIVO_ESPERADO: esperado.toFixed(2),
      HORA_APERTURA: abierta.HORA_APERTURA,
      USUARIO_APERTURA: abierta.USUARIO_APERTURA,
      NUM_MOVIMIENTOS: movs.length,
    }, 'Caja abierta.');
  } catch (err) {
    return respuestaError('Error al consultar estado de caja: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ABRIR CAJA — registra monto inicial del día
// ════════════════════════════════════════════════════════════
function abrirCaja(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Caja')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso para abrir caja.', 'ERR_PERMISO');
    }
    // ¿Ya hay una caja abierta?
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') {
        lock.releaseLock();
        return respuestaError('Ya hay una caja abierta. Ciérrela antes de abrir otra.');
      }
    }
    var montoInicial = parseFloat(params.MONTO_INICIAL);
    if (isNaN(montoInicial) || montoInicial < 0) {
      lock.releaseLock();
      return respuestaError('El monto inicial debe ser un número válido.');
    }
    var idApertura = generarID(HOJAS.APERTURA_CAJA, 'ID_APERTURA', 'AP', 4);
    insertarFila(HOJAS.APERTURA_CAJA, {
      ID_APERTURA:       idApertura,
      FECHA:             getFecha('fecha'),
      TURNO:             params.TURNO || 'ÚNICO',
      MONTO_INICIAL:     montoInicial.toFixed(2),
      TOTAL_INGRESOS:    '0.00',
      TOTAL_EGRESOS:     '0.00',
      EFECTIVO_ESPERADO: montoInicial.toFixed(2),
      EFECTIVO_CONTADO:  '0.00',
      DIFERENCIA:        '0.00',
      HORA_APERTURA:     getFecha('hora'),
      HORA_CIERRE:       '-',
      USUARIO_APERTURA:  params.usuario || '-',
      USUARIO_CIERRE:    '-',
      ESTADO:            'ABIERTA',
      OBSERVACIONES:     params.OBSERVACIONES || '-',
    });
    // Movimiento de apertura
    insertarFila(HOJAS.CAJA, {
      ID_CAJA:           generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4),
      ID_APERTURA:       idApertura,
      FECHA:             getFecha('fecha'),
      HORA:              getFecha('hora'),
      TURNO:             params.TURNO || 'ÚNICO',
      TIPO:              'APERTURA',
      ID_TCONCEPTO_CAJA: '-',
      ID_VENTA:          '-',
      MODO_PAGO:         'EFECTIVO',
      MONTO:             montoInicial.toFixed(2),
      USUARIO:           params.usuario || '-',
      ESTADO:            'ACTIVO',
      OBSERVACIONES:     'Apertura de caja',
    });
    lock.releaseLock();
    return respuestaOK({ ID_APERTURA: idApertura }, 'Caja abierta con S/ ' + montoInicial.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al abrir caja: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REGISTRAR MOVIMIENTO — ingreso o egreso manual
// ════════════════════════════════════════════════════════════
function registrarMovimiento(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Caja')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    // Buscar la caja abierta
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    if (!abierta) { lock.releaseLock(); return respuestaError('No hay caja abierta. Abra la caja primero.'); }

    var tipo = String(params.TIPO || '').toUpperCase();
    if (tipo !== 'INGRESO' && tipo !== 'EGRESO') {
      lock.releaseLock();
      return respuestaError('El tipo debe ser INGRESO o EGRESO.');
    }
    var monto = parseFloat(params.MONTO);
    if (isNaN(monto) || monto <= 0) { lock.releaseLock(); return respuestaError('El monto debe ser mayor a 0.'); }

    insertarFila(HOJAS.CAJA, {
      ID_CAJA:           generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4),
      ID_APERTURA:       abierta.ID_APERTURA,
      FECHA:             getFecha('fecha'),
      HORA:              getFecha('hora'),
      TURNO:             abierta.TURNO || 'ÚNICO',
      TIPO:              tipo,
      ID_TCONCEPTO_CAJA: params.ID_TCONCEPTO_CAJA || '-',
      ID_VENTA:          params.ID_VENTA || '-',
      MODO_PAGO:         params.MODO_PAGO || 'EFECTIVO',
      MONTO:             monto.toFixed(2),
      USUARIO:           params.usuario || '-',
      ESTADO:            'ACTIVO',
      OBSERVACIONES:     params.OBSERVACIONES || '-',
    });
    lock.releaseLock();
    return respuestaOK({}, 'Movimiento registrado: ' + tipo + ' S/ ' + monto.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar movimiento: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  LISTAR CAJA — movimientos de la caja abierta (o de una apertura)
// ════════════════════════════════════════════════════════════
function listarCaja(params) {
  try {
    var idApertura = params.ID_APERTURA;
    if (!idApertura) {
      // usar la caja abierta
      var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
      for (var i = 0; i < aperturas.length; i++) {
        if (aperturas[i].ESTADO === 'ABIERTA') { idApertura = aperturas[i].ID_APERTURA; break; }
      }
    }
    if (!idApertura) return respuestaOK([], 'No hay caja abierta.');

    var movs = leerHoja(HOJAS.CAJA).map(limpiarFila)
      .filter(function(m){ return m.ID_APERTURA === idApertura; });
    var conceptos = leerHoja(HOJAS.TCONCEPTO_CAJA).map(limpiarFila);

    var enriched = movs.map(function(m){
      var conceptoNombre = '—';
      for (var j = 0; j < conceptos.length; j++) {
        if (conceptos[j].ID_TCONCEPTO_CAJA === m.ID_TCONCEPTO_CAJA) { conceptoNombre = conceptos[j].NOMBRE; break; }
      }
      return {
        ID_CAJA:         m.ID_CAJA,
        FECHA:           m.FECHA,
        HORA:            m.HORA,
        TIPO:            m.TIPO,
        CONCEPTO_NOMBRE: conceptoNombre,
        ID_VENTA:        m.ID_VENTA,
        MODO_PAGO:       m.MODO_PAGO,
        MONTO:           m.MONTO,
        USUARIO:         m.USUARIO,
        ESTADO:          m.ESTADO,
        OBSERVACIONES:   m.OBSERVACIONES,
      };
    });
    // ordenar por hora descendente (lo último primero)
    enriched.sort(function(a,b){ return (a.HORA||'') > (b.HORA||'') ? -1 : 1; });
    return respuestaOK(enriched, enriched.length + ' movimiento(s).');
  } catch (err) {
    return respuestaError('Error al listar caja: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  CERRAR CAJA — arqueo: efectivo contado vs esperado
// ════════════════════════════════════════════════════════════
function cerrarCaja(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Caja')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso para cerrar caja.', 'ERR_PERMISO');
    }
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    if (!abierta) { lock.releaseLock(); return respuestaError('No hay caja abierta para cerrar.'); }

    var contado = parseFloat(params.EFECTIVO_CONTADO);
    if (isNaN(contado) || contado < 0) { lock.releaseLock(); return respuestaError('Ingrese el efectivo contado (arqueo).'); }

    // Recalcular totales de los movimientos
    var movs = leerHoja(HOJAS.CAJA).map(limpiarFila)
      .filter(function(m){ return m.ID_APERTURA === abierta.ID_APERTURA && m.ESTADO !== 'ANULADO'; });
    var ingresos = 0, egresos = 0;
    movs.forEach(function(m){
      var monto = parseFloat(m.MONTO) || 0;
      if (m.TIPO === 'INGRESO') ingresos += monto;
      else if (m.TIPO === 'EGRESO') egresos += monto;
    });
    var montoInicial = parseFloat(abierta.MONTO_INICIAL) || 0;
    var esperado = montoInicial + ingresos - egresos;
    var diferencia = contado - esperado;

    actualizarFila(HOJAS.APERTURA_CAJA, 'ID_APERTURA', abierta.ID_APERTURA, {
      TOTAL_INGRESOS:    ingresos.toFixed(2),
      TOTAL_EGRESOS:     egresos.toFixed(2),
      EFECTIVO_ESPERADO: esperado.toFixed(2),
      EFECTIVO_CONTADO:  contado.toFixed(2),
      DIFERENCIA:        diferencia.toFixed(2),
      HORA_CIERRE:       getFecha('hora'),
      USUARIO_CIERRE:    params.usuario || '-',
      ESTADO:            'CERRADA',
      OBSERVACIONES:     params.OBSERVACIONES || abierta.OBSERVACIONES || '-',
    });
    // Movimiento de cierre
    insertarFila(HOJAS.CAJA, {
      ID_CAJA:           generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4),
      ID_APERTURA:       abierta.ID_APERTURA,
      FECHA:             getFecha('fecha'),
      HORA:              getFecha('hora'),
      TURNO:             abierta.TURNO || 'ÚNICO',
      TIPO:              'CIERRE',
      ID_TCONCEPTO_CAJA: '-',
      ID_VENTA:          '-',
      MODO_PAGO:         'EFECTIVO',
      MONTO:             contado.toFixed(2),
      USUARIO:           params.usuario || '-',
      ESTADO:            'ACTIVO',
      OBSERVACIONES:     'Cierre. Esperado: ' + esperado.toFixed(2) + ' Contado: ' + contado.toFixed(2) + ' Dif: ' + diferencia.toFixed(2),
    });
    lock.releaseLock();
    return respuestaOK({
      EFECTIVO_ESPERADO: esperado.toFixed(2),
      EFECTIVO_CONTADO:  contado.toFixed(2),
      DIFERENCIA:        diferencia.toFixed(2),
    }, 'Caja cerrada. Diferencia: S/ ' + diferencia.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al cerrar caja: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ARQUEO POSTERIOR — registra el efectivo contado sobre una caja
//  que se cerró automáticamente (DIFERENCIA = PENDIENTE).
//  Cierra el hueco de control: valida lo esperado vs lo contado.
// ════════════════════════════════════════════════════════════
function arquearCajaCerrada(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Caja')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso para arquear caja.', 'ERR_PERMISO');
    }
    if (!params.ID_APERTURA) { lock.releaseLock(); return respuestaError('ID_APERTURA requerido.'); }

    var contado = parseFloat(params.EFECTIVO_CONTADO);
    if (isNaN(contado) || contado < 0) { lock.releaseLock(); return respuestaError('Ingrese el efectivo contado (arqueo).'); }

    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var caja = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ID_APERTURA === params.ID_APERTURA) { caja = aperturas[i]; break; }
    }
    if (!caja) { lock.releaseLock(); return respuestaError('No se encontró la caja indicada.'); }
    if (caja.ESTADO !== 'CERRADA') { lock.releaseLock(); return respuestaError('Solo se puede arquear una caja CERRADA.'); }
    if (caja.DIFERENCIA !== 'PENDIENTE') { lock.releaseLock(); return respuestaError('Esta caja ya fue arqueada (diferencia registrada).'); }

    // Recalcular esperado desde los movimientos (fuente de verdad)
    var movs = leerHoja(HOJAS.CAJA).map(limpiarFila)
      .filter(function(m){ return m.ID_APERTURA === caja.ID_APERTURA && m.ESTADO !== 'ANULADO'; });
    var ingresos = 0, egresos = 0;
    movs.forEach(function(m){
      var monto = parseFloat(m.MONTO) || 0;
      if (m.TIPO === 'INGRESO') ingresos += monto;
      else if (m.TIPO === 'EGRESO') egresos += monto;
    });
    var montoInicial = parseFloat(caja.MONTO_INICIAL) || 0;
    var esperado = montoInicial + ingresos - egresos;
    var diferencia = contado - esperado;

    var quien = params.usuario || (params._sesion && params._sesion.USUARIO) || '-';
    var sello = (caja.OBSERVACIONES && caja.OBSERVACIONES !== '-' ? caja.OBSERVACIONES + ' · ' : '') +
                'ARQUEO POSTERIOR (' + getFecha() + ' · ' + quien + ')';

    actualizarFila(HOJAS.APERTURA_CAJA, 'ID_APERTURA', caja.ID_APERTURA, {
      TOTAL_INGRESOS:    ingresos.toFixed(2),
      TOTAL_EGRESOS:     egresos.toFixed(2),
      EFECTIVO_ESPERADO: esperado.toFixed(2),
      EFECTIVO_CONTADO:  contado.toFixed(2),
      DIFERENCIA:        diferencia.toFixed(2),
      USUARIO_CIERRE:    quien,
      OBSERVACIONES:     sello,
    });
    // Movimiento de arqueo (traza en el libro de caja)
    insertarFila(HOJAS.CAJA, {
      ID_CAJA:           generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4),
      ID_APERTURA:       caja.ID_APERTURA,
      FECHA:             getFecha('fecha'),
      HORA:              getFecha('hora'),
      TURNO:             caja.TURNO || 'ÚNICO',
      TIPO:              'ARQUEO',
      ID_TCONCEPTO_CAJA: '-',
      ID_VENTA:          '-',
      MODO_PAGO:         'EFECTIVO',
      MONTO:             contado.toFixed(2),
      USUARIO:           quien,
      ESTADO:            'ACTIVO',
      OBSERVACIONES:     'Arqueo posterior. Esperado: ' + esperado.toFixed(2) + ' Contado: ' + contado.toFixed(2) + ' Dif: ' + diferencia.toFixed(2),
    });
    registrarAuditoria((params._sesion?params._sesion.ID_USUARIO:'-'), 'CAJA', 'ARQUEO_POSTERIOR',
      'Arqueo caja ' + caja.ID_APERTURA + ' · Esperado: ' + esperado.toFixed(2) + ' · Contado: ' + contado.toFixed(2) + ' · Dif: ' + diferencia.toFixed(2));

    lock.releaseLock();
    return respuestaOK({
      EFECTIVO_ESPERADO: esperado.toFixed(2),
      EFECTIVO_CONTADO:  contado.toFixed(2),
      DIFERENCIA:        diferencia.toFixed(2),
    }, 'Arqueo registrado. Diferencia: S/ ' + diferencia.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al arquear caja: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  LISTAR APERTURAS — historial de cajas (cerradas/abiertas)
// ════════════════════════════════════════════════════════════
function listarAperturas(params) {
  try {
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila)
      .filter(function(a){ return a.ID_APERTURA && String(a.ID_APERTURA).trim() !== ''; });
    if (params && params.fechaDesde) {
      aperturas = aperturas.filter(function(a){ return a.FECHA >= params.fechaDesde; });
    }
    if (params && params.fechaHasta) {
      aperturas = aperturas.filter(function(a){ return a.FECHA <= params.fechaHasta; });
    }
    aperturas.sort(function(a,b){ return (a.FECHA||'') > (b.FECHA||'') ? -1 : 1; });
    return respuestaOK(aperturas, aperturas.length + ' apertura(s).');
  } catch (err) {
    return respuestaError('Error al listar aperturas: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ANULAR MOVIMIENTO DE CAJA (gasto/ingreso) — solo ADMINISTRADOR
//  No borra: marca ESTADO='ANULADO' y registra el motivo.
// ════════════════════════════════════════════════════════════
function anularMovimientoCaja(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') {
      lock.releaseLock();
      return respuestaError('Solo el Administrador puede anular movimientos de caja.', 'ERR_PERMISO');
    }
    if (!params.ID_CAJA) { lock.releaseLock(); return respuestaError('ID_CAJA requerido.'); }

    // Buscar el movimiento
    var movs = leerHoja(HOJAS.CAJA).map(limpiarFila);
    var mov = null;
    for (var i = 0; i < movs.length; i++) {
      if (movs[i].ID_CAJA === params.ID_CAJA) { mov = movs[i]; break; }
    }
    if (!mov) { lock.releaseLock(); return respuestaError('Movimiento no encontrado.'); }
    if (String(mov.ESTADO).toUpperCase() === 'ANULADO') {
      lock.releaseLock();
      return respuestaError('Este movimiento ya está anulado.');
    }
    // No permitir anular movimientos generados por una venta (esos se revierten anulando la venta)
    if (mov.ID_VENTA && mov.ID_VENTA !== '-' && mov.ID_VENTA !== '') {
      lock.releaseLock();
      return respuestaError('Este movimiento proviene de una venta. Anule la venta correspondiente.');
    }

    var motivo = String(params.MOTIVO || 'Sin motivo').toUpperCase().trim();
    var obsOriginal = String(mov.OBSERVACIONES || '').replace(/^-$/, '');
    var nuevaObs = (obsOriginal ? obsOriginal + ' | ' : '') +
                   'ANULADO POR ' + (params.usuario || rol) + ': ' + motivo;

    actualizarFila(HOJAS.CAJA, 'ID_CAJA', params.ID_CAJA, {
      ESTADO: 'ANULADO',
      OBSERVACIONES: nuevaObs,
    });

    registrarAuditoria((params._sesion?params._sesion.ID_USUARIO:'-'), 'CAJA', 'ANULAR_MOVIMIENTO', 'Movimiento de caja anulado: ' + params.ID_CAJA);
    lock.releaseLock();
    return respuestaOK({ ID_CAJA: params.ID_CAJA }, 'Movimiento anulado correctamente.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al anular: ' + err.message);
  }
}
