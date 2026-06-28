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
    if (!_puedeModulo(params, 'Finanzas')) {
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
    if (!_puedeModulo(params, 'Finanzas')) {
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
    if (!_puedeModulo(params, 'Finanzas')) {
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

// ════════════════════════════════════════════════════════════
//  RESUMEN FINANCIERO (Pieza 1) — ingresos vs egresos por periodo
//  Solo lectura. Consolida VENTA (ingresos) y CAJA (egresos).
//  params: { desde:'YYYY-MM-DD', hasta:'YYYY-MM-DD' }
// ════════════════════════════════════════════════════════════
function resumenFinanciero(params) {
  try {
    if (!_puedeModulo(params, 'Finanzas')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    var desde = String(params.desde || '').trim(); // YYYY-MM-DD
    var hasta = String(params.hasta || '').trim();
    if (!desde || !hasta) return respuestaError('Indique el rango de fechas (desde y hasta).');

    // Helper: una fecha (string YYYY-MM-DD o datetime) cae en el rango
    function enRango(fechaStr) {
      if (!fechaStr) return false;
      var f = String(fechaStr).substring(0, 10); // primeros 10 chars = YYYY-MM-DD
      return f >= desde && f <= hasta;
    }

    // ── INGRESOS: ventas no anuladas ──
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && String(v.ID_VENTA).trim() !== ''; });
    var totalIngresos = 0, numVentas = 0;
    var ingresosPorDia = {};
    ventas.forEach(function(v){
      var estado = String(v.ESTADO || '').toUpperCase();
      if (estado === 'ANULADA' || estado === 'ANULADO') return;
      if (!enRango(v.FECHA_VENTA)) return;
      var monto = parseFloat(v.TOTAL) || 0;
      totalIngresos += monto;
      numVentas++;
      var dia = String(v.FECHA_VENTA).substring(0,10);
      ingresosPorDia[dia] = (ingresosPorDia[dia] || 0) + monto;
    });

    // ── EGRESOS: movimientos de caja tipo EGRESO ──
    var caja = leerHoja(HOJAS.CAJA).map(limpiarFila)
      .filter(function(m){ return m.ID_CAJA && String(m.ID_CAJA).trim() !== ''; });
    var conceptos = leerHoja(HOJAS.TCONCEPTO_CAJA).map(limpiarFila);
    function nombreConcepto(id) {
      for (var i = 0; i < conceptos.length; i++) {
        if (conceptos[i].ID_TCONCEPTO_CAJA === id) return conceptos[i].NOMBRE;
      }
      return 'OTROS';
    }
    var totalEgresos = 0, numEgresos = 0;
    var egresosPorConcepto = {};
    var egresosPorDia = {};
    caja.forEach(function(m){
      var estado = String(m.ESTADO || '').toUpperCase();
      if (estado === 'ANULADO' || estado === 'ANULADA') return;
      if (String(m.TIPO).toUpperCase() !== 'EGRESO') return;
      if (!enRango(m.FECHA)) return;
      var monto = parseFloat(m.MONTO) || 0;
      totalEgresos += monto;
      numEgresos++;
      var con = nombreConcepto(m.ID_TCONCEPTO_CAJA) || 'OTROS';
      egresosPorConcepto[con] = (egresosPorConcepto[con] || 0) + monto;
      var dia = String(m.FECHA).substring(0,10);
      egresosPorDia[dia] = (egresosPorDia[dia] || 0) + monto;
    });

    // ── CUENTAS POR PAGAR pendientes (no filtradas por fecha: estado actual) ──
    var obligaciones = leerHoja(HOJAS.OBLIGACION).map(limpiarFila)
      .filter(function(o){ return o.ID_OBLIGACION && String(o.ID_OBLIGACION).trim() !== ''; });
    var totalPorPagar = 0, numPorPagar = 0;
    obligaciones.forEach(function(o){
      var estado = String(o.ESTADO || '').toUpperCase();
      if (estado === 'ANULADA' || estado === 'PAGADA') return;
      var pend = parseFloat(o.MONTO_PENDIENTE) || 0;
      if (pend > 0) { totalPorPagar += pend; numPorPagar++; }
    });

    // ── Serie diaria combinada (para gráfico) ──
    var diasSet = {};
    Object.keys(ingresosPorDia).forEach(function(d){ diasSet[d]=true; });
    Object.keys(egresosPorDia).forEach(function(d){ diasSet[d]=true; });
    var dias = Object.keys(diasSet).sort();
    var serie = dias.map(function(d){
      return { fecha:d, ingresos:(ingresosPorDia[d]||0), egresos:(egresosPorDia[d]||0) };
    });

    // ── Egresos por concepto (para desglose) ──
    var desglose = Object.keys(egresosPorConcepto).map(function(k){
      return { concepto:k, monto:egresosPorConcepto[k] };
    }).sort(function(a,b){ return b.monto - a.monto; });

    var utilidad = totalIngresos - totalEgresos;

    return respuestaOK({
      desde: desde, hasta: hasta,
      ingresos: totalIngresos,
      egresos: totalEgresos,
      utilidad: utilidad,
      numVentas: numVentas,
      numEgresos: numEgresos,
      porPagar: totalPorPagar,
      numPorPagar: numPorPagar,
      serie: serie,
      desgloseEgresos: desglose,
    }, 'Resumen financiero generado.');
  } catch (err) {
    return respuestaError('Error al generar resumen: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REPORTE FINANCIERO DETALLADO (Bloque 1) — solo lectura
//  Resumen + ingresos por especialidad/servicio + por método de pago
//  params: { desde, hasta }
// ════════════════════════════════════════════════════════════
function reporteFinanciero(params) {
  try {
    if (!_puedeModulo(params, 'Finanzas')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    var desde = String(params.desde || '').trim();
    var hasta = String(params.hasta || '').trim();
    if (!desde || !hasta) return respuestaError('Indique el rango de fechas.');

    function enRango(fechaStr) {
      if (!fechaStr) return false;
      var f = String(fechaStr).substring(0, 10);
      return f >= desde && f <= hasta;
    }

    // Cargar tablas
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && String(v.ID_VENTA).trim() !== ''; });
    var dventa = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var modosPago = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);

    // Índices rápidos
    function nombreEsp(id){ for(var i=0;i<especialidades.length;i++){ if(especialidades[i].ID_ESPECIALIDAD===id) return especialidades[i].ESPECIALIDAD; } return null; }
    function servInfo(id){ for(var i=0;i<servicios.length;i++){ if(servicios[i].ID_SERVICIO===id) return servicios[i]; } return null; }
    function nombrePaq(id){ for(var i=0;i<paquetes.length;i++){ if(paquetes[i].ID_PAQUETE===id) return paquetes[i].NOMBRE_PAQUETE; } return id; }
    function nombreModo(id){ for(var i=0;i<modosPago.length;i++){ if(modosPago[i].ID_TMODO_PAGO===id) return modosPago[i].NOMBRE; } return 'OTRO'; }

    // Ventas válidas del periodo (no anuladas)
    var ventasValidas = ventas.filter(function(v){
      var est = String(v.ESTADO||'').toUpperCase();
      return est!=='ANULADA' && est!=='ANULADO' && enRango(v.FECHA_VENTA);
    });
    var idsValidas = {};
    ventasValidas.forEach(function(v){ idsValidas[v.ID_VENTA]=v; });

    var totalIngresos = 0;
    ventasValidas.forEach(function(v){ totalIngresos += (parseFloat(v.TOTAL)||0); });

    // ── Por método de pago ──
    var porMetodo = {};
    ventasValidas.forEach(function(v){
      var m = nombreModo(v.ID_TMODO_PAGO) || 'OTRO';
      porMetodo[m] = (porMetodo[m]||0) + (parseFloat(v.TOTAL)||0);
    });
    var metodos = Object.keys(porMetodo).map(function(k){ return {metodo:k, monto:porMetodo[k]}; })
      .sort(function(a,b){ return b.monto-a.monto; });

    // ── Por servicio y por especialidad (desde DVENTA) ──
    var porServicio = {}, porEspecialidad = {}, porPaquete = {};
    dventa.forEach(function(d){
      if (!idsValidas[d.ID_VENTA]) return; // solo de ventas válidas del periodo
      var sub = parseFloat(d.SUBTOTAL)||0;
      var tipo = String(d.TIPO||'').toUpperCase();
      if (tipo==='PAQUETE' || (d.ID_PAQUETE && d.ID_PAQUETE!=='-')) {
        var np = nombrePaq(d.ID_PAQUETE);
        porPaquete[np] = (porPaquete[np]||0) + sub;
      } else if (d.ID_SERVICIO && d.ID_SERVICIO!=='-') {
        var s = servInfo(d.ID_SERVICIO);
        var nomServ = s ? s.NOMBRE_SERVICIO : d.ID_SERVICIO;
        porServicio[nomServ] = (porServicio[nomServ]||0) + sub;
        var esp = (s && s.ID_ESPECIALIDAD && s.ID_ESPECIALIDAD!=='-') ? (nombreEsp(s.ID_ESPECIALIDAD)||'Sin especialidad') : 'Sin especialidad';
        porEspecialidad[esp] = (porEspecialidad[esp]||0) + sub;
      }
    });
    function aLista(obj, keyName){
      return Object.keys(obj).map(function(k){ var o={monto:obj[k]}; o[keyName]=k; return o; })
        .sort(function(a,b){ return b.monto-a.monto; });
    }
    var listaServicios = aLista(porServicio, 'servicio');
    var listaEsp = aLista(porEspecialidad, 'especialidad');
    var listaPaquetes = aLista(porPaquete, 'paquete');
    // % participación por especialidad
    listaEsp.forEach(function(e){ e.pct = totalIngresos>0 ? Math.round((e.monto/totalIngresos)*100) : 0; });

    // ── Egresos (caja) por concepto ──
    var caja = leerHoja(HOJAS.CAJA).map(limpiarFila);
    var conceptos = leerHoja(HOJAS.TCONCEPTO_CAJA).map(limpiarFila);
    function nombreConcepto(id){ for(var i=0;i<conceptos.length;i++){ if(conceptos[i].ID_TCONCEPTO_CAJA===id) return conceptos[i].NOMBRE; } return 'OTROS'; }
    var totalEgresos = 0, porConcepto = {};
    caja.forEach(function(m){
      if (String(m.ESTADO||'').toUpperCase()==='ANULADO') return;
      if (String(m.TIPO).toUpperCase()!=='EGRESO') return;
      if (!enRango(m.FECHA)) return;
      var mo = parseFloat(m.MONTO)||0;
      totalEgresos += mo;
      var con = nombreConcepto(m.ID_TCONCEPTO_CAJA);
      porConcepto[con] = (porConcepto[con]||0) + mo;
    });
    var listaEgresos = aLista(porConcepto, 'concepto');

    return respuestaOK({
      desde: desde, hasta: hasta,
      totalIngresos: totalIngresos,
      totalEgresos: totalEgresos,
      utilidad: totalIngresos - totalEgresos,
      numVentas: ventasValidas.length,
      ticketPromedio: ventasValidas.length>0 ? (totalIngresos/ventasValidas.length) : 0,
      porEspecialidad: listaEsp,
      porServicio: listaServicios,
      porPaquete: listaPaquetes,
      porMetodo: metodos,
      porConcepto: listaEgresos,
    }, 'Reporte generado.');
  } catch (err) {
    return respuestaError('Error al generar reporte: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REPORTE FINANCIERO — BLOQUE 2: LIQUIDEZ
//  Cuentas por cobrar + Cuentas por pagar + Flujo de caja
// ════════════════════════════════════════════════════════════
function reporteLiquidez(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Finanzas'))
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    var desde = params.desde, hasta = params.hasta;
    if (!desde || !hasta) return respuestaError('Indique el rango de fechas.');

    function enRango(fechaStr) {
      if (!fechaStr) return false;
      var f = String(fechaStr).substring(0, 10);
      return f >= desde && f <= hasta;
    }
    var hoy = getFecha('fecha');

    // ── 1. CUENTAS POR COBRAR (ventas con saldo > 0, no anuladas) ──
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && String(v.ID_VENTA).trim() !== ''; });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    function nomPaciente(id){ for(var i=0;i<pacientes.length;i++){ if(pacientes[i].ID_PACIENTE===id) return ((pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||'')).trim(); } return '—'; }

    var porCobrar = [], totalCobrar = 0;
    ventas.forEach(function(v){
      var est = String(v.ESTADO||'').toUpperCase();
      if (est === 'ANULADA') return;
      var saldo = parseFloat(v.SALDO) || 0;
      if (saldo <= 0) return;
      var cliente = (v.RAZON_SOCIAL && v.RAZON_SOCIAL !== '-') ? v.RAZON_SOCIAL : nomPaciente(v.ID_PACIENTE);
      porCobrar.push({
        ID_VENTA: v.ID_VENTA,
        FECHA: String(v.FECHA_VENTA||'').substring(0,10),
        CLIENTE: cliente,
        TOTAL: (parseFloat(v.TOTAL)||0).toFixed(2),
        PAGADO: (parseFloat(v.MONTO_PAGADO)||0).toFixed(2),
        SALDO: saldo.toFixed(2),
      });
      totalCobrar += saldo;
    });
    porCobrar.sort(function(a,b){ return parseFloat(b.SALDO) - parseFloat(a.SALDO); });

    // ── 2. CUENTAS POR PAGAR (obligaciones con monto pendiente) ──
    var obligaciones = leerHoja(HOJAS.OBLIGACION).map(limpiarFila)
      .filter(function(o){ return o.ID_OBLIGACION && String(o.ID_OBLIGACION).trim() !== ''; });
    var proveedores = leerHoja(HOJAS.PROVEEDOR).map(limpiarFila);
    function nomProveedor(id){ for(var i=0;i<proveedores.length;i++){ if(proveedores[i].ID_PROVEEDOR===id) return proveedores[i].RAZON_SOCIAL; } return '—'; }

    var porPagar = [], totalPagar = 0, totalVencido = 0;
    obligaciones.forEach(function(o){
      var est = String(o.ESTADO||'').toUpperCase();
      if (est === 'PAGADA' || est === 'ANULADA') return;
      var pend = parseFloat(o.MONTO_PENDIENTE) || 0;
      if (pend <= 0) return;
      var venc = String(o.FECHA_VENCIMIENTO||'').substring(0,10);
      var vencida = venc && venc < hoy;
      porPagar.push({
        ID_OBLIGACION: o.ID_OBLIGACION,
        PROVEEDOR: nomProveedor(o.ID_PROVEEDOR),
        COMPROBANTE: (o.NUMERO_COMPROBANTE && o.NUMERO_COMPROBANTE!=='-') ? o.NUMERO_COMPROBANTE : '—',
        VENCIMIENTO: venc || '—',
        VENCIDA: vencida,
        PENDIENTE: pend.toFixed(2),
      });
      totalPagar += pend;
      if (vencida) totalVencido += pend;
    });
    porPagar.sort(function(a,b){ return (a.VENCIMIENTO||'') > (b.VENCIMIENTO||'') ? 1 : -1; });

    // ── 3. FLUJO DE CAJA del periodo (entradas vs salidas por día) ──
    var caja = leerHoja(HOJAS.CAJA).map(limpiarFila);
    var flujoDias = {};
    caja.forEach(function(m){
      var est = String(m.ESTADO||'').toUpperCase();
      if (est === 'ANULADO') return;
      if (!enRango(m.FECHA)) return;
      var dia = String(m.FECHA).substring(0,10);
      if (!flujoDias[dia]) flujoDias[dia] = { entradas:0, salidas:0 };
      var monto = parseFloat(m.MONTO) || 0;
      if (String(m.TIPO).toUpperCase() === 'INGRESO') flujoDias[dia].entradas += monto;
      else flujoDias[dia].salidas += monto;
    });
    var flujo = [], acumulado = 0, totalEntradas = 0, totalSalidas = 0;
    Object.keys(flujoDias).sort().forEach(function(dia){
      var e = flujoDias[dia].entradas, s = flujoDias[dia].salidas, neto = e - s;
      acumulado += neto;
      totalEntradas += e; totalSalidas += s;
      flujo.push({ FECHA: dia, ENTRADAS: e.toFixed(2), SALIDAS: s.toFixed(2), NETO: neto.toFixed(2), ACUMULADO: acumulado.toFixed(2) });
    });

    return respuestaOK({
      porCobrar: porCobrar,
      totalCobrar: totalCobrar.toFixed(2),
      porPagar: porPagar,
      totalPagar: totalPagar.toFixed(2),
      totalVencido: totalVencido.toFixed(2),
      flujo: flujo,
      totalEntradas: totalEntradas.toFixed(2),
      totalSalidas: totalSalidas.toFixed(2),
      flujoNeto: (totalEntradas - totalSalidas).toFixed(2),
    });
  } catch (err) {
    return respuestaError('Error reporte liquidez: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REPORTE FINANCIERO — BLOQUE 3: INDICADORES
//  KPIs del mes + comparativo mes actual vs mes anterior
// ════════════════════════════════════════════════════════════
function reporteIndicadores(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Finanzas'))
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');

    // mes = 'YYYY-MM' (por defecto el mes actual)
    var mes = params.mes || getFecha('fecha').substring(0, 7);
    var partes = mes.split('-');
    var anio = parseInt(partes[0]), mm = parseInt(partes[1]);
    // mes anterior
    var prevMM = mm - 1, prevAnio = anio;
    if (prevMM < 1) { prevMM = 12; prevAnio = anio - 1; }
    var mesPrev = prevAnio + '-' + String(prevMM).padStart(2, '0');

    // Cargar datos una vez
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var caja = leerHoja(HOJAS.CAJA).map(limpiarFila);
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var dventa = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);

    function nomEsp(id){ for(var i=0;i<especialidades.length;i++){ if(especialidades[i].ID_ESPECIALIDAD===id) return especialidades[i].ESPECIALIDAD; } return 'Sin especialidad'; }
    function servEsp(idServ){ for(var i=0;i<servicios.length;i++){ if(servicios[i].ID_SERVICIO===idServ) return servicios[i].ID_ESPECIALIDAD; } return null; }

    // Calcula los indicadores de un mes dado
    function calcMes(mesAA) {
      var ingresos = 0, numV = 0;
      var idsV = {};
      ventas.forEach(function(v){
        var est = String(v.ESTADO||'').toUpperCase();
        if (est === 'ANULADA') return;
        if (String(v.FECHA_VENTA||'').substring(0,7) !== mesAA) return;
        ingresos += (parseFloat(v.TOTAL)||0);
        numV++;
        idsV[v.ID_VENTA] = true;
      });
      var egresos = 0;
      caja.forEach(function(m){
        if (String(m.ESTADO||'').toUpperCase() === 'ANULADO') return;
        if (String(m.TIPO||'').toUpperCase() !== 'EGRESO') return;
        if (String(m.FECHA||'').substring(0,7) !== mesAA) return;
        egresos += (parseFloat(m.MONTO)||0);
      });
      // Citas
      var citasProg = 0, citasAtend = 0;
      citas.forEach(function(c){
        if (String(c.FECHA_CITA||'').substring(0,7) !== mesAA) return;
        var est = String(c.ESTADO_CITA||'').toUpperCase();
        if (est === 'CANCELADA') return;
        citasProg++;
        if (est.indexOf('ATENDID') >= 0) citasAtend++;
      });
      // Pacientes nuevos
      var pacNuevos = 0;
      pacientes.forEach(function(p){
        if (String(p.FECHA_REGISTRO||'').substring(0,7) === mesAA) pacNuevos++;
      });
      // Especialidad más rentable
      var ingEsp = {};
      dventa.forEach(function(d){
        if (!idsV[d.ID_VENTA]) return;
        if (d.ID_SERVICIO && d.ID_SERVICIO !== '-') {
          var ie = servEsp(d.ID_SERVICIO);
          var nE = (ie && ie !== '-') ? nomEsp(ie) : 'Sin especialidad';
          ingEsp[nE] = (ingEsp[nE]||0) + (parseFloat(d.SUBTOTAL)||0);
        }
      });
      var espTop = '—', espTopMonto = 0;
      for (var e in ingEsp) { if (ingEsp[e] > espTopMonto) { espTopMonto = ingEsp[e]; espTop = e; } }

      var utilidad = ingresos - egresos;
      return {
        ingresos: ingresos, egresos: egresos, utilidad: utilidad,
        numVentas: numV,
        ticketProm: numV > 0 ? (ingresos/numV) : 0,
        margen: ingresos > 0 ? (utilidad/ingresos*100) : 0,
        citasProg: citasProg, citasAtend: citasAtend,
        ocupacion: citasProg > 0 ? (citasAtend/citasProg*100) : 0,
        pacNuevos: pacNuevos,
        espTop: espTop, espTopMonto: espTopMonto,
      };
    }

    var actual = calcMes(mes);
    var previo = calcMes(mesPrev);

    // Variación % entre actual y previo
    function variacion(a, b){ if (b === 0) return a > 0 ? 100 : 0; return ((a - b) / b) * 100; }

    return respuestaOK({
      mes: mes, mesPrev: mesPrev,
      actual: actual, previo: previo,
      var_ingresos:  variacion(actual.ingresos, previo.ingresos).toFixed(1),
      var_egresos:   variacion(actual.egresos, previo.egresos).toFixed(1),
      var_utilidad:  variacion(actual.utilidad, previo.utilidad).toFixed(1),
      var_ventas:    variacion(actual.numVentas, previo.numVentas).toFixed(1),
      var_citas:     variacion(actual.citasAtend, previo.citasAtend).toFixed(1),
    });
  } catch (err) {
    return respuestaError('Error reporte indicadores: ' + err.message);
  }
}
