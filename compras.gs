// ============================================================
// VIZVALL — compras.gs — Compra de insumos
// Al registrar una compra:
//   1. Crea la COMPRA_INSUMO + su detalle (DCOMPRA_INSUMO)
//   2. Genera automáticamente la OBLIGACION (deuda por pagar)
//   3. Sube el STOCK de cada producto (movimiento ENTRADA)
// ============================================================

function guardarCompra(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso para registrar compras.', 'ERR_PERMISO');
    }
    if (!params.ID_PROVEEDOR) { lock.releaseLock(); return respuestaError('Seleccione un proveedor.'); }

    var items = params.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e) { items = []; } }
    if (!Array.isArray(items) || !items.length) {
      lock.releaseLock();
      return respuestaError('Agregue al menos un producto a la compra.');
    }

    // Calcular total y validar items
    var total = 0;
    for (var i = 0; i < items.length; i++) {
      var cant = parseFloat(items[i].CANTIDAD) || 0;
      var precio = parseFloat(items[i].PRECIO_UNITARIO) || 0;
      if (cant <= 0) { lock.releaseLock(); return respuestaError('Cantidad inválida en un producto.'); }
      total += cant * precio;
    }

    var condicion = String(params.CONDICION || 'CONTADO').toUpperCase(); // CONTADO | CREDITO
    var idCompra = generarID(HOJAS.COMPRA_INSUMO, 'ID_COMPRA', 'CMP', 4);
    var idObligacion = '-';
    var idCajaMov = '-';

    if (condicion === 'CREDITO') {
      // ── CRÉDITO: genera OBLIGACIÓN por pagar ──
      idObligacion = generarID(HOJAS.OBLIGACION, 'ID_OBLIGACION', 'OBL', 4);
      insertarFila(HOJAS.OBLIGACION, {
        ID_OBLIGACION:      idObligacion,
        ID_TIPO_OBLIGACION: params.ID_TIPO_OBLIGACION || '-',
        ID_PROVEEDOR:       params.ID_PROVEEDOR,
        ID_TCOMPROBANTE:    params.ID_TCOMPROBANTE || '-',
        NUMERO_COMPROBANTE: String(params.NUMERO_COMPROBANTE || '-').toUpperCase(),
        FECHA_EMISION:      params.FECHA_COMPRA || getFecha('fecha'),
        FECHA_VENCIMIENTO:  params.FECHA_VENCIMIENTO || getFecha('fecha'),
        DESCRIPCION:        'COMPRA DE INSUMOS',
        MONTO_TOTAL:        total.toFixed(2),
        MONTO_PENDIENTE:    total.toFixed(2),
        ARCHIVO_ADJUNTO:    params.ARCHIVO_ADJUNTO || '-',
        ESTADO:             'PENDIENTE',
        OBSERVACION:        String(params.OBSERVACION || '-').toUpperCase(),
        FECHA_REGISTRO:     getFecha('datetime'),
      });
    } else {
      // ── CONTADO: paga directo, sale de caja (egreso) si hay efectivo ──
      var modoNombre = '';
      if (params.ID_TMODO_PAGO) {
        var modosC = leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila);
        for (var mc = 0; mc < modosC.length; mc++) { if (modosC[mc].ID_TMODO_PAGO === params.ID_TMODO_PAGO) { modoNombre = String(modosC[mc].NOMBRE||'').toUpperCase(); break; } }
      }
      if (modoNombre.indexOf('EFECTIVO') >= 0) {
        var apsC = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
        var cajaAbiertaC = null;
        for (var ac = 0; ac < apsC.length; ac++) { if (apsC[ac].ESTADO === 'ABIERTA') { cajaAbiertaC = apsC[ac]; break; } }
        if (!cajaAbiertaC) {
          lock.releaseLock();
          return respuestaError('Debe abrir la caja para registrar una compra al contado en efectivo.', 'ERR_CAJA_CERRADA');
        }
        idCajaMov = generarID(HOJAS.CAJA, 'ID_CAJA', 'CJ', 4);
        insertarFila(HOJAS.CAJA, {
          ID_CAJA:           idCajaMov,
          ID_APERTURA:       cajaAbiertaC.ID_APERTURA,
          FECHA:             getFecha('fecha'),
          HORA:              getFecha('hora'),
          TURNO:             cajaAbiertaC.TURNO || 'ÚNICO',
          TIPO:              'EGRESO',
          ID_TCONCEPTO_CAJA: '-',
          ID_VENTA:          '-',
          MODO_PAGO:         'EFECTIVO',
          MONTO:             total.toFixed(2),
          USUARIO:           params.usuario || '-',
          ESTADO:            'ACTIVO',
          OBSERVACIONES:     'COMPRA CONTADO ' + idCompra,
        });
      }
    }

    // ── Crear la COMPRA ──
    insertarFila(HOJAS.COMPRA_INSUMO, {
      ID_COMPRA:      idCompra,
      ID_PROVEEDOR:   params.ID_PROVEEDOR,
      ID_OBLIGACION:  idObligacion,
      FECHA_COMPRA:   params.FECHA_COMPRA || getFecha('fecha'),
      CONDICION:      condicion,
      ID_TMODO_PAGO:  params.ID_TMODO_PAGO || '-',
      ID_CAJA:        idCajaMov,
      TOTAL:          total.toFixed(2),
      ESTADO:         'REGISTRADO',
      OBSERVACION:    String(params.OBSERVACION || '-').toUpperCase(),
      ID_USUARIO:     params.usuario || '-',
      FECHA_REGISTRO: getFecha('datetime'),
    });

    // ── 3. Detalle + actualizar stock (movimiento ENTRADA) ──
    var productos = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
    var tiposMov = leerHoja(HOJAS.TIPO_MOVIMIENTO_INVENTARIO).map(limpiarFila);
    var idTipoEntrada = '-';
    for (var t = 0; t < tiposMov.length; t++) {
      if (String(tiposMov[t].NOMBRE||'').toUpperCase() === 'ENTRADA') { idTipoEntrada = tiposMov[t].ID_TMOVIMIENTO; break; }
    }

    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var cantJ = parseFloat(it.CANTIDAD) || 0;
      var precioJ = parseFloat(it.PRECIO_UNITARIO) || 0;
      var subtotalJ = cantJ * precioJ;

      // ── Crear LOTE del producto (control de vencimiento, FEFO) ──
      var idLote = '-';
      if (cantJ > 0) {
        idLote = generarID(HOJAS.LOTE_PRODUCTO, 'ID_LOTE', 'LOT', 4);
        insertarFila(HOJAS.LOTE_PRODUCTO, {
          ID_LOTE:             idLote,
          ID_PRODUCTO:         it.ID_PRODUCTO,
          NUMERO_LOTE:         String(it.NUMERO_LOTE || ('AUTO-' + idLote)).toUpperCase(),
          FECHA_INGRESO:       params.FECHA_COMPRA || getFecha('fecha'),
          FECHA_VENCIMIENTO:   it.FECHA_VENCIMIENTO || '-',
          CANTIDAD_INICIAL:    cantJ.toString(),
          CANTIDAD_DISPONIBLE: cantJ.toString(),
          ESTADO:              'ACTIVO',
          OBSERVACION:         'COMPRA ' + idCompra,
          FECHA_REGISTRO:      getFecha('datetime'),
        });
      }

      // Detalle (con el lote vinculado)
      insertarFila(HOJAS.DCOMPRA_INSUMO, {
        ID_DCOMPRA_INSUMO: generarID(HOJAS.DCOMPRA_INSUMO, 'ID_DCOMPRA_INSUMO', 'DCI', 4),
        ID_COMPRA:         idCompra,
        ID_PRODUCTO:       it.ID_PRODUCTO,
        ID_LOTE:           idLote,
        CANTIDAD:          cantJ.toString(),
        PRECIO_UNITARIO:   precioJ.toFixed(2),
        SUBTOTAL:          subtotalJ.toFixed(2),
        OBSERVACION:       it.OBSERVACION || '-',
      });

      // Actualizar stock del producto
      var prod = null;
      for (var p = 0; p < productos.length; p++) { if (productos[p].ID_PRODUCTO === it.ID_PRODUCTO) { prod = productos[p]; break; } }
      if (prod) {
        var stockAnt = parseFloat(prod.STOCK) || 0;
        var stockAct = stockAnt + cantJ;
        // Movimiento de inventario (ENTRADA)
        insertarFila(HOJAS.MOVIMIENTO_INVENTARIO, {
          ID_MOVIMIENTO:    generarID(HOJAS.MOVIMIENTO_INVENTARIO, 'ID_MOVIMIENTO', 'MOV', 4),
          ID_PRODUCTO:      it.ID_PRODUCTO,
          ID_TMOVIMIENTO:   idTipoEntrada,
          CANTIDAD:         cantJ.toString(),
          STOCK_ANTERIOR:   stockAnt.toString(),
          STOCK_ACTUAL:     stockAct.toString(),
          OBSERVACION:      'Compra ' + idCompra,
          ID_USUARIO:       params.usuario || '-',
          FECHA_MOVIMIENTO: getFecha('datetime'),
          FECHA_REGISTRO:   getFecha('datetime'),
        });
        actualizarFila(HOJAS.PRODUCTO_INSUMO, 'ID_PRODUCTO', it.ID_PRODUCTO, { STOCK: stockAct.toString() });
        // Actualizar en memoria por si el mismo producto aparece dos veces
        prod.STOCK = stockAct.toString();
      }
    }

    lock.releaseLock();
    var msg = (condicion === 'CREDITO')
      ? 'Compra al crédito registrada. Obligación ' + idObligacion + ' por S/ ' + total.toFixed(2)
      : 'Compra al contado registrada por S/ ' + total.toFixed(2);
    return respuestaOK({ ID_COMPRA: idCompra, ID_OBLIGACION: idObligacion, CONDICION: condicion, TOTAL: total.toFixed(2) }, msg);
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar compra: ' + err.message);
  }
}

