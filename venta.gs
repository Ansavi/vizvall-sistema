// ============================================================
// VIZVALL — venta.gs — Gestión de Ventas / Cobros
// Venta con detalle de servicios. Puede vincularse a una cita.
// ============================================================

// ════════════════════════════════════════════════════════════
//  GENERAR NÚMERO DE TICKET: DDMMAAAA + correlativo continuo (5 díg)
//  Ej: 0406202600001, 0406202600002 ... (nunca reinicia)
// ════════════════════════════════════════════════════════════
function generarNumeroTicket() {
  var hoy = getFecha('dd') + getFecha('MM') + getFecha('yyyy'); // DDMMYYYY
  // Correlativo continuo: el mayor correlativo de TODOS los tickets emitidos.
  var ventas = leerHoja(HOJAS.VENTA);
  var maxCorr = 0;
  for (var i = 0; i < ventas.length; i++) {
    var raw = ventas[i].NUMERO_COMPROBANTE;
    if (raw === null || raw === undefined || raw === '' || raw === '-') continue;
    // Normalizar: puede venir como número (sin notación científica) o texto
    var num;
    if (typeof raw === 'number') {
      num = Math.round(raw).toFixed(0); // evita notación científica y decimales
    } else {
      num = String(raw).trim();
    }
    // Quitar cualquier carácter no numérico residual
    num = num.replace(/[^0-9]/g, '');
    // Los tickets tienen 13 dígitos: 8 fecha + 5 correlativo
    if (num.length === 13) {
      var corr = parseInt(num.substring(8), 10);
      if (!isNaN(corr) && corr > maxCorr) maxCorr = corr;
    }
  }
  var siguiente = maxCorr + 1;
  return hoy + String(siguiente).padStart(5, '0');
}

