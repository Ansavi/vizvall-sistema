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

    // Nuevo modelo: presencia (opcional) + comisión (opcional). Al menos uno.
    var modPres = String(params.MODALIDAD_PRESENCIA || 'NINGUNO').toUpperCase();
    var modsPres = ['NINGUNO','SUELDO_FIJO','POR_TURNO','POR_HORA'];
    if (modsPres.indexOf(modPres) < 0) { lock.releaseLock(); return respuestaError('Modalidad de presencia no válida.'); }
    var montoPres = parseFloat(params.MONTO_PRESENCIA) || 0;
    var tieneCom = String(params.TIENE_COMISION || 'NO').toUpperCase() === 'SI';
    var pctCom = parseFloat(params.PORCENTAJE_COMISION) || 0;

    // Validaciones de coherencia
    if (modPres === 'NINGUNO' && !tieneCom) {
      lock.releaseLock(); return respuestaError('Configure al menos un concepto: pago por presencia o comisión.');
    }
    if (modPres !== 'NINGUNO' && montoPres <= 0) {
      lock.releaseLock(); return respuestaError('Indique el monto del pago por presencia.');
    }
    if (tieneCom && (pctCom <= 0 || pctCom > 100)) {
      lock.releaseLock(); return respuestaError('El porcentaje de comisión debe estar entre 1 y 100.');
    }

    // MODALIDAD legada (compatibilidad): si hay presencia, esa; si solo comisión, PORCENTAJE
    var modLegada = (modPres !== 'NINGUNO') ? modPres : 'PORCENTAJE';
    var montoLegado = (modPres !== 'NINGUNO') ? montoPres : pctCom;

    if (params.ID_HONORARIO_CONFIG) {
      actualizarFila(HOJAS.HONORARIO_CONFIG, 'ID_HONORARIO_CONFIG', params.ID_HONORARIO_CONFIG, {
        MODALIDAD:            modLegada,
        MONTO:               montoLegado.toFixed(2),
        MODALIDAD_PRESENCIA:  modPres,
        MONTO_PRESENCIA:      montoPres.toFixed(2),
        TIENE_COMISION:       tieneCom ? 'SI' : 'NO',
        PORCENTAJE_COMISION:  pctCom.toFixed(2),
        DESCRIPCION:          String(params.DESCRIPCION || '-').toUpperCase(),
        ESTADO:               params.ESTADO || 'ACTIVO',
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
      MODALIDAD:       modLegada,
      MONTO:           montoLegado.toFixed(2),
      DESCRIPCION:     String(params.DESCRIPCION || '-').toUpperCase(),
      ESTADO:          'ACTIVO',
      FECHA_REGISTRO:  getFecha('fecha'),
      MODALIDAD_PRESENCIA: modPres,
      MONTO_PRESENCIA:     montoPres.toFixed(2),
      TIENE_COMISION:      tieneCom ? 'SI' : 'NO',
      PORCENTAJE_COMISION: pctCom.toFixed(2),
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
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }

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
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
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

// ════════════════════════════════════════════════════════════
//  FASE C — COMISIONES por venta (queda como deuda al médico)
// ════════════════════════════════════════════════════════════

// Helper: obtener el médico de una venta vía su cita
function _medicoDeVenta(idVenta) {
  try {
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === idVenta) { venta = ventas[i]; break; } }
    if (!venta || !venta.ID_CITA || venta.ID_CITA === '-') return null;
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var cita = null;
    for (var j = 0; j < citas.length; j++) { if (citas[j].ID_CITA === venta.ID_CITA) { cita = citas[j]; break; } }
    if (!cita || !cita.ID_MEDICO || cita.ID_MEDICO === '-') return null;
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    for (var k = 0; k < medicos.length; k++) {
      if (medicos[k].ID_MEDICO === cita.ID_MEDICO) {
        return { ID_MEDICO: medicos[k].ID_MEDICO, NOMBRE: ((medicos[k].NOMBRES||'')+' '+(medicos[k].APELLIDOS||'')).trim() };
      }
    }
    return { ID_MEDICO: cita.ID_MEDICO, NOMBRE: cita.ID_MEDICO };
  } catch (e) { return null; }
}

// ── Registrar una comisión sobre una venta ──
function registrarComisionVenta(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }

    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }

    // Validar que la venta exista y obtener su total
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === params.ID_VENTA) { venta = ventas[i]; break; } }
    if (!venta) { lock.releaseLock(); return respuestaError('Venta no encontrada.'); }
    if (String(venta.ESTADO).toUpperCase() === 'ANULADA') { lock.releaseLock(); return respuestaError('No se puede comisionar una venta anulada.'); }

    var baseVenta = parseFloat(venta.TOTAL) || 0;

    // Médico: del parámetro o automático de la cita
    var idMedico = params.ID_MEDICO, nombreMedico = params.NOMBRE_MEDICO;
    if (!idMedico || idMedico === '-') {
      var auto = _medicoDeVenta(params.ID_VENTA);
      if (auto) { idMedico = auto.ID_MEDICO; nombreMedico = auto.NOMBRE; }
    }
    if (!idMedico || idMedico === '-') { lock.releaseLock(); return respuestaError('No se pudo determinar el médico. Selecciónelo manualmente.'); }

    // Calcular el monto de la comisión
    var tipoCalc = String(params.TIPO_CALCULO || 'PORCENTAJE').toUpperCase();
    var valor = parseFloat(params.VALOR) || 0;
    if (valor <= 0) { lock.releaseLock(); return respuestaError('Indique el porcentaje o monto de la comisión.'); }
    var montoComision;
    if (tipoCalc === 'PORCENTAJE') {
      if (valor > 100) { lock.releaseLock(); return respuestaError('El porcentaje no puede ser mayor a 100.'); }
      montoComision = baseVenta * (valor / 100);
    } else { // MONTO_FIJO
      montoComision = valor;
    }

    // Evitar comisión duplicada para la misma venta+médico
    var existentes = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);
    for (var e = 0; e < existentes.length; e++) {
      if (existentes[e].ESTADO !== 'ANULADA' &&
          existentes[e].ID_VENTA === params.ID_VENTA &&
          existentes[e].ID_MEDICO === idMedico) {
        lock.releaseLock();
        return respuestaError('Ya existe una comisión para este médico en esta venta.');
      }
    }

    var id = generarID(HOJAS.COMISION_VENTA, 'ID_COMISION', 'CO', 4);
    insertarFila(HOJAS.COMISION_VENTA, {
      ID_COMISION:      id,
      ID_VENTA:         params.ID_VENTA,
      ID_MEDICO:        idMedico,
      NOMBRE_MEDICO:    String(nombreMedico || idMedico).toUpperCase(),
      BASE_VENTA:       baseVenta.toFixed(2),
      TIPO_CALCULO:     tipoCalc,
      VALOR:            valor.toString(),
      MONTO_COMISION:   montoComision.toFixed(2),
      ESTADO:           'PENDIENTE',
      ID_PAGO_HONORARIO:'-',
      OBSERVACION:      String(params.OBSERVACION || '-').toUpperCase(),
      USUARIO:          params.usuario || '-',
      FECHA_REGISTRO:   getFecha('datetime'),
    });
    registrarAuditoria((params._sesion?params._sesion.ID_USUARIO:'-'), 'COMISIONES', 'CREAR_COMISION', 'Comisión ' + id + ' · ' + nombreMedico + ' · S/ ' + montoComision.toFixed(2));
    lock.releaseLock();
    return respuestaOK({ ID_COMISION: id, MONTO_COMISION: montoComision.toFixed(2), NOMBRE_MEDICO: nombreMedico },
                       'Comisión registrada: S/ ' + montoComision.toFixed(2) + ' para ' + nombreMedico);
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar comisión: ' + err.message);
  }
}

