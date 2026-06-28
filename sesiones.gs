// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Sesiones.gs
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR CONTROLES DE SESIONES
// ════════════════════════════════════════════════════════════
function listarSesiones(params) {
  try {
    if (!_puedeModulo(params, 'Control Sesiones')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    let controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila);

    // Enriquecer con datos de paciente y médico
    const pacientes  = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    const medicos    = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    const tipos      = leerHoja(HOJAS.TCONTROL_SESIONES).map(limpiarFila);

    controles = controles.map(c => {
      const pac = pacientes.find(p => p.ID_PACIENTE === c.ID_PACIENTE) || {};
      const med = medicos.find(m => m.ID_MEDICO === c.ID_MEDICO) || {};
      const tip = tipos.find(t => t.ID_TCONTROL === c.TIPO) || {};
      return {
        ...c,
        PACIENTE_NOMBRE:   (pac.NOMBRES || '') + ' ' + (pac.APELLIDOS || ''),
        PACIENTE_DOC:      pac.NUMERO_DOCUMENTO || '—',
        MEDICO_NOMBRE:     med.NOMBRES ? 'Dr. ' + med.NOMBRES + ' ' + med.APELLIDOS : '—',
        TIPO_NOMBRE:       tip.NOMBRE || c.TIPO || '—',
        PROGRESO_PCT:      c.TOTAL_SESIONES > 0
                           ? Math.round((c.SESIONES_USADAS / c.TOTAL_SESIONES) * 100)
                           : 0,
      };
    });

    // Filtros
    if (params.estado) {
      controles = controles.filter(c =>
        String(c.ESTADO).toUpperCase() === params.estado.toUpperCase()
      );
    }
    if (params.tipo) {
      controles = controles.filter(c => c.TIPO === params.tipo);
    }
    if (params.ID_PACIENTE) {
      controles = controles.filter(c => c.ID_PACIENTE === params.ID_PACIENTE);
    }
    if (params.query) {
      const q = params.query.toUpperCase().trim();
      controles = controles.filter(c =>
        (c.PACIENTE_NOMBRE + ' ' + c.ID_CONTROL + ' ' + c.TIPO_NOMBRE).toUpperCase().includes(q)
      );
    }

    // Ordenar: ACTIVO primero, luego por fecha inicio desc
    controles.sort((a, b) => {
      if (a.ESTADO === 'ACTIVO' && b.ESTADO !== 'ACTIVO') return -1;
      if (a.ESTADO !== 'ACTIVO' && b.ESTADO === 'ACTIVO') return 1;
      return (b.FECHA_INICIO || '') > (a.FECHA_INICIO || '') ? 1 : -1;
    });

    const limite  = parseInt(params.limite) || 50;
    const pagina  = parseInt(params.pagina) || 1;
    const total   = controles.length;
    const inicio  = (pagina - 1) * limite;
    const datos   = controles.slice(inicio, inicio + limite);

    return respuestaOK({ datos, total, pagina, limite, paginas: Math.ceil(total / limite) },
      total + ' control(es) encontrado(s).');

  } catch (err) {
    return respuestaError('Error al listar sesiones: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  OBTENER DETALLE DE UN CONTROL
// ════════════════════════════════════════════════════════════
function obtenerDetalleControl(params) {
  try {
    if (!params.ID_CONTROL) return respuestaError('ID_CONTROL requerido.');

    const controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila);
    const control = controles.find(c => c.ID_CONTROL === params.ID_CONTROL);
    if (!control) return respuestaError('Control no encontrado.');

    // Obtener sesiones registradas
    const sesiones = leerHoja(HOJAS.DCONTROL_SESIONES).map(limpiarFila)
      .filter(s => s.ID_CONTROL === params.ID_CONTROL)
      .sort((a, b) => (String(b.FECHA||'')+String(b.HORA||'')) > (String(a.FECHA||'')+String(a.HORA||'')) ? -1 : 1);

    // Enriquecer médicos en sesiones
    const medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    const sesionesEnriquecidas = sesiones.map(s => ({
      ...s,
      MEDICO_NOMBRE: medicos.find(m => m.ID_MEDICO === s.ID_MEDICO)
        ? 'Dr. ' + medicos.find(m => m.ID_MEDICO === s.ID_MEDICO).NOMBRES + ' ' +
          medicos.find(m => m.ID_MEDICO === s.ID_MEDICO).APELLIDOS
        : '—',
    }));

    return respuestaOK({ control, sesiones: sesionesEnriquecidas });

  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  CREAR CONTROL DE SESIONES
// ════════════════════════════════════════════════════════════
function crearControlSesiones(params) {
  try {
    if (!_puedeModulo(params, 'Control Sesiones')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    const requeridos = ['ID_PACIENTE','TIPO','TOTAL_SESIONES','FECHA_INICIO','PRECIO_TOTAL'];
    for (const campo of requeridos) {
      if (!params[campo] || String(params[campo]).trim() === '') {
        return respuestaError('El campo ' + campo + ' es requerido.');
      }
    }

    const controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila);
    const ultimos   = controles.map(c => parseInt((c.ID_CONTROL || '').replace('CS-', '')));
    const siguiente = (ultimos.length ? Math.max(...ultimos.filter(n => !isNaN(n))) : 0) + 1;
    const idControl = 'CS-' + String(siguiente).padStart(4, '0');

    const total    = parseInt(params.TOTAL_SESIONES) || 0;
    const pagado   = parseFloat(params.MONTO_PAGADO) || 0;
    const precio   = parseFloat(params.PRECIO_TOTAL) || 0;
    const saldo    = precio - pagado;

    // Calcular fecha fin si no se provee
    let fechaFin = params.FECHA_FIN || '';
    if (!fechaFin && params.VIGENCIA_DIAS) {
      const fi = new Date(params.FECHA_INICIO);
      fi.setDate(fi.getDate() + parseInt(params.VIGENCIA_DIAS));
      fechaFin = fi.toISOString().split('T')[0];
    }

    insertarFila(HOJAS.CONTROL_SESIONES, {
      ID_CONTROL:         idControl,
      ID_VENTA:           params.ID_VENTA || '-',
      FECHA_INICIO:       params.FECHA_INICIO,
      FECHA_FIN:          fechaFin || '-',
      ID_PACIENTE:        params.ID_PACIENTE,
      TIPO:               params.TIPO,
      ID_PAQUETE:         params.ID_PAQUETE || '-',
      TOTAL_SESIONES:     total,
      SESIONES_USADAS:    0,
      SESIONES_RESTANTES: total,
      PRECIO_TOTAL:       precio,
      MONTO_PAGADO:       pagado,
      SALDO:              saldo,
      ID_MEDICO:          params.ID_MEDICO || '-',
      PROXIMA_CITA:       params.PROXIMA_CITA || '-',
      ESTADO:             'ACTIVO',
      OBSERVACIONES:      params.OBSERVACIONES || '-',
    });

    return respuestaOK({ ID_CONTROL: idControl }, 'Control de sesiones creado correctamente.');

  } catch (err) {
    return respuestaError('Error al crear control: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REGISTRAR SESIÓN REALIZADA
// ════════════════════════════════════════════════════════════
function registrarSesion(params) {
  try {
    if (!_puedeModulo(params, 'Control Sesiones')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    if (!params.ID_CONTROL) return respuestaError('ID_CONTROL requerido.');

    // Obtener el control
    const controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila);
    const ctrl = controles.find(c => c.ID_CONTROL === params.ID_CONTROL);
    if (!ctrl) return respuestaError('Control de sesiones no encontrado.');
    if (ctrl.ESTADO !== 'ACTIVO') {
      return respuestaError('Este control no está ACTIVO. Estado actual: ' + ctrl.ESTADO);
    }

    const usadas     = parseInt(ctrl.SESIONES_USADAS) || 0;
    const total      = parseInt(ctrl.TOTAL_SESIONES) || 0;
    const restantes  = total - usadas;

    if (restantes <= 0) {
      return respuestaError('No quedan sesiones disponibles en este control.');
    }

    // Generar ID de detalle
    const detalles  = leerHoja(HOJAS.DCONTROL_SESIONES).map(limpiarFila);
    const ultimos   = detalles.map(d => parseInt((d.ID_DCONTROL || '').replace('DC-', '')));
    const siguiente = (ultimos.length ? Math.max(...ultimos.filter(n => !isNaN(n))) : 0) + 1;
    const idDetalle = 'DC-' + String(siguiente).padStart(4, '0');

    const estadoSesion = String(params.ESTADO_SESION || 'REALIZADA').toUpperCase();
    const hoy          = getFecha('fecha');
    const hora         = params.HORA || getFecha('hora');

    // Insertar detalle
    insertarFila(HOJAS.DCONTROL_SESIONES, {
      ID_DCONTROL:       idDetalle,
      ID_CONTROL:        params.ID_CONTROL,
      FECHA:             params.FECHA || hoy,
      HORA:              hora,
      ID_MEDICO:         params.ID_MEDICO || ctrl.ID_MEDICO || '-',
      NUMERO_SESION:     usadas + 1,
      DURACION_MIN:      parseInt(params.DURACION_MIN) || 30,
      DESCRIPCION_SESION:normalizar(params.DESCRIPCION_SESION || 'Sesión registrada'),
      ESTADO_SESION:     estadoSesion,
      OBSERVACIONES:     params.OBSERVACIONES || '-',
    });

    // Actualizar contadores en CONTROL_SESIONES
    // Solo contar como usada si el estado es REALIZADA
    const nuevasUsadas    = estadoSesion === 'REALIZADA' ? usadas + 1 : usadas;
    const nuevasRestantes = total - nuevasUsadas;
    const nuevoEstado     = nuevasRestantes <= 0 ? 'COMPLETADO' : 'ACTIVO';

    actualizarFila(HOJAS.CONTROL_SESIONES, 'ID_CONTROL', params.ID_CONTROL, {
      SESIONES_USADAS:    nuevasUsadas,
      SESIONES_RESTANTES: nuevasRestantes,
      ESTADO:             nuevoEstado,
      PROXIMA_CITA:       params.PROXIMA_CITA || ctrl.PROXIMA_CITA || '-',
    });

    return respuestaOK({
      ID_DCONTROL:       idDetalle,
      SESIONES_USADAS:   nuevasUsadas,
      SESIONES_RESTANTES: nuevasRestantes,
      ESTADO:            nuevoEstado,
    }, estadoSesion === 'REALIZADA'
        ? 'Sesión registrada. Quedan ' + nuevasRestantes + ' sesión(es).'
        : 'Sesión marcada como ' + estadoSesion + '.');

  } catch (err) {
    return respuestaError('Error al registrar sesión: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR CONTROL (próxima cita, saldo, observaciones)
// ════════════════════════════════════════════════════════════
function actualizarControl(params) {
  try {
    if (!params.ID_CONTROL) return respuestaError('ID_CONTROL requerido.');
    const datos = {};
    if (params.PROXIMA_CITA  !== undefined) datos.PROXIMA_CITA  = params.PROXIMA_CITA || '-';
    if (params.MONTO_PAGADO  !== undefined) {
      const ctrl   = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila)
                       .find(c => c.ID_CONTROL === params.ID_CONTROL);
      if (ctrl) {
        datos.MONTO_PAGADO = parseFloat(params.MONTO_PAGADO) || 0;
        datos.SALDO        = parseFloat(ctrl.PRECIO_TOTAL) - datos.MONTO_PAGADO;
      }
    }
    if (params.ESTADO        !== undefined) datos.ESTADO        = String(params.ESTADO).toUpperCase();
    if (params.ID_MEDICO     !== undefined) datos.ID_MEDICO     = params.ID_MEDICO || '-';
    if (params.OBSERVACIONES !== undefined) datos.OBSERVACIONES = params.OBSERVACIONES || '-';

    actualizarFila(HOJAS.CONTROL_SESIONES, 'ID_CONTROL', params.ID_CONTROL, datos);
    return respuestaOK({}, 'Control actualizado.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REPORTE SESIONES
// ════════════════════════════════════════════════════════════
function reporteSesiones(params) {
  try {
    const controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila);
    const resumen = {
      total:      controles.length,
      activos:    controles.filter(c => c.ESTADO === 'ACTIVO').length,
      completados:controles.filter(c => c.ESTADO === 'COMPLETADO').length,
      cancelados: controles.filter(c => c.ESTADO === 'CANCELADO').length,
      totalSesionesUsadas: controles.reduce((s, c) => s + (parseInt(c.SESIONES_USADAS) || 0), 0),
      saldoPendiente: controles.reduce((s, c) => s + (parseFloat(c.SALDO) || 0), 0),
    };
    return respuestaOK({ controles, resumen });
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  Cambiar el estado de una sesión existente (PROGRAMADA → ...)
//  Maneja descuento al pasar a REALIZADA y reprogramación.
// ════════════════════════════════════════════════════════════
function cambiarEstadoSesion(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Control Sesiones')) {
      lock.releaseLock();
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_DCONTROL) { lock.releaseLock(); return respuestaError('ID_DCONTROL requerido.'); }
    var nuevoEstadoSesion = String(params.ESTADO_SESION || '').toUpperCase();
    var validos = ['PROGRAMADA','REALIZADA','NO_ASISTIO','CANCELADA','REPROGRAMADA'];
    if (validos.indexOf(nuevoEstadoSesion) < 0) { lock.releaseLock(); return respuestaError('Estado de sesión no válido.'); }

    // Buscar la sesión (detalle)
    var detalles = leerHoja(HOJAS.DCONTROL_SESIONES).map(limpiarFila);
    var det = detalles.find(function(d){ return d.ID_DCONTROL === params.ID_DCONTROL; });
    if (!det) { lock.releaseLock(); return respuestaError('Sesión no encontrada.'); }

    var estadoAnterior = String(det.ESTADO_SESION || '').toUpperCase();
    if (estadoAnterior === 'REALIZADA') { lock.releaseLock(); return respuestaError('No se puede cambiar una sesión ya REALIZADA.'); }

    // Obtener el control asociado
    var controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila);
    var ctrl = controles.find(function(c){ return c.ID_CONTROL === det.ID_CONTROL; });
    if (!ctrl) { lock.releaseLock(); return respuestaError('Control no encontrado.'); }

    var usadas = parseInt(ctrl.SESIONES_USADAS) || 0;
    var total  = parseInt(ctrl.TOTAL_SESIONES) || 0;

    // Datos a actualizar en la sesión
    var cambios = { ESTADO_SESION: nuevoEstadoSesion };
    if (params.OBSERVACIONES) cambios.OBSERVACIONES = normalizar(params.OBSERVACIONES);
    if (params.DESCRIPCION_SESION) cambios.DESCRIPCION_SESION = normalizar(params.DESCRIPCION_SESION);

    // Si pasa a REALIZADA → descuenta y asigna número de sesión
    if (nuevoEstadoSesion === 'REALIZADA') {
      if (usadas >= total) { lock.releaseLock(); return respuestaError('No quedan sesiones disponibles en este control.'); }
      cambios.NUMERO_SESION = usadas + 1;
      actualizarFila(HOJAS.DCONTROL_SESIONES, 'ID_DCONTROL', params.ID_DCONTROL, cambios);
      var nuevasUsadas = usadas + 1;
      var nuevasRestantes = total - nuevasUsadas;
      actualizarFila(HOJAS.CONTROL_SESIONES, 'ID_CONTROL', det.ID_CONTROL, {
        SESIONES_USADAS: nuevasUsadas,
        SESIONES_RESTANTES: nuevasRestantes,
        ESTADO: nuevasRestantes <= 0 ? 'COMPLETADO' : 'ACTIVO',
      });
      lock.releaseLock();
      return respuestaOK({ SESIONES_RESTANTES: nuevasRestantes }, 'Sesión marcada como REALIZADA. Quedan ' + nuevasRestantes + ' sesión(es).');
    }

    // Si se REPROGRAMA → marca la actual y crea una nueva PROGRAMADA con la nueva fecha
    if (nuevoEstadoSesion === 'REPROGRAMADA') {
      if (!params.NUEVA_FECHA) { lock.releaseLock(); return respuestaError('Indique la nueva fecha para reprogramar.'); }
      actualizarFila(HOJAS.DCONTROL_SESIONES, 'ID_DCONTROL', params.ID_DCONTROL, cambios);
      // Crear nueva sesión PROGRAMADA
      var ult = detalles.map(function(d){ return parseInt((d.ID_DCONTROL||'').replace('DC-','')); });
      var sig = (ult.length ? Math.max.apply(null, ult.filter(function(n){return !isNaN(n);})) : 0) + 1;
      var nuevoId = 'DC-' + String(sig).padStart(4,'0');
      insertarFila(HOJAS.DCONTROL_SESIONES, {
        ID_DCONTROL:       nuevoId,
        ID_CONTROL:        det.ID_CONTROL,
        FECHA:             params.NUEVA_FECHA,
        HORA:              params.NUEVA_HORA || det.HORA || '-',
        ID_MEDICO:         det.ID_MEDICO || '-',
        NUMERO_SESION:     0,
        DURACION_MIN:      det.DURACION_MIN || 30,
        DESCRIPCION_SESION:det.DESCRIPCION_SESION || 'SESIÓN REPROGRAMADA',
        ESTADO_SESION:     'PROGRAMADA',
        OBSERVACIONES:     'REPROGRAMADA DESDE ' + (det.FECHA||'-'),
      });
      lock.releaseLock();
      return respuestaOK({ ID_NUEVA: nuevoId }, 'Sesión reprogramada para el ' + params.NUEVA_FECHA + '.');
    }

    // NO_ASISTIO o CANCELADA → solo cambia estado, no descuenta
    actualizarFila(HOJAS.DCONTROL_SESIONES, 'ID_DCONTROL', params.ID_DCONTROL, cambios);
    lock.releaseLock();
    return respuestaOK({}, 'Sesión marcada como ' + nuevoEstadoSesion + '.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al cambiar estado: ' + err.message);
  }
}
