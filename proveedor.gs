// ============================================================
// VIZVALL — proveedor.gs — CRUD de Proveedores
// ============================================================

function listarProveedores(params) {
  try {
    var provs = leerHoja(HOJAS.PROVEEDOR).map(limpiarFila)
      .filter(function(p){ return p.ID_PROVEEDOR && String(p.ID_PROVEEDOR).trim() !== ''; });
    if (params && params.soloActivos) {
      provs = provs.filter(function(p){ return p.ESTADO === 'ACTIVO'; });
    }
    provs.sort(function(a,b){ return String(a.RAZON_SOCIAL||'') > String(b.RAZON_SOCIAL||'') ? 1 : -1; });
    return respuestaOK(provs, provs.length + ' proveedor(es).');
  } catch (err) {
    return respuestaError('Error al listar proveedores: ' + err.message);
  }
}

function guardarProveedor(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Compras')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso para gestionar proveedores.', 'ERR_PERMISO');
    }
    var razon = String(params.RAZON_SOCIAL || '').trim().toUpperCase();
    if (!razon) { lock.releaseLock(); return respuestaError('La razón social es requerida.'); }

    var ruc = String(params.RUC || '').trim();
    if (ruc && !/^(10|20)\d{9}$/.test(ruc)) {
      lock.releaseLock();
      return respuestaError('El RUC debe tener 11 dígitos y empezar con 10 o 20.');
    }
    // Teléfono 9-15 caracteres (si se ingresa)
    var tel = String(params.TELEFONO || '').replace(/\s/g,'').trim();
    if (tel && tel !== '-' && !/^[0-9]{9}$/.test(tel)) {
      lock.releaseLock();
      return respuestaError('El teléfono debe tener exactamente 9 dígitos numéricos.');
    }
    // Email formato válido (si se ingresa)
    var email = String(params.EMAIL || '').trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      lock.releaseLock();
      return respuestaError('El email no tiene un formato válido.');
    }
    // RUC único (si se ingresa)
    if (ruc) {
      var existentes = leerHoja(HOJAS.PROVEEDOR).map(limpiarFila);
      for (var e = 0; e < existentes.length; e++) {
        if (String(existentes[e].RUC||'').trim() === ruc && existentes[e].ID_PROVEEDOR !== params.ID_PROVEEDOR) {
          lock.releaseLock();
          return respuestaError('Ya existe un proveedor con ese RUC.');
        }
      }
    }

    if (params.ID_PROVEEDOR) {
      // Editar
      actualizarFila(HOJAS.PROVEEDOR, 'ID_PROVEEDOR', params.ID_PROVEEDOR, {
        RUC:          ruc || '-',
        RAZON_SOCIAL: razon,
        DIRECCION:    String(params.DIRECCION || '-').toUpperCase(),
        TELEFONO:     params.TELEFONO || '-',
        EMAIL:        params.EMAIL || '-',
        CONTACTO:     String(params.CONTACTO || '-').toUpperCase(),
        ESTADO:       params.ESTADO || 'ACTIVO',
      });
      lock.releaseLock();
      return respuestaOK({ ID_PROVEEDOR: params.ID_PROVEEDOR }, 'Proveedor actualizado.');
    } else {
      // Nuevo
      var id = generarID(HOJAS.PROVEEDOR, 'ID_PROVEEDOR', 'PRV', 4);
      insertarFila(HOJAS.PROVEEDOR, {
        ID_PROVEEDOR:   id,
        RUC:            ruc || '-',
        RAZON_SOCIAL:   razon,
        DIRECCION:      String(params.DIRECCION || '-').toUpperCase(),
        TELEFONO:       params.TELEFONO || '-',
        EMAIL:          params.EMAIL || '-',
        CONTACTO:       String(params.CONTACTO || '-').toUpperCase(),
        ESTADO:         'ACTIVO',
        FECHA_REGISTRO: getFecha('datetime'),
      });
      lock.releaseLock();
      return respuestaOK({ ID_PROVEEDOR: id }, 'Proveedor registrado.');
    }
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar proveedor: ' + err.message);
  }
}

function eliminarProveedor(params) {
  try {
    if (!_puedeModulo(params, 'Compras')) {
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_PROVEEDOR) return respuestaError('ID_PROVEEDOR requerido.');
    // No desactivar si tiene compras u obligaciones asociadas
    var compras = leerHoja(HOJAS.COMPRA_INSUMO).map(limpiarFila);
    for (var ci = 0; ci < compras.length; ci++) {
      if (compras[ci].ID_PROVEEDOR === params.ID_PROVEEDOR && compras[ci].ESTADO !== 'ANULADO') {
        return respuestaError('No se puede desactivar: el proveedor tiene compras registradas.');
      }
    }
    var obls = leerHoja(HOJAS.OBLIGACION).map(limpiarFila);
    for (var oi = 0; oi < obls.length; oi++) {
      if (obls[oi].ID_PROVEEDOR === params.ID_PROVEEDOR && obls[oi].ESTADO !== 'ANULADO' && obls[oi].ESTADO !== 'PAGADO') {
        return respuestaError('No se puede desactivar: el proveedor tiene obligaciones pendientes.');
      }
    }
    // Baja lógica
    actualizarFila(HOJAS.PROVEEDOR, 'ID_PROVEEDOR', params.ID_PROVEEDOR, { ESTADO: 'INACTIVO' });
    return respuestaOK({}, 'Proveedor desactivado.');
  } catch (err) {
    return respuestaError('Error al eliminar proveedor: ' + err.message);
  }
}
