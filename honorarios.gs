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
    if (['ADMINISTRADOR','CAJERO'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }

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
    if (['ADMINISTRADOR','CAJERO'].indexOf(rol) < 0) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var lista = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila)
      .filter(function(co){ return co.ID_COMISION && String(co.ID_COMISION).trim() !== '' && co.ESTADO !== 'ANULADA'; });
    if (params.ID_MEDICO) lista = lista.filter(function(co){ return co.ID_MEDICO === params.ID_MEDICO; });
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
    if (!params.ID_MEDICO) { lock.releaseLock(); return respuestaError('Médico requerido.'); }

    // Verificar caja abierta
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) { if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; } }
    if (!abierta) { lock.releaseLock(); return respuestaError('No hay caja abierta. Abra la caja primero.'); }

    // Comisiones pendientes del médico
    var coms = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila)
      .filter(function(co){ return co.ID_MEDICO === params.ID_MEDICO && co.ESTADO === 'PENDIENTE'; });
    if (!coms.length) { lock.releaseLock(); return respuestaError('Este médico no tiene comisiones pendientes.'); }

    var total = 0, nombre = '';
    coms.forEach(function(co){ total += (parseFloat(co.MONTO_COMISION)||0); nombre = co.NOMBRE_MEDICO; });
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
      ID_PAGO_HONORARIO: idPago, TIPO_PERSONAL: 'MEDICO', ID_PERSONAL: params.ID_MEDICO,
      NOMBRE_PERSONAL: String(nombre).toUpperCase(), PERIODO_DESDE: params.desde || '-', PERIODO_HASTA: params.hasta || '-',
      MODALIDAD: 'PORCENTAJE', MONTO: total.toFixed(2), MODO_PAGO: params.MODO_PAGO || 'EFECTIVO',
      ID_CAJA: idCaja, OBSERVACION: 'PAGO DE ' + coms.length + ' COMISIÓN(ES)', ESTADO: 'PAGADO',
      USUARIO: params.usuario || '-', FECHA_PAGO: getFecha('datetime'),
    });

    // 3. Marcar cada comisión como PAGADA (apuntando al pago)
    coms.forEach(function(co){
      actualizarFila(HOJAS.COMISION_VENTA, 'ID_COMISION', co.ID_COMISION, { ESTADO: 'PAGADA', ID_PAGO_HONORARIO: idPago });
    });

    lock.releaseLock();
    return respuestaOK({ ID_PAGO_HONORARIO: idPago, total: total.toFixed(2), cantidad: coms.length },
                       'Pagadas ' + coms.length + ' comisión(es): S/ ' + total.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al pagar comisiones: ' + err.message);
  }
}