// ── Listar comisiones (filtrable por médico/estado) ──
function listarComisiones(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var lista = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila)
      .filter(function(co){ return co.ID_COMISION && String(co.ID_COMISION).trim() !== '' && co.ESTADO !== 'ANULADA'; });
    if (params.ID_MEDICO) lista = lista.filter(function(co){ return co.ID_MEDICO === params.ID_MEDICO; });
    if (params.ID_VENTA)  lista = lista.filter(function(co){ return co.ID_VENTA === params.ID_VENTA; });
    if (params.estado)    lista = lista.filter(function(co){ return co.ESTADO === params.estado; });

    // ── Enriquecer con datos de la venta: comprobante, fecha, descripción ──
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var tcomp = leerHoja(HOJAS.TCOMPROBANTE).map(limpiarFila);
    var dventa = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);

    function ventaDe(idV){ for(var i=0;i<ventas.length;i++){ if(ventas[i].ID_VENTA===idV) return ventas[i]; } return null; }
    function nombreComp(idT){ for(var i=0;i<tcomp.length;i++){ if(tcomp[i].ID_TCOMPROBANTE===idT) return tcomp[i].NOMBRE; } return 'TICKET'; }
    function nombreServ(idS){ for(var i=0;i<servicios.length;i++){ if(servicios[i].ID_SERVICIO===idS) return servicios[i].NOMBRE_SERVICIO; } return null; }
    function nombrePaq(idP){ for(var i=0;i<paquetes.length;i++){ if(paquetes[i].ID_PAQUETE===idP) return paquetes[i].NOMBRE_PAQUETE; } return null; }
    function descVenta(idV){
      var items = dventa.filter(function(d){ return d.ID_VENTA===idV; });
      var nombres = [];
      items.forEach(function(d){
        if(d.ID_SERVICIO && d.ID_SERVICIO!=='-'){ var n=nombreServ(d.ID_SERVICIO); if(n) nombres.push(n); }
        else if(d.ID_PAQUETE && d.ID_PAQUETE!=='-'){ var p=nombrePaq(d.ID_PAQUETE); if(p) nombres.push(p); }
      });
      if(!nombres.length) return '—';
      if(nombres.length<=2) return nombres.join(', ');
      return nombres.slice(0,2).join(', ') + ' +' + (nombres.length-2);
    }

    var enriquecida = lista.map(function(co){
      var v = ventaDe(co.ID_VENTA);
      var comprobante = '—', fechaVenta = co.FECHA_REGISTRO || '—';
      if(v){
        var tipoC = nombreComp(v.ID_TCOMPROBANTE);
        var num = (v.NUMERO_COMPROBANTE && v.NUMERO_COMPROBANTE!=='-') ? v.NUMERO_COMPROBANTE : '';
        comprobante = tipoC + (num ? ' ' + num : '');
        fechaVenta = v.FECHA_VENTA || co.FECHA_REGISTRO;
      }
      return {
        ID_COMISION: co.ID_COMISION, ID_VENTA: co.ID_VENTA,
        ID_MEDICO: co.ID_MEDICO, NOMBRE_MEDICO: co.NOMBRE_MEDICO,
        BASE_VENTA: co.BASE_VENTA, TIPO_CALCULO: co.TIPO_CALCULO,
        VALOR: co.VALOR, MONTO_COMISION: co.MONTO_COMISION,
        ESTADO: co.ESTADO, FECHA_REGISTRO: co.FECHA_REGISTRO,
        // Campos nuevos enriquecidos:
        COMPROBANTE: comprobante,
        FECHA_VENTA: fechaVenta,
        DESCRIPCION_VENTA: descVenta(co.ID_VENTA),
      };
    });
    enriquecida.sort(function(a,b){ return (a.FECHA_VENTA||'') > (b.FECHA_VENTA||'') ? -1 : 1; });
    return respuestaOK(enriquecida, enriquecida.length + ' comisión(es).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ── Anular una comisión pendiente ──
function anularComision(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') return respuestaError('Solo el Administrador.', 'ERR_PERMISO');
    if (!params.ID_COMISION) return respuestaError('ID requerido.');
    var coms = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);
    for (var i = 0; i < coms.length; i++) {
      if (coms[i].ID_COMISION === params.ID_COMISION) {
        if (coms[i].ESTADO === 'PAGADA') return respuestaError('No se puede anular una comisión ya pagada.');
        break;
      }
    }
    actualizarFila(HOJAS.COMISION_VENTA, 'ID_COMISION', params.ID_COMISION, { ESTADO: 'ANULADA' });
    registrarAuditoria((params._sesion?params._sesion.ID_USUARIO:'-'), 'COMISIONES', 'ANULAR_COMISION', 'Comisión anulada: ' + params.ID_COMISION);
    return respuestaOK({}, 'Comisión anulada.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ── Total de comisiones pendientes de un médico (para sugerir al pagar) ──
function totalComisionesPendientes(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') return respuestaError('Solo el Administrador.', 'ERR_PERMISO');
    if (!params.ID_MEDICO) return respuestaError('Médico requerido.');
    var lista = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila)
      .filter(function(co){ return co.ID_MEDICO === params.ID_MEDICO && co.ESTADO === 'PENDIENTE'; });
    var total = 0, ids = [];
    lista.forEach(function(co){ total += (parseFloat(co.MONTO_COMISION)||0); ids.push(co.ID_COMISION); });
    return respuestaOK({ ID_MEDICO: params.ID_MEDICO, total: total, cantidad: lista.length, ids: ids, detalle: lista },
                       lista.length + ' comisión(es) pendiente(s), total S/ ' + total.toFixed(2));
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ── Pagar comisiones pendientes de un médico (las marca PAGADA + registra honorario) ──
function pagarComisiones(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el Administrador.', 'ERR_PERMISO'); }
    var idEjecutor = params.ID_EJECUTOR || params.ID_MEDICO;
    if (!idEjecutor) { lock.releaseLock(); return respuestaError('Ejecutor requerido.'); }

    // Verificar caja abierta
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) { if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; } }
    if (!abierta) { lock.releaseLock(); return respuestaError('No hay caja abierta. Abra la caja primero.'); }

    // Comisiones pendientes del médico
    var coms = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila)
      .filter(function(co){ return co.ID_MEDICO === idEjecutor && co.ESTADO === 'PENDIENTE'; });
    if (!coms.length) { lock.releaseLock(); return respuestaError('Este ejecutor no tiene comisiones pendientes.'); }

    var total = 0, nombre = '', tipoEjecutor = 'MEDICO';
    coms.forEach(function(co){ total += (parseFloat(co.MONTO_COMISION)||0); nombre = co.NOMBRE_MEDICO; if(co.TIPO_EJECUTOR) tipoEjecutor = co.TIPO_EJECUTOR; });
    if (total <= 0) { lock.releaseLock(); return respuestaError('El total de comisiones es 0.'); }

    // 1. Egreso en caja
    var idCaja = generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4);
    insertarFila(HOJAS.CAJA, {
      ID_CAJA: idCaja, ID_APERTURA: abierta.ID_APERTURA,
      FECHA: getFecha('fecha'), HORA: getFecha('hora'), TURNO: abierta.TURNO || 'ÚNICO',
      TIPO: 'EGRESO', ID_TCONCEPTO_CAJA: params.ID_TCONCEPTO_CAJA || '-', ID_VENTA: '-',
      MODO_PAGO: params.MODO_PAGO || 'EFECTIVO', MONTO: total.toFixed(2),
      USUARIO: params.usuario || '-', ESTADO: 'ACTIVO',
      OBSERVACIONES: 'PAGO COMISIONES: ' + String(nombre).toUpperCase() + ' (' + coms.length + ')',
    });

    // 2. Registrar el pago de honorario
    var idPago = generarID(HOJAS.PAGO_HONORARIO, 'ID_PAGO_HONORARIO', 'PH', 4);
    insertarFila(HOJAS.PAGO_HONORARIO, {
      ID_PAGO_HONORARIO: idPago, TIPO_PERSONAL: (tipoEjecutor==='PROFESIONAL'?'PROFESIONAL':'MEDICO'), ID_PERSONAL: idEjecutor,
      NOMBRE_PERSONAL: String(nombre).toUpperCase(), PERIODO_DESDE: params.desde || '-', PERIODO_HASTA: params.hasta || '-',
      MODALIDAD: 'PORCENTAJE', MONTO: total.toFixed(2), MODO_PAGO: params.MODO_PAGO || 'EFECTIVO',
      ID_CAJA: idCaja, OBSERVACION: 'PAGO DE ' + coms.length + ' COMISIÓN(ES)', ESTADO: 'PAGADO',
      USUARIO: params.usuario || '-', FECHA_PAGO: getFecha('datetime'),
    });

    // 3. Marcar cada comisión como PAGADA (apuntando al pago)
    coms.forEach(function(co){
      actualizarFila(HOJAS.COMISION_VENTA, 'ID_COMISION', co.ID_COMISION, { ESTADO: 'PAGADA', ID_PAGO_HONORARIO: idPago });
    });

    registrarAuditoria((params._sesion?params._sesion.ID_USUARIO:'-'), 'COMISIONES', 'PAGAR_COMISIONES', 'Pago ' + idPago + ' · ' + coms.length + ' comisión(es) · S/ ' + total.toFixed(2));
    lock.releaseLock();
    return respuestaOK({ ID_PAGO_HONORARIO: idPago, total: total.toFixed(2), cantidad: coms.length },
                       'Pagadas ' + coms.length + ' comisión(es): S/ ' + total.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al pagar comisiones: ' + err.message);
  }
}

/**
 * Wrapper público de _medicoDeVenta para que el frontend pueda
 * pre-seleccionar el médico de la cita en el modal de comisión.
 */