// ════════════════════════════════════════════════════════════
//  LISTAR VENTAS (con nombre de paciente, comprobante, modo pago)
// ════════════════════════════════════════════════════════════
function listarVentas(params) {
  try {
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){
        // Excluir proformas: tienen su propia pestaña (no son ventas reales aún)
        if (String(v.ESTADO || '').toUpperCase() === 'PROFORMA') return false;
        return v.ID_VENTA && String(v.ID_VENTA).trim() !== '';
      });

    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var modosPago = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
    var comprobantes = leerHoja(HOJAS.TCOMPROBANTE).map(limpiarFila);
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var tiposDoc = leerHoja(HOJAS.TIPO_DOCUMENTO).map(limpiarFila);

    if (params && params.fecha) {
      ventas = ventas.filter(function(v){ return String(v.FECHA_VENTA).indexOf(params.fecha) === 0; });
    }
    if (params && params.estado) {
      ventas = ventas.filter(function(v){ return v.ESTADO === params.estado; });
    }

    var enriched = ventas.map(function(v){
      var pacNombre = '—', pacDoc = '—', pacTdoc = 'DOC', modoNombre = '—', compNombre = '—';
      var fechaCita = '—', horaCita = '';
      for (var i = 0; i < pacientes.length; i++) {
        if (pacientes[i].ID_PACIENTE === v.ID_PACIENTE) {
          var pp = pacientes[i];
          // Si tiene razón social (RUC), usar esa; si no, nombres+apellidos
          pacNombre = (pp.RAZON_SOCIAL && pp.RAZON_SOCIAL !== '-') ? pp.RAZON_SOCIAL : ((pp.NOMBRES||'')+' '+(pp.APELLIDOS||''));
          pacDoc = pp.NUMERO_DOCUMENTO || '—';
          // Etiqueta del tipo de documento
          for (var td = 0; td < tiposDoc.length; td++) {
            if (String(tiposDoc[td].ID_TIPO_DOCUMENTO) === String(pp.ID_TIPO_DOCUMENTO)) { pacTdoc = tiposDoc[td].TIPO || 'DOC'; break; }
          }
          break;
        }
      }
      if (v.ID_CITA && v.ID_CITA !== '-') {
        for (var ci = 0; ci < citas.length; ci++) {
          if (citas[ci].ID_CITA === v.ID_CITA) { fechaCita = citas[ci].FECHA_CITA || '—'; horaCita = citas[ci].HORA_CITA || ''; break; }
        }
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
        ESTADO_COMPROBANTE: v.ESTADO_COMPROBANTE || 'PENDIENTE',
        RUC_CLIENTE:        v.RUC_CLIENTE,
        RAZON_SOCIAL:       v.RAZON_SOCIAL,
        COMPROBANTE_NOMBRE: compNombre,
        ID_PACIENTE:        v.ID_PACIENTE,
        PACIENTE_NOMBRE:    pacNombre,
        PACIENTE_DOC:       pacDoc,
        PACIENTE_TDOC:      pacTdoc,
        ID_CITA:            v.ID_CITA,
        FECHA_CITA:         fechaCita,
        HORA_CITA:          horaCita,
        MODO_PAGO_NOMBRE:   modoNombre,
        SUBTOTAL:           v.SUBTOTAL,
        DESCUENTO:          v.DESCUENTO,
        IGV:                v.IGV,
        TOTAL:              v.TOTAL,
        MONTO_PAGADO:       v.MONTO_PAGADO || v.TOTAL,
        SALDO:              v.SALDO || '0.00',
        ESTADO_PAGO:        v.ESTADO_PAGO || 'PAGADO',
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
  // Bloqueo para evitar números de ticket duplicados en ventas simultáneas
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(eLock) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO', 'RECEPCION'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso para registrar ventas.', 'ERR_PERMISO');
    }
    if (!params.ID_PACIENTE) { lock.releaseLock(); return respuestaError('El paciente es requerido.'); }

    var items = params.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) { items = []; }
    }
    if (!Array.isArray(items) || !items.length) {
      lock.releaseLock();
      return respuestaError('Debe agregar al menos un servicio a la venta.');
    }
    // ── DEDUPLICAR items: fusionar líneas idénticas (mismo servicio/paquete + precio) ──
    var itemsUnicos = [];
    for (var du = 0; du < items.length; du++) {
      var itm = items[du];
      var clave = (itm.TIPO||'SERVICIO') + '|' + (itm.ID_SERVICIO||'') + '|' + (itm.ID_PAQUETE||'') + '|' + (itm.PRECIO_UNITARIO||'');
      var yaExiste = null;
      for (var ee = 0; ee < itemsUnicos.length; ee++) {
        if (itemsUnicos[ee]._clave === clave) { yaExiste = itemsUnicos[ee]; break; }
      }
      if (yaExiste) {
        // Sumar cantidad y descuento en lugar de duplicar la línea
        yaExiste.CANTIDAD = (parseFloat(yaExiste.CANTIDAD)||0) + (parseFloat(itm.CANTIDAD)||1);
        yaExiste.DESCUENTO = (parseFloat(yaExiste.DESCUENTO)||0) + (parseFloat(itm.DESCUENTO)||0);
      } else {
        var copia = {};
        for (var kk in itm) { if (itm.hasOwnProperty(kk)) copia[kk] = itm[kk]; }
        copia._clave = clave;
        itemsUnicos.push(copia);
      }
    }
    items = itemsUnicos;

    // ── VALIDAR STOCK DE INSUMOS (bloquea si no alcanza) ──
    try {
      var chequeoStock = verificarStockInsumos_(items);
      if (chequeoStock && !chequeoStock.ok && chequeoStock.faltantes && chequeoStock.faltantes.length) {
        lock.releaseLock();
        var detF = chequeoStock.faltantes.map(function(f){ return f.producto + ' (necesita ' + f.requerido + ', hay ' + f.disponible + ')'; }).join('; ');
        return respuestaError('Stock de insumos insuficiente para: ' + detF, 'ERR_STOCK_INSUMO');
      }
    } catch (eChk) { /* si receta/inventario no configurado, no bloquea */ }

    // ── VALIDAR CAJA: si el pago es EFECTIVO, debe haber una caja abierta ──
    if (params.ID_TMODO_PAGO) {
      var modosTmp = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
      var modoNombreTmp = '';
      for (var mt = 0; mt < modosTmp.length; mt++) {
        if (modosTmp[mt].ID_TMODO_PAGO === params.ID_TMODO_PAGO) { modoNombreTmp = String(modosTmp[mt].NOMBRE || '').toUpperCase(); break; }
      }
      if (modoNombreTmp.indexOf('EFECTIVO') >= 0) {
        var apsTmp = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
        var hayCaja = false;
        for (var at = 0; at < apsTmp.length; at++) {
          if (apsTmp[at].ESTADO === 'ABIERTA') { hayCaja = true; break; }
        }
        if (!hayCaja) {
          lock.releaseLock();
          return respuestaError('Debe abrir la caja antes de cobrar en efectivo.', 'ERR_CAJA_CERRADA');
        }
      }
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

    var idVenta = generarID(HOJAS.VENTA, 'ID_VENTA', 'VTA', 4);

    // Determinar si el comprobante es TICKET o BOLETA/FACTURA
    var nombreComp = '';
    if (params.ID_TCOMPROBANTE) {
      var tcomps = leerHoja(HOJAS.TCOMPROBANTE).map(limpiarFila);
      for (var t = 0; t < tcomps.length; t++) {
        if (tcomps[t].ID_TCOMPROBANTE === params.ID_TCOMPROBANTE) { nombreComp = String(tcomps[t].NOMBRE || '').toUpperCase(); break; }
      }
    }
    var esTicket = nombreComp.indexOf('TICKET') >= 0;

    // Ticket: número automático DDMMAAAA+correlativo, estado ACEPTADO (no editable)
    // Boleta/Factura: número pendiente, estado PENDIENTE (se registra después)
    var numComp, estadoComp;
    if (esTicket) {
      numComp = generarNumeroTicket();
      estadoComp = 'ACEPTADO';
    } else {
      numComp = '-';
      estadoComp = 'PENDIENTE';
    }

    // ── PAGO INICIAL: contado total o adelanto ──
    // params.ADELANTO opcional. Si no viene, se asume pago completo al contado.
    var montoPagadoIni, saldoIni, estadoPagoIni;
    var adelanto = parseFloat(params.ADELANTO);
    if (!isNaN(adelanto) && adelanto >= 0 && adelanto < total) {
      // Pago parcial (adelanto)
      montoPagadoIni = adelanto;
      saldoIni = total - adelanto;
      estadoPagoIni = adelanto > 0 ? 'PARCIAL' : 'PENDIENTE';
    } else {
      // Pago completo al contado
      montoPagadoIni = total;
      saldoIni = 0;
      estadoPagoIni = 'PAGADO';
    }

    insertarFila(HOJAS.VENTA, {
      ID_VENTA:           idVenta,
      FECHA_VENTA:        getFecha('datetime'),
      ID_TCOMPROBANTE:    params.ID_TCOMPROBANTE || '-',
      NUMERO_COMPROBANTE: numComp,
      ESTADO_COMPROBANTE: estadoComp,
      RUC_CLIENTE:        params.RUC_CLIENTE ? String(params.RUC_CLIENTE).trim() : '-',
      RAZON_SOCIAL:       params.RAZON_SOCIAL ? String(params.RAZON_SOCIAL).trim().toUpperCase() : '-',
      ID_PACIENTE:        params.ID_PACIENTE,
      ID_CITA:            params.ID_CITA || '-',
      ID_USUARIO:         params._sesion ? (params._sesion.ID_USUARIO || params._sesion.USUARIO || '-') : '-',
      ID_TMODO_PAGO:      params.ID_TMODO_PAGO || '-',
      SUBTOTAL:           baseImponible.toFixed(2),
      DESCUENTO:          descuentoTotal.toFixed(2),
      IGV:                igv.toFixed(2),
      TOTAL:              total.toFixed(2),
      MONTO_PAGADO:       montoPagadoIni.toFixed(2),
      SALDO:              saldoIni.toFixed(2),
      ESTADO_PAGO:        estadoPagoIni,
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

    // ── DESCONTAR INSUMOS POR FEFO (la venta ya existe) ──
    try {
      descontarInsumosVenta_(items, idVenta, params.usuario || '-', false);
    } catch (eDesc) { /* no bloquea la venta ya creada si algo falla aquí */ }

    // ── REGISTRAR PAGO INICIAL (contado o adelanto) + INGRESO A CAJA ──
    try {
      if (montoPagadoIni > 0) {
        // ¿El modo de pago es efectivo? (para caja)
        var modoNombre = '';
        if (params.ID_TMODO_PAGO) {
          var mps = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
          for (var mp = 0; mp < mps.length; mp++) {
            if (mps[mp].ID_TMODO_PAGO === params.ID_TMODO_PAGO) { modoNombre = String(mps[mp].NOMBRE || '').toUpperCase(); break; }
          }
        }
        var idCajaPago = '-';
        if (modoNombre.indexOf('EFECTIVO') >= 0) {
          var aperturasCaja = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
          var cajaAbierta = null;
          for (var ac = 0; ac < aperturasCaja.length; ac++) {
            if (aperturasCaja[ac].ESTADO === 'ABIERTA') { cajaAbierta = aperturasCaja[ac]; break; }
          }
          if (cajaAbierta) {
            idCajaPago = generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4);
            insertarFila(HOJAS.CAJA, {
              ID_CAJA:           idCajaPago,
              ID_APERTURA:       cajaAbierta.ID_APERTURA,
              FECHA:             getFecha('fecha'),
              HORA:              getFecha('hora'),
              TURNO:             cajaAbierta.TURNO || 'ÚNICO',
              TIPO:              'INGRESO',
              ID_TCONCEPTO_CAJA: '-',
              ID_VENTA:          idVenta,
              MODO_PAGO:         'EFECTIVO',
              MONTO:             montoPagadoIni.toFixed(2),
              USUARIO:           params.usuario || '-',
              ESTADO:            'ACTIVO',
              OBSERVACIONES:     'Venta ' + idVenta + (numComp !== '-' ? ' / ' + numComp : '') + (estadoPagoIni === 'PARCIAL' ? ' (adelanto)' : ''),
            });
          }
        }
        // Registrar el pago en PAGO_VENTA
        insertarFila(HOJAS.PAGO_VENTA, {
          ID_PAGO_VENTA:  generarID(HOJAS.PAGO_VENTA, 'ID_PAGO_VENTA', 'PV', 4),
          ID_VENTA:       idVenta,
          ID_CAJA:        idCajaPago,
          ID_TMODO_PAGO:  params.ID_TMODO_PAGO || '-',
          FECHA_PAGO:     getFecha('fecha'),
          MONTO:          montoPagadoIni.toFixed(2),
          TIPO:           (estadoPagoIni === 'PAGADO') ? 'CANCELACION' : 'ADELANTO',
          OBSERVACION:    '-',
          ESTADO:         'ACTIVO',
          FECHA_REGISTRO: getFecha('datetime'),
        });
      }
    } catch(eCaja) {}

    lock.releaseLock();
    return respuestaOK({ ID_VENTA: idVenta, NUMERO_COMPROBANTE: numComp, ES_TICKET: esTicket, TOTAL: total.toFixed(2) }, 'Venta registrada: ' + (esTicket ? numComp : idVenta));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
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

    // Verificar que no esté ya anulada
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var v = 0; v < ventas.length; v++) { if (ventas[v].ID_VENTA === params.ID_VENTA) { venta = ventas[v]; break; } }
    if (!venta) return respuestaError('Venta no encontrada.');
    if (venta.ESTADO === 'ANULADA') return respuestaError('La venta ya está anulada.');

    // Recuperar los servicios de la venta para devolver sus insumos
    var detalle = leerHoja(HOJAS.DVENTA).map(limpiarFila)
      .filter(function(d){ return d.ID_VENTA === params.ID_VENTA; });
    var items = detalle.map(function(d){
      return { TIPO: d.TIPO, ID_SERVICIO: d.ID_SERVICIO, ID_PAQUETE: d.ID_PAQUETE, CANTIDAD: d.CANTIDAD };
    });

    // Marcar anulada
    actualizarFila(HOJAS.VENTA, 'ID_VENTA', params.ID_VENTA, { ESTADO: 'ANULADA' });

    // Devolver insumos al stock + kardex (ENTRADA que revierte la SALIDA)
    try {
      devolverInsumosVenta_(items, params.ID_VENTA, params.usuario || '-');
    } catch (eIns) { /* si falla la devolución, la venta igual queda anulada */ }

    return respuestaOK({}, 'Venta anulada y se devolvieron los insumos al stock.');
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

// ════════════════════════════════════════════════════════════
//  REGISTRAR COMPROBANTE SUNAT (se llena DESPUÉS de la venta)
//  Boleta o Factura. Si es factura: RUC + razón social.
// ════════════════════════════════════════════════════════════
function registrarComprobante(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO', 'RECEPCION'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_VENTA) return respuestaError('ID_VENTA requerido.');
    if (!params.NUMERO_COMPROBANTE || String(params.NUMERO_COMPROBANTE).trim() === '') {
      return respuestaError('El número de comprobante es requerido.');
    }

    var datos = {
      NUMERO_COMPROBANTE: String(params.NUMERO_COMPROBANTE).trim().toUpperCase(),
      ESTADO_COMPROBANTE: 'EMITIDO',
    };
    // El tipo y RUC ya se guardaron al momento de la venta.
    // Aquí solo se registra la numeración SUNAT. Permitir corregir si se envía.
    if (params.ID_TCOMPROBANTE) datos.ID_TCOMPROBANTE = params.ID_TCOMPROBANTE;
    if (params.RUC_CLIENTE) datos.RUC_CLIENTE = String(params.RUC_CLIENTE).trim();
    if (params.RAZON_SOCIAL) datos.RAZON_SOCIAL = String(params.RAZON_SOCIAL).trim().toUpperCase();

    actualizarFila(HOJAS.VENTA, 'ID_VENTA', params.ID_VENTA, datos);
    return respuestaOK({}, 'Comprobante registrado: ' + datos.NUMERO_COMPROBANTE);
  } catch (err) {
    return respuestaError('Error al registrar comprobante: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  LISTAR CITAS DE UN PACIENTE (para vincular al cobrar)
// ════════════════════════════════════════════════════════════
function listarCitasDePaciente(params) {
  try {
    if (!params.ID_PACIENTE) return respuestaError('ID_PACIENTE requerido.');
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return c.ID_PACIENTE === params.ID_PACIENTE && c.ESTADO_CITA !== 'CANCELADA'; });
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var enriched = citas.map(function(c){
      var med = '—', esp = '—';
      for (var i = 0; i < medicos.length; i++) { if (medicos[i].ID_MEDICO === c.ID_MEDICO) { med = (medicos[i].NOMBRES||'')+' '+(medicos[i].APELLIDOS||''); break; } }
      for (var j = 0; j < especialidades.length; j++) { if (especialidades[j].ID_ESPECIALIDAD === c.ID_ESPECIALIDAD) { esp = especialidades[j].ESPECIALIDAD || '—'; break; } }
      return {
        ID_CITA: c.ID_CITA, FECHA_CITA: c.FECHA_CITA, HORA_CITA: c.HORA_CITA,
        MEDICO_NOMBRE: med, ESPECIALIDAD_NOMBRE: esp,
        ESTADO_CITA: c.ESTADO_CITA, ESTADO_PAGO: c.ESTADO_PAGO || 'PENDIENTE',
      };
    });
    enriched.sort(function(a,b){ return (a.FECHA_CITA||'')>(b.FECHA_CITA||'')?-1:1; });
    return respuestaOK(enriched);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  PAGOS DE VENTA — registrar cuota/cancelación posterior
// ════════════════════════════════════════════════════════════
function registrarPagoVenta(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO', 'RECEPCION'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }
    var monto = parseFloat(params.MONTO);
    if (isNaN(monto) || monto <= 0) { lock.releaseLock(); return respuestaError('El monto debe ser mayor a 0.'); }

    // Leer la venta
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === params.ID_VENTA) { venta = ventas[i]; break; } }
    if (!venta) { lock.releaseLock(); return respuestaError('Venta no encontrada.'); }
    if (venta.ESTADO === 'ANULADA') { lock.releaseLock(); return respuestaError('La venta está anulada.'); }

    var saldo = parseFloat(venta.SALDO);
    if (isNaN(saldo)) saldo = parseFloat(venta.TOTAL) - (parseFloat(venta.MONTO_PAGADO) || 0);
    if (saldo <= 0) { lock.releaseLock(); return respuestaError('Esta venta ya está totalmente pagada.'); }
    if (monto > saldo + 0.001) {
      lock.releaseLock();
      return respuestaError('El monto (S/ ' + monto.toFixed(2) + ') excede el saldo (S/ ' + saldo.toFixed(2) + ').');
    }

    // ¿Modo efectivo? → caja
    var modoNombre = '';
    if (params.ID_TMODO_PAGO) {
      var modos = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
      for (var m = 0; m < modos.length; m++) { if (modos[m].ID_TMODO_PAGO === params.ID_TMODO_PAGO) { modoNombre = String(modos[m].NOMBRE || '').toUpperCase(); break; } }
    }
    var idCajaPago = '-';
    if (modoNombre.indexOf('EFECTIVO') >= 0) {
      var aps = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
      var cajaAbierta = null;
      for (var a = 0; a < aps.length; a++) { if (aps[a].ESTADO === 'ABIERTA') { cajaAbierta = aps[a]; break; } }
      if (!cajaAbierta) { lock.releaseLock(); return respuestaError('Debe abrir la caja para cobrar en efectivo.', 'ERR_CAJA_CERRADA'); }
      idCajaPago = generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4);
      insertarFila(HOJAS.CAJA, {
        ID_CAJA:           idCajaPago,
        ID_APERTURA:       cajaAbierta.ID_APERTURA,
        FECHA:             getFecha('fecha'),
        HORA:              getFecha('hora'),
        TURNO:             cajaAbierta.TURNO || 'ÚNICO',
        TIPO:              'INGRESO',
        ID_TCONCEPTO_CAJA: '-',
        ID_VENTA:          params.ID_VENTA,
        MODO_PAGO:         'EFECTIVO',
        MONTO:             monto.toFixed(2),
        USUARIO:           params.usuario || '-',
        ESTADO:            'ACTIVO',
        OBSERVACIONES:     'Cobro venta ' + params.ID_VENTA,
      });
    }

    // Nuevo saldo y estado
    var nuevoPagado = (parseFloat(venta.MONTO_PAGADO) || 0) + monto;
    var nuevoSaldo = parseFloat(venta.TOTAL) - nuevoPagado;
    if (nuevoSaldo < 0.01) nuevoSaldo = 0;
    var nuevoEstadoPago = (nuevoSaldo <= 0) ? 'PAGADO' : 'PARCIAL';

    // Registrar el pago
    insertarFila(HOJAS.PAGO_VENTA, {
      ID_PAGO_VENTA:  generarID(HOJAS.PAGO_VENTA, 'ID_PAGO_VENTA', 'PV', 4),
      ID_VENTA:       params.ID_VENTA,
      ID_CAJA:        idCajaPago,
      ID_TMODO_PAGO:  params.ID_TMODO_PAGO || '-',
      FECHA_PAGO:     getFecha('fecha'),
      MONTO:          monto.toFixed(2),
      TIPO:           (nuevoSaldo <= 0) ? 'CANCELACION' : 'CUOTA',
      OBSERVACION:    String(params.OBSERVACION || '-').toUpperCase(),
      ESTADO:         'ACTIVO',
      FECHA_REGISTRO: getFecha('datetime'),
    });

    // Actualizar la venta
    actualizarFila(HOJAS.VENTA, 'ID_VENTA', params.ID_VENTA, {
      MONTO_PAGADO: nuevoPagado.toFixed(2),
      SALDO:        nuevoSaldo.toFixed(2),
      ESTADO_PAGO:  nuevoEstadoPago,
    });

    lock.releaseLock();
    return respuestaOK({ MONTO_PAGADO: nuevoPagado.toFixed(2), SALDO: nuevoSaldo.toFixed(2), ESTADO_PAGO: nuevoEstadoPago },
      'Pago registrado. Saldo: S/ ' + nuevoSaldo.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar pago de venta: ' + err.message);
  }
}

