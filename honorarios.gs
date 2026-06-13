// ============================================================
// VIZVALL — Módulo de Honorarios (Fase A: config + sueldo fijo + pago)
// ============================================================

// Modalidades soportadas (Fase A usa SUELDO_FIJO; B y C agregarán las demás)
// SUELDO_FIJO | POR_TURNO | POR_HORA | PORCENTAJE

// ── Listar configuraciones de honorario ──
function listarHonorarioConfig(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') return respuestaError('Solo el Administrador.', 'ERR_PERMISO');
    var lista = leerHoja(HOJAS.HONORARIO_CONFIG).map(limpiarFila)
      .filter(function(h){ return h.ID_HONORARIO_CONFIG && String(h.ID_HONORARIO_CONFIG).trim() !== ''; });
    return respuestaOK(lista, lista.length + ' configuración(es).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ── Guardar/actualizar configuración ──
function guardarHonorarioConfig(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el Administrador.', 'ERR_PERMISO'); }

    if (!params.ID_PERSONAL)  { lock.releaseLock(); return respuestaError('Seleccione el personal.'); }
    if (!params.MODALIDAD)    { lock.releaseLock(); return respuestaError('Seleccione la modalidad.'); }
    var monto = parseFloat(params.MONTO);
    if (isNaN(monto) || monto < 0) { lock.releaseLock(); return respuestaError('Monto inválido.'); }
    var modsValidas = ['SUELDO_FIJO','POR_TURNO','POR_HORA','PORCENTAJE'];
    if (modsValidas.indexOf(params.MODALIDAD) < 0) { lock.releaseLock(); return respuestaError('Modalidad no válida.'); }

    if (params.ID_HONORARIO_CONFIG) {
      // actualizar
      actualizarFila(HOJAS.HONORARIO_CONFIG, 'ID_HONORARIO_CONFIG', params.ID_HONORARIO_CONFIG, {
        MODALIDAD:   params.MODALIDAD,
        MONTO:       monto.toFixed(2),
        DESCRIPCION: String(params.DESCRIPCION || '-').toUpperCase(),
        ESTADO:      params.ESTADO || 'ACTIVO',
      });
      lock.releaseLock();
      return respuestaOK({ ID_HONORARIO_CONFIG: params.ID_HONORARIO_CONFIG }, 'Configuración actualizada.');
    }

    var id = generarID(HOJAS.HONORARIO_CONFIG, 'ID_HONORARIO_CONFIG', 'HC', 4);
    insertarFila(HOJAS.HONORARIO_CONFIG, {
      ID_HONORARIO_CONFIG: id,
      TIPO_PERSONAL:   String(params.TIPO_PERSONAL || 'MEDICO').toUpperCase(),
      ID_PERSONAL:     params.ID_PERSONAL,
      NOMBRE_PERSONAL: String(params.NOMBRE_PERSONAL || '-').toUpperCase(),
      MODALIDAD:       params.MODALIDAD,
      MONTO:           monto.toFixed(2),
      DESCRIPCION:     String(params.DESCRIPCION || '-').toUpperCase(),
      ESTADO:          'ACTIVO',
      FECHA_REGISTRO:  getFecha('fecha'),
    });
    lock.releaseLock();
    return respuestaOK({ ID_HONORARIO_CONFIG: id }, 'Configuración guardada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar: ' + err.message);
  }
}

// ── Desactivar una configuración ──
function desactivarHonorarioConfig(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') return respuestaError('Solo el Administrador.', 'ERR_PERMISO');
    if (!params.ID_HONORARIO_CONFIG) return respuestaError('ID requerido.');
    actualizarFila(HOJAS.HONORARIO_CONFIG, 'ID_HONORARIO_CONFIG', params.ID_HONORARIO_CONFIG, { ESTADO: 'INACTIVO' });
    return respuestaOK({}, 'Configuración desactivada.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ── Registrar un pago de honorario (pasa por caja como EGRESO) ──
function registrarPagoHonorario(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el Administrador.', 'ERR_PERMISO'); }

    if (!params.ID_PERSONAL) { lock.releaseLock(); return respuestaError('Seleccione el personal.'); }
    var monto = parseFloat(params.MONTO);
    if (isNaN(monto) || monto <= 0) { lock.releaseLock(); return respuestaError('El monto debe ser mayor a 0.'); }

    // Verificar caja abierta
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    if (!abierta) { lock.releaseLock(); return respuestaError('No hay caja abierta. Abra la caja primero.'); }

    // 1. Registrar el egreso en CAJA
    var idCaja = generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4);
    var obsCaja = 'PAGO HONORARIO: ' + String(params.NOMBRE_PERSONAL || params.ID_PERSONAL).toUpperCase();
    insertarFila(HOJAS.CAJA, {
      ID_CAJA:           idCaja,
      ID_APERTURA:       abierta.ID_APERTURA,
      FECHA:             getFecha('fecha'),
      HORA:              getFecha('hora'),
      TURNO:             abierta.TURNO || 'ÚNICO',
      TIPO:              'EGRESO',
      ID_TCONCEPTO_CAJA: params.ID_TCONCEPTO_CAJA || '-',
      ID_VENTA:          '-',
      MODO_PAGO:         params.MODO_PAGO || 'EFECTIVO',
      MONTO:             monto.toFixed(2),
      USUARIO:           params.usuario || '-',
      ESTADO:            'ACTIVO',
      OBSERVACIONES:     obsCaja,
    });

    // 2. Registrar el pago de honorario
    var idPago = generarID(HOJAS.PAGO_HONORARIO, 'ID_PAGO_HONORARIO', 'PH', 4);
    insertarFila(HOJAS.PAGO_HONORARIO, {
      ID_PAGO_HONORARIO: idPago,
      TIPO_PERSONAL:   String(params.TIPO_PERSONAL || 'MEDICO').toUpperCase(),
      ID_PERSONAL:     params.ID_PERSONAL,
      NOMBRE_PERSONAL: String(params.NOMBRE_PERSONAL || '-').toUpperCase(),
      PERIODO_DESDE:   params.PERIODO_DESDE || '-',
      PERIODO_HASTA:   params.PERIODO_HASTA || '-',
      MODALIDAD:       params.MODALIDAD || 'SUELDO_FIJO',
      MONTO:           monto.toFixed(2),
      MODO_PAGO:       params.MODO_PAGO || 'EFECTIVO',
      ID_CAJA:         idCaja,
      OBSERVACION:     String(params.OBSERVACION || '-').toUpperCase(),
      ESTADO:          'PAGADO',
      USUARIO:         params.usuario || '-',
      FECHA_PAGO:      getFecha('datetime'),
    });

    lock.releaseLock();
    return respuestaOK({ ID_PAGO_HONORARIO: idPago, ID_CAJA: idCaja }, 'Pago de honorario registrado: S/ ' + monto.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar pago: ' + err.message);
  }
}

// ── Listar pagos de honorarios (historial) ──
function listarPagosHonorario(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') return respuestaError('Solo el Administrador.', 'ERR_PERMISO');
    var lista = leerHoja(HOJAS.PAGO_HONORARIO).map(limpiarFila)
      .filter(function(p){ return p.ID_PAGO_HONORARIO && String(p.ID_PAGO_HONORARIO).trim() !== ''; });
    lista.sort(function(a,b){ return (a.FECHA_PAGO||'') > (b.FECHA_PAGO||'') ? -1 : 1; });
    return respuestaOK(lista, lista.length + ' pago(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  FASE B — ASISTENCIA del personal (turnos / horas)
// ════════════════════════════════════════════════════════════

// ── Registrar asistencia de un día ──
function registrarAsistencia(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','RECEPCION'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }

    if (!params.ID_PERSONAL) { lock.releaseLock(); return respuestaError('Seleccione el personal.'); }
    if (!params.FECHA)       { lock.releaseLock(); return respuestaError('Indique la fecha.'); }
    var horas = parseFloat(params.HORAS) || 0;

    // Evitar duplicado: mismo personal + misma fecha + mismo turno
    var existentes = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila);
    for (var i = 0; i < existentes.length; i++) {
      if (existentes[i].ESTADO !== 'ANULADO' &&
          existentes[i].ID_PERSONAL === params.ID_PERSONAL &&
          existentes[i].FECHA === params.FECHA &&
          String(existentes[i].TURNO).toUpperCase() === String(params.TURNO || 'ÚNICO').toUpperCase()) {
        lock.releaseLock();
        return respuestaError('Ya existe asistencia para este personal en esa fecha y turno.');
      }
    }

    var id = generarID(HOJAS.ASISTENCIA_PERSONAL, 'ID_ASISTENCIA', 'AS', 4);
    insertarFila(HOJAS.ASISTENCIA_PERSONAL, {
      ID_ASISTENCIA:   id,
      TIPO_PERSONAL:   String(params.TIPO_PERSONAL || 'MEDICO').toUpperCase(),
      ID_PERSONAL:     params.ID_PERSONAL,
      NOMBRE_PERSONAL: String(params.NOMBRE_PERSONAL || '-').toUpperCase(),
      FECHA:           params.FECHA,
      TURNO:           String(params.TURNO || 'ÚNICO').toUpperCase(),
      HORAS:           horas.toString(),
      ASISTIO:         (params.ASISTIO === false || params.ASISTIO === 'NO') ? 'NO' : 'SI',
      OBSERVACION:     String(params.OBSERVACION || '-').toUpperCase(),
      ESTADO:          'ACTIVO',
      USUARIO:         params.usuario || '-',
      FECHA_REGISTRO:  getFecha('datetime'),
    });
    lock.releaseLock();
    return respuestaOK({ ID_ASISTENCIA: id }, 'Asistencia registrada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar asistencia: ' + err.message);
  }
}

// ── Listar asistencia (filtrable por personal y rango) ──
function listarAsistencia(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','RECEPCION'].indexOf(rol) < 0) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var lista = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila)
      .filter(function(a){ return a.ID_ASISTENCIA && String(a.ID_ASISTENCIA).trim() !== '' && a.ESTADO !== 'ANULADO'; });
    if (params.ID_PERSONAL) lista = lista.filter(function(a){ return a.ID_PERSONAL === params.ID_PERSONAL; });
    if (params.desde) lista = lista.filter(function(a){ return String(a.FECHA).substring(0,10) >= params.desde; });
    if (params.hasta) lista = lista.filter(function(a){ return String(a.FECHA).substring(0,10) <= params.hasta; });
    lista.sort(function(a,b){ return (a.FECHA||'') > (b.FECHA||'') ? -1 : 1; });
    return respuestaOK(lista, lista.length + ' registro(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ── Anular un registro de asistencia ──
function anularAsistencia(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') return respuestaError('Solo el Administrador.', 'ERR_PERMISO');
    if (!params.ID_ASISTENCIA) return respuestaError('ID requerido.');
    actualizarFila(HOJAS.ASISTENCIA_PERSONAL, 'ID_ASISTENCIA', params.ID_ASISTENCIA, { ESTADO: 'ANULADO' });
    return respuestaOK({}, 'Asistencia anulada.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ── Calcular asistencia acumulada de un personal en un periodo ──
// Devuelve turnos y horas asistidas para sugerir el pago
function calcularAsistenciaPeriodo(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') return respuestaError('Solo el Administrador.', 'ERR_PERMISO');
    if (!params.ID_PERSONAL) return respuestaError('Seleccione el personal.');
    if (!params.desde || !params.hasta) return respuestaError('Indique el periodo.');

    var lista = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila)
      .filter(function(a){
        return a.ESTADO !== 'ANULADO' &&
               a.ID_PERSONAL === params.ID_PERSONAL &&
               String(a.ASISTIO).toUpperCase() === 'SI' &&
               String(a.FECHA).substring(0,10) >= params.desde &&
               String(a.FECHA).substring(0,10) <= params.hasta;
      });
    var totalTurnos = lista.length;
    var totalHoras = 0;
    lista.forEach(function(a){ totalHoras += (parseFloat(a.HORAS) || 0); });

    return respuestaOK({
      ID_PERSONAL: params.ID_PERSONAL,
      desde: params.desde, hasta: params.hasta,
      totalTurnos: totalTurnos,
      totalHoras: totalHoras,
      detalle: lista,
    }, totalTurnos + ' turno(s), ' + totalHoras + ' hora(s).');
  } catch (err) {
    return respuestaError('Error al calcular asistencia: ' + err.message);
  }
}