// Listar compras (con filtros)
function listarCompras(params) {
  try {
    var compras = leerHoja(HOJAS.COMPRA_INSUMO).map(limpiarFila)
      .filter(function(c){ return c.ID_COMPRA && String(c.ID_COMPRA).trim() !== ''; });
    if (params && params.ID_PROVEEDOR) {
      compras = compras.filter(function(c){ return c.ID_PROVEEDOR === params.ID_PROVEEDOR; });
    }
    if (params && params.fechaDesde) {
      compras = compras.filter(function(c){ return String(c.FECHA_COMPRA||'') >= params.fechaDesde; });
    }
    if (params && params.fechaHasta) {
      compras = compras.filter(function(c){ return String(c.FECHA_COMPRA||'') <= params.fechaHasta; });
    }
    var proveedores = leerHoja(HOJAS.PROVEEDOR).map(limpiarFila);
    var obls = leerHoja(HOJAS.OBLIGACION).map(limpiarFila);
    var enriched = compras.map(function(c){
      var provNom = c.ID_PROVEEDOR, oblEstado = '-';
      for (var i = 0; i < proveedores.length; i++) { if (proveedores[i].ID_PROVEEDOR === c.ID_PROVEEDOR) { provNom = proveedores[i].RAZON_SOCIAL; break; } }
      for (var j = 0; j < obls.length; j++) { if (obls[j].ID_OBLIGACION === c.ID_OBLIGACION) { oblEstado = obls[j].ESTADO; break; } }
      return {
        ID_COMPRA:        c.ID_COMPRA,
        PROVEEDOR_NOMBRE: provNom,
        ID_OBLIGACION:    c.ID_OBLIGACION,
        OBLIGACION_ESTADO:oblEstado,
        FECHA_COMPRA:     c.FECHA_COMPRA,
        TOTAL:            c.TOTAL,
        ESTADO:           c.ESTADO,
        OBSERVACION:      c.OBSERVACION,
      };
    });
    enriched.sort(function(a,b){ return String(a.FECHA_COMPRA||'') > String(b.FECHA_COMPRA||'') ? -1 : 1; });
    return respuestaOK(enriched, enriched.length + ' compra(s).');
  } catch (err) {
    return respuestaError('Error al listar compras: ' + err.message);
  }
}

