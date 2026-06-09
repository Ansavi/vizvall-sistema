// ============================================================
// VIZVALL — recetas.gs — Recetas de insumos por servicio + FEFO
// ============================================================

// Listar la receta (insumos) de un servicio
function listarRecetaServicio(params) {
  try {
    if (!params.ID_SERVICIO) return respuestaError('ID_SERVICIO requerido.');
    var receta = leerHoja(HOJAS.SERVICIO_INSUMO).map(limpiarFila)
      .filter(function(r){ return r.ID_SERVICIO === params.ID_SERVICIO; });
    var productos = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
    var enriched = receta.map(function(r){
      var pNom = r.ID_PRODUCTO, pUnidad = '', pStock = '0';
      for (var i = 0; i < productos.length; i++) {
        if (productos[i].ID_PRODUCTO === r.ID_PRODUCTO) {
          pNom = productos[i].NOMBRE; pUnidad = productos[i].UNIDAD_MEDIDA; pStock = productos[i].STOCK; break;
        }
      }
      return {
        ID_SERVICIO_INSUMO: r.ID_SERVICIO_INSUMO,
        ID_PRODUCTO:        r.ID_PRODUCTO,
        PRODUCTO_NOMBRE:    pNom,
        UNIDAD_MEDIDA:      pUnidad,
        STOCK_ACTUAL:       pStock,
        CANTIDAD:           r.CANTIDAD,
        OBSERVACION:        r.OBSERVACION,
      };
    });
    return respuestaOK(enriched, enriched.length + ' insumo(s) en la receta.');
  } catch (err) {
    return respuestaError('Error al listar receta: ' + err.message);
  }
}

// Agregar (o actualizar) un insumo en la receta de un servicio
function agregarInsumoReceta(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_SERVICIO) { lock.releaseLock(); return respuestaError('Servicio requerido.'); }
    if (!params.ID_PRODUCTO) { lock.releaseLock(); return respuestaError('Producto requerido.'); }
    var cant = parseFloat(params.CANTIDAD);
    if (isNaN(cant) || cant <= 0) { lock.releaseLock(); return respuestaError('La cantidad debe ser mayor a 0.'); }

    var receta = leerHoja(HOJAS.SERVICIO_INSUMO).map(limpiarFila);
    for (var i = 0; i < receta.length; i++) {
      if (receta[i].ID_SERVICIO === params.ID_SERVICIO && receta[i].ID_PRODUCTO === params.ID_PRODUCTO) {
        actualizarFila(HOJAS.SERVICIO_INSUMO, 'ID_SERVICIO_INSUMO', receta[i].ID_SERVICIO_INSUMO, {
          CANTIDAD: cant.toString(),
          OBSERVACION: String(params.OBSERVACION || '-').toUpperCase(),
        });
        lock.releaseLock();
        return respuestaOK({}, 'Insumo actualizado en la receta.');
      }
    }

    insertarFila(HOJAS.SERVICIO_INSUMO, {
      ID_SERVICIO_INSUMO: generarID(HOJAS.SERVICIO_INSUMO, 'ID_SERVICIO_INSUMO', 'SIN', 4),
      ID_SERVICIO:        params.ID_SERVICIO,
      ID_PRODUCTO:        params.ID_PRODUCTO,
      CANTIDAD:           cant.toString(),
      OBSERVACION:        String(params.OBSERVACION || '-').toUpperCase(),
    });
    lock.releaseLock();
    return respuestaOK({}, 'Insumo agregado a la receta.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al agregar insumo: ' + err.message);
  }
}

// Quitar un insumo de la receta (eliminación física, es configuración)
function quitarInsumoReceta(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_SERVICIO_INSUMO) return respuestaError('ID_SERVICIO_INSUMO requerido.');
    var hoja = getHoja(HOJAS.SERVICIO_INSUMO);
    var datos = hoja.getDataRange().getValues();
    var cab = datos[0];
    var idxId = cab.indexOf('ID_SERVICIO_INSUMO');
    for (var r = datos.length - 1; r >= 1; r--) {
      if (String(datos[r][idxId]) === String(params.ID_SERVICIO_INSUMO)) {
        hoja.deleteRow(r + 1);
      }
    }
    return respuestaOK({}, 'Insumo quitado de la receta.');
  } catch (err) {
    return respuestaError('Error al quitar insumo: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  Solo VERIFICA stock de insumos (no descuenta). {ok, faltantes}
// ════════════════════════════════════════════════════════════
function verificarStockInsumos_(items) {
  var faltantes = [];
  if (!Array.isArray(items) || !items.length) return { ok: true, faltantes: faltantes };
  var recetaAll = leerHoja(HOJAS.SERVICIO_INSUMO).map(limpiarFila);
  var productos  = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
  var consumo = {};
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.TIPO !== 'SERVICIO' || !it.ID_SERVICIO) continue;
    var cantServicio = parseFloat(it.CANTIDAD) || 1;
    for (var r = 0; r < recetaAll.length; r++) {
      if (recetaAll[r].ID_SERVICIO === it.ID_SERVICIO) {
        var idProd = recetaAll[r].ID_PRODUCTO;
        consumo[idProd] = (consumo[idProd] || 0) + (parseFloat(recetaAll[r].CANTIDAD) || 0) * cantServicio;
      }
    }
  }
  for (var idProd in consumo) {
    var prod = null;
    for (var p = 0; p < productos.length; p++) { if (productos[p].ID_PRODUCTO === idProd) { prod = productos[p]; break; } }
    if (!prod) continue;
    var stockActual = parseFloat(prod.STOCK) || 0;
    if (consumo[idProd] > stockActual) {
      faltantes.push({ producto: prod.NOMBRE, requerido: consumo[idProd], disponible: stockActual });
    }
  }
  return { ok: faltantes.length === 0, faltantes: faltantes };
}

