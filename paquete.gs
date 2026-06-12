// ============================================================
// VIZVALL — paquete.gs — Catálogo de Paquetes
// Un paquete agrupa servicios + nº de sesiones a un precio total.
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR PAQUETES (con su detalle de servicios)
// ════════════════════════════════════════════════════════════
function listarPaquetes(params) {
  try {
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila)
      .filter(function(p){ return p.ID_PAQUETE && String(p.ID_PAQUETE).trim() !== ''; });

    var detalles = leerHoja(HOJAS.DPAQUETE).map(limpiarFila);
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);

    if (params && params.estado) {
      paquetes = paquetes.filter(function(p){ return p.ESTADO === params.estado; });
    }

    var enriched = paquetes.map(function(p){
      var items = [];
      for (var i = 0; i < detalles.length; i++) {
        if (detalles[i].ID_PAQUETE === p.ID_PAQUETE) {
          var srvNombre = '—';
          for (var j = 0; j < servicios.length; j++) {
            if (servicios[j].ID_SERVICIO === detalles[i].ID_SERVICIO) { srvNombre = servicios[j].NOMBRE_SERVICIO || '—'; break; }
          }
          items.push({
            ID_DPAQUETE:       detalles[i].ID_DPAQUETE,
            ID_SERVICIO:       detalles[i].ID_SERVICIO,
            SERVICIO_NOMBRE:   srvNombre,
            CANTIDAD:          detalles[i].CANTIDAD,
            PRECIO_REFERENCIAL: detalles[i].PRECIO_REFERENCIAL,
          });
        }
      }
      return {
        ID_PAQUETE:     p.ID_PAQUETE,
        NOMBRE_PAQUETE: p.NOMBRE_PAQUETE,
        TIPO:           p.TIPO,
        DESCRIPCION:    p.DESCRIPCION,
        TOTAL_SESIONES: p.TOTAL_SESIONES,
        PRECIO_TOTAL:   p.PRECIO_TOTAL,
        VIGENCIA_DIAS:  p.VIGENCIA_DIAS,
        ESTADO:         p.ESTADO || 'ACTIVO',
        SERVICIOS:      items,
      };
    });
    return respuestaOK(enriched, enriched.length + ' paquete(s).');
  } catch (err) {
    return respuestaError('Error al listar paquetes: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR PAQUETE (nuevo) — con su detalle de servicios
//  params.items = JSON [{ ID_SERVICIO, CANTIDAD, PRECIO_REFERENCIAL }]
// ════════════════════════════════════════════════════════════
function guardarPaquete(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede crear paquetes.', 'ERR_PERMISO');
    }
    if (!params.NOMBRE_PAQUETE || String(params.NOMBRE_PAQUETE).trim() === '') {
      return respuestaError('El nombre del paquete es requerido.');
    }
    if (params.PRECIO_TOTAL === undefined || params.PRECIO_TOTAL === '' || isNaN(parseFloat(params.PRECIO_TOTAL))) {
      return respuestaError('El precio total es requerido y debe ser numérico.');
    }

    var items = params.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e) { items = []; } }
    if (!Array.isArray(items)) items = [];

    var idPaquete = generarID(HOJAS.PAQUETE, 'ID_PAQUETE', 'PAP', 4);

    insertarFila(HOJAS.PAQUETE, {
      ID_PAQUETE:     idPaquete,
      NOMBRE_PAQUETE: String(params.NOMBRE_PAQUETE).trim().toUpperCase(),
      TIPO:           params.TIPO || '-',
      DESCRIPCION:    params.DESCRIPCION ? String(params.DESCRIPCION).toUpperCase() : '-',
      TOTAL_SESIONES: parseInt(params.TOTAL_SESIONES) || 0,
      PRECIO_TOTAL:   parseFloat(params.PRECIO_TOTAL).toFixed(2),
      VIGENCIA_DIAS:  parseInt(params.VIGENCIA_DIAS) || 0,
      ESTADO:         params.ESTADO || 'ACTIVO',
      FECHA_REGISTRO: getFecha('fecha'),
    });

    // Detalle de servicios del paquete
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.ID_SERVICIO) continue;
      insertarFila(HOJAS.DPAQUETE, {
        ID_DPAQUETE:        generarID(HOJAS.DPAQUETE, 'ID_DPAQUETE', 'DPA', 4),
        ID_PAQUETE:         idPaquete,
        ID_SERVICIO:        it.ID_SERVICIO,
        CANTIDAD:           parseInt(it.CANTIDAD) || 1,
        PRECIO_REFERENCIAL: (parseFloat(it.PRECIO_REFERENCIAL) || 0).toFixed(2),
      });
    }

    return respuestaOK({ ID_PAQUETE: idPaquete }, 'Paquete creado: ' + idPaquete);
  } catch (err) {
    return respuestaError('Error al guardar paquete: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR PAQUETE (datos básicos; reemplaza detalle si se envía)
// ════════════════════════════════════════════════════════════
function actualizarPaquete(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede editar paquetes.', 'ERR_PERMISO');
    }
    if (!params.ID_PAQUETE) return respuestaError('ID_PAQUETE requerido.');

    var datos = {};
    if (params.NOMBRE_PAQUETE !== undefined) datos.NOMBRE_PAQUETE = String(params.NOMBRE_PAQUETE).trim().toUpperCase();
    if (params.TIPO !== undefined) datos.TIPO = params.TIPO || '-';
    if (params.DESCRIPCION !== undefined) datos.DESCRIPCION = params.DESCRIPCION ? String(params.DESCRIPCION).toUpperCase() : '-';
    if (params.TOTAL_SESIONES !== undefined) datos.TOTAL_SESIONES = parseInt(params.TOTAL_SESIONES) || 0;
    if (params.PRECIO_TOTAL !== undefined && params.PRECIO_TOTAL !== '') datos.PRECIO_TOTAL = parseFloat(params.PRECIO_TOTAL).toFixed(2);
    if (params.VIGENCIA_DIAS !== undefined) datos.VIGENCIA_DIAS = parseInt(params.VIGENCIA_DIAS) || 0;
    if (params.ESTADO !== undefined) datos.ESTADO = params.ESTADO;

    actualizarFila(HOJAS.PAQUETE, 'ID_PAQUETE', params.ID_PAQUETE, datos);

    // Si envía items, reemplazar el detalle (borrar antiguos lógicamente no aplica; re-creamos)
    var items = params.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e) { items = null; } }
    if (Array.isArray(items)) {
      // Marcar detalles antiguos: como DPAQUETE no tiene ESTADO, los dejamos y agregamos nuevos
      // Para simplicidad, sólo agregamos si no existían. (Edición de detalle avanzada se hará luego.)
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.ID_SERVICIO || it._existente) continue;
        insertarFila(HOJAS.DPAQUETE, {
          ID_DPAQUETE:        generarID(HOJAS.DPAQUETE, 'ID_DPAQUETE', 'DPA', 4),
          ID_PAQUETE:         params.ID_PAQUETE,
          ID_SERVICIO:        it.ID_SERVICIO,
          CANTIDAD:           parseInt(it.CANTIDAD) || 1,
          PRECIO_REFERENCIAL: (parseFloat(it.PRECIO_REFERENCIAL) || 0).toFixed(2),
        });
      }
    }

    return respuestaOK({}, 'Paquete actualizado.');
  } catch (err) {
    return respuestaError('Error al actualizar paquete: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  IMPORTACIÓN MASIVA DE PAQUETES
// ════════════════════════════════════════════════════════════
function importarPaquetesMasivo(params) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede importar paquetes.', 'ERR_PERMISO');
    }
    var filas = params.filas;
    if (!Array.isArray(filas) || !filas.length) return respuestaError('No hay datos para importar.');
    if (filas.length > 500) return respuestaError('Máximo 500 paquetes por importación.');

    var creados = 0, errores = [];
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      var fila = i + 2;
      try {
        var nombre = String(f.NOMBRE_PAQUETE || '').trim();
        var precio = f.PRECIO_TOTAL;
        var sesiones = f.TOTAL_SESIONES;
        if (!nombre) { errores.push('Fila ' + fila + ': falta NOMBRE_PAQUETE.'); continue; }
        if (precio === undefined || precio === '' || isNaN(parseFloat(precio))) {
          errores.push('Fila ' + fila + ' (' + nombre + '): PRECIO_TOTAL inválido.'); continue;
        }
        if (sesiones === undefined || sesiones === '' || isNaN(parseInt(sesiones))) {
          errores.push('Fila ' + fila + ' (' + nombre + '): TOTAL_SESIONES inválido.'); continue;
        }
        var idPaquete = generarID(HOJAS.PAQUETE, 'ID_PAQUETE', 'PAP', 4);
        insertarFila(HOJAS.PAQUETE, {
          ID_PAQUETE:     idPaquete,
          NOMBRE_PAQUETE: nombre.toUpperCase(),
          TIPO:           '-',
          DESCRIPCION:    String(f.DESCRIPCION || '-').trim().toUpperCase() || '-',
          TOTAL_SESIONES: parseInt(sesiones) || 0,
          PRECIO_TOTAL:   parseFloat(precio).toFixed(2),
          VIGENCIA_DIAS:  parseInt(f.VIGENCIA_DIAS) || 0,
          ESTADO:         'ACTIVO',
          FECHA_REGISTRO: getFecha('fecha'),
        });
        creados++;
      } catch (eFila) {
        errores.push('Fila ' + fila + ': ' + eFila.message);
      }
    }
    return respuestaOK({ creados: creados, errores: errores },
      creados + ' paquete(s) importado(s).' + (errores.length ? ' ' + errores.length + ' con error.' : ''));
  } catch (err) {
    return respuestaError('Error en importación: ' + err.message);
  } finally {
    lock.releaseLock();
  }
}
