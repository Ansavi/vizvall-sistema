// ============================================================
// VIZVALL — horarioapoyo.gs — Horarios de profesionales de apoyo
// Espejo de los horarios de médicos, adaptado a área de apoyo.
// ============================================================

function listarHorariosApoyo(params) {
  try {
    if (!params.ID_PROFESIONAL) return respuestaError('ID_PROFESIONAL requerido.');
    var horarios = leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila)
      .filter(function(h){ return h.ID_PROFESIONAL === params.ID_PROFESIONAL && h.ESTADO === 'ACTIVO'; });
    var areas = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
    var enriched = horarios.map(function(h){
      var areaNombre = '—';
      for (var i = 0; i < areas.length; i++) {
        if (areas[i].ID_AREA_APOYO === h.ID_AREA_APOYO) { areaNombre = areas[i].NOMBRE || '—'; break; }
      }
      return {
        ID_HORARIO_APOYO: h.ID_HORARIO_APOYO,
        ID_PROFESIONAL:   h.ID_PROFESIONAL,
        ID_AREA_APOYO:    h.ID_AREA_APOYO,
        AREA_NOMBRE:      areaNombre,
        DIA_SEMANA:       h.DIA_SEMANA,
        HORA_INICIO:      h.HORA_INICIO,
        HORA_FIN:         h.HORA_FIN,
        INTERVALO_MIN:    h.INTERVALO_MIN,
        ESTADO:           h.ESTADO,
      };
    });
    return respuestaOK(enriched);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function guardarHorarioApoyo(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      lock.releaseLock();
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_PROFESIONAL || !params.DIA_SEMANA || !params.HORA_INICIO || !params.HORA_FIN) {
      lock.releaseLock();
      return respuestaError('Campos requeridos: ID_PROFESIONAL, DIA_SEMANA, HORA_INICIO, HORA_FIN.');
    }
    if (params.HORA_FIN <= params.HORA_INICIO) {
      lock.releaseLock();
      return respuestaError('La hora de fin debe ser mayor a la de inicio.');
    }

    // El área se toma del profesional (un profesional pertenece a un área)
    var profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    var prof = null;
    for (var i = 0; i < profs.length; i++) { if (profs[i].ID_PROFESIONAL === params.ID_PROFESIONAL) { prof = profs[i]; break; } }
    if (!prof) { lock.releaseLock(); return respuestaError('Profesional no encontrado.'); }
    var idArea = prof.ID_AREA_APOYO || '-';

    var horarios = leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila);
    var ultimos  = horarios.map(function(h){ return parseInt((h.ID_HORARIO_APOYO||'').replace('HAP-','')); });
    var _f = ultimos.filter(function(n){ return !isNaN(n); });
    var sig = (_f.length ? Math.max.apply(null, _f) : 0) + 1;
    var idHorario = 'HAP-' + String(sig).padStart(4,'0');

    insertarFila(HOJAS.HORARIO_APOYO, {
      ID_HORARIO_APOYO: idHorario,
      ID_PROFESIONAL:   params.ID_PROFESIONAL,
      ID_AREA_APOYO:    idArea,
      DIA_SEMANA:       String(params.DIA_SEMANA).toUpperCase(),
      HORA_INICIO:      params.HORA_INICIO,
      HORA_FIN:         params.HORA_FIN,
      INTERVALO_MIN:    parseInt(params.INTERVALO_MIN) || 30,
      ESTADO:           'ACTIVO',
    });
    lock.releaseLock();
    return respuestaOK({ ID_HORARIO_APOYO: idHorario }, 'Horario guardado.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error: ' + err.message);
  }
}

function eliminarHorarioApoyo(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_HORARIO_APOYO) return respuestaError('ID_HORARIO_APOYO requerido.');
    actualizarFila(HOJAS.HORARIO_APOYO, 'ID_HORARIO_APOYO', params.ID_HORARIO_APOYO, { ESTADO: 'INACTIVO' });
    return respuestaOK({}, 'Horario eliminado.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// Lista profesionales de apoyo de un área (para el popup de cita)
function listarProfesionalesPorArea(params) {
  try {
    if (!params.ID_AREA_APOYO) return respuestaError('ID_AREA_APOYO requerido.');
    var profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila)
      .filter(function(p){ return p.ID_AREA_APOYO === params.ID_AREA_APOYO && p.ESTADO === 'ACTIVO'; });
    var enriched = profs.map(function(p){
      return {
        ID_PROFESIONAL: p.ID_PROFESIONAL,
        NOMBRE_COMPLETO: (p.NOMBRES || '') + ' ' + (p.APELLIDOS || ''),
        PROFESION:      p.PROFESION,
      };
    });
    return respuestaOK(enriched, enriched.length + ' profesional(es).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// Horarios disponibles de un profesional de apoyo en una fecha (espejo del de médicos)
function horariosDisponiblesApoyo(params) {
  try {
    if (!params.ID_PROFESIONAL || !params.FECHA) {
      return respuestaError('ID_PROFESIONAL y FECHA son requeridos.');
    }
    // Día de la semana de la fecha
    var dias = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
    var fechaObj = new Date(params.FECHA + 'T00:00:00');
    var diaSemana = dias[fechaObj.getDay()];

    var horarios = leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila)
      .filter(function(h){
        return h.ID_PROFESIONAL === params.ID_PROFESIONAL &&
               String(h.DIA_SEMANA).toUpperCase() === diaSemana &&
               h.ESTADO === 'ACTIVO';
      });
    if (!horarios.length) return respuestaOK([], 'Sin horarios ese día.');

    // Generar slots según intervalo
    var slots = [];
    horarios.forEach(function(h){
      var ini = _aMinutos(h.HORA_INICIO);
      var fin = _aMinutos(h.HORA_FIN);
      var intv = parseInt(h.INTERVALO_MIN) || 30;
      for (var m = ini; m + intv <= fin; m += intv) {
        slots.push(_aHora(m));
      }
    });

    // Quitar los ya ocupados (citas de ese profesional esa fecha, no canceladas)
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){
        return c.ID_PROFESIONAL === params.ID_PROFESIONAL &&
               c.FECHA_CITA === params.FECHA &&
               c.ESTADO_CITA !== 'CANCELADA';
      });
    var ocupados = {};
    citas.forEach(function(c){ ocupados[c.HORA_CITA] = true; });
    var disponibles = slots.filter(function(s){ return !ocupados[s]; });

    return respuestaOK(disponibles, disponibles.length + ' horario(s) disponible(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// Helpers de tiempo (locales para no chocar con otros archivos)
function _aMinutos(hhmm) {
  var p = String(hhmm).split(':');
  return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
}
function _aHora(min) {
  var h = Math.floor(min / 60), m = min % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