// Listar pagos de una venta
function listarPagosVenta(params) {
  try {
    if (!params.ID_VENTA) return respuestaError('ID_VENTA requerido.');
    var pagos = leerHoja(HOJAS.PAGO_VENTA).map(limpiarFila)
      .filter(function(p){ return p.ID_VENTA === params.ID_VENTA && p.ESTADO !== 'ANULADO'; });
    var modos = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
    var enriched = pagos.map(function(p){
      var modoNom = p.ID_TMODO_PAGO;
      for (var i = 0; i < modos.length; i++) { if (modos[i].ID_TMODO_PAGO === p.ID_TMODO_PAGO) { modoNom = modos[i].NOMBRE; break; } }
      return {
        ID_PAGO_VENTA: p.ID_PAGO_VENTA,
        FECHA_PAGO:    p.FECHA_PAGO,
        MODO_PAGO:     modoNom,
        MONTO:         p.MONTO,
        TIPO:          p.TIPO,
        OBSERVACION:   p.OBSERVACION,
      };
    });
    enriched.sort(function(a,b){ return String(a.FECHA_PAGO||'') > String(b.FECHA_PAGO||'') ? 1 : -1; });
    return respuestaOK(enriched, enriched.length + ' pago(s).');
  } catch (err) {
    return respuestaError('Error al listar pagos: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  Busca ventas con saldo pendiente de un paciente
// ════════════════════════════════════════════════════════════
function consultarDeudaPaciente(params) {
  try {
    if (!params.ID_PACIENTE) return respuestaError('ID_PACIENTE requerido.');
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){
        var estado = String(v.ESTADO || '').toUpperCase();
        // Excluir: anuladas, proformas y convertidas (no son deudas reales)
        if (estado === 'ANULADA' || estado === 'PROFORMA' || estado === 'CONVERTIDA') return false;
        return v.ID_PACIENTE === params.ID_PACIENTE &&
               (v.ESTADO_PAGO === 'PARCIAL' || v.ESTADO_PAGO === 'PENDIENTE') &&
               (parseFloat(v.SALDO) || 0) > 0;
      });
    var totalDeuda = 0;
    var detalle = ventas.map(function(v){
      var saldo = parseFloat(v.SALDO) || 0;
      totalDeuda += saldo;
      return {
        ID_VENTA:     v.ID_VENTA,
        FECHA_VENTA:  v.FECHA_VENTA,
        TOTAL:        parseFloat(v.TOTAL) || 0,
        MONTO_PAGADO: parseFloat(v.MONTO_PAGADO) || 0,
        SALDO:        saldo,
        ESTADO_PAGO:  v.ESTADO_PAGO,
      };
    });
    detalle.sort(function(a,b){ return String(b.FECHA_VENTA) > String(a.FECHA_VENTA) ? 1 : -1; });
    return respuestaOK({
      tieneDeuda:  detalle.length > 0,
      cantidad:    detalle.length,
      totalDeuda:  totalDeuda,
      ventas:      detalle,
    }, detalle.length + ' venta(s) con saldo.');
  } catch (err) {
    return respuestaError('Error al consultar deuda: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  PROFORMA (borrador de venta) — NO toca stock, caja ni SUNAT
//  Estado: PROFORMA. Se puede editar y luego convertir en venta.
// ════════════════════════════════════════════════════════════
function guardarProforma(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO', 'RECEPCION'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock(); return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_PACIENTE) { lock.releaseLock(); return respuestaError('El paciente es requerido.'); }

    var items = params.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e){ items = []; } }
    if (!Array.isArray(items) || !items.length) { lock.releaseLock(); return respuestaError('Agregue al menos un servicio.'); }

    // Calcular totales (igual que la venta, pero sin tocar nada contable)
    var subtotal = 0, descuentoTotal = 0;
    for (var i = 0; i < items.length; i++) {
      var cant = parseFloat(items[i].CANTIDAD) || 1;
      var precio = parseFloat(items[i].PRECIO_UNITARIO) || 0;
      var desc = parseFloat(items[i].DESCUENTO) || 0;
      subtotal += cant * precio; descuentoTotal += desc;
    }
    var bruto = subtotal - descuentoTotal;
    var igvModo = params.igvModo || (params.aplicaIGV ? 'agregar' : 'ninguno');
    var baseImponible, igv, total;
    if (igvModo === 'agregar') { baseImponible = bruto; igv = +(bruto*0.18).toFixed(2); total = +(bruto+igv).toFixed(2); }
    else if (igvModo === 'incluido') { baseImponible = +(bruto/1.18).toFixed(2); igv = +(bruto-baseImponible).toFixed(2); total = +bruto.toFixed(2); }
    else { baseImponible = bruto; igv = 0; total = +bruto.toFixed(2); }

    var idVenta = generarID(HOJAS.VENTA, 'ID_VENTA', 'PRO', 4);

    insertarFila(HOJAS.VENTA, {
      ID_VENTA:           idVenta,
      FECHA_VENTA:        getFecha('datetime'),
      ID_TCOMPROBANTE:    '-',          // sin comprobante hasta cobrar
      NUMERO_COMPROBANTE: '-',
      ESTADO_COMPROBANTE: 'PROFORMA',
      RUC_CLIENTE:        params.RUC_CLIENTE ? String(params.RUC_CLIENTE).trim() : '-',
      RAZON_SOCIAL:       params.RAZON_SOCIAL ? String(params.RAZON_SOCIAL).trim().toUpperCase() : '-',
      ID_PACIENTE:        params.ID_PACIENTE,
      ID_CITA:            params.ID_CITA || '-',
      ID_USUARIO:         params._sesion ? (params._sesion.ID_USUARIO || params._sesion.USUARIO || '-') : '-',
      ID_TMODO_PAGO:      params.ID_TMODO_PAGO || '-',
      SUBTOTAL:           baseImponible.toFixed(2),
      DESCUENTO:          descuentoTotal.toFixed(2),
      IGV:                igv.toFixed(2),
      TOTAL:              total.toFixed(2),
      MONTO_PAGADO:       '0.00',       // no se ha cobrado
      SALDO:              total.toFixed(2),
      ESTADO_PAGO:        'PENDIENTE',
      ESTADO:             'PROFORMA',    // ← clave: no es una venta emitida
      OBSERVACIONES:      params.OBSERVACIONES || '-',
    });

    // Guardar el detalle (servicios) — esto sí, para poder editarla/convertirla
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
    }

    lock.releaseLock();
    return respuestaOK({ ID_VENTA: idVenta }, 'Proforma guardada: ' + idVenta + '. No afecta stock ni caja hasta convertirla en venta.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error: ' + err.message);
  }
}