function medicoDeVentaPublico(params) {
  try {
    if (!params.ID_VENTA) return respuestaError('Venta requerida.');
    var med = _medicoDeVenta(params.ID_VENTA);
    if (!med) return respuestaOK(null, 'Sin médico asociado.');
    return respuestaOK(med, 'Médico encontrado.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REGISTRAR COMISIONES POR SERVICIO
//  Recibe params.comisiones = JSON array, una entrada por servicio:
//    { ID_SERVICIO, SERVICIO_NOMBRE, MONTO_SERVICIO, ID_MEDICO,
//      NOMBRE_MEDICO, TIPO_CALCULO, VALOR }
//  Crea una comisión por cada servicio. Valida cada una.
// ════════════════════════════════════════════════════════════
function registrarComisionesPorServicio(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }

    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }

    // Parsear la lista de comisiones
    var lista = params.comisiones;
    if (typeof lista === 'string') { try { lista = JSON.parse(lista); } catch(e){ lista = []; } }
    if (!Array.isArray(lista) || !lista.length) { lock.releaseLock(); return respuestaError('Seleccione al menos un servicio que comisione.'); }

    // Validar que la venta exista y no esté anulada
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === params.ID_VENTA) { venta = ventas[i]; break; } }
    if (!venta) { lock.releaseLock(); return respuestaError('Venta no encontrada.'); }
    if (String(venta.ESTADO).toUpperCase() === 'ANULADA') { lock.releaseLock(); return respuestaError('No se puede comisionar una venta anulada.'); }

    // Comisiones existentes (para no duplicar por servicio+médico)
    var existentes = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);

    var estadoComision = String(params.ESTADO_COMISION || 'PENDIENTE').toUpperCase();
    if (['PENDIENTE','BORRADOR'].indexOf(estadoComision) < 0) estadoComision = 'PENDIENTE';

    var creadas = 0;
    var errores = [];
    for (var j = 0; j < lista.length; j++) {
      var it = lista[j];
      var idServicio = it.ID_SERVICIO || '';
      var servNombre = it.SERVICIO_NOMBRE || '';
      var montoServicio = parseFloat(it.MONTO_SERVICIO) || 0;
      var idMedico = it.ID_MEDICO || '';
      var nombreMedico = it.NOMBRE_MEDICO || '';
      var tipoCalc = String(it.TIPO_CALCULO || 'PORCENTAJE').toUpperCase();
      var valor = parseFloat(it.VALOR) || 0;

      // En PENDIENTE validar; en BORRADOR permitir incompletos
      if (estadoComision === 'PENDIENTE') {
        if (!idMedico) { errores.push(servNombre + ': sin médico'); continue; }
        if (valor <= 0) { errores.push(servNombre + ': sin valor'); continue; }
      }

      var montoComision = 0;
      if (valor > 0) {
        if (tipoCalc === 'PORCENTAJE') {
          if (valor > 100) { errores.push(servNombre + ': % mayor a 100'); continue; }
          montoComision = montoServicio * (valor / 100);
        } else { // MONTO_FIJO
          montoComision = valor;
        }
      }

      // Evitar duplicado servicio+médico en la misma venta
      var dup = false;
      for (var e = 0; e < existentes.length; e++) {
        if (existentes[e].ESTADO !== 'ANULADA' &&
            existentes[e].ID_VENTA === params.ID_VENTA &&
            existentes[e].ID_SERVICIO === idServicio &&
            existentes[e].ID_MEDICO === idMedico) {
          dup = true; break;
        }
      }
      if (dup) { errores.push(servNombre + ': ya tiene comisión para ese médico'); continue; }

      var id = generarID(HOJAS.COMISION_VENTA, 'ID_COMISION', 'CO', 4);
      insertarFila(HOJAS.COMISION_VENTA, {
        ID_COMISION:      id,
        ID_VENTA:         params.ID_VENTA,
        ID_SERVICIO:      idServicio,
        SERVICIO_NOMBRE:  String(servNombre).toUpperCase(),
        ID_MEDICO:        idMedico,
        NOMBRE_MEDICO:    String(nombreMedico || idMedico).toUpperCase(),
        TIPO_EJECUTOR:    String(it.TIPO_EJECUTOR || 'MEDICO').toUpperCase(),
        BASE_VENTA:       montoServicio.toFixed(2),
        TIPO_CALCULO:     tipoCalc,
        VALOR:            valor.toString(),
        MONTO_COMISION:   montoComision.toFixed(2),
        ESTADO:           estadoComision,
        ID_PAGO_HONORARIO:'',
        OBSERVACION:      params.OBSERVACION || '',
        USUARIO:          (params._sesion && params._sesion.USUARIO) || '',
        FECHA_REGISTRO:   getFecha('datetime')
      });
      // Refrescar existentes para no duplicar dentro del mismo lote
      existentes.push({ ID_VENTA: params.ID_VENTA, ID_SERVICIO: idServicio, ID_MEDICO: idMedico, ESTADO: 'PENDIENTE' });
      creadas++;
    }

    lock.releaseLock();
    if (!creadas && errores.length) {
      return respuestaError('No se registró ninguna comisión. ' + errores.join('; '));
    }
    var msg = creadas + ' comisión(es) registrada(s).';
    if (errores.length) msg += ' Avisos: ' + errores.join('; ');
    return respuestaOK({ creadas: creadas, errores: errores }, msg);
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  MARCAR VENTA SIN COMISIÓN — deja constancia de que se revisó
//  y se determinó que la venta no genera comisiones.
// ════════════════════════════════════════════════════════════
function marcarVentaSinComision(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }

    // Validar venta
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === params.ID_VENTA) { venta = ventas[i]; break; } }
    if (!venta) { lock.releaseLock(); return respuestaError('Venta no encontrada.'); }

    // ¿Ya tiene comisiones activas (no anuladas)?
    var existentes = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);
    for (var e = 0; e < existentes.length; e++) {
      if (existentes[e].ID_VENTA === params.ID_VENTA && existentes[e].ESTADO !== 'ANULADA') {
        lock.releaseLock();
        return respuestaError('Esta venta ya tiene comisiones registradas. Anúlelas primero si desea marcarla sin comisión.');
      }
    }

    // Registrar la constancia
    var id = generarID(HOJAS.COMISION_VENTA, 'ID_COMISION', 'CO', 4);
    insertarFila(HOJAS.COMISION_VENTA, {
      ID_COMISION:      id,
      ID_VENTA:         params.ID_VENTA,
      ID_SERVICIO:      '',
      SERVICIO_NOMBRE:  '(TODA LA VENTA)',
      ID_MEDICO:        '',
      NOMBRE_MEDICO:    '—',
      BASE_VENTA:       (parseFloat(venta.TOTAL) || 0).toFixed(2),
      TIPO_CALCULO:     '',
      VALOR:            '0',
      MONTO_COMISION:   '0.00',
      ESTADO:           'SIN_COMISION',
      ID_PAGO_HONORARIO:'',
      OBSERVACION:      'Revisada: no genera comisión.',
      USUARIO:          (params._sesion && params._sesion.USUARIO) || '',
      FECHA_REGISTRO:   getFecha('datetime')
    });

    lock.releaseLock();
    return respuestaOK({ ID_COMISION: id }, 'Venta marcada como SIN COMISIÓN. Queda la constancia.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ESTADO DE COMISIÓN POR VENTA — para los badges en la lista
//  Devuelve { ID_VENTA: 'SIN_COMISION'|'BORRADOR'|'PENDIENTE'|'PAGADA' }
// ════════════════════════════════════════════════════════════
function estadoComisionVentas(params) {
  try {
    var coms = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila)
      .filter(function(co){ return co.ID_COMISION && co.ESTADO !== 'ANULADA'; });

    // Agrupar por venta. Prioridad: PENDIENTE/PAGADA > BORRADOR > SIN_COMISION
    var mapa = {};
    coms.forEach(function(co){
      var v = co.ID_VENTA;
      var est = co.ESTADO;
      if (!mapa[v]) { mapa[v] = est; return; }
      // Si hay alguna pendiente o pagada, esa manda
      if (est === 'PENDIENTE' || est === 'PAGADA') { mapa[v] = est; }
      else if (mapa[v] === 'SIN_COMISION' && est === 'BORRADOR') { mapa[v] = 'BORRADOR'; }
    });

    return respuestaOK(mapa, 'Estados de comisión.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GESTOR DE COMISIONES POR VENTA (Honorarios)
//  Lista ventas con su estado de comisión y permite asignar
//  comisiones por ítem (servicio/paquete), eligiendo ejecutor.
// ════════════════════════════════════════════════════════════

// Lista ventas reales con su estado de comisión (con/sin)
function listarVentasParaComision(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');

    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila).filter(function(v){
      var est = String(v.ESTADO||'').toUpperCase();
      return v.ID_VENTA && est !== 'PROFORMA' && est !== 'CONVERTIDA' && est !== 'ANULADA';
    });
    var comisiones = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);
    var pacientes  = leerHoja(HOJAS.PACIENTE).map(limpiarFila);

    // ¿qué ventas ya tienen comisión activa?
    var conComision = {};
    comisiones.forEach(function(co){ if(co.ESTADO !== 'ANULADA') conComision[co.ID_VENTA] = true; });

    function nomPac(id){ for(var i=0;i<pacientes.length;i++){ if(pacientes[i].ID_PACIENTE===id) return ((pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||'')).trim(); } return '—'; }

    var filtro = String(params.filtroEstado||'TODOS').toUpperCase();
    var lista = [];
    ventas.forEach(function(v){
      var tiene = !!conComision[v.ID_VENTA];
      if (filtro === 'CON' && !tiene) return;
      if (filtro === 'SIN' && tiene) return;
      lista.push({
        ID_VENTA:        v.ID_VENTA,
        FECHA_VENTA:     String(v.FECHA_VENTA||'').substring(0,10),
        ID_PACIENTE:     v.ID_PACIENTE,
        NOMBRE_PACIENTE: nomPac(v.ID_PACIENTE),
        TOTAL:           v.TOTAL,
        TIENE_COMISION:  tiene
      });
    });
    lista.sort(function(a,b){ return (a.FECHA_VENTA||'') > (b.FECHA_VENTA||'') ? -1 : 1; });
    return respuestaOK(lista, lista.length + ' venta(s).');
  } catch (err) { return respuestaError('Error: ' + err.message); }
}

// Devuelve el desglose de una venta + la comisión existente de cada ítem
function detalleVentaParaComision(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_VENTA) return respuestaError('Venta requerida.');

    var detalle   = leerHoja(HOJAS.DVENTA).map(limpiarFila).filter(function(d){ return d.ID_VENTA === params.ID_VENTA; });
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
    var paquetes  = leerHoja(HOJAS.PAQUETE).map(limpiarFila);
    var especialid= leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var areas     = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
    var comisiones= leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);

    function srv(id){ for(var i=0;i<servicios.length;i++){ if(servicios[i].ID_SERVICIO===id) return servicios[i]; } return null; }
    function paq(id){ for(var i=0;i<paquetes.length;i++){ if(paquetes[i].ID_PAQUETE===id) return paquetes[i]; } return null; }
    function nomEsp(id){ for(var i=0;i<especialid.length;i++){ if(especialid[i].ID_ESPECIALIDAD===id) return especialid[i].ESPECIALIDAD||''; } return ''; }
    function nomArea(id){ for(var i=0;i<areas.length;i++){ if(areas[i].ID_AREA_APOYO===id) return areas[i].NOMBRE||''; } return ''; }
    function comDeServicio(idVenta, idServicio){
      for(var i=0;i<comisiones.length;i++){
        if(comisiones[i].ID_VENTA===idVenta && comisiones[i].ID_SERVICIO===idServicio && comisiones[i].ESTADO!=='ANULADA') return comisiones[i];
      }
      return null;
    }

    var items = detalle.map(function(d){
      var nombre='—', especialidad='', area='', idServ=d.ID_SERVICIO;
      if (String(d.TIPO).toUpperCase()==='PAQUETE') {
        var p=paq(d.ID_PAQUETE); nombre='📦 '+(p?(p.NOMBRE_PAQUETE||'—'):'—');
      } else {
        var s=srv(d.ID_SERVICIO);
        if(s){ nombre=s.NOMBRE_SERVICIO||'—'; especialidad=nomEsp(s.ID_ESPECIALIDAD); area=nomArea(s.ID_AREA_APOYO); }
      }
      var com = (String(d.TIPO).toUpperCase()==='SERVICIO') ? comDeServicio(params.ID_VENTA, d.ID_SERVICIO) : null;
      return {
        ID_DVENTA:       d.ID_DVENTA,
        TIPO:            d.TIPO,
        ID_SERVICIO:     d.ID_SERVICIO,
        SERVICIO_NOMBRE: nombre,
        ESPECIALIDAD:    especialidad,
        AREA_NOMBRE:     area,
        SUBTOTAL:        d.SUBTOTAL,
        // Comisión existente (si la hay)
        COM_ACTIVA:      !!com,
        COM_ID:          com ? com.ID_COMISION : '',
        COM_TIPO_EJECUTOR: com ? com.TIPO_EJECUTOR : '',
        COM_ID_EJECUTOR: com ? com.ID_MEDICO : '',
        COM_NOMBRE_EJECUTOR: com ? com.NOMBRE_MEDICO : '',
        COM_TIPO_CALCULO: com ? com.TIPO_CALCULO : 'PORCENTAJE',
        COM_VALOR:       com ? com.VALOR : '',
        COM_MONTO:       com ? com.MONTO_COMISION : '',
        COM_ESTADO:      com ? com.ESTADO : ''
      };
    });
    return respuestaOK(items, items.length + ' ítem(s).');
  } catch (err) { return respuestaError('Error: ' + err.message); }
}