// ════════════════════════════════════════════════════════════
//  DESCUENTA insumos por FEFO (lote que vence primero).
//  Genera MOVIMIENTO_INVENTARIO SALIDA y actualiza stock.
// ════════════════════════════════════════════════════════════
function descontarInsumosVenta_(items, idVenta, usuario, bloquearSinStock) {
  var verif = verificarStockInsumos_(items);
  if (bloquearSinStock && !verif.ok) return { ok: false, faltantes: verif.faltantes };

  var recetaAll = leerHoja(HOJAS.SERVICIO_INSUMO).map(limpiarFila);
  var productos  = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila);
  var lotes      = leerHoja(HOJAS.LOTE_PRODUCTO).map(limpiarFila);
  var tiposMov   = leerHoja(HOJAS.TIPO_MOVIMIENTO_INVENTARIO).map(limpiarFila);
  var idTipoSalida = '-';
  for (var t = 0; t < tiposMov.length; t++) {
    if (String(tiposMov[t].NOMBRE||'').toUpperCase().indexOf('SALIDA') >= 0) { idTipoSalida = tiposMov[t].ID_TMOVIMIENTO; break; }
  }

  // Acumular consumo por producto
  var consumo = {};
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.TIPO !== 'SERVICIO' || !it.ID_SERVICIO) continue;
    var cantServicio = parseFloat(it.CANTIDAD) || 1;
    for (var r = 0; r < recetaAll.length; r++) {
      if (recetaAll[r].ID_SERVICIO === it.ID_SERVICIO) {
        var idP = recetaAll[r].ID_PRODUCTO;
        consumo[idP] = (consumo[idP] || 0) + (parseFloat(recetaAll[r].CANTIDAD) || 0) * cantServicio;
      }
    }
  }

  for (var idProd2 in consumo) {
    var prod2 = null;
    for (var p2 = 0; p2 < productos.length; p2++) { if (productos[p2].ID_PRODUCTO === idProd2) { prod2 = productos[p2]; break; } }
    if (!prod2) continue;

    var aDescontar = consumo[idProd2];
    var stockAnt = parseFloat(prod2.STOCK) || 0;
    var stockNuevo = stockAnt - aDescontar;
    if (stockNuevo < 0) stockNuevo = 0;

    // FEFO: lotes activos con disponible, ordenados por vencimiento más próximo
    var lotesProd = lotes.filter(function(l){
      return l.ID_PRODUCTO === idProd2 && l.ESTADO === 'ACTIVO' && (parseFloat(l.CANTIDAD_DISPONIBLE)||0) > 0;
    });
    lotesProd.sort(function(a,b){ return String(a.FECHA_VENCIMIENTO||'9999') > String(b.FECHA_VENCIMIENTO||'9999') ? 1 : -1; });
    var restante = aDescontar;
    for (var lp = 0; lp < lotesProd.length && restante > 0; lp++) {
      var disp = parseFloat(lotesProd[lp].CANTIDAD_DISPONIBLE) || 0;
      var quita = Math.min(disp, restante);
      var nuevoDisp = disp - quita;
      actualizarFila(HOJAS.LOTE_PRODUCTO, 'ID_LOTE', lotesProd[lp].ID_LOTE, {
        CANTIDAD_DISPONIBLE: nuevoDisp.toString(),
        ESTADO: nuevoDisp <= 0 ? 'AGOTADO' : 'ACTIVO',
      });
      restante -= quita;
    }

    insertarFila(HOJAS.MOVIMIENTO_INVENTARIO, {
      ID_MOVIMIENTO:    generarID(HOJAS.MOVIMIENTO_INVENTARIO, 'ID_MOVIMIENTO', 'MOV', 4),
      ID_PRODUCTO:      idProd2,
      ID_TMOVIMIENTO:   idTipoSalida,
      CANTIDAD:         aDescontar.toString(),
      STOCK_ANTERIOR:   stockAnt.toString(),
      STOCK_ACTUAL:     stockNuevo.toString(),
      OBSERVACION:      'CONSUMO POR VENTA ' + idVenta,
      ID_USUARIO:       usuario || '-',
      FECHA_MOVIMIENTO: getFecha('datetime'),
      FECHA_REGISTRO:   getFecha('datetime'),
    });
    actualizarFila(HOJAS.PRODUCTO_INSUMO, 'ID_PRODUCTO', idProd2, { STOCK: stockNuevo.toString() });
  }

  return { ok: true, faltantes: verif.faltantes };
}
