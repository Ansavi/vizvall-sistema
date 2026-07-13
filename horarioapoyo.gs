// ============================================================
// VIZVALL — horarioapoyo.gs — Horarios de profesionales de apoyo
// Espejo de los horarios de médicos, adaptado a área de apoyo.
// ============================================================

function listarHorariosApoyo(params) {
  try {
    var tipoEjec = String(params.TIPO_EJECUTOR || 'PROFESIONAL').toUpperCase();
    var idEjec = params.ID_EJECUTOR || params.ID_PROFESIONAL || params.ID_MEDICO;
    if (!idEjec) return respuestaError('Ejecutor requerido.');
    var horarios = leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila)
      .filter(function(h){
        var match = (tipoEjec === 'MEDICO') ? (h.ID_MEDICO === idEjec) : (h.ID_PROFESIONAL === idEjec);
        return match && h.ESTADO === 'ACTIVO';
      });
    var areas = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
    var enriched = horarios.map(function(h){
      var areaNombre = '—';
      for (var i = 0; i < areas.length; i++) {
        if (areas[i].ID_AREA_APOYO === h.ID_AREA_APOYO) { areaNombre = areas[i].NOMBRE || '—'; break; }
      }
      return {
        ID_HORARIO_APOYO: h.ID_HORARIO_APOYO,
        ID_HORARIO:       h.ID_HORARIO_APOYO,   // alias compat. con frontend calendario
        ID_PROFESIONAL:   h.ID_PROFESIONAL,
        ID_AREA_APOYO:    h.ID_AREA_APOYO,
        ID_ESPECIALIDAD:  h.ID_AREA_APOYO,       // alias compat.
        AREA_NOMBRE:      areaNombre,
        ESPECIALIDAD_NOMBRE: areaNombre,         // alias compat.
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
    if (!_puedeModulo(params, 'Personal')) {
      lock.releaseLock();
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.DIA_SEMANA || !params.HORA_INICIO || !params.HORA_FIN) {
      lock.releaseLock();
      return respuestaError('Campos requeridos: DIA_SEMANA, HORA_INICIO, HORA_FIN.');
    }
    if (params.HORA_FIN <= params.HORA_INICIO) {
      lock.releaseLock();
      return respuestaError('La hora de fin debe ser mayor a la de inicio.');
    }

    var tipoEjec = String(params.TIPO_EJECUTOR || 'PROFESIONAL').toUpperCase();
    var idProfesional = '-', idMedico = '-', idArea = params.ID_AREA_APOYO || '-';

    if (tipoEjec === 'MEDICO') {
      if (!params.ID_MEDICO) { lock.releaseLock(); return respuestaError('ID_MEDICO requerido.'); }
      if (!params.ID_AREA_APOYO) { lock.releaseLock(); return respuestaError('ID_AREA_APOYO requerido para médico.'); }
      idMedico = params.ID_MEDICO;
      idArea = params.ID_AREA_APOYO;
    } else {
      if (!params.ID_PROFESIONAL) { lock.releaseLock(); return respuestaError('ID_PROFESIONAL requerido.'); }
      var profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
      var prof = null;
      for (var i = 0; i < profs.length; i++) { if (profs[i].ID_PROFESIONAL === params.ID_PROFESIONAL) { prof = profs[i]; break; } }
      if (!prof) { lock.releaseLock(); return respuestaError('Profesional no encontrado.'); }
      idProfesional = params.ID_PROFESIONAL;
      idArea = prof.ID_AREA_APOYO || '-';
    }

    var horarios = leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila);
    var ultimos  = horarios.map(function(h){ return parseInt((h.ID_HORARIO_APOYO||'').replace('HAP-','')); });
    var _f = ultimos.filter(function(n){ return !isNaN(n); });
    var sig = (_f.length ? Math.max.apply(null, _f) : 0) + 1;
    var idHorario = 'HAP-' + String(sig).padStart(4,'0');

    insertarFila(HOJAS.HORARIO_APOYO, {
      ID_HORARIO_APOYO: idHorario,
      TIPO_EJECUTOR:    tipoEjec,
      ID_PROFESIONAL:   idProfesional,
      ID_MEDICO:        idMedico,
      ID_AREA_APOYO:    idArea,
      DIA_SEMANA:       String(params.DIA_SEMANA).toUpperCase(),
      HORA_INICIO:      params.HORA_INICIO,
      HORA_FIN:         params.HORA_FIN,
      INTERVALO_MIN:    parseInt(params.INTERVALO_MIN) || 30,
      ESTADO:           'ACTIVO',
      MODALIDAD_TRABAJO: String(params.MODALIDAD_TRABAJO || 'FIJO').toUpperCase(),
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
    if (!_puedeModulo(params, 'Personal')) {
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

    // 1. Profesionales de apoyo del área
    var profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila)
      .filter(function(p){ return p.ID_AREA_APOYO === params.ID_AREA_APOYO && p.ESTADO === 'ACTIVO'; });
    var lista = profs.map(function(p){
      return {
        TIPO_EJECUTOR:   'PROFESIONAL',
        ID_EJECUTOR:     p.ID_PROFESIONAL,
        ID_PROFESIONAL:  p.ID_PROFESIONAL,
        ID_MEDICO:       '',
        NOMBRE_COMPLETO: (p.NOMBRES || '') + ' ' + (p.APELLIDOS || ''),
        PROFESION:       p.PROFESION,
        ETIQUETA:        'técnico',
      };
    });

    // 2. Médicos asignados a esa área de apoyo
    var medArea = leerHoja(HOJAS.MEDICO_AREA_APOYO).map(limpiarFila)
      .filter(function(ma){ return ma.ID_AREA_APOYO === params.ID_AREA_APOYO && ma.ESTADO === 'ACTIVO'; });
    if (medArea.length) {
      var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
      medArea.forEach(function(ma){
        for (var i = 0; i < medicos.length; i++) {
          if (medicos[i].ID_MEDICO === ma.ID_MEDICO && medicos[i].ESTADO === 'ACTIVO') {
            lista.push({
              TIPO_EJECUTOR:   'MEDICO',
              ID_EJECUTOR:     medicos[i].ID_MEDICO,
              ID_PROFESIONAL:  '',
              ID_MEDICO:       medicos[i].ID_MEDICO,
              NOMBRE_COMPLETO: 'Dr. ' + (medicos[i].NOMBRES || '') + ' ' + (medicos[i].APELLIDOS || ''),
              PROFESION:       'Médico',
              ETIQUETA:        'médico',
            });
            break;
          }
        }
      });
    }

    return respuestaOK(lista, lista.length + ' ejecutor(es).');
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