// Guarda/actualiza las comisiones marcadas de una venta
// params.comisiones = JSON [{ ID_DVENTA, ID_SERVICIO, SERVICIO_NOMBRE, BASE, TIPO_EJECUTOR, ID_EJECUTOR, NOMBRE_EJECUTOR, TIPO_CALCULO, VALOR, COM_ID(opcional) }]
function guardarComisionesDeVenta(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e){ return respuestaError('Sistema ocupado.'); }
  try {
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }

    var items = params.comisiones;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e){ items = []; } }
    if (!items) items = [];

    var idUsuario = params._sesion ? (params._sesion.ID_USUARIO || params._sesion.USUARIO || '-') : '-';
    var comisiones = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);
    var creadas=0, actualizadas=0, eliminadas=0;

    // Set de servicios que vienen marcados (para detectar los que se desmarcaron)
    var marcadosServicio = {};
    items.forEach(function(it){ if(it.ID_SERVICIO) marcadosServicio[it.ID_SERVICIO] = true; });

    // 1. Anular comisiones de esta venta cuyo servicio YA NO está marcado
    comisiones.forEach(function(co){
      if (co.ID_VENTA === params.ID_VENTA && co.ESTADO !== 'ANULADA' && co.ESTADO !== 'PAGADA') {
        if (!marcadosServicio[co.ID_SERVICIO]) {
          actualizarFila(HOJAS.COMISION_VENTA, 'ID_COMISION', co.ID_COMISION, { ESTADO: 'ANULADA' });
          eliminadas++;
        }
      }
    });

    // 2. Crear o actualizar las marcadas
    items.forEach(function(it){
      var valor = parseFloat(it.VALOR) || 0;
      if (valor <= 0 || !it.ID_EJECUTOR) return;
      var base = parseFloat(it.BASE) || 0;
      var tipoCalc = String(it.TIPO_CALCULO||'PORCENTAJE').toUpperCase();
      var monto = (tipoCalc==='PORCENTAJE') ? (base * (valor/100)) : valor;

      // ¿ya existe comisión para este servicio en esta venta?
      var existente = null;
      for (var i=0;i<comisiones.length;i++){
        if (comisiones[i].ID_VENTA===params.ID_VENTA && comisiones[i].ID_SERVICIO===it.ID_SERVICIO && comisiones[i].ESTADO!=='ANULADA') { existente=comisiones[i]; break; }
      }
      var datos = {
        ID_SERVICIO:     String(it.ID_SERVICIO||'-'),
        SERVICIO_NOMBRE: String(it.SERVICIO_NOMBRE||'-').toUpperCase(),
        ID_MEDICO:       String(it.ID_EJECUTOR),
        NOMBRE_MEDICO:   String(it.NOMBRE_EJECUTOR||'-').toUpperCase(),
        TIPO_EJECUTOR:   String(it.TIPO_EJECUTOR||'MEDICO'),
        BASE_VENTA:      base.toFixed(2),
        TIPO_CALCULO:    tipoCalc,
        VALOR:           String(valor),
        MONTO_COMISION:  monto.toFixed(2)
      };
      if (existente && existente.ESTADO !== 'PAGADA') {
        actualizarFila(HOJAS.COMISION_VENTA, 'ID_COMISION', existente.ID_COMISION, datos);
        actualizadas++;
      } else if (!existente) {
        datos.ID_COMISION = generarID(HOJAS.COMISION_VENTA, 'ID_COMISION', 'COM', 4);
        datos.ID_VENTA = String(params.ID_VENTA);
        datos.ESTADO = 'PENDIENTE';
        datos.ID_PAGO_HONORARIO = '-';
        datos.OBSERVACION = '-';
        datos.USUARIO = String(idUsuario);
        datos.FECHA_REGISTRO = getFecha('datetime');
        insertarFila(HOJAS.COMISION_VENTA, datos);
        creadas++;
      }
    });

    if (typeof registrarAuditoria === 'function')
      registrarAuditoria(idUsuario, 'COMISIONES', 'GESTIONAR_COMISION', 'Venta ' + params.ID_VENTA + ' · ' + creadas + ' creada(s), ' + actualizadas + ' actualizada(s), ' + eliminadas + ' anulada(s)');

    lock.releaseLock();
    return respuestaOK({ creadas:creadas, actualizadas:actualizadas, eliminadas:eliminadas }, 'Comisiones guardadas.');
  } catch (err) {
    lock.releaseLock();
    return respuestaError('Error al guardar comisiones: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  RESUMEN / TABLERO DE HONORARIOS
//  Totales de comisiones (pendientes/pagadas) y pagos de honorarios,
//  globales y del mes actual, + desglose de lo pendiente por persona.
// ════════════════════════════════════════════════════════════
function resumenHonorarios(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');

    var mesAA = getFecha('fecha').substring(0, 7); // YYYY-MM

    var comisiones = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);
    var pagos      = leerHoja(HOJAS.PAGO_HONORARIO).map(limpiarFila);

    // ── COMISIONES ──
    var comPendiente = 0, comPagada = 0, comPendMes = 0, comPagadaMes = 0;
    var pendientePorPersona = {}; // id → { nombre, tipo, total, cantidad }

    comisiones.forEach(function(co){
      var monto = parseFloat(co.MONTO_COMISION) || 0;
      var est = String(co.ESTADO || '').toUpperCase();
      var fechaMes = String(co.FECHA_REGISTRO || '').substring(0, 7);
      if (est === 'PENDIENTE') {
        comPendiente += monto;
        if (fechaMes === mesAA) comPendMes += monto;
        // desglose por persona
        var k = co.ID_MEDICO || '-';
        if (!pendientePorPersona[k]) pendientePorPersona[k] = { id:k, nombre: co.NOMBRE_MEDICO || k, tipo: co.TIPO_EJECUTOR || 'MEDICO', total:0, cantidad:0 };
        pendientePorPersona[k].total += monto;
        pendientePorPersona[k].cantidad++;
      } else if (est === 'PAGADA') {
        comPagada += monto;
        if (fechaMes === mesAA) comPagadaMes += monto;
      }
    });

    // ── PAGOS DE HONORARIOS ──
    var pagosTotal = 0, pagosMes = 0, pagosCantMes = 0;
    pagos.forEach(function(pg){
      if (String(pg.ESTADO || '').toUpperCase() === 'ANULADO') return;
      var monto = parseFloat(pg.MONTO) || 0;
      var fechaMes = String(pg.FECHA_PAGO || '').substring(0, 7);
      pagosTotal += monto;
      if (fechaMes === mesAA) { pagosMes += monto; pagosCantMes++; }
    });

    // Desglose ordenado (mayor deuda primero)
    var desglose = Object.keys(pendientePorPersona).map(function(k){ return pendientePorPersona[k]; });
    desglose.sort(function(a, b){ return b.total - a.total; });

    return respuestaOK({
      MES: mesAA,
      // Comisiones
      COM_PENDIENTE:       comPendiente.toFixed(2),
      COM_PAGADA:          comPagada.toFixed(2),
      COM_PENDIENTE_MES:   comPendMes.toFixed(2),
      COM_PAGADA_MES:      comPagadaMes.toFixed(2),
      PERSONAS_PENDIENTES: desglose.length,
      // Pagos honorarios
      PAGOS_TOTAL:         pagosTotal.toFixed(2),
      PAGOS_MES:           pagosMes.toFixed(2),
      PAGOS_CANT_MES:      pagosCantMes,
      // Desglose por persona
      DESGLOSE:            desglose
    }, 'Resumen calculado.');
  } catch (err) {
    return respuestaError('Error al calcular resumen: ' + err.message);
  }
}


// ════════════════════════════════════════════════════════════════════════
//  FASE 1 — MARCAJE DE ASISTENCIA TIPO RELOJ CONTROL
//  Prefijo backend: as*  (asistencia)
// ════════════════════════════════════════════════════════════════════════

// Garantiza que la hoja ASISTENCIA_PERSONAL tenga las columnas de marcaje.
// Se llama al inicio de cada operación de marcaje: si faltan columnas, las crea.
// Así el marcaje funciona aunque no se haya corrido ampliarAsistenciaMarcaje.
function _asGarantizarColumnas() {
  var hoja = getHoja(HOJAS.ASISTENCIA_PERSONAL);
  if (!hoja) return;
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var nuevas = ['HORA_INGRESO','HORA_SALIDA','HORARIO_PREVISTO','ESTADO_MARCA','ES_VOLANTE'];
  var creo = false;
  nuevas.forEach(function(col){
    if (cab.indexOf(col) < 0) {
      hoja.insertColumnAfter(hoja.getLastColumn());
      hoja.getRange(1, hoja.getLastColumn()).setValue(col);
      creo = true;
    }
  });
  if (creo) _invalidarCacheHoja_(HOJAS.ASISTENCIA_PERSONAL);
}

