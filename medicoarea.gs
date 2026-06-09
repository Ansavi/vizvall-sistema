// ============================================================
// VIZVALL — medicoarea.gs — Médico ↔ Áreas de apoyo
// Permite que un médico también atienda servicios de apoyo
// (ej: un radiólogo que hace ecografías).
// ============================================================

// Listar las áreas de apoyo asignadas a un médico
function listarAreasMedico(params) {
  try {
    if (!params.ID_MEDICO) return respuestaError('ID_MEDICO requerido.');
    var asignadas = leerHoja(HOJAS.MEDICO_AREA_APOYO).map(limpiarFila)
      .filter(function(ma){ return ma.ID_MEDICO === params.ID_MEDICO && ma.ESTADO === 'ACTIVO'; });
    var areas = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
    var enriched = asignadas.map(function(ma){
      var areaNombre = '—';
      for (var i = 0; i < areas.length; i++) {
        if (areas[i].ID_AREA_APOYO === ma.ID_AREA_APOYO) { areaNombre = areas[i].NOMBRE || '—'; break; }
      }
      return {
        ID_MEDICO_AREA: ma.ID_MEDICO_AREA,
        ID_AREA_APOYO:  ma.ID_AREA_APOYO,
        AREA_NOMBRE:    areaNombre,
      };
    });
    return respuestaOK(enriched, enriched.length + ' área(s) de apoyo.');
  } catch (err) {
    return respuestaError('Error al listar áreas del médico: ' + err.message);
  }
}

// Asignar un área de apoyo a un médico
function agregarAreaMedico(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('Solo el Administrador puede gestionar áreas de apoyo.', 'ERR_PERMISO');
    }
    if (!params.ID_MEDICO || !params.ID_AREA_APOYO) {
      lock.releaseLock();
      return respuestaError('ID_MEDICO e ID_AREA_APOYO son requeridos.');
    }

    var existentes = leerHoja(HOJAS.MEDICO_AREA_APOYO).map(limpiarFila);
    for (var d = 0; d < existentes.length; d++) {
      if (existentes[d].ID_MEDICO === params.ID_MEDICO &&
          existentes[d].ID_AREA_APOYO === params.ID_AREA_APOYO &&
          existentes[d].ESTADO === 'ACTIVO') {
        lock.releaseLock();
        return respuestaError('Esta área de apoyo ya está asignada al médico.');
      }
    }

    var ultimos = existentes.map(function(ma){ return parseInt((ma.ID_MEDICO_AREA||'').replace('MA-','')); });
    var _f = ultimos.filter(function(n){ return !isNaN(n); });
    var sig = (_f.length ? Math.max.apply(null, _f) : 0) + 1;
    var id = 'MA-' + String(sig).padStart(4,'0');

    insertarFila(HOJAS.MEDICO_AREA_APOYO, {
      ID_MEDICO_AREA: id,
      ID_MEDICO:      params.ID_MEDICO,
      ID_AREA_APOYO:  params.ID_AREA_APOYO,
      ESTADO:         'ACTIVO',
      FECHA_REGISTRO: getFecha('fecha'),
    });
    lock.releaseLock();
    return respuestaOK({ ID_MEDICO_AREA: id }, 'Área de apoyo asignada al médico.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al asignar área: ' + err.message);
  }
}

// Quitar (baja lógica) un área de apoyo de un médico
function quitarAreaMedico(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede gestionar áreas de apoyo.', 'ERR_PERMISO');
    }
    if (!params.ID_MEDICO_AREA) return respuestaError('ID_MEDICO_AREA requerido.');
    actualizarFila(HOJAS.MEDICO_AREA_APOYO, 'ID_MEDICO_AREA', params.ID_MEDICO_AREA, { ESTADO: 'INACTIVO' });
    return respuestaOK({}, 'Área de apoyo quitada del médico.');
  } catch (err) {
    return respuestaError('Error al quitar área: ' + err.message);
  }
}

// Lista médicos que tienen al menos un área de apoyo asignada (para horarios)
function listarMedicosConApoyo(params) {
  try {
    var medArea = leerHoja(HOJAS.MEDICO_AREA_APOYO).map(limpiarFila)
      .filter(function(ma){ return ma.ESTADO === 'ACTIVO'; });
    var idsUnicos = {};
    medArea.forEach(function(ma){ idsUnicos[ma.ID_MEDICO] = true; });

    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var lista = [];
    medicos.forEach(function(m){
      if (idsUnicos[m.ID_MEDICO] && m.ESTADO === 'ACTIVO') {
        lista.push({ ID_MEDICO: m.ID_MEDICO, NOMBRES: m.NOMBRES, APELLIDOS: m.APELLIDOS });
      }
    });
    return respuestaOK(lista, lista.length + ' médico(s) con apoyo.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