// Detalle de una compra
function obtenerDetalleCompra(params) {
  try {
    if (!params.ID_COMPRA) return respuestaError('ID_COMPRA requerido.');
    var det = leerHoja(HOJAS.DCOMPRA_INSUMO).map(limpiarFila)
      .filter(function(d){ return d.ID_COMPRA === params.ID_COMPRA; });
    var productos = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
    var enriched = det.map(function(d){
      var pNom = d.ID_PRODUCTO;
      for (var i = 0; i < productos.length; i++) { if (productos[i].ID_PRODUCTO === d.ID_PRODUCTO) { pNom = productos[i].NOMBRE; break; } }
      return {
        PRODUCTO_NOMBRE: pNom,
        CANTIDAD:        d.CANTIDAD,
        PRECIO_UNITARIO: d.PRECIO_UNITARIO,
        SUBTOTAL:        d.SUBTOTAL,
        OBSERVACION:     d.OBSERVACION,
      };
    });
    return respuestaOK(enriched, enriched.length + ' ítem(s).');
  } catch (err) {
    return respuestaError('Error al obtener detalle: ' + err.message);
  }
}

// Historial de precios de compra de un producto
function historialPreciosCompra(params) {
  try {
    if (!params.ID_PRODUCTO) return respuestaError('ID_PRODUCTO requerido.');
    var det = leerHoja(HOJAS.DCOMPRA_INSUMO).map(limpiarFila)
      .filter(function(d){ return d.ID_PRODUCTO === params.ID_PRODUCTO; });
    var compras = leerHoja(HOJAS.COMPRA_INSUMO).map(limpiarFila);
    var proveedores = leerHoja(HOJAS.PROVEEDOR).map(limpiarFila);
    var enriched = det.map(function(d){
      var fecha = '-', provNom = '-';
      for (var i = 0; i < compras.length; i++) {
        if (compras[i].ID_COMPRA === d.ID_COMPRA) {
          fecha = compras[i].FECHA_COMPRA;
          for (var j = 0; j < proveedores.length; j++) { if (proveedores[j].ID_PROVEEDOR === compras[i].ID_PROVEEDOR) { provNom = proveedores[j].RAZON_SOCIAL; break; } }
          break;
        }
      }
      return {
        FECHA_COMPRA:    fecha,
        PROVEEDOR_NOMBRE:provNom,
        CANTIDAD:        d.CANTIDAD,
        PRECIO_UNITARIO: d.PRECIO_UNITARIO,
      };
    });
    enriched.sort(function(a,b){ return String(a.FECHA_COMPRA||'') > String(b.FECHA_COMPRA||'') ? -1 : 1; });
    return respuestaOK(enriched, enriched.length + ' registro(s).');
  } catch (err) {
    return respuestaError('Error al obtener historial de precios: ' + err.message);
  }
}


