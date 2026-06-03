// ============================================================
// VIZVALL — cita.gs — Gestión de Citas
// Cita y pago independientes (cita sin pago / pago sin cita)
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR CITAS (con filtros opcionales: fecha, médico, estado)
// ════════════════════════════════════════════════════════════
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

    var enriched = citas.map(function(c){
      var pacNombre = '—', medNombre = '—', espNombre = '—';
      for (var i = 0; i < pacientes.length; i++) {
        if (pacientes[i].ID_PACIENTE === c.ID_PACIENTE) {
          pacNombre = (pacientes[i].NOMBRES || '') + ' ' + (pacientes[i].APELLIDOS || '');
          break;
        }
      }
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
      return {
        ID_CITA:         c.ID_CITA,
        ID_PACIENTE:     c.ID_PACIENTE,
        PACIENTE_NOMBRE: pacNombre,
        ID_MEDICO:       c.ID_MEDICO,
        MEDICO_NOMBRE:   medNombre,
        ID_ESPECIALIDAD: c.ID_ESPECIALIDAD,
        ESPECIALIDAD_NOMBRE: espNombre,
        FECHA_CITA:      c.FECHA_CITA,
        HORA_CITA:       c.HORA_CITA,
        MOTIVO_CONSULTA: c.MOTIVO_CONSULTA,
        ESTADO_CITA:     c.ESTADO_CITA || 'PROGRAMADA',
        ESTADO_PAGO:     c.ESTADO_PAGO || 'PENDIENTE',
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
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'RECEPCION', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('No tiene permiso para crear citas.', 'ERR_PERMISO');
    }

    var requeridos = ['ID_PACIENTE', 'ID_MEDICO', 'ID_ESPECIALIDAD', 'FECHA_CITA', 'HORA_CITA'];
    for (var r = 0; r < requeridos.length; r++) {
      if (!params[requeridos[r]] || String(params[requeridos[r]]).trim() === '') {
        return respuestaError('El campo ' + requeridos[r] + ' es requerido.');
      }
    }

    // Validar que no exista otra cita activa para ese médico en esa fecha/hora
    var citasExist = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){
        return c.ID_MEDICO === params.ID_MEDICO &&
               c.FECHA_CITA === params.FECHA_CITA &&
               c.HORA_CITA === params.HORA_CITA &&
               c.ESTADO_CITA !== 'CANCELADA';
      });
    if (citasExist.length) {
      return respuestaError('Ya existe una cita para ese médico en esa fecha y hora.');
    }

    var idCita = generarID(HOJAS.CITA, 'ID_CITA', 'CIT', 4);

    insertarFila(HOJAS.CITA, {
      ID_CITA:         idCita,
      ID_PACIENTE:     params.ID_PACIENTE,
      ID_MEDICO:       params.ID_MEDICO,
      ID_ESPECIALIDAD: params.ID_ESPECIALIDAD,
      FECHA_CITA:      params.FECHA_CITA,
      HORA_CITA:       params.HORA_CITA,
      MOTIVO_CONSULTA: params.MOTIVO_CONSULTA || '-',
      ESTADO_CITA:     'PROGRAMADA',
      ID_TCITA:        params.ID_TCITA || '-',
      CONSULTORIO:     params.CONSULTORIO || '-',
      ESTADO_PAGO:     'PENDIENTE',
      ID_VENTA:        '-',
      OBSERVACIONES:   params.OBSERVACIONES || '-',
      FECHA_REGISTRO:  getFecha('fecha'),
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

    return respuestaOK({ ID_CITA: idCita }, 'Cita registrada: ' + idCita);
  } catch (err) {
    return respuestaError('Error al guardar cita: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR ESTADO DE CITA (programada/atendida/cancelada/reprogramada)
// ════════════════════════════════════════════════════════════
function actualizarEstadoCita(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'RECEPCION', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_CITA || !params.ESTADO_CITA) {
      return respuestaError('ID_CITA y ESTADO_CITA son requeridos.');
    }

    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var cita = null;
    for (var i = 0; i < citas.length; i++) {
      if (citas[i].ID_CITA === params.ID_CITA) { cita = citas[i]; break; }
    }
    if (!cita) return respuestaError('Cita no encontrada.');

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

    return respuestaOK({}, 'Estado de cita actualizado a ' + params.ESTADO_CITA + '.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR ESTADO DE PAGO de una cita
// ════════════════════════════════════════════════════════════
function actualizarPagoCita(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'CAJERO', 'RECEPCION'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('No tiene permiso.', 'ERR_PERMISO');
    }
    if (!params.ID_CITA) return respuestaError('ID_CITA requerido.');

    var datos = { ESTADO_PAGO: params.ESTADO_PAGO || 'PAGADO' };
    if (params.ID_VENTA) datos.ID_VENTA = params.ID_VENTA;

    actualizarFila(HOJAS.CITA, 'ID_CITA', params.ID_CITA, datos);
    return respuestaOK({}, 'Estado de pago actualizado.');
  } catch (err) {
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