// Devuelve el personal (médicos + apoyo) que TIENE HORARIO configurado ese día,
// junto con su marcaje del día si ya existe.
function asPersonalDelDia(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    _asGarantizarColumnas();
    var fecha = params.fecha;
    if (!fecha) return respuestaError('Indique la fecha.');

    var diasMap = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
    var partes = String(fecha).split('-');
    var dObj = new Date(parseInt(partes[0],10), parseInt(partes[1],10)-1, parseInt(partes[2],10));
    var diaSemana = diasMap[dObj.getDay()];

    function normDia(d){
      return String(d||'').toUpperCase().trim()
        .replace(/[\u00c1\u00c0\u00c4]/g,'A').replace(/[\u00c9\u00c8\u00cb]/g,'E')
        .replace(/[\u00cd\u00cc\u00cf]/g,'I').replace(/[\u00d3\u00d2\u00d6]/g,'O')
        .replace(/[\u00da\u00d9\u00dc]/g,'U');
    }
    function horaValida(h){ var s=String(h||'').trim(); return s && s!=='-' && s.indexOf(':')>0; }

    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var profs   = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var areas   = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
    var configs = leerHoja(HOJAS.HONORARIO_CONFIG).map(limpiarFila)
      .filter(function(c){ return c.ESTADO === 'ACTIVO'; });

    function nomMed(id){ for(var i=0;i<medicos.length;i++){ if(medicos[i].ID_MEDICO===id) return ((medicos[i].NOMBRES||'')+' '+(medicos[i].APELLIDOS||'')).trim(); } return '\u2014'; }
    function nomProf(id){ for(var i=0;i<profs.length;i++){ if(profs[i].ID_PROFESIONAL===id) return ((profs[i].NOMBRES||'')+' '+(profs[i].APELLIDOS||'')).trim(); } return '\u2014'; }
    function nomEsp(id){ for(var i=0;i<especialidades.length;i++){ if(especialidades[i].ID_ESPECIALIDAD===id) return especialidades[i].ESPECIALIDAD||'\u2014'; } return '\u2014'; }
    function nomArea(id){ for(var i=0;i<areas.length;i++){ if(areas[i].ID_AREA_APOYO===id) return areas[i].NOMBRE||'\u2014'; } return '\u2014'; }
    function modalidadDe(idPer){ for(var i=0;i<configs.length;i++){ if(configs[i].ID_PERSONAL===idPer) return configs[i].MODALIDAD||'-'; } return '-'; }

    // ── 1) Recolectar TODOS los bloques de horario del día (medico + apoyo) ──
    var bloques = [];

    leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila).forEach(function(h){
      if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
      if (String(h.MODALIDAD_TRABAJO||'').toUpperCase()==='VOLANTE') return; // volante: solo marca manual
      if (normDia(h.DIA_SEMANA) !== diaSemana) return;
      if (!horaValida(h.HORA_INICIO) || !horaValida(h.HORA_FIN)) return;
      bloques.push({
        ID_PERSONAL: h.ID_MEDICO, TIPO_PERSONAL: 'MEDICO', NOMBRE: nomMed(h.ID_MEDICO),
        ETIQUETA: nomEsp(h.ID_ESPECIALIDAD), ORIGEN: 'ESPECIALIDAD',
        INI: String(h.HORA_INICIO).trim(), FIN: String(h.HORA_FIN).trim(),
        MODALIDAD_TRABAJO: String(h.MODALIDAD_TRABAJO||'FIJO').toUpperCase()
      });
    });

    leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila).forEach(function(h){
      if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
      if (String(h.MODALIDAD_TRABAJO||'').toUpperCase()==='VOLANTE') return;
      if (normDia(h.DIA_SEMANA) !== diaSemana) return;
      if (!horaValida(h.HORA_INICIO) || !horaValida(h.HORA_FIN)) return;
      var esMed = String(h.TIPO_EJECUTOR||'').toUpperCase()==='MEDICO';
      var idPer = esMed ? h.ID_MEDICO : h.ID_PROFESIONAL;
      bloques.push({
        ID_PERSONAL: idPer, TIPO_PERSONAL: esMed?'MEDICO':'APOYO',
        NOMBRE: esMed?nomMed(idPer):nomProf(idPer),
        ETIQUETA: nomArea(h.ID_AREA_APOYO), ORIGEN: 'AREA_APOYO',
        INI: String(h.HORA_INICIO).trim(), FIN: String(h.HORA_FIN).trim(),
        MODALIDAD_TRABAJO: String(h.MODALIDAD_TRABAJO||'FIJO').toUpperCase()
      });
    });

    // ── 2) AGRUPAR POR PERSONA: una sola fila, etiquetas + rango combinado ──
    // Prima el horario mas temprano (ingreso) y el mas tarde (salida).
    var mapa = {};
    var orden = [];
    bloques.forEach(function(b){
      var k = b.TIPO_PERSONAL + '|' + b.ID_PERSONAL;
      if (!mapa[k]) {
        mapa[k] = {
          ID_PERSONAL: b.ID_PERSONAL, TIPO_PERSONAL: b.TIPO_PERSONAL, NOMBRE: b.NOMBRE,
          MODALIDAD: modalidadDe(b.ID_PERSONAL),
          MODALIDAD_TRABAJO: b.MODALIDAD_TRABAJO,
          ETIQUETAS: [], INGRESO_PREVISTO: b.INI, SALIDA_PREVISTA: b.FIN
        };
        orden.push(k);
      }
      var g = mapa[k];
      g.ETIQUETAS.push({ NOMBRE: b.ETIQUETA, INI: b.INI, FIN: b.FIN, ORIGEN: b.ORIGEN });
      if (b.INI < g.INGRESO_PREVISTO) g.INGRESO_PREVISTO = b.INI;  // el mas temprano
      if (b.FIN > g.SALIDA_PREVISTA)  g.SALIDA_PREVISTA  = b.FIN;  // el mas tarde
      if (b.MODALIDAD_TRABAJO === 'MIXER') g.MODALIDAD_TRABAJO = 'MIXER';
    });

    var lista = orden.map(function(k){
      var g = mapa[k];
      // Fusionar etiquetas repetidas (misma especialidad/area el mismo dia):
      // una sola etiqueta con el inicio mas temprano y el fin mas tarde.
      var porNombre = {}, ordenEt = [];
      g.ETIQUETAS.forEach(function(e){
        var kn = String(e.NOMBRE||'').toUpperCase();
        if (!porNombre[kn]) { porNombre[kn] = { NOMBRE:e.NOMBRE, INI:e.INI, FIN:e.FIN, ORIGEN:e.ORIGEN }; ordenEt.push(kn); }
        else {
          if (e.INI < porNombre[kn].INI) porNombre[kn].INI = e.INI;
          if (e.FIN > porNombre[kn].FIN) porNombre[kn].FIN = e.FIN;
        }
      });
      g.ETIQUETAS = ordenEt.map(function(kn){ return porNombre[kn]; });
      g.ETIQUETAS.sort(function(a,b){ return a.INI < b.INI ? -1 : (a.INI > b.INI ? 1 : 0); });
      g.PREVISTO = g.INGRESO_PREVISTO + '-' + g.SALIDA_PREVISTA;   // rango combinado
      g.AREA_ESP = g.ETIQUETAS.map(function(e){ return e.NOMBRE; }).join(' + '); // compatibilidad
      return g;
    });

    // ── 3) Adjuntar marcaje del dia ──
    var marcas = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila)
      .filter(function(a){ return a.ESTADO!=='ANULADO' && String(a.FECHA).substring(0,10)===fecha; });
    function marcaDe(idPer){ for(var i=0;i<marcas.length;i++){ if(marcas[i].ID_PERSONAL===idPer && String(marcas[i].ES_VOLANTE).toUpperCase()!=='SI') return marcas[i]; } return null; }

    lista.forEach(function(item){
      var mk = marcaDe(item.ID_PERSONAL);
      item.ID_ASISTENCIA = mk ? mk.ID_ASISTENCIA : '';
      item.HORA_INGRESO  = mk ? (mk.HORA_INGRESO||'') : '';
      item.HORA_SALIDA   = mk ? (mk.HORA_SALIDA||'') : '';
      item.ESTADO_MARCA  = mk ? (mk.ESTADO_MARCA||'') : '';
      item.ASISTIO       = mk ? (mk.ASISTIO||'') : '';
    });

    // ── 4) Volantes: solo los marcados manualmente ese dia ──
    var volantes = marcas.filter(function(a){ return String(a.ES_VOLANTE).toUpperCase()==='SI'; }).map(function(a){
      return {
        ID_PERSONAL: a.ID_PERSONAL, TIPO_PERSONAL: a.TIPO_PERSONAL, NOMBRE: a.NOMBRE_PERSONAL,
        AREA_ESP: '', ETIQUETAS: [], MODALIDAD: modalidadDe(a.ID_PERSONAL), MODALIDAD_TRABAJO:'VOLANTE',
        PREVISTO: '', INGRESO_PREVISTO:'', SALIDA_PREVISTA:'',
        ID_ASISTENCIA: a.ID_ASISTENCIA, HORA_INGRESO: a.HORA_INGRESO||'', HORA_SALIDA: a.HORA_SALIDA||'',
        ESTADO_MARCA: a.ESTADO_MARCA||'', ASISTIO: a.ASISTIO||'', ES_VOLANTE:'SI'
      };
    });

    lista.sort(function(a,b){ return String(a.NOMBRE).localeCompare(String(b.NOMBRE)); });
    return respuestaOK({ fecha: fecha, dia: diaSemana, conHorario: lista, volantes: volantes });
  } catch (err) { return respuestaError('Error al leer personal del d\u00eda: ' + err.message); }
}

// Calcula el estado del marcaje comparando ingreso real vs previsto
function _asCalcEstado(previsto, horaIngreso, esVolante) {
  if (esVolante) return 'EXTRA';
  if (!horaIngreso) return 'PENDIENTE';
  if (!previsto || previsto.indexOf('-')<0) return 'REGISTRADO';
  var pIni = previsto.split('-')[0];                 // "08:00"
  var hi = String(horaIngreso).substring(0,5);       // "08:03"
  if (hi > pIni) return 'TARDANZA';
  return 'A_TIEMPO';
}

// Marca INGRESO (sella hora exacta). Crea el registro si no existe.
function asMarcarIngreso(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_PERSONAL || !params.FECHA) { lock.releaseLock(); return respuestaError('Faltan datos.'); }
    _asGarantizarColumnas();

    var esVolante = String(params.ES_VOLANTE).toUpperCase()==='SI';
    var horaExacta = getFecha('hora');
    var estadoMarca = _asCalcEstado(params.PREVISTO||'', horaExacta, esVolante);

    // ¿Ya existe registro de ese personal ese día?
    var registros = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila);
    var existente = null;
    for (var i=0;i<registros.length;i++){
      if (registros[i].ESTADO!=='ANULADO' && registros[i].ID_PERSONAL===params.ID_PERSONAL &&
          String(registros[i].FECHA).substring(0,10)===params.FECHA) { existente = registros[i]; break; }
    }

    if (existente) {
      actualizarFila(HOJAS.ASISTENCIA_PERSONAL, 'ID_ASISTENCIA', existente.ID_ASISTENCIA, {
        HORA_INGRESO: horaExacta, ESTADO_MARCA: estadoMarca, ASISTIO: 'SI'
      });
      lock.releaseLock();
      return respuestaOK({ ID_ASISTENCIA: existente.ID_ASISTENCIA, hora: horaExacta, estado: estadoMarca }, 'Ingreso marcado: ' + horaExacta);
    }

    var id = generarID(HOJAS.ASISTENCIA_PERSONAL, 'ID_ASISTENCIA', 'AS', 4);
    insertarFila(HOJAS.ASISTENCIA_PERSONAL, {
      ID_ASISTENCIA: id, TIPO_PERSONAL: String(params.TIPO_PERSONAL||'MEDICO').toUpperCase(),
      ID_PERSONAL: params.ID_PERSONAL, NOMBRE_PERSONAL: String(params.NOMBRE_PERSONAL||'-').toUpperCase(),
      FECHA: params.FECHA, TURNO: 'ÚNICO', HORAS: '0', ASISTIO: 'SI',
      OBSERVACION: '-', ESTADO: 'ACTIVO', USUARIO: params.usuario||'-', FECHA_REGISTRO: getFecha('datetime'),
      HORA_INGRESO: horaExacta, HORA_SALIDA: '', HORARIO_PREVISTO: params.PREVISTO||'',
      ESTADO_MARCA: estadoMarca, ES_VOLANTE: esVolante?'SI':'NO'
    });
    lock.releaseLock();
    return respuestaOK({ ID_ASISTENCIA: id, hora: horaExacta, estado: estadoMarca }, 'Ingreso marcado: ' + horaExacta);
  } catch (err) { try{lock.releaseLock();}catch(e){} return respuestaError('Error al marcar ingreso: ' + err.message); }
}