// ════════════ ANULAR COMPRA ════════════
// Revierte el stock (movimiento SALIDA) y anula la obligación asociada (si no tiene pagos).
function anularCompra(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('Solo el administrador puede anular compras.', 'ERR_PERMISO');
    }
    if (!params.ID_COMPRA) { lock.releaseLock(); return respuestaError('Compra requerida.'); }

    var compras = leerHoja(HOJAS.COMPRA_INSUMO).map(limpiarFila);
    var compra = null;
    for (var i = 0; i < compras.length; i++) { if (compras[i].ID_COMPRA === params.ID_COMPRA) { compra = compras[i]; break; } }
    if (!compra) { lock.releaseLock(); return respuestaError('Compra no encontrada.'); }
    if (compra.ESTADO === 'ANULADO') { lock.releaseLock(); return respuestaError('La compra ya está anulada.'); }

    // Si es a crédito y la obligación tiene pagos, no se puede anular
    if (compra.ID_OBLIGACION && compra.ID_OBLIGACION !== '-') {
      var pagos = leerHoja(HOJAS.PAGO_OBLIGACION).map(limpiarFila)
        .filter(function(p){ return p.ID_OBLIGACION === compra.ID_OBLIGACION && p.ESTADO !== 'ANULADO'; });
      if (pagos.length > 0) {
        lock.releaseLock();
        return respuestaError('No se puede anular: la obligación de esta compra ya tiene pagos.');
      }
    }

    // Revertir stock: por cada producto del detalle, generar SALIDA
    var detalle = leerHoja(HOJAS.DCOMPRA_INSUMO).map(limpiarFila)
      .filter(function(d){ return d.ID_COMPRA === params.ID_COMPRA; });
    var productos = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
    var tiposMov = leerHoja(HOJAS.TIPO_MOVIMIENTO_INVENTARIO).map(limpiarFila);
    var idTipoSalida = '-';
    for (var t = 0; t < tiposMov.length; t++) { if (String(tiposMov[t].NOMBRE||'').toUpperCase() === 'SALIDA') { idTipoSalida = tiposMov[t].ID_TMOVIMIENTO; break; } }

    for (var d = 0; d < detalle.length; d++) {
      var prod = null;
      for (var p = 0; p < productos.length; p++) { if (productos[p].ID_PRODUCTO === detalle[d].ID_PRODUCTO) { prod = productos[p]; break; } }
      if (prod) {
        var cant = parseFloat(detalle[d].CANTIDAD) || 0;
        var stockAnt = parseFloat(prod.STOCK) || 0;
        var stockAct = stockAnt - cant;
        if (stockAct < 0) stockAct = 0; // no permitir negativo
        insertarFila(HOJAS.MOVIMIENTO_INVENTARIO, {
          ID_MOVIMIENTO:    generarID(HOJAS.MOVIMIENTO_INVENTARIO, 'ID_MOVIMIENTO', 'MOV', 4),
          ID_PRODUCTO:      detalle[d].ID_PRODUCTO,
          ID_TMOVIMIENTO:   idTipoSalida,
          CANTIDAD:         cant.toString(),
          STOCK_ANTERIOR:   stockAnt.toString(),
          STOCK_ACTUAL:     stockAct.toString(),
          OBSERVACION:      'ANULACIÓN COMPRA ' + params.ID_COMPRA,
          ID_USUARIO:       params.usuario || '-',
          FECHA_MOVIMIENTO: getFecha('datetime'),
          FECHA_REGISTRO:   getFecha('datetime'),
        });
        actualizarFila(HOJAS.PRODUCTO_INSUMO, 'ID_PRODUCTO', detalle[d].ID_PRODUCTO, { STOCK: stockAct.toString() });
        prod.STOCK = stockAct.toString();
      }
    }

    // Desactivar los lotes generados por esta compra
    try {
      var lotesCompra = leerHoja(HOJAS.LOTE_PRODUCTO).map(limpiarFila)
        .filter(function(l){ return l.OBSERVACION === ('COMPRA ' + params.ID_COMPRA); });
      for (var lc = 0; lc < lotesCompra.length; lc++) {
        actualizarFila(HOJAS.LOTE_PRODUCTO, 'ID_LOTE', lotesCompra[lc].ID_LOTE, {
          ESTADO: 'ANULADO', CANTIDAD_DISPONIBLE: '0',
        });
      }
    } catch (eLot) {}

    // Anular la obligación asociada (si existe)
    if (compra.ID_OBLIGACION && compra.ID_OBLIGACION !== '-') {
      actualizarFila(HOJAS.OBLIGACION, 'ID_OBLIGACION', compra.ID_OBLIGACION, {
        ESTADO: 'ANULADO', OBSERVACION: 'ANULADA POR ANULACIÓN DE COMPRA ' + params.ID_COMPRA,
      });
    }

    // Marcar la compra como anulada
    actualizarFila(HOJAS.COMPRA_INSUMO, 'ID_COMPRA', params.ID_COMPRA, {
      ESTADO: 'ANULADO', OBSERVACION: String(params.MOTIVO || 'Anulada').toUpperCase(),
    });

    lock.releaseLock();
    return respuestaOK({}, 'Compra anulada. Se revirtió el stock' + (compra.ID_OBLIGACION !== '-' ? ' y la obligación.' : '.'));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al anular compra: ' + err.message);
  }
}
