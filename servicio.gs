// ============================================================
// VIZVALL — servicio.gs — Catálogo de Servicios con precios
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR SERVICIOS (con nombre de especialidad / área / tipo)
// ════════════════════════════════════════════════════════════
function listarServicios(params) {
  try {
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila)
      .filter(function(s){ return s.ID_SERVICIO && String(s.ID_SERVICIO).trim() !== ''; });

    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var areas = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
    var tservicios = leerHoja(HOJAS.TSERVICIO).map(limpiarFila);

    if (params && params.estado) {
      servicios = servicios.filter(function(s){ return s.ESTADO === params.estado; });
    }

    var enriched = servicios.map(function(s){
      var espNombre = '—', areaNombre = '—', tipoNombre = '—';
      for (var i = 0; i < especialidades.length; i++) {
        if (especialidades[i].ID_ESPECIALIDAD === s.ID_ESPECIALIDAD) { espNombre = especialidades[i].ESPECIALIDAD || '—'; break; }
      }
      for (var j = 0; j < areas.length; j++) {
        if (areas[j].ID_AREA_APOYO === s.ID_AREA_APOYO) { areaNombre = areas[j].NOMBRE || '—'; break; }
      }
      for (var k = 0; k < tservicios.length; k++) {
        if (tservicios[k].ID_TSERVICIO === s.ID_TSERVICIO) { tipoNombre = tservicios[k].NOMBRE || '—'; break; }
      }
      return {
        ID_SERVICIO:     s.ID_SERVICIO,
        ID_ESPECIALIDAD: s.ID_ESPECIALIDAD,
        ESPECIALIDAD_NOMBRE: espNombre,
        ID_AREA_APOYO:   s.ID_AREA_APOYO,
        AREA_NOMBRE:     areaNombre,
        ID_TSERVICIO:    s.ID_TSERVICIO,
        TIPO_NOMBRE:     tipoNombre,
        NOMBRE_SERVICIO: s.NOMBRE_SERVICIO,
        PRECIO_BASE:     s.PRECIO_BASE,
        TIEMPO_ESTIMADO: s.TIEMPO_ESTIMADO,
        OBSERVACION:     s.OBSERVACION,
        ESTADO:          s.ESTADO || 'ACTIVO',
      };
    });
    return respuestaOK(enriched, enriched.length + ' servicio(s).');
  } catch (err) {
    return respuestaError('Error al listar servicios: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR SERVICIO (nuevo)
// ════════════════════════════════════════════════════════════
function guardarServicio(params) {
  try {
    if (!_puedeModulo(params, 'Servicios')) {
      return respuestaError('Solo el Administrador puede crear servicios.', 'ERR_PERMISO');
    }
    if (!params.NOMBRE_SERVICIO || String(params.NOMBRE_SERVICIO).trim() === '') {
      return respuestaError('El nombre del servicio es requerido.');
    }
    if (params.PRECIO_BASE === undefined || params.PRECIO_BASE === '' || isNaN(parseFloat(params.PRECIO_BASE))) {
      return respuestaError('El precio base es requerido y debe ser numérico.');
    }

    var idServicio = generarID(HOJAS.SERVICIO, 'ID_SERVICIO', 'SRV', 4);

    insertarFila(HOJAS.SERVICIO, {
      ID_SERVICIO:     idServicio,
      ID_ESPECIALIDAD: params.ID_ESPECIALIDAD || '-',
      ID_AREA_APOYO:   params.ID_AREA_APOYO || '-',
      ID_TSERVICIO:    params.ID_TSERVICIO || '-',
      NOMBRE_SERVICIO: String(params.NOMBRE_SERVICIO).trim().toUpperCase(),
      PRECIO_BASE:     parseFloat(params.PRECIO_BASE).toFixed(2),
      TIEMPO_ESTIMADO: params.TIEMPO_ESTIMADO || '-',
      OBSERVACION:     params.OBSERVACION || '-',
      ESTADO:          params.ESTADO || 'ACTIVO',
    });
    return respuestaOK({ ID_SERVICIO: idServicio }, 'Servicio creado: ' + idServicio);
  } catch (err) {
    return respuestaError('Error al guardar servicio: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR SERVICIO
// ════════════════════════════════════════════════════════════
function actualizarServicio(params) {
  try {
    if (!_puedeModulo(params, 'Servicios')) {
      return respuestaError('Solo el Administrador puede editar servicios.', 'ERR_PERMISO');
    }
    if (!params.ID_SERVICIO) return respuestaError('ID_SERVICIO requerido.');

    var datos = {};
    if (params.NOMBRE_SERVICIO !== undefined) datos.NOMBRE_SERVICIO = String(params.NOMBRE_SERVICIO).trim().toUpperCase();
    if (params.PRECIO_BASE !== undefined && params.PRECIO_BASE !== '') datos.PRECIO_BASE = parseFloat(params.PRECIO_BASE).toFixed(2);
    if (params.ID_ESPECIALIDAD !== undefined) datos.ID_ESPECIALIDAD = params.ID_ESPECIALIDAD || '-';
    if (params.ID_AREA_APOYO !== undefined) datos.ID_AREA_APOYO = params.ID_AREA_APOYO || '-';
    if (params.ID_TSERVICIO !== undefined) datos.ID_TSERVICIO = params.ID_TSERVICIO || '-';
    if (params.TIEMPO_ESTIMADO !== undefined) datos.TIEMPO_ESTIMADO = params.TIEMPO_ESTIMADO || '-';
    if (params.OBSERVACION !== undefined) datos.OBSERVACION = params.OBSERVACION || '-';
    if (params.ESTADO !== undefined) datos.ESTADO = params.ESTADO;

    actualizarFila(HOJAS.SERVICIO, 'ID_SERVICIO', params.ID_SERVICIO, datos);
    // Auditar cambio de precio si se modificó
    if (params.PRECIO_BASE !== undefined && params.PRECIO_BASE !== '' && !isNaN(parseFloat(params.PRECIO_BASE))) {
      registrarAuditoria((params._sesion?params._sesion.ID_USUARIO:'-'), 'SERVICIOS', 'EDITAR_PRECIO', 'Servicio ' + params.ID_SERVICIO + ' · nuevo precio S/ ' + parseFloat(params.PRECIO_BASE).toFixed(2));
    }
    return respuestaOK({}, 'Servicio actualizado.');
  } catch (err) {
    return respuestaError('Error al actualizar servicio: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  IMPORTACIÓN MASIVA DE SERVICIOS
// ════════════════════════════════════════════════════════════
function importarServiciosMasivo(params) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!_puedeModulo(params, 'Servicios')) {
      return respuestaError('Solo el Administrador puede importar servicios.', 'ERR_PERMISO');
    }
    var filas = params.filas;
    if (!Array.isArray(filas) || !filas.length) return respuestaError('No hay datos para importar.');
    if (filas.length > 500) return respuestaError('Máximo 500 servicios por importación.');

    // Cargar especialidades una sola vez para mapear nombre → ID
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila)
      .filter(function(e){ return e.ESTADO === 'ACTIVO'; });

    var creados = 0, errores = [];
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      var fila = i + 2; // referencia visual para el usuario
      try {
        var nombre = String(f.NOMBRE_SERVICIO || '').trim();
        var precio = f.PRECIO_BASE;
        var espTexto = String(f.ESPECIALIDAD || '').trim();
        if (!nombre) { errores.push('Fila ' + fila + ': falta NOMBRE_SERVICIO.'); continue; }
        if (precio === undefined || precio === '' || isNaN(parseFloat(precio))) {
          errores.push('Fila ' + fila + ' (' + nombre + '): PRECIO_BASE inválido.'); continue;
        }
        if (!espTexto) { errores.push('Fila ' + fila + ' (' + nombre + '): falta ESPECIALIDAD.'); continue; }
        // Buscar especialidad por nombre o por ID
        var idEsp = null;
        for (var e = 0; e < especialidades.length; e++) {
          if (String(especialidades[e].ESPECIALIDAD).toUpperCase() === espTexto.toUpperCase() ||
              String(especialidades[e].ID_ESPECIALIDAD).toUpperCase() === espTexto.toUpperCase()) {
            idEsp = especialidades[e].ID_ESPECIALIDAD; break;
          }
        }
        if (!idEsp) { errores.push('Fila ' + fila + ' (' + nombre + '): especialidad "' + espTexto + '" no existe.'); continue; }

        var idServicio = generarID(HOJAS.SERVICIO, 'ID_SERVICIO', 'SRV', 4);
        insertarFila(HOJAS.SERVICIO, {
          ID_SERVICIO:     idServicio,
          ID_ESPECIALIDAD: idEsp,
          ID_AREA_APOYO:   '-',
          ID_TSERVICIO:    '-',
          NOMBRE_SERVICIO: nombre.toUpperCase(),
          PRECIO_BASE:     parseFloat(precio).toFixed(2),
          TIEMPO_ESTIMADO: String(f.TIEMPO_ESTIMADO || '-').trim() || '-',
          OBSERVACION:     String(f.OBSERVACION || '-').trim() || '-',
          ESTADO:          'ACTIVO',
        });
        creados++;
      } catch (eFila) {
        errores.push('Fila ' + fila + ': ' + eFila.message);
      }
    }
    return respuestaOK({ creados: creados, errores: errores },
      creados + ' servicio(s) importado(s).' + (errores.length ? ' ' + errores.length + ' con error.' : ''));
  } catch (err) {
    return respuestaError('Error en importación: ' + err.message);
  } finally {
    lock.releaseLock();
  }
}