/** Lista solo las PROFORMAS (borradores) */
function listarProformas(params) {
  try {
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && v.ESTADO === 'PROFORMA'; });

    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    function nomPac(id){ for(var i=0;i<pacientes.length;i++){ if(pacientes[i].ID_PACIENTE===id) return ((pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||'')).trim(); } return id; }

    var lista = ventas.map(function(v){
      return {
        ID_VENTA: v.ID_VENTA, FECHA_VENTA: v.FECHA_VENTA,
        ID_PACIENTE: v.ID_PACIENTE, PACIENTE_NOMBRE: nomPac(v.ID_PACIENTE),
        TOTAL: v.TOTAL, OBSERVACIONES: v.OBSERVACIONES
      };
    });
    lista.sort(function(a,b){ return String(b.FECHA_VENTA).localeCompare(String(a.FECHA_VENTA)); });
    return respuestaOK(lista, lista.length + ' proforma(s).');
  } catch (e) { return respuestaError('Error: ' + e.message); }
}

/** Anula una proforma (no la borra, la marca ANULADA) */
function anularProforma(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','CAJERO','RECEPCION'].indexOf(rol) < 0) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_VENTA) return respuestaError('Proforma requerida.');
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var v = null;
    for (var i=0;i<ventas.length;i++){ if(ventas[i].ID_VENTA===params.ID_VENTA){ v=ventas[i]; break; } }
    if (!v) return respuestaError('Proforma no encontrada.');
    if (v.ESTADO !== 'PROFORMA') return respuestaError('Solo se pueden anular proformas.');
    actualizarFila(HOJAS.VENTA, 'ID_VENTA', params.ID_VENTA, { ESTADO: 'ANULADA' });
    return respuestaOK({}, 'Proforma anulada.');
  } catch (e) { return respuestaError('Error: ' + e.message); }
}