// Marca SALIDA (sella hora exacta) y calcula horas trabajadas
function asMarcarSalida(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_ASISTENCIA) { lock.releaseLock(); return respuestaError('Marque primero el ingreso.'); }
    _asGarantizarColumnas();

    var horaExacta = getFecha('hora');
    // Calcular horas trabajadas (ingreso → salida)
    var registros = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila);
    var reg = null;
    for (var i=0;i<registros.length;i++){ if (registros[i].ID_ASISTENCIA===params.ID_ASISTENCIA){ reg=registros[i]; break; } }
    var horas = 0;
    if (reg && reg.HORA_INGRESO) {
      horas = _asHorasEntre(reg.HORA_INGRESO, horaExacta);
    }
    actualizarFila(HOJAS.ASISTENCIA_PERSONAL, 'ID_ASISTENCIA', params.ID_ASISTENCIA, {
      HORA_SALIDA: horaExacta, HORAS: horas.toFixed(2)
    });
    lock.releaseLock();
    return respuestaOK({ hora: horaExacta, horas: horas.toFixed(2) }, 'Salida marcada: ' + horaExacta);
  } catch (err) { try{lock.releaseLock();}catch(e){} return respuestaError('Error al marcar salida: ' + err.message); }
}

// Horas decimales entre dos "HH:mm:ss"
function _asHorasEntre(ini, fin) {
  function seg(t){ var p=String(t).split(':'); return (parseInt(p[0],10)||0)*3600+(parseInt(p[1],10)||0)*60+(parseInt(p[2],10)||0); }
  var d = seg(fin) - seg(ini);
  if (d < 0) d = 0;
  return d/3600;
}

// Marca AUSENTE (faltó)
function asMarcarAusente(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_PERSONAL || !params.FECHA) { lock.releaseLock(); return respuestaError('Faltan datos.'); }
    _asGarantizarColumnas();

    var registros = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila);
    var existente = null;
    for (var i=0;i<registros.length;i++){
      if (registros[i].ESTADO!=='ANULADO' && registros[i].ID_PERSONAL===params.ID_PERSONAL &&
          String(registros[i].FECHA).substring(0,10)===params.FECHA) { existente = registros[i]; break; }
    }
    if (existente) {
      actualizarFila(HOJAS.ASISTENCIA_PERSONAL, 'ID_ASISTENCIA', existente.ID_ASISTENCIA, {
        ASISTIO:'NO', ESTADO_MARCA:'AUSENTE', HORA_INGRESO:'', HORA_SALIDA:'', HORAS:'0'
      });
      lock.releaseLock();
      return respuestaOK({ ID_ASISTENCIA: existente.ID_ASISTENCIA }, 'Marcado como ausente.');
    }
    var id = generarID(HOJAS.ASISTENCIA_PERSONAL, 'ID_ASISTENCIA', 'AS', 4);
    insertarFila(HOJAS.ASISTENCIA_PERSONAL, {
      ID_ASISTENCIA: id, TIPO_PERSONAL: String(params.TIPO_PERSONAL||'MEDICO').toUpperCase(),
      ID_PERSONAL: params.ID_PERSONAL, NOMBRE_PERSONAL: String(params.NOMBRE_PERSONAL||'-').toUpperCase(),
      FECHA: params.FECHA, TURNO:'ÚNICO', HORAS:'0', ASISTIO:'NO',
      OBSERVACION:'-', ESTADO:'ACTIVO', USUARIO: params.usuario||'-', FECHA_REGISTRO: getFecha('datetime'),
      HORA_INGRESO:'', HORA_SALIDA:'', HORARIO_PREVISTO: params.PREVISTO||'', ESTADO_MARCA:'AUSENTE', ES_VOLANTE:'NO'
    });
    lock.releaseLock();
    return respuestaOK({ ID_ASISTENCIA: id }, 'Marcado como ausente.');
  } catch (err) { try{lock.releaseLock();}catch(e){} return respuestaError('Error: ' + err.message); }
}

// Corregir / anular un marcaje (para errores)
function asCorregirMarca(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    if (!_puedeModulo(params, 'Honorarios')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    // Solo ADMINISTRADOR o GESTOR DE SERVICIOS pueden corregir/anular marcajes
    var rolC = String((params._sesion && params._sesion.ROL) || params.rol || '').toUpperCase();
    if (rolC !== 'ADMINISTRADOR' && rolC !== 'GESTOR DE SERVICIOS') {
      lock.releaseLock();
      return respuestaError('Solo Administrador o Gestor de Servicios puede corregir un marcaje.', 'ERR_PERMISO');
    }
    if (!params.ID_ASISTENCIA) { lock.releaseLock(); return respuestaError('ID requerido.'); }
    var cambios = {};
    if (params.HORA_INGRESO !== undefined) cambios.HORA_INGRESO = params.HORA_INGRESO;
    if (params.HORA_SALIDA  !== undefined) cambios.HORA_SALIDA  = params.HORA_SALIDA;
    // Recalcular estado y horas si corresponde
    if (params.HORA_INGRESO !== undefined || params.PREVISTO !== undefined) {
      cambios.ESTADO_MARCA = _asCalcEstado(params.PREVISTO||'', params.HORA_INGRESO||'', String(params.ES_VOLANTE).toUpperCase()==='SI');
    }
    if (params.HORA_INGRESO && params.HORA_SALIDA) {
      cambios.HORAS = _asHorasEntre(params.HORA_INGRESO, params.HORA_SALIDA).toFixed(2);
    }
    if (params.anular === true || params.anular === 'SI') { cambios.ESTADO = 'ANULADO'; }
    actualizarFila(HOJAS.ASISTENCIA_PERSONAL, 'ID_ASISTENCIA', params.ID_ASISTENCIA, cambios);
    lock.releaseLock();
    return respuestaOK({}, params.anular ? 'Marcaje anulado.' : 'Marcaje corregido.');
  } catch (err) { try{lock.releaseLock();}catch(e){} return respuestaError('Error: ' + err.message); }
}

// Buscar personal para agregar como volante (todo médico/profesional activo)
function asBuscarVolantes(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var q = String(params.q||'').toUpperCase();

    // Solo personal CONFIGURADO COMO VOLANTE (tiene al menos un horario con MODALIDAD_TRABAJO = VOLANTE)
    var esVol = {};
    // Un horario es VOLANTE si: modalidad=VOLANTE, o quedo marcado el dia/hora de volante.
    // (Respaldo por si la columna MODALIDAD_TRABAJO no existia al guardar.)
    function _esFilaVolante(h){
      return String(h.MODALIDAD_TRABAJO||'').toUpperCase()==='VOLANTE' ||
             String(h.DIA_SEMANA||'').toUpperCase()==='VOLANTE' ||
             String(h.HORA_INICIO||'').trim()==='-';
    }
    leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila).forEach(function(h){
      if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
      if (!_esFilaVolante(h)) return;
      if (h.ID_MEDICO) esVol['MEDICO|'+h.ID_MEDICO] = true;
    });
    leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila).forEach(function(h){
      if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
      if (!_esFilaVolante(h)) return;
      var esMed = String(h.TIPO_EJECUTOR||'').toUpperCase()==='MEDICO';
      var idPer = esMed ? h.ID_MEDICO : h.ID_PROFESIONAL;
      if (idPer) esVol[(esMed?'MEDICO|':'APOYO|')+idPer] = true;
    });

    var out = [];
    leerHoja(HOJAS.MEDICO).map(limpiarFila).forEach(function(m){
      if (!m.ID_MEDICO || String(m.ESTADO||'').toUpperCase()==='INACTIVO') return;
      if (!esVol['MEDICO|'+m.ID_MEDICO]) return;
      var nom = ((m.NOMBRES||'')+' '+(m.APELLIDOS||'')).trim();
      if (!q || nom.toUpperCase().indexOf(q)>=0) out.push({ ID_PERSONAL:m.ID_MEDICO, TIPO_PERSONAL:'MEDICO', NOMBRE:nom });
    });
    leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila).forEach(function(p){
      if (!p.ID_PROFESIONAL || String(p.ESTADO||'').toUpperCase()==='INACTIVO') return;
      if (!esVol['APOYO|'+p.ID_PROFESIONAL]) return;
      var nom = ((p.NOMBRES||'')+' '+(p.APELLIDOS||'')).trim();
      if (!q || nom.toUpperCase().indexOf(q)>=0) out.push({ ID_PERSONAL:p.ID_PROFESIONAL, TIPO_PERSONAL:'APOYO', NOMBRE:nom });
    });
    out.sort(function(a,b){ return String(a.NOMBRE).localeCompare(String(b.NOMBRE)); });
    return respuestaOK(out.slice(0,50), out.length + ' volante(s).');
  } catch (err) { return respuestaError('Error: ' + err.message); }
}

// Listar el mes completo de marcajes (para vista de calendario e historial)
function asListarMes(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.mes) return respuestaError('Indique el mes (YYYY-MM).');
    var lista = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila)
      .filter(function(a){ return a.ID_ASISTENCIA && a.ESTADO!=='ANULADO' && String(a.FECHA).substring(0,7)===params.mes; });
    // Conteo por día para pintar el calendario
    var porDia = {};
    lista.forEach(function(a){
      var d = String(a.FECHA).substring(0,10);
      if (!porDia[d]) porDia[d] = { total:0, presentes:0, ausentes:0, tardanzas:0, nombres:[] };
      porDia[d].total++;
      if (String(a.ASISTIO).toUpperCase()==='NO') porDia[d].ausentes++;
      else porDia[d].presentes++;
      if (String(a.ESTADO_MARCA).toUpperCase()==='TARDANZA') porDia[d].tardanzas++;
      // Nombre corto + estado para mini lista en la celda
      var nom = String(a.NOMBRE_PERSONAL||'').split(' ');
      var corto = (nom[0]||'')+' '+((nom[2]||nom[1]||'').charAt(0)+'.');
      porDia[d].nombres.push({
        nombre: corto.trim(),
        ingreso: a.HORA_INGRESO || '',
        estado: a.ESTADO_MARCA || '',
        ausente: String(a.ASISTIO).toUpperCase()==='NO'
      });
    });
    return respuestaOK({ mes: params.mes, registros: lista, porDia: porDia });
  } catch (err) { return respuestaError('Error: ' + err.message); }
}


