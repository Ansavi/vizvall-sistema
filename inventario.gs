// ============================================================
// VIZVALL — inventario.gs — Productos/insumos + Kardex
// ============================================================

// ════════════ PRODUCTOS ════════════
function listarProductos(params) {
  try {
    var prods = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila)
      .filter(function(p){ return p.ID_PRODUCTO && String(p.ID_PRODUCTO).trim() !== ''; });
    if (params && params.soloActivos) {
      prods = prods.filter(function(p){ return p.ESTADO === 'ACTIVO'; });
    }
    if (params && params.bajoStock) {
      prods = prods.filter(function(p){
        return (parseFloat(p.STOCK)||0) <= (parseFloat(p.STOCK_MINIMO)||0);
      });
    }
    prods.sort(function(a,b){ return String(a.NOMBRE||'') > String(b.NOMBRE||'') ? 1 : -1; });
    return respuestaOK(prods, prods.length + ' producto(s).');
  } catch (err) {
    return respuestaError('Error al listar productos: ' + err.message);
  }
}

function guardarProducto(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    var nombre = String(params.NOMBRE || '').trim().toUpperCase();
    if (!nombre) { lock.releaseLock(); return respuestaError('El nombre del producto es requerido.'); }
    // Código único (si se ingresa)
    var codigo = String(params.CODIGO || '').trim().toUpperCase();
    if (codigo && codigo !== '-') {
      var prodsExist = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
      for (var pe = 0; pe < prodsExist.length; pe++) {
        if (String(prodsExist[pe].CODIGO||'').trim().toUpperCase() === codigo && prodsExist[pe].ID_PRODUCTO !== params.ID_PRODUCTO) {
          lock.releaseLock();
          return respuestaError('Ya existe un producto con ese código.');
        }
      }
    }
    // Precio referencial mayor a 0 (si se ingresa)
    var precioRef = parseFloat(params.PRECIO_REFERENCIAL) || 0;
    if (params.PRECIO_REFERENCIAL && precioRef <= 0) {
      lock.releaseLock();
      return respuestaError('El precio referencial debe ser mayor a 0.');
    }

    if (params.ID_PRODUCTO) {
      // Editar (no se toca STOCK aquí; el stock cambia solo por movimientos)
      actualizarFila(HOJAS.PRODUCTO_INSUMO, 'ID_PRODUCTO', params.ID_PRODUCTO, {
        CODIGO:             String(params.CODIGO || '-').toUpperCase(),
        NOMBRE:             nombre,
        DESCRIPCION:        String(params.DESCRIPCION || '-').toUpperCase(),
        UNIDAD_MEDIDA:      String(params.UNIDAD_MEDIDA || 'UND').toUpperCase(),
        STOCK_MINIMO:       (parseFloat(params.STOCK_MINIMO)||0).toString(),
        PRECIO_REFERENCIAL: (parseFloat(params.PRECIO_REFERENCIAL)||0).toFixed(2),
        ESTADO:             params.ESTADO || 'ACTIVO',
      });
      lock.releaseLock();
      return respuestaOK({ ID_PRODUCTO: params.ID_PRODUCTO }, 'Producto actualizado.');
    } else {
      // Nuevo
      var id = generarID(HOJAS.PRODUCTO_INSUMO, 'ID_PRODUCTO', 'PRD', 4);
      var stockIni = parseFloat(params.STOCK) || 0;
      insertarFila(HOJAS.PRODUCTO_INSUMO, {
        ID_PRODUCTO:        id,
        CODIGO:             String(params.CODIGO || '-').toUpperCase(),
        NOMBRE:             nombre,
        DESCRIPCION:        String(params.DESCRIPCION || '-').toUpperCase(),
        UNIDAD_MEDIDA:      String(params.UNIDAD_MEDIDA || 'UND').toUpperCase(),
        STOCK:              stockIni.toString(),
        STOCK_MINIMO:       (parseFloat(params.STOCK_MINIMO)||0).toString(),
        PRECIO_REFERENCIAL: (parseFloat(params.PRECIO_REFERENCIAL)||0).toFixed(2),
        ESTADO:             'ACTIVO',
        FECHA_REGISTRO:     getFecha('datetime'),
      });
      // Si tiene stock inicial, registrar movimiento de entrada
      if (stockIni > 0) {
        registrarMovimientoInventario_(id, 'ENTRADA', stockIni, 0, stockIni,
          'Stock inicial', params.usuario || '-');
      }
      lock.releaseLock();
      return respuestaOK({ ID_PRODUCTO: id }, 'Producto registrado.');
    }
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar producto: ' + err.message);
  }
}

// ════════════ MOVIMIENTOS (KARDEX) ════════════