// ════════════════════════════════════════════════════════════
//  CONVERTIR PROFORMA EN VENTA — aquí SÍ se cobra, descuenta
//  stock, registra caja y genera comprobante (vía guardarVenta).
//  Recibe params.ID_VENTA (la proforma) + datos de cobro
//  (ID_TCOMPROBANTE, ID_TMODO_PAGO, ADELANTO, RUC, etc.)
// ════════════════════════════════════════════════════════════
function convertirProformaEnVenta(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','CAJERO','RECEPCION'].indexOf(rol) < 0) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_VENTA) return respuestaError('Proforma requerida.');

    // Leer la proforma
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var pro = null;
    for (var i=0;i<ventas.length;i++){ if(ventas[i].ID_VENTA===params.ID_VENTA){ pro=ventas[i]; break; } }
    if (!pro) return respuestaError('Proforma no encontrada.');
    if (pro.ESTADO !== 'PROFORMA') return respuestaError('Esta venta ya no es una proforma.');

    // Leer su detalle y armarlo como items para guardarVenta
    var detalle = leerHoja(HOJAS.DVENTA).map(limpiarFila)
      .filter(function(d){ return d.ID_VENTA === params.ID_VENTA; });
    if (!detalle.length) return respuestaError('La proforma no tiene servicios.');

    var items = detalle.map(function(d){
      return {
        TIPO: d.TIPO || 'SERVICIO',
        ID_SERVICIO: d.ID_SERVICIO, ID_PAQUETE: d.ID_PAQUETE,
        CANTIDAD: d.CANTIDAD, PRECIO_UNITARIO: d.PRECIO_UNITARIO, DESCUENTO: d.DESCUENTO
      };
    });

    // Determinar IGV modo a partir de la proforma
    var igvModo = 'ninguno';
    if (parseFloat(pro.IGV) > 0) igvModo = 'agregar';

    // Llamar a guardarVenta con los datos de cobro (hace stock, caja, comprobante)
    var ventaParams = {
      ID_PACIENTE: pro.ID_PACIENTE,
      ID_CITA: pro.ID_CITA && pro.ID_CITA !== '-' ? pro.ID_CITA : '',
      items: items,
      ID_TMODO_PAGO: params.ID_TMODO_PAGO || pro.ID_TMODO_PAGO,
      ID_TCOMPROBANTE: params.ID_TCOMPROBANTE || '',
      RUC_CLIENTE: params.RUC_CLIENTE || pro.RUC_CLIENTE,
      RAZON_SOCIAL: params.RAZON_SOCIAL || pro.RAZON_SOCIAL,
      ADELANTO: params.ADELANTO,
      igvModo: igvModo,
      OBSERVACIONES: pro.OBSERVACIONES,
      _sesion: params._sesion
    };

    var res = guardarVenta(ventaParams);
    if (!res || !res.ok) return res; // si falló (ej: sin stock o caja), devolver el error

    // Éxito: marcar la proforma como CONVERTIDA (deja rastro)
    actualizarFila(HOJAS.VENTA, 'ID_VENTA', params.ID_VENTA, {
      ESTADO: 'CONVERTIDA',
      OBSERVACIONES: (pro.OBSERVACIONES && pro.OBSERVACIONES !== '-' ? pro.OBSERVACIONES + ' · ' : '') + 'Convertida en ' + (res.datos && res.datos.ID_VENTA ? res.datos.ID_VENTA : 'venta')
    });

    return respuestaOK(res.datos, 'Proforma convertida en venta correctamente.');
  } catch (e) { return respuestaError('Error: ' + e.message); }
}