// ════════════════════════════════════════════════════════════════════════
//  FASE 2 — Resumen mensual de asistencia AGRUPADO POR PERSONA
//  Para el reporte imprimible y la exportación a Excel.
// ════════════════════════════════════════════════════════════════════════
function asResumenMesPorPersona(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.mes) return respuestaError('Indique el mes (YYYY-MM).');

    var lista = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila)
      .filter(function(a){ return a.ID_ASISTENCIA && a.ESTADO !== 'ANULADO' && String(a.FECHA).substring(0,7) === params.mes; });

    var porPersona = {};
    lista.forEach(function(a){
      var id = a.ID_PERSONAL;
      if (!porPersona[id]) {
        porPersona[id] = {
          ID_PERSONAL: id, NOMBRE: a.NOMBRE_PERSONAL || id, TIPO: a.TIPO_PERSONAL || '',
          dias: 0, horas: 0, tardanzas: 0, ausencias: 0, aTiempo: 0, turnosExtra: 0, detalle: []
        };
      }
      var p = porPersona[id];
      var estado = String(a.ESTADO_MARCA || '').toUpperCase();
      var ausente = String(a.ASISTIO).toUpperCase() === 'NO';
      if (ausente) { p.ausencias++; }
      else {
        p.dias++;
        p.horas += (parseFloat(a.HORAS) || 0);
        if (estado === 'TARDANZA') p.tardanzas++;
        else if (estado === 'A_TIEMPO') p.aTiempo++;
        if (String(a.ES_VOLANTE).toUpperCase() === 'SI') p.turnosExtra++;
      }
      p.detalle.push({
        fecha: String(a.FECHA).substring(0,10), ingreso: a.HORA_INGRESO || '', salida: a.HORA_SALIDA || '',
        horas: a.HORAS || '0', estado: estado, ausente: ausente, volante: String(a.ES_VOLANTE).toUpperCase()==='SI'
      });
    });

    // Convertir a array ordenado por nombre
    var arr = Object.keys(porPersona).map(function(k){
      var p = porPersona[k];
      p.horas = Math.round(p.horas * 100) / 100;
      p.detalle.sort(function(a,b){ return a.fecha < b.fecha ? -1 : 1; });
      return p;
    }).sort(function(a,b){ return String(a.NOMBRE).localeCompare(String(b.NOMBRE)); });

    // Totales generales
    var tot = { personas: arr.length, dias: 0, horas: 0, tardanzas: 0, ausencias: 0 };
    arr.forEach(function(p){ tot.dias += p.dias; tot.horas += p.horas; tot.tardanzas += p.tardanzas; tot.ausencias += p.ausencias; });
    tot.horas = Math.round(tot.horas * 100) / 100;

    return respuestaOK({ mes: params.mes, personas: arr, totales: tot });
  } catch (err) { return respuestaError('Error en resumen mensual: ' + err.message); }
}


// ════════════════════════════════════════════════════════════════════════
//  FASE 3a+ — REGLAS DE COMISIÓN POR SERVICIO
// ════════════════════════════════════════════════════════════════════════

// Listar reglas de comisión de un personal (o todas)
function listarComisionReglas(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var reglas = leerHoja(HOJAS.COMISION_REGLA).map(limpiarFila)
      .filter(function(r){ return r.ID_COMISION_REGLA && r.ESTADO !== 'INACTIVO'; });
    if (params.ID_PERSONAL) {
      reglas = reglas.filter(function(r){ return r.ID_PERSONAL === params.ID_PERSONAL; });
    }
    return respuestaOK(reglas, reglas.length + ' regla(s).');
  } catch (err) { return respuestaError('Error al listar reglas: ' + err.message); }
}

// Guardar (crear) una regla de comisión por servicio
function guardarComisionRegla(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : (params.rol||'');
    if (String(rol).toUpperCase() !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el Administrador.', 'ERR_PERMISO'); }

    if (!params.ID_PERSONAL) { lock.releaseLock(); return respuestaError('Falta el personal.'); }
    if (!params.ID_SERVICIO) { lock.releaseLock(); return respuestaError('Seleccione el servicio o paquete.'); }
    var tipoItem = String(params.TIPO_ITEM || 'SERVICIO').toUpperCase();
    if (['SERVICIO','PAQUETE'].indexOf(tipoItem) < 0) tipoItem = 'SERVICIO';
    var tipoCalc = String(params.TIPO_CALCULO || 'PORCENTAJE').toUpperCase();
    if (['PORCENTAJE','MONTO_FIJO'].indexOf(tipoCalc) < 0) { lock.releaseLock(); return respuestaError('Tipo de cálculo no válido.'); }
    var valor = parseFloat(params.VALOR) || 0;
    if (valor <= 0) { lock.releaseLock(); return respuestaError('Indique el valor de la comisión.'); }
    if (tipoCalc === 'PORCENTAJE' && valor > 100) { lock.releaseLock(); return respuestaError('El porcentaje no puede superar 100.'); }

    // Evitar duplicado: mismo personal + servicio activo
    var existentes = leerHoja(HOJAS.COMISION_REGLA).map(limpiarFila);
    for (var i = 0; i < existentes.length; i++) {
      if (existentes[i].ESTADO !== 'INACTIVO' && existentes[i].ID_PERSONAL === params.ID_PERSONAL && existentes[i].ID_SERVICIO === params.ID_SERVICIO) {
        // Actualizar la existente en vez de duplicar
        actualizarFila(HOJAS.COMISION_REGLA, 'ID_COMISION_REGLA', existentes[i].ID_COMISION_REGLA, {
          TIPO_CALCULO: tipoCalc, VALOR: valor.toFixed(2)
        });
        lock.releaseLock();
        return respuestaOK({ ID_COMISION_REGLA: existentes[i].ID_COMISION_REGLA, actualizada: true }, 'Regla actualizada.');
      }
    }

    var id = generarID(HOJAS.COMISION_REGLA, 'ID_COMISION_REGLA', 'CR', 4);
    insertarFila(HOJAS.COMISION_REGLA, {
      ID_COMISION_REGLA: id,
      ID_PERSONAL:     params.ID_PERSONAL,
      TIPO_PERSONAL:   String(params.TIPO_PERSONAL || 'MEDICO').toUpperCase(),
      TIPO_ITEM:       tipoItem,
      ID_SERVICIO:     params.ID_SERVICIO,
      NOMBRE_SERVICIO: String(params.NOMBRE_SERVICIO || '-').toUpperCase(),
      TIPO_CALCULO:    tipoCalc,
      VALOR:           valor.toFixed(2),
      ESTADO:          'ACTIVO',
      FECHA_REGISTRO:  getFecha('fecha'),
    });
    lock.releaseLock();
    return respuestaOK({ ID_COMISION_REGLA: id }, 'Regla de comisión agregada.');
  } catch (err) { try{lock.releaseLock();}catch(e){} return respuestaError('Error al guardar regla: ' + err.message); }
}

// Eliminar (desactivar) una regla de comisión
function eliminarComisionRegla(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : (params.rol||'');
    if (String(rol).toUpperCase() !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el Administrador.', 'ERR_PERMISO'); }
    if (!params.ID_COMISION_REGLA) { lock.releaseLock(); return respuestaError('ID requerido.'); }
    actualizarFila(HOJAS.COMISION_REGLA, 'ID_COMISION_REGLA', params.ID_COMISION_REGLA, { ESTADO: 'INACTIVO' });
    lock.releaseLock();
    return respuestaOK({}, 'Regla eliminada.');
  } catch (err) { try{lock.releaseLock();}catch(e){} return respuestaError('Error: ' + err.message); }
}


// ════════════════════════════════════════════════════════════════════════
//  FASE 3b — PRE-CÁLCULO DE HONORARIO (para validar ANTES de pagar)
//  Suma: presencia (desde asistencia) + comisiones (desde ventas por servicio)
//  NO paga: solo devuelve el desglose para que el usuario valide.
// ════════════════════════════════════════════════════════════════════════
function precalcularHonorario(params) {
  try {
    if (!_puedeModulo(params, 'Honorarios')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_PERSONAL) return respuestaError('Seleccione el personal.');
    if (!params.desde || !params.hasta) return respuestaError('Indique el período (desde y hasta).');

    var idPer = params.ID_PERSONAL;
    var desde = params.desde, hasta = params.hasta;

    // Datos de configuración de la persona
    var config = leerHoja(HOJAS.HONORARIO_CONFIG).map(limpiarFila)
      .filter(function(c){ return c.ESTADO === 'ACTIVO' && c.ID_PERSONAL === idPer; })[0];
    if (!config) return respuestaError('Este personal no tiene configuración de honorarios activa.');

    var nombre = config.NOMBRE_PERSONAL || idPer;

    // ── 1. PRESENCIA (desde asistencia) ──
    var presencia = _calcularPresenciaPersona(idPer, config, desde, hasta);

    // ── 2. COMISIONES (desde ventas cruzadas con reglas por servicio) ──
    var comisiones = _calcularComisionesPersona(idPer, desde, hasta);

    var totalPresencia = presencia.monto;
    var totalComisiones = comisiones.total;
    var totalPagar = totalPresencia + totalComisiones;

    return respuestaOK({
      ID_PERSONAL: idPer, NOMBRE: nombre, TIPO_PERSONAL: config.TIPO_PERSONAL || '',
      periodo: { desde: desde, hasta: hasta },
      presencia: presencia,
      comisiones: comisiones,
      totalPresencia: Math.round(totalPresencia * 100) / 100,
      totalComisiones: Math.round(totalComisiones * 100) / 100,
      totalPagar: Math.round(totalPagar * 100) / 100
    });
  } catch (err) { return respuestaError('Error en pre-cálculo: ' + err.message); }
}

// Calcula el pago por presencia según la modalidad y la asistencia del período
function _calcularPresenciaPersona(idPer, config, desde, hasta) {
  var modPres = String(config.MODALIDAD_PRESENCIA || (config.MODALIDAD !== 'PORCENTAJE' ? config.MODALIDAD : 'NINGUNO')).toUpperCase();
  var montoPres = parseFloat(config.MONTO_PRESENCIA || (config.MODALIDAD !== 'PORCENTAJE' ? config.MONTO : 0)) || 0;

  if (modPres === 'NINGUNO' || !modPres) {
    return { modalidad: 'NINGUNO', monto: 0, detalle: 'Sin pago por presencia', dias: 0, horas: 0 };
  }

  // Leer asistencia del período (no anulada, presente)
  var asist = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila).filter(function(a){
    if (!a.ID_ASISTENCIA || a.ESTADO === 'ANULADO') return false;
    if (a.ID_PERSONAL !== idPer) return false;
    var f = String(a.FECHA).substring(0,10);
    if (f < desde || f > hasta) return false;
    return String(a.ASISTIO).toUpperCase() !== 'NO';
  });

  var dias = asist.length;
  var horas = 0;
  asist.forEach(function(a){ horas += parseFloat(a.HORAS) || 0; });
  horas = Math.round(horas * 100) / 100;

  var monto = 0, detalle = '';
  if (modPres === 'SUELDO_FIJO') {
    monto = montoPres; // sueldo mensual completo
    detalle = 'Sueldo fijo mensual';
  } else if (modPres === 'POR_TURNO') {
    monto = dias * montoPres; // un turno por día trabajado
    detalle = dias + ' turno(s) × S/ ' + montoPres.toFixed(2);
  } else if (modPres === 'POR_HORA') {
    monto = horas * montoPres;
    detalle = horas + ' h × S/ ' + montoPres.toFixed(2);
  }

  return {
    modalidad: modPres, monto: Math.round(monto * 100) / 100, detalle: detalle,
    dias: dias, horas: horas, montoUnitario: montoPres
  };
}

