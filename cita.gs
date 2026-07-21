// ============================================================
// VIZVALL — cita.gs — Gestión de Citas
// Cita y pago independientes (cita sin pago / pago sin cita)
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR CITAS (con filtros opcionales: fecha, médico, estado)
// ════════════════════════════════════════════════════════════
// Regla de negocio: gestion (requiere accion) vs historial (ya cerro)
function _citaEnGestion(c, hoy) {
  var fecha    = String(c.FECHA_CITA || '').substring(0, 10);
  var estado   = String(c.ESTADO_CITA || 'PROGRAMADA').toUpperCase();
  var pago     = String(c.ESTADO_PAGO || 'PENDIENTE').toUpperCase();
  var pagada   = (pago === 'PAGADO');
  var atendida = (estado === 'ATENDIDA');
  var expirada = fecha && (fecha < hoy);
  if (estado === 'CANCELADA') return false;      // cancelada -> fuera
  if (atendida && pagada) return false;          // ciclo cerrado -> historial
  if (atendida && !pagada) return true;          // falta cobrar -> gestion
  if (!expirada) return true;                    // hoy/futura -> gestion
  if (pagada) return true;                       // pagada sin atender -> reprogramar
  return false;                                  // expirada sin pagar -> historial
}

function listarCitas(params) {
  try {
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return c.ID_CITA && String(c.ID_CITA).trim() !== ''; });

    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);

    // Filtros
    if (params.fecha) {
      citas = citas.filter(function(c){ return c.FECHA_CITA === params.fecha; });
    }
    if (params.ID_MEDICO) {
      citas = citas.filter(function(c){ return c.ID_MEDICO === params.ID_MEDICO; });
    }
    if (params.estado) {
      citas = citas.filter(function(c){ return c.ESTADO_CITA === params.estado; });
    }
    if (params.estadoPago) {
      citas = citas.filter(function(c){ return (c.ESTADO_PAGO || 'PENDIENTE') === params.estadoPago; });
    }
    // Filtro por vista: 'gestion' (hoy + futuras) o 'historial' (vencidas). Sin filtro = todas.
    if (params.vista === 'gestion') {
      var hoyG = getFecha('fecha');
      citas = citas.filter(function(c){ return _citaEnGestion(c, hoyG); });
    } else if (params.vista === 'historial') {
      var hoyH = getFecha('fecha');
      citas = citas.filter(function(c){ return !_citaEnGestion(c, hoyH); });
    }

    var profesionales = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    var areasApoyo = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
    var hoyCita = getFecha('fecha'); // YYYY-MM-DD de hoy

    var enriched = citas.map(function(c){
      var pacNombre = '—', medNombre = '—', espNombre = '—';
      for (var i = 0; i < pacientes.length; i++) {
        if (pacientes[i].ID_PACIENTE === c.ID_PACIENTE) {
          pacNombre = (pacientes[i].NOMBRES || '') + ' ' + (pacientes[i].APELLIDOS || '');
          break;
        }
      }
      var tipoAt = String(c.TIPO_ATENCION || 'ESPECIALIDAD').toUpperCase();
      if (tipoAt === 'APOYO') {
        // Mostrar profesional de apoyo y su área en las mismas columnas
        for (var pa = 0; pa < profesionales.length; pa++) {
          if (profesionales[pa].ID_PROFESIONAL === c.ID_PROFESIONAL) {
            medNombre = (profesionales[pa].NOMBRES || '') + ' ' + (profesionales[pa].APELLIDOS || '');
            break;
          }
        }
        for (var ar = 0; ar < areasApoyo.length; ar++) {
          if (areasApoyo[ar].ID_AREA_APOYO === c.ID_AREA_APOYO) {
            espNombre = areasApoyo[ar].NOMBRE || '—';
            break;
          }
        }
      } else {
        for (var j = 0; j < medicos.length; j++) {
          if (medicos[j].ID_MEDICO === c.ID_MEDICO) {
            medNombre = (medicos[j].NOMBRES || '') + ' ' + (medicos[j].APELLIDOS || '');
            break;
          }
        }
        for (var k = 0; k < especialidades.length; k++) {
          if (especialidades[k].ID_ESPECIALIDAD === c.ID_ESPECIALIDAD) {
            espNombre = especialidades[k].ESPECIALIDAD || '—';
            break;
          }
        }
      }
      var fCita = String(c.FECHA_CITA || '').substring(0,10);
      // Clasificación temporal: HOY / FUTURA / VENCIDA (pasó la fecha, sin importar estado)
      var cuando = 'HOY';
      if (fCita) {
        if (fCita > hoyCita) cuando = 'FUTURA';
        else if (fCita < hoyCita) {
          var _pag = String(c.ESTADO_PAGO||'PENDIENTE').toUpperCase()==='PAGADO';
          var _at  = String(c.ESTADO_CITA||'').toUpperCase()==='ATENDIDA';
          cuando = (_pag && !_at) ? 'POR_REPROGRAMAR' : 'VENCIDA';
        }
      }
      return {
        ID_CITA:         c.ID_CITA,
        ID_PACIENTE:     c.ID_PACIENTE,
        PACIENTE_NOMBRE: pacNombre,
        TIPO_ATENCION:   tipoAt,
        ID_MEDICO:       c.ID_MEDICO,
        ID_PROFESIONAL:  c.ID_PROFESIONAL,
        ID_AREA_APOYO:   c.ID_AREA_APOYO,
        MEDICO_NOMBRE:   medNombre,
        ID_ESPECIALIDAD: c.ID_ESPECIALIDAD,
        ESPECIALIDAD_NOMBRE: espNombre,
        FECHA_CITA:      c.FECHA_CITA,
        HORA_CITA:       c.HORA_CITA,
        MOTIVO_CONSULTA: c.MOTIVO_CONSULTA,
        ESTADO_CITA:     c.ESTADO_CITA || 'PROGRAMADA',
        ESTADO_PAGO:     c.ESTADO_PAGO || 'PENDIENTE',
        CUANDO:          cuando,
        ID_VENTA:        c.ID_VENTA,
        CONSULTORIO:     c.CONSULTORIO,
        OBSERVACIONES:   c.OBSERVACIONES,
        FECHA_REGISTRO:  c.FECHA_REGISTRO,
      };
    });

    // Ordenar por fecha + hora
    enriched.sort(function(a, b){
      var fa = (a.FECHA_CITA || '') + ' ' + (a.HORA_CITA || '');
      var fb = (b.FECHA_CITA || '') + ' ' + (b.HORA_CITA || '');
      return fa > fb ? 1 : (fa < fb ? -1 : 0);
    });

    return respuestaOK(enriched, enriched.length + ' cita(s).');
  } catch (err) {
    return respuestaError('Error al listar citas: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR CITA (nueva) — sin obligar pago
// ════════════════════════════════════════════════════════════
function guardarCita(params) {
  var lock = null;
  try {
    if (!_puedeModulo(params, 'Citas')) {
      return respuestaError('No tiene permiso para crear citas.', 'ERR_PERMISO');
    }

    var tipoAtencion = String(params.TIPO_ATENCION || 'ESPECIALIDAD').toUpperCase();

    // Requeridos comunes
    if (!params.ID_PACIENTE) return respuestaError('El campo ID_PACIENTE es requerido.');
    // Fecha y hora son opcionales si la cita se crea desde una venta (queda "Por programar")
    var permitirSinFecha = params.PERMITIR_SIN_FECHA === true || params.PERMITIR_SIN_FECHA === 'SI';
    if (!permitirSinFecha) {
      if (!params.FECHA_CITA)  return respuestaError('El campo FECHA_CITA es requerido.');
      if (!params.HORA_CITA)   return respuestaError('El campo HORA_CITA es requerido.');
    }

    var idMedico = '-', idEspecialidad = '-', idProfesional = '-', idArea = '-';
    var citasExist;

    var tipoEjecutor = 'PROFESIONAL';
    if (tipoAtencion === 'APOYO') {
      // ── Cita de servicio de apoyo ──
      if (!params.ID_AREA_APOYO)  return respuestaError('Seleccione un área de apoyo.');
      idArea = params.ID_AREA_APOYO;
      tipoEjecutor = String(params.TIPO_EJECUTOR || 'PROFESIONAL').toUpperCase();

      if (tipoEjecutor === 'MEDICO') {
        if (!params.ID_MEDICO) return respuestaError('Seleccione el médico que ejecuta el servicio.');
        idMedico = params.ID_MEDICO;
        citasExist = leerHoja(HOJAS.CITA).map(limpiarFila).filter(function(c){
          return c.ID_MEDICO === idMedico && c.TIPO_ATENCION === 'APOYO' &&
                 c.FECHA_CITA === params.FECHA_CITA &&
                 c.HORA_CITA === params.HORA_CITA &&
                 c.ESTADO_CITA !== 'CANCELADA';
        });
        if (citasExist.length) return respuestaError('Ya existe una cita para ese médico en esa fecha y hora.');
      } else {
        if (!params.ID_PROFESIONAL) return respuestaError('Seleccione un profesional de apoyo.');
        idProfesional = params.ID_PROFESIONAL;
        citasExist = leerHoja(HOJAS.CITA).map(limpiarFila).filter(function(c){
          return c.ID_PROFESIONAL === idProfesional &&
                 c.FECHA_CITA === params.FECHA_CITA &&
                 c.HORA_CITA === params.HORA_CITA &&
                 c.ESTADO_CITA !== 'CANCELADA';
        });
        if (citasExist.length) return respuestaError('Ya existe una cita para ese profesional en esa fecha y hora.');
      }
    } else {
      // ── Cita de especialidad (médico) ──
      if (!params.ID_MEDICO)       return respuestaError('Seleccione un médico.');
      if (!params.ID_ESPECIALIDAD) return respuestaError('Seleccione una especialidad.');
      idMedico = params.ID_MEDICO;
      idEspecialidad = params.ID_ESPECIALIDAD;
      citasExist = leerHoja(HOJAS.CITA).map(limpiarFila).filter(function(c){
        return c.ID_MEDICO === idMedico &&
               c.FECHA_CITA === params.FECHA_CITA &&
               c.HORA_CITA === params.HORA_CITA &&
               c.ESTADO_CITA !== 'CANCELADA';
      });
      if (citasExist.length) return respuestaError('Ya existe una cita para ese médico en esa fecha y hora.');
    }

    // ── SECCIÓN CRÍTICA: bloquear para evitar citas duplicadas simultáneas ──
    lock = LockService.getScriptLock();
    try { lock.waitLock(30000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }

    var idCita = generarID(HOJAS.CITA, 'ID_CITA', 'CIT', 4);

    insertarFila(HOJAS.CITA, {
      ID_CITA:         idCita,
      ID_PACIENTE:     params.ID_PACIENTE,
      TIPO_ATENCION:   tipoAtencion,
      TIPO_EJECUTOR:   (tipoAtencion === 'APOYO' ? tipoEjecutor : 'MEDICO'),
      ID_MEDICO:       idMedico,
      ID_ESPECIALIDAD: idEspecialidad,
      ID_PROFESIONAL:  idProfesional,
      ID_AREA_APOYO:   idArea,
      FECHA_CITA:      params.FECHA_CITA || '-',
      HORA_CITA:       params.HORA_CITA || '-',
      MOTIVO_CONSULTA: params.MOTIVO_CONSULTA || '-',
      ESTADO_CITA:     (params.FECHA_CITA && params.HORA_CITA) ? 'PROGRAMADA' : 'POR PROGRAMAR',
      ID_TCITA:        params.ID_TCITA || '-',
      CONSULTORIO:     params.CONSULTORIO || '-',
      ESTADO_PAGO:     'PENDIENTE',
      ID_VENTA:        '-',
      OBSERVACIONES:   params.OBSERVACIONES || '-',
      FECHA_REGISTRO:  getFecha('fecha'),
      TIPO_ITEM:       params.TIPO_ITEM || '-',
      ID_ITEM:         params.ID_ITEM || '-',
      NOMBRE_ITEM:     params.NOMBRE_ITEM || '-',
      PRECIO_REF:      params.PRECIO_REF || '0.00',
    });

    // Registrar en historial
    try {
      insertarFila(HOJAS.HISTORIAL_CITA, {
        ID_HISTORIAL:    generarID(HOJAS.HISTORIAL_CITA, 'ID_HISTORIAL', 'HC', 4),
        ID_CITA:         idCita,
        ESTADO_ANTERIOR: '-',
        ESTADO_NUEVO:    'PROGRAMADA',
        FECHA:           getFecha('datetime'),
        ID_USUARIO:      params._sesion ? params._sesion.ID_USUARIO || params._sesion.USUARIO : '-',
        OBSERVACION:     'Cita creada',
      });
    } catch(e) {}

    if (lock) lock.releaseLock();
    return respuestaOK({ ID_CITA: idCita }, 'Cita registrada: ' + idCita);
  } catch (err) {
    if (lock) lock.releaseLock();
    return respuestaError('Error al guardar cita: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR ESTADO DE CITA (programada/atendida/cancelada/reprogramada)
// ════════════════════════════════════════════════════════════
function actualizarEstadoCita(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Citas')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_CITA || !params.ESTADO_CITA) {
      lock.releaseLock();
      return respuestaError('ID_CITA y ESTADO_CITA son requeridos.');
    }

    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var cita = null;
    for (var i = 0; i < citas.length; i++) {
      if (citas[i].ID_CITA === params.ID_CITA) { cita = citas[i]; break; }
    }
    if (!cita) { lock.releaseLock(); return respuestaError('Cita no encontrada.'); }

    var estadoAnterior = cita.ESTADO_CITA || 'PROGRAMADA';

    var datos = { ESTADO_CITA: params.ESTADO_CITA };
    // Si se reprograma, actualizar fecha/hora
    if (params.ESTADO_CITA === 'REPROGRAMADA' || params.FECHA_CITA) {
      if (params.FECHA_CITA) datos.FECHA_CITA = params.FECHA_CITA;
      if (params.HORA_CITA) datos.HORA_CITA = params.HORA_CITA;
    }
    if (params.OBSERVACIONES) datos.OBSERVACIONES = params.OBSERVACIONES;

    actualizarFila(HOJAS.CITA, 'ID_CITA', params.ID_CITA, datos);

    // Historial
    try {
      insertarFila(HOJAS.HISTORIAL_CITA, {
        ID_HISTORIAL:    generarID(HOJAS.HISTORIAL_CITA, 'ID_HISTORIAL', 'HC', 4),
        ID_CITA:         params.ID_CITA,
        ESTADO_ANTERIOR: estadoAnterior,
        ESTADO_NUEVO:    params.ESTADO_CITA,
        FECHA:           getFecha('datetime'),
        ID_USUARIO:      params._sesion ? params._sesion.ID_USUARIO || params._sesion.USUARIO : '-',
        OBSERVACION:     params.OBSERVACIONES || '-',
      });
    } catch(e) {}

    lock.releaseLock();
    return respuestaOK({}, 'Estado de cita actualizado a ' + params.ESTADO_CITA + '.');
  } catch (err) {
    if (lock) lock.releaseLock();
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR ESTADO DE PAGO de una cita
// ════════════════════════════════════════════════════════════
function actualizarPagoCita(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Citas')) {
      lock.releaseLock();
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_CITA) { lock.releaseLock(); return respuestaError('ID_CITA requerido.'); }

    var datos = { ESTADO_PAGO: params.ESTADO_PAGO || 'PAGADO' };
    if (params.ID_VENTA) datos.ID_VENTA = params.ID_VENTA;

    actualizarFila(HOJAS.CITA, 'ID_CITA', params.ID_CITA, datos);
    lock.releaseLock();
    return respuestaOK({}, 'Estado de pago actualizado.');
  } catch (err) {
    if (lock) lock.releaseLock();
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  OBTENER HISTORIAL DE UNA CITA
// ════════════════════════════════════════════════════════════
function obtenerHistorialCita(params) {
  try {
    if (!params.ID_CITA) return respuestaError('ID_CITA requerido.');
    var hist = leerHoja(HOJAS.HISTORIAL_CITA).map(limpiarFila)
      .filter(function(h){ return h.ID_CITA === params.ID_CITA; });
    hist.sort(function(a, b){ return (a.FECHA || '') > (b.FECHA || '') ? -1 : 1; });
    return respuestaOK(hist);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  OBTENER SLOTS DISPONIBLES de un médico en una fecha
//  (según su horario de ese día de la semana, menos citas ocupadas)
// ════════════════════════════════════════════════════════════
function obtenerSlotsCita(params) {
  try {
    if (!params.ID_MEDICO || !params.FECHA || !params.ID_ESPECIALIDAD) {
      return respuestaError('ID_MEDICO, ID_ESPECIALIDAD y FECHA son requeridos.');
    }

    // Día de la semana de la fecha
    var partes = params.FECHA.split('-');
    var fecha = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    var diasMap = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
    var diaSemana = diasMap[fecha.getDay()];

    // Horarios del médico ese día y esa especialidad
    var horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila)
      .filter(function(h){
        return h.ID_MEDICO === params.ID_MEDICO &&
               h.ID_ESPECIALIDAD === params.ID_ESPECIALIDAD &&
               h.DIA_SEMANA === diaSemana &&
               h.ESTADO === 'ACTIVO';
      });

    if (!horarios.length) {
      // Distinguir: ¿el médico no tiene NINGÚN horario en esta especialidad, o solo no atiende ESE día?
      var tieneAlgunHorarioMed = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila)
        .some(function(h){
          return h.ID_MEDICO === params.ID_MEDICO &&
                 h.ID_ESPECIALIDAD === params.ID_ESPECIALIDAD &&
                 h.ESTADO === 'ACTIVO';
        });
      if (!tieneAlgunHorarioMed) {
        return respuestaOK({ slots: [], dia: diaSemana, sinHorario: true,
          mensaje: 'Este médico no tiene horario configurado para esta especialidad. Configure su horario en el módulo de Horarios.' });
      }
      return respuestaOK({ slots: [], dia: diaSemana, mensaje: 'El médico no atiende esta especialidad ese día.' });
    }

    // Citas ya ocupadas ese día (no canceladas)
    var ocupadas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){
        return c.ID_MEDICO === params.ID_MEDICO &&
               c.FECHA_CITA === params.FECHA &&
               c.ESTADO_CITA !== 'CANCELADA';
      })
      .map(function(c){ return c.HORA_CITA; });

    // Generar slots según intervalo
    var slots = [];
    horarios.forEach(function(h){
      var intervalo = parseInt(h.INTERVALO_MIN) || 30;
      var ini = h.HORA_INICIO.split(':');
      var fin = h.HORA_FIN.split(':');
      var minIni = parseInt(ini[0]) * 60 + parseInt(ini[1]);
      var minFin = parseInt(fin[0]) * 60 + parseInt(fin[1]);
      for (var m = minIni; m + intervalo <= minFin; m += intervalo) {
        var hh = Math.floor(m / 60);
        var mm = m % 60;
        var hora = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
        slots.push({ hora: hora, ocupado: ocupadas.indexOf(hora) >= 0 });
      }
    });

    return respuestaOK({ slots: slots, dia: diaSemana });
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REPORTE DE CITAS (resumen por estado)
// ════════════════════════════════════════════════════════════
function reporteCitas(params) {
  try {
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return c.ID_CITA && String(c.ID_CITA).trim() !== ''; });
    return respuestaOK({
      total:        citas.length,
      programadas:  citas.filter(function(c){ return c.ESTADO_CITA === 'PROGRAMADA'; }).length,
      atendidas:    citas.filter(function(c){ return c.ESTADO_CITA === 'ATENDIDA'; }).length,
      canceladas:   citas.filter(function(c){ return c.ESTADO_CITA === 'CANCELADA'; }).length,
      pendientesPago: citas.filter(function(c){ return (c.ESTADO_PAGO || 'PENDIENTE') === 'PENDIENTE'; }).length,
    });
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  LISTAR MÉDICOS QUE EJERCEN UNA ESPECIALIDAD
// ════════════════════════════════════════════════════════════
function listarMedicosPorEspecialidad(params) {
  try {
    if (!params.ID_ESPECIALIDAD) return respuestaError('ID_ESPECIALIDAD requerido.');

    var medEsps = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila)
      .filter(function(me){ return me.ID_ESPECIALIDAD === params.ID_ESPECIALIDAD && me.ESTADO === 'ACTIVO'; });

    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);

    var resultado = [];
    for (var i = 0; i < medEsps.length; i++) {
      for (var j = 0; j < medicos.length; j++) {
        if (medicos[j].ID_MEDICO === medEsps[i].ID_MEDICO && medicos[j].ESTADO === 'ACTIVO') {
          resultado.push({
            ID_MEDICO:  medicos[j].ID_MEDICO,
            NOMBRES:    medicos[j].NOMBRES,
            APELLIDOS:  medicos[j].APELLIDOS,
            NUMERO_CMP: medicos[j].NUMERO_CMP,
          });
          break;
        }
      }
    }
    return respuestaOK(resultado, resultado.length + ' médico(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// Slots disponibles de un profesional de apoyo (mismo formato que obtenerSlotsCita)
function obtenerSlotsApoyo(params) {
  try {
    if (!params.FECHA) return respuestaError('FECHA es requerida.');
    var tipoEjec = String(params.TIPO_EJECUTOR || 'PROFESIONAL').toUpperCase();
    var idEjec = params.ID_EJECUTOR || params.ID_PROFESIONAL || params.ID_MEDICO;
    if (!idEjec) return respuestaError('Seleccione el ejecutor.');

    var partes = params.FECHA.split('-');
    var fecha = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    var diasMap = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
    var diaSemana = diasMap[fecha.getDay()];

    var horarios = leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila)
      .filter(function(h){
        var match = (tipoEjec === 'MEDICO') ? (h.ID_MEDICO === idEjec) : (h.ID_PROFESIONAL === idEjec);
        return match &&
               String(h.DIA_SEMANA).toUpperCase() === diaSemana &&
               h.ESTADO === 'ACTIVO';
      });
    if (!horarios.length) {
      // Distinguir: ¿no tiene NINGÚN horario configurado, o solo no atiende ESE día?
      var tieneAlgunHorario = leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila)
        .some(function(h){
          var match = (tipoEjec === 'MEDICO') ? (h.ID_MEDICO === idEjec) : (h.ID_PROFESIONAL === idEjec);
          return match && h.ESTADO === 'ACTIVO';
        });
      if (!tieneAlgunHorario) {
        return respuestaOK({ slots: [], dia: diaSemana, sinHorario: true,
          mensaje: 'Este profesional no tiene horario configurado. Configure su horario en el módulo de Horarios.' });
      }
      return respuestaOK({ slots: [], dia: diaSemana, mensaje: 'No atiende ese día.' });
    }

    var ocupadas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){
        var match = (tipoEjec === 'MEDICO') ? (c.ID_MEDICO === idEjec && c.TIPO_ATENCION === 'APOYO') : (c.ID_PROFESIONAL === idEjec);
        return match &&
               c.FECHA_CITA === params.FECHA &&
               c.ESTADO_CITA !== 'CANCELADA';
      })
      .map(function(c){ return c.HORA_CITA; });

    var slots = [];
    horarios.forEach(function(h){
      var intervalo = parseInt(h.INTERVALO_MIN) || 30;
      var ini = h.HORA_INICIO.split(':');
      var fin = h.HORA_FIN.split(':');
      var minIni = parseInt(ini[0]) * 60 + parseInt(ini[1]);
      var minFin = parseInt(fin[0]) * 60 + parseInt(fin[1]);
      for (var m = minIni; m + intervalo <= minFin; m += intervalo) {
        var hh = Math.floor(m / 60), mm = m % 60;
        var hora = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
        slots.push({ hora: hora, ocupado: ocupadas.indexOf(hora) >= 0 });
      }
    });
    return respuestaOK({ slots: slots, dia: diaSemana });
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