// ════════════════════════════════════════════════════════════
//  EDITAR PROFORMA — reemplaza sus servicios y totales
//  (solo si sigue en estado PROFORMA)
// ════════════════════════════════════════════════════════════
function editarProforma(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','CAJERO','RECEPCION'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Proforma requerida.'); }

    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var pro = null;
    for (var i=0;i<ventas.length;i++){ if(ventas[i].ID_VENTA===params.ID_VENTA){ pro=ventas[i]; break; } }
    if (!pro) { lock.releaseLock(); return respuestaError('Proforma no encontrada.'); }
    if (pro.ESTADO !== 'PROFORMA') { lock.releaseLock(); return respuestaError('Solo se editan proformas.'); }

    var items = params.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e){ items = []; } }
    if (!Array.isArray(items) || !items.length) { lock.releaseLock(); return respuestaError('Agregue al menos un servicio.'); }

    // Recalcular totales
    var subtotal = 0, descuentoTotal = 0;
    for (var k = 0; k < items.length; k++) {
      var cant = parseFloat(items[k].CANTIDAD) || 1;
      var precio = parseFloat(items[k].PRECIO_UNITARIO) || 0;
      var desc = parseFloat(items[k].DESCUENTO) || 0;
      subtotal += cant * precio; descuentoTotal += desc;
    }
    var bruto = subtotal - descuentoTotal;
    var igvModo = params.igvModo || (params.aplicaIGV ? 'agregar' : 'ninguno');
    var baseImponible, igv, total;
    if (igvModo === 'agregar') { baseImponible = bruto; igv = +(bruto*0.18).toFixed(2); total = +(bruto+igv).toFixed(2); }
    else if (igvModo === 'incluido') { baseImponible = +(bruto/1.18).toFixed(2); igv = +(bruto-baseImponible).toFixed(2); total = +bruto.toFixed(2); }
    else { baseImponible = bruto; igv = 0; total = +bruto.toFixed(2); }

    // Borrar el detalle viejo de esta proforma
    var hojaD = getHoja(HOJAS.DVENTA);
    var datosD = hojaD.getDataRange().getValues();
    var cabD = datosD[0];
    var colIdV = cabD.indexOf('ID_VENTA');
    for (var r = datosD.length - 1; r >= 1; r--) {
      if (String(datosD[r][colIdV]) === params.ID_VENTA) { hojaD.deleteRow(r + 1); }
    }

    // Insertar detalle nuevo
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var c = parseFloat(it.CANTIDAD) || 1;
      var p = parseFloat(it.PRECIO_UNITARIO) || 0;
      var d = parseFloat(it.DESCUENTO) || 0;
      insertarFila(HOJAS.DVENTA, {
        ID_DVENTA:       generarID(HOJAS.DVENTA, 'ID_DVENTA', 'DV', 4),
        ID_VENTA:        params.ID_VENTA,
        TIPO:            it.TIPO || 'SERVICIO',
        ID_SERVICIO:     (it.TIPO === 'PAQUETE') ? '-' : (it.ID_SERVICIO || '-'),
        ID_PAQUETE:      (it.TIPO === 'PAQUETE') ? (it.ID_PAQUETE || '-') : '-',
        CANTIDAD:        c, PRECIO_UNITARIO: p.toFixed(2), DESCUENTO: d.toFixed(2),
        SUBTOTAL:        (c * p - d).toFixed(2),
      });
    }

    // Actualizar totales de la proforma
    actualizarFila(HOJAS.VENTA, 'ID_VENTA', params.ID_VENTA, {
      SUBTOTAL: baseImponible.toFixed(2), DESCUENTO: descuentoTotal.toFixed(2),
      IGV: igv.toFixed(2), TOTAL: total.toFixed(2), SALDO: total.toFixed(2),
      ID_PACIENTE: params.ID_PACIENTE || pro.ID_PACIENTE,
      OBSERVACIONES: params.OBSERVACIONES || pro.OBSERVACIONES
    });

    lock.releaseLock();
    return respuestaOK({ ID_VENTA: params.ID_VENTA }, 'Proforma actualizada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error: ' + err.message);
  }
}

/** Obtiene los datos de una proforma (para editar): paciente, totales */
function obtenerProforma(params) {
  try {
    if (!params.ID_VENTA) return respuestaError('Proforma requerida.');
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var pro = null;
    for (var i=0;i<ventas.length;i++){ if(ventas[i].ID_VENTA===params.ID_VENTA){ pro=ventas[i]; break; } }
    if (!pro) return respuestaError('Proforma no encontrada.');

    // Nombre del paciente
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var nombrePac = pro.ID_PACIENTE;
    for (var p=0;p<pacientes.length;p++){
      if(pacientes[p].ID_PACIENTE===pro.ID_PACIENTE){
        nombrePac = ((pacientes[p].NOMBRES||'')+' '+(pacientes[p].APELLIDOS||'')).trim();
        break;
      }
    }
    return respuestaOK({
      ID_VENTA: pro.ID_VENTA, ID_PACIENTE: pro.ID_PACIENTE, PACIENTE_NOMBRE: nombrePac,
      ESTADO: pro.ESTADO, TOTAL: pro.TOTAL, OBSERVACIONES: pro.OBSERVACIONES
    }, 'Proforma encontrada.');
  } catch (e) { return respuestaError('Error: ' + e.message); }
}