// Calcula las comisiones cruzando las reglas por servicio con las ventas del período
function _calcularComisionesPersona(idPer, desde, hasta) {
  // Reglas de comisión de esta persona
  var reglas = leerHoja(HOJAS.COMISION_REGLA).map(limpiarFila)
    .filter(function(r){ return r.ID_COMISION_REGLA && r.ESTADO !== 'INACTIVO' && r.ID_PERSONAL === idPer; });
  if (!reglas.length) return { total: 0, porServicio: [], detalleVentas: [] };

  // Mapa rápido: por servicio y por paquete
  var reglaServicio = {}, reglaPaquete = {};
  reglas.forEach(function(r){
    if (String(r.TIPO_ITEM||'SERVICIO').toUpperCase()==='PAQUETE') reglaPaquete[r.ID_SERVICIO] = r;
    else reglaServicio[r.ID_SERVICIO] = r;
  });

  // Ventas del período (activas/pagadas)
  var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila).filter(function(v){
    if (!v.ID_VENTA || v.ESTADO === 'ANULADO' || v.ESTADO === 'ANULADA') return false;
    var f = String(v.FECHA_VENTA).substring(0,10);
    return f >= desde && f <= hasta;
  });
  var ventaFecha = {}; ventas.forEach(function(v){ ventaFecha[v.ID_VENTA] = String(v.FECHA_VENTA).substring(0,10); });
  var ventasIds = {}; ventas.forEach(function(v){ ventasIds[v.ID_VENTA] = true; });

  // Detalle de ventas (DVENTA): líneas donde esta persona fue ejecutor y el ítem tiene regla
  var detalles = leerHoja(HOJAS.DVENTA).map(limpiarFila).filter(function(d){
    if (!d.ID_VENTA || !ventasIds[d.ID_VENTA] || d.ID_EJECUTOR !== idPer) return false;
    var esPaq = String(d.TIPO||'').toUpperCase()==='PAQUETE';
    if (esPaq) return !!reglaPaquete[d.ID_PAQUETE];
    return !!reglaServicio[d.ID_SERVICIO];
  });

  var porServicio = {}; // clave -> {nombre, tipo, valor, nVentas, base, comision}
  var detalleVentas = [];
  detalles.forEach(function(d){
    var esPaq = String(d.TIPO||'').toUpperCase()==='PAQUETE';
    var r = esPaq ? reglaPaquete[d.ID_PAQUETE] : reglaServicio[d.ID_SERVICIO];
    var idItem = esPaq ? d.ID_PAQUETE : d.ID_SERVICIO;
    var base = parseFloat(d.SUBTOTAL) || 0;
    var comision = 0;
    if (String(r.TIPO_CALCULO).toUpperCase() === 'MONTO_FIJO') {
      comision = parseFloat(r.VALOR) || 0; // monto fijo por ítem realizado
    } else {
      comision = base * ((parseFloat(r.VALOR) || 0) / 100);
    }
    comision = Math.round(comision * 100) / 100;

    var clave = (esPaq?'P:':'S:') + idItem;
    if (!porServicio[clave]) {
      porServicio[clave] = {
        ID_SERVICIO: idItem, TIPO_ITEM: esPaq?'PAQUETE':'SERVICIO',
        nombre: (r.NOMBRE_SERVICIO || idItem) + (esPaq?' 📦':''),
        tipo: r.TIPO_CALCULO, valor: r.VALOR, nVentas: 0, base: 0, comision: 0
      };
    }
    var ps = porServicio[clave];
    ps.nVentas++; ps.base += base; ps.comision += comision;

    detalleVentas.push({
      ID_VENTA: d.ID_VENTA, ID_SERVICIO: idItem, TIPO_ITEM: esPaq?'PAQUETE':'SERVICIO',
      fecha: ventaFecha[d.ID_VENTA] || '', servicio: (r.NOMBRE_SERVICIO || idItem) + (esPaq?' 📦':''),
      base: base, tipo: r.TIPO_CALCULO, valor: r.VALOR, comision: comision
    });
  });

  var arrServicio = Object.keys(porServicio).map(function(k){
    var ps = porServicio[k];
    ps.base = Math.round(ps.base * 100) / 100;
    ps.comision = Math.round(ps.comision * 100) / 100;
    return ps;
  }).sort(function(a,b){ return String(a.nombre).localeCompare(String(b.nombre)); });

  var total = 0; arrServicio.forEach(function(ps){ total += ps.comision; });
  detalleVentas.sort(function(a,b){ return a.fecha < b.fecha ? -1 : 1; });

  return { total: Math.round(total * 100) / 100, porServicio: arrServicio, detalleVentas: detalleVentas };
}


// ════════════════════════════════════════════════════════════════════════
//  FASE 3b — CONFIRMAR PAGO (tras validar el pre-cálculo)
//  Registra el pago total (presencia + comisiones) pasando por caja.
//  Marca las comisiones incluidas para no volver a pagarlas.
// ════════════════════════════════════════════════════════════════════════
function confirmarPagoHonorario(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : (params.rol||'');
    if (String(rol).toUpperCase() !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el Administrador puede pagar honorarios.', 'ERR_PERMISO'); }

    if (!params.ID_PERSONAL) { lock.releaseLock(); return respuestaError('Falta el personal.'); }
    var totalPagar = parseFloat(params.totalPagar) || 0;
    if (totalPagar <= 0) { lock.releaseLock(); return respuestaError('El monto a pagar debe ser mayor a 0.'); }

    // Verificar caja abierta
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) { if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; } }
    if (!abierta) { lock.releaseLock(); return respuestaError('No hay caja abierta. Abra la caja primero.'); }

    var totalPresencia = parseFloat(params.totalPresencia) || 0;
    var totalComisiones = parseFloat(params.totalComisiones) || 0;
    var nombre = String(params.NOMBRE_PERSONAL || params.ID_PERSONAL).toUpperCase();

    // 1. Egreso en CAJA
    var idCaja = generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4);
    var obsCaja = 'PAGO HONORARIO: ' + nombre + ' | Presencia S/' + totalPresencia.toFixed(2) + ' + Comisiones S/' + totalComisiones.toFixed(2);
    insertarFila(HOJAS.CAJA, {
      ID_CAJA: idCaja, ID_APERTURA: abierta.ID_APERTURA, FECHA: getFecha('fecha'), HORA: getFecha('hora'),
      TURNO: abierta.TURNO || 'ÚNICO', TIPO: 'EGRESO', ID_TCONCEPTO_CAJA: params.ID_TCONCEPTO_CAJA || '-',
      ID_VENTA: '-', MODO_PAGO: params.MODO_PAGO || 'EFECTIVO', MONTO: totalPagar.toFixed(2),
      USUARIO: params.usuario || '-', ESTADO: 'ACTIVO', OBSERVACIONES: obsCaja,
    });

    // 2. Registro del pago de honorario
    var idPago = generarID(HOJAS.PAGO_HONORARIO, 'ID_PAGO_HONORARIO', 'PH', 4);
    insertarFila(HOJAS.PAGO_HONORARIO, {
      ID_PAGO_HONORARIO: idPago, TIPO_PERSONAL: String(params.TIPO_PERSONAL || 'MEDICO').toUpperCase(),
      ID_PERSONAL: params.ID_PERSONAL, NOMBRE_PERSONAL: nombre,
      PERIODO_DESDE: params.desde || '-', PERIODO_HASTA: params.hasta || '-',
      MODALIDAD: 'MIXTO', MONTO: totalPagar.toFixed(2), MODO_PAGO: params.MODO_PAGO || 'EFECTIVO',
      ID_CAJA: idCaja, OBSERVACION: obsCaja, ESTADO: 'PAGADO',
      USUARIO: params.usuario || '-', FECHA_PAGO: getFecha('datetime'),
    });

    // 3. Registrar/marcar las comisiones incluidas en este pago (trazabilidad)
    if (params.detalleVentas) {
      var det = params.detalleVentas;
      if (typeof det === 'string') { try { det = JSON.parse(det); } catch(e){ det = []; } }
      (det || []).forEach(function(dv){
        var idc = generarID(HOJAS.COMISION_VENTA, 'ID_COMISION', 'CV', 5);
        insertarFila(HOJAS.COMISION_VENTA, {
          ID_COMISION: idc, ID_VENTA: dv.ID_VENTA || '-', ID_SERVICIO: dv.ID_SERVICIO || '-',
          SERVICIO_NOMBRE: String(dv.servicio||'-').toUpperCase(), ID_MEDICO: params.ID_PERSONAL,
          NOMBRE_MEDICO: nombre, TIPO_EJECUTOR: String(params.TIPO_PERSONAL||'MEDICO').toUpperCase(),
          BASE_VENTA: (parseFloat(dv.base)||0).toFixed(2), TIPO_CALCULO: dv.tipo||'-', VALOR: dv.valor||'0',
          MONTO_COMISION: (parseFloat(dv.comision)||0).toFixed(2), ESTADO: 'PAGADO', ID_PAGO_HONORARIO: idPago,
          OBSERVACION: 'INCLUIDA EN PAGO ' + idPago, USUARIO: params.usuario||'-', FECHA_REGISTRO: getFecha('datetime'),
        });
      });
    }

    lock.releaseLock();
    return respuestaOK({ ID_PAGO_HONORARIO: idPago, ID_CAJA: idCaja, total: totalPagar.toFixed(2) },
      'Pago registrado: S/ ' + totalPagar.toFixed(2) + ' (Presencia S/' + totalPresencia.toFixed(2) + ' + Comisiones S/' + totalComisiones.toFixed(2) + ')');
  } catch (err) { try{lock.releaseLock();}catch(e){} return respuestaError('Error al confirmar pago: ' + err.message); }
}