// Helper interno: registra un movimiento y actualiza el stock del producto
function registrarMovimientoInventario_(idProducto, tipoNombre, cantidad, stockAnt, stockAct, observacion, usuario) {
  // Buscar el ID del tipo de movimiento por nombre
  var tipos = leerHoja(HOJAS.TIPO_MOVIMIENTO_INVENTARIO).map(limpiarFila);
  var idTipo = '-';
  for (var i = 0; i < tipos.length; i++) {
    if (String(tipos[i].NOMBRE || '').toUpperCase() === String(tipoNombre).toUpperCase()) {
      idTipo = tipos[i].ID_TMOVIMIENTO; break;
    }
  }
  insertarFila(HOJAS.MOVIMIENTO_INVENTARIO, {
    ID_MOVIMIENTO:    generarID(HOJAS.MOVIMIENTO_INVENTARIO, 'ID_MOVIMIENTO', 'MOV', 4),
    ID_PRODUCTO:      idProducto,
    ID_TMOVIMIENTO:   idTipo,
    CANTIDAD:         cantidad.toString(),
    STOCK_ANTERIOR:   stockAnt.toString(),
    STOCK_ACTUAL:     stockAct.toString(),
    OBSERVACION:      observacion || '-',
    ID_USUARIO:       usuario || '-',
    FECHA_MOVIMIENTO: getFecha('datetime'),
    FECHA_REGISTRO:   getFecha('datetime'),
  });
}

// Registrar movimiento manual (entrada o salida)
function registrarMovimiento_inv(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_PRODUCTO) { lock.releaseLock(); return respuestaError('Seleccione un producto.'); }
    var cant = parseFloat(params.CANTIDAD);
    if (isNaN(cant) || cant <= 0) { lock.releaseLock(); return respuestaError('La cantidad debe ser mayor a 0.'); }

    var tipo = String(params.TIPO || '').toUpperCase(); // ENTRADA | SALIDA
    if (tipo !== 'ENTRADA' && tipo !== 'SALIDA') { lock.releaseLock(); return respuestaError('Tipo debe ser ENTRADA o SALIDA.'); }

    // Leer stock actual
    var prods = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
    var prod = null;
    for (var i = 0; i < prods.length; i++) { if (prods[i].ID_PRODUCTO === params.ID_PRODUCTO) { prod = prods[i]; break; } }
    if (!prod) { lock.releaseLock(); return respuestaError('Producto no encontrado.'); }

    var stockAnt = parseFloat(prod.STOCK) || 0;
    var stockAct = (tipo === 'ENTRADA') ? (stockAnt + cant) : (stockAnt - cant);
    if (stockAct < 0) { lock.releaseLock(); return respuestaError('Stock insuficiente. Stock actual: ' + stockAnt); }

    // Registrar movimiento y actualizar stock
    registrarMovimientoInventario_(params.ID_PRODUCTO, tipo, cant, stockAnt, stockAct,
      params.OBSERVACION || '-', params.usuario || '-');
    actualizarFila(HOJAS.PRODUCTO_INSUMO, 'ID_PRODUCTO', params.ID_PRODUCTO, { STOCK: stockAct.toString() });

    lock.releaseLock();
    return respuestaOK({ STOCK_ACTUAL: stockAct }, 'Movimiento registrado. Stock: ' + stockAct);
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al registrar movimiento: ' + err.message);
  }
}

// Kardex: movimientos de un producto (o todos)
function listarKardex(params) {
  try {
    var movs = leerHoja(HOJAS.MOVIMIENTO_INVENTARIO).map(limpiarFila)
      .filter(function(m){ return m.ID_MOVIMIENTO && String(m.ID_MOVIMIENTO).trim() !== ''; });
    if (params && params.ID_PRODUCTO) {
      movs = movs.filter(function(m){ return m.ID_PRODUCTO === params.ID_PRODUCTO; });
    }
    if (params && params.fechaDesde) {
      movs = movs.filter(function(m){ return String(m.FECHA_MOVIMIENTO||'').substring(0,10) >= params.fechaDesde; });
    }
    if (params && params.fechaHasta) {
      movs = movs.filter(function(m){ return String(m.FECHA_MOVIMIENTO||'').substring(0,10) <= params.fechaHasta; });
    }
    // Enriquecer con nombre de producto y tipo
    var prods = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
    var tipos = leerHoja(HOJAS.TIPO_MOVIMIENTO_INVENTARIO).map(limpiarFila);
    var enriched = movs.map(function(m){
      var pNom = m.ID_PRODUCTO, tNom = m.ID_TMOVIMIENTO;
      for (var i = 0; i < prods.length; i++) { if (prods[i].ID_PRODUCTO === m.ID_PRODUCTO) { pNom = prods[i].NOMBRE; break; } }
      for (var j = 0; j < tipos.length; j++) { if (tipos[j].ID_TMOVIMIENTO === m.ID_TMOVIMIENTO) { tNom = tipos[j].NOMBRE; break; } }
      return {
        ID_MOVIMIENTO:    m.ID_MOVIMIENTO,
        PRODUCTO_NOMBRE:  pNom,
        TIPO_NOMBRE:      tNom,
        CANTIDAD:         m.CANTIDAD,
        STOCK_ANTERIOR:   m.STOCK_ANTERIOR,
        STOCK_ACTUAL:     m.STOCK_ACTUAL,
        OBSERVACION:      m.OBSERVACION,
        FECHA_MOVIMIENTO: m.FECHA_MOVIMIENTO,
      };
    });
    enriched.sort(function(a,b){ return String(a.FECHA_MOVIMIENTO||'') > String(b.FECHA_MOVIMIENTO||'') ? -1 : 1; });
    return respuestaOK(enriched, enriched.length + ' movimiento(s).');
  } catch (err) {
    return respuestaError('Error al listar kardex: ' + err.message);
  }
}
