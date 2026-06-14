// ============================================================
// VIZVALL — Historia Clínica (Fase 1: Ficha clínica del paciente)
// ============================================================

// ── Obtener la ficha clínica de un paciente (la crea vacía si no existe) ──
function obtenerFichaClinica(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_PACIENTE) return respuestaError('Seleccione el paciente.');

    // Datos del paciente
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var pac = null;
    for (var i = 0; i < pacientes.length; i++) { if (pacientes[i].ID_PACIENTE === params.ID_PACIENTE) { pac = pacientes[i]; break; } }
    if (!pac) return respuestaError('Paciente no encontrado.');

    // Buscar ficha existente
    var fichas = leerHoja(HOJAS.FICHA_CLINICA).map(limpiarFila);
    var ficha = null;
    for (var f = 0; f < fichas.length; f++) {
      if (fichas[f].ID_PACIENTE === params.ID_PACIENTE && fichas[f].ESTADO !== 'ANULADO') { ficha = fichas[f]; break; }
    }

    var datosPac = {
      ID_PACIENTE: pac.ID_PACIENTE,
      NOMBRE: ((pac.NOMBRES||'')+' '+(pac.APELLIDOS||'')).trim(),
      DOCUMENTO: pac.NUMERO_DOCUMENTO || '-',
      SEXO: pac.SEXO || '-',
      FECHA_NACIMIENTO: pac.FECHA_NACIMIENTO || '-',
      TELEFONO: pac.TELEFONO || '-',
    };

    if (!ficha) {
      return respuestaOK({ paciente: datosPac, ficha: null, existe: false }, 'Sin ficha clínica aún.');
    }
    return respuestaOK({ paciente: datosPac, ficha: ficha, existe: true }, 'Ficha encontrada.');
  } catch (err) {
    return respuestaError('Error al obtener ficha: ' + err.message);
  }
}

// ── Guardar/actualizar la ficha clínica ──
function guardarFichaClinica(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Solo médico o administrador.', 'ERR_PERMISO'); }
    if (!params.ID_PACIENTE) { lock.releaseLock(); return respuestaError('Paciente requerido.'); }

    var campos = {
      GRUPO_SANGUINEO:         String(params.GRUPO_SANGUINEO || '-').toUpperCase(),
      ALERGIAS:                String(params.ALERGIAS || '-').toUpperCase(),
      ENFERMEDADES_CRONICAS:   String(params.ENFERMEDADES_CRONICAS || '-').toUpperCase(),
      CIRUGIAS_PREVIAS:        String(params.CIRUGIAS_PREVIAS || '-').toUpperCase(),
      MEDICACION_HABITUAL:     String(params.MEDICACION_HABITUAL || '-').toUpperCase(),
      ANTECEDENTES_FAMILIARES: String(params.ANTECEDENTES_FAMILIARES || '-').toUpperCase(),
      OBSERVACIONES:           String(params.OBSERVACIONES || '-').toUpperCase(),
      USUARIO_ACTUALIZA:       params.usuario || '-',
      FECHA_ACTUALIZACION:     getFecha('datetime'),
    };

    // ¿Ya existe ficha? → actualizar; si no → crear
    var fichas = leerHoja(HOJAS.FICHA_CLINICA).map(limpiarFila);
    var existente = null;
    for (var f = 0; f < fichas.length; f++) {
      if (fichas[f].ID_PACIENTE === params.ID_PACIENTE && fichas[f].ESTADO !== 'ANULADO') { existente = fichas[f]; break; }
    }

    if (existente) {
      actualizarFila(HOJAS.FICHA_CLINICA, 'ID_FICHA', existente.ID_FICHA, campos);
      lock.releaseLock();
      return respuestaOK({ ID_FICHA: existente.ID_FICHA }, 'Ficha clínica actualizada.');
    }

    var id = generarID(HOJAS.FICHA_CLINICA, 'ID_FICHA', 'FC', 4);
    campos.ID_FICHA = id;
    campos.ID_PACIENTE = params.ID_PACIENTE;
    campos.ESTADO = 'ACTIVO';
    campos.FECHA_REGISTRO = getFecha('datetime');
    insertarFila(HOJAS.FICHA_CLINICA, campos);
    lock.releaseLock();
    return respuestaOK({ ID_FICHA: id }, 'Ficha clínica creada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar ficha: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  FASE 2 — ATENCIONES MÉDICAS (diagnóstico por visita)
// ════════════════════════════════════════════════════════════

// ── Obtener la atención de una venta (+ ficha clínica del paciente) ──
function obtenerAtencionDeVenta(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_VENTA) return respuestaError('Venta requerida.');

    // Datos de la venta
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === params.ID_VENTA) { venta = ventas[i]; break; } }
    if (!venta) return respuestaError('Venta no encontrada.');

    // Paciente
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var pac = null;
    for (var p = 0; p < pacientes.length; p++) { if (pacientes[p].ID_PACIENTE === venta.ID_PACIENTE) { pac = pacientes[p]; break; } }
    var nombrePac = pac ? ((pac.NOMBRES||'')+' '+(pac.APELLIDOS||'')).trim() : '—';

    // Médico (de la cita asociada)
    var medico = _medicoDeVenta(params.ID_VENTA);

    // Ficha clínica (para mostrar alergias/crónicas)
    var fichas = leerHoja(HOJAS.FICHA_CLINICA).map(limpiarFila);
    var ficha = null;
    for (var f = 0; f < fichas.length; f++) {
      if (fichas[f].ID_PACIENTE === venta.ID_PACIENTE && fichas[f].ESTADO !== 'ANULADO') { ficha = fichas[f]; break; }
    }
    var resumenFicha = ficha ? {
      ALERGIAS: (ficha.ALERGIAS && ficha.ALERGIAS!=='-') ? ficha.ALERGIAS : '',
      ENFERMEDADES_CRONICAS: (ficha.ENFERMEDADES_CRONICAS && ficha.ENFERMEDADES_CRONICAS!=='-') ? ficha.ENFERMEDADES_CRONICAS : '',
      MEDICACION_HABITUAL: (ficha.MEDICACION_HABITUAL && ficha.MEDICACION_HABITUAL!=='-') ? ficha.MEDICACION_HABITUAL : '',
    } : null;

    // ¿Ya existe atención para esta venta?
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var atencion = null;
    for (var a = 0; a < atenciones.length; a++) {
      if (atenciones[a].ID_VENTA === params.ID_VENTA && atenciones[a].ESTADO !== 'ANULADA') { atencion = atenciones[a]; break; }
    }

    return respuestaOK({
      ID_VENTA: params.ID_VENTA,
      ID_PACIENTE: venta.ID_PACIENTE,
      NOMBRE_PACIENTE: nombrePac,
      ID_MEDICO: medico ? medico.ID_MEDICO : '-',
      NOMBRE_MEDICO: medico ? medico.NOMBRE : '—',
      ID_CITA: venta.ID_CITA || '-',
      ficha: resumenFicha,
      atencion: atencion,
      existe: !!atencion,
    }, atencion ? 'Atención encontrada.' : 'Sin atención aún.');
  } catch (err) {
    return respuestaError('Error al obtener atención: ' + err.message);
  }
}

// ── Guardar/actualizar la atención médica de una venta ──
function guardarAtencionMedica(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Solo médico o administrador.', 'ERR_PERMISO'); }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }
    if (!params.DIAGNOSTICO || String(params.DIAGNOSTICO).trim()==='') { lock.releaseLock(); return respuestaError('El diagnóstico es obligatorio.'); }

    var campos = {
      MOTIVO:          String(params.MOTIVO || '-').toUpperCase(),
      PA:              String(params.PA || '-'),
      TEMPERATURA:     String(params.TEMPERATURA || '-'),
      PESO:            String(params.PESO || '-'),
      TALLA:           String(params.TALLA || '-'),
      FREC_CARDIACA:   String(params.FREC_CARDIACA || '-'),
      SAT_O2:          String(params.SAT_O2 || '-'),
      DIAGNOSTICO:     String(params.DIAGNOSTICO || '-').toUpperCase(),
      TRATAMIENTO:     String(params.TRATAMIENTO || '-').toUpperCase(),
      INDICACIONES:    String(params.INDICACIONES || '-').toUpperCase(),
      ORDENES:         String(params.ORDENES || '-').toUpperCase(),
      PROXIMO_CONTROL: String(params.PROXIMO_CONTROL || '-'),
    };

    // ¿Ya existe? → actualizar; si no → crear
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var existente = null;
    for (var a = 0; a < atenciones.length; a++) {
      if (atenciones[a].ID_VENTA === params.ID_VENTA && atenciones[a].ESTADO !== 'ANULADA') { existente = atenciones[a]; break; }
    }

    if (existente) {
      actualizarFila(HOJAS.ATENCION_MEDICA, 'ID_ATENCION', existente.ID_ATENCION, campos);
      lock.releaseLock();
      return respuestaOK({ ID_ATENCION: existente.ID_ATENCION }, 'Atención actualizada.');
    }

    var id = generarID(HOJAS.ATENCION_MEDICA, 'ID_ATENCION', 'AT', 4);
    campos.ID_ATENCION     = id;
    campos.ID_VENTA        = params.ID_VENTA;
    campos.ID_PACIENTE     = params.ID_PACIENTE || '-';
    campos.NOMBRE_PACIENTE = String(params.NOMBRE_PACIENTE || '-').toUpperCase();
    campos.ID_MEDICO       = params.ID_MEDICO || '-';
    campos.NOMBRE_MEDICO   = String(params.NOMBRE_MEDICO || '-').toUpperCase();
    campos.ID_CITA         = params.ID_CITA || '-';
    campos.FECHA_ATENCION  = getFecha('datetime');
    campos.ESTADO          = 'ACTIVO';
    campos.USUARIO         = params.usuario || '-';
    campos.FECHA_REGISTRO  = getFecha('datetime');
    insertarFila(HOJAS.ATENCION_MEDICA, campos);
    lock.releaseLock();
    return respuestaOK({ ID_ATENCION: id }, 'Atención registrada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar atención: ' + err.message);
  }
}

// ── Listar las atenciones de un paciente (para la línea de tiempo, Fase 3) ──
function listarAtencionesPaciente(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_PACIENTE) return respuestaError('Paciente requerido.');
    var lista = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila)
      .filter(function(a){ return a.ID_PACIENTE === params.ID_PACIENTE && a.ESTADO !== 'ANULADA'; });
    lista.sort(function(a,b){ return (a.FECHA_ATENCION||'') > (b.FECHA_ATENCION||'') ? -1 : 1; });
    return respuestaOK(lista, lista.length + ' atención(es).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}


// ── Obtener una atención por su ID + ficha del paciente (para editar desde Historia Clínica) ──
function obtenerAtencionPorId(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_ATENCION) return respuestaError('Atención requerida.');

    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var at = null;
    for (var a = 0; a < atenciones.length; a++) { if (atenciones[a].ID_ATENCION === params.ID_ATENCION) { at = atenciones[a]; break; } }
    if (!at) return respuestaError('Atención no encontrada.');

    // Ficha del paciente (alergias)
    var fichas = leerHoja(HOJAS.FICHA_CLINICA).map(limpiarFila);
    var ficha = null;
    for (var f = 0; f < fichas.length; f++) {
      if (fichas[f].ID_PACIENTE === at.ID_PACIENTE && fichas[f].ESTADO !== 'ANULADO') { ficha = fichas[f]; break; }
    }
    var resumenFicha = ficha ? {
      ALERGIAS: (ficha.ALERGIAS && ficha.ALERGIAS!=='-') ? ficha.ALERGIAS : '',
      ENFERMEDADES_CRONICAS: (ficha.ENFERMEDADES_CRONICAS && ficha.ENFERMEDADES_CRONICAS!=='-') ? ficha.ENFERMEDADES_CRONICAS : '',
      MEDICACION_HABITUAL: (ficha.MEDICACION_HABITUAL && ficha.MEDICACION_HABITUAL!=='-') ? ficha.MEDICACION_HABITUAL : '',
    } : null;

    return respuestaOK({
      ID_VENTA: at.ID_VENTA, ID_PACIENTE: at.ID_PACIENTE, NOMBRE_PACIENTE: at.NOMBRE_PACIENTE,
      ID_MEDICO: at.ID_MEDICO, NOMBRE_MEDICO: at.NOMBRE_MEDICO, ID_CITA: at.ID_CITA,
      ficha: resumenFicha, atencion: at, existe: true,
    }, 'Atención encontrada.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
// ── Estado de atención de las ventas (para el badge en Ventas) ──
// Devuelve un mapa { ID_VENTA: 'COMPLETADA' | 'PENDIENTE' }
// COMPLETADA = la atención tiene diagnóstico; PENDIENTE = no existe o sin diagnóstico
function estadoAtencionVentas(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION','CAJERO','ENFERMERA'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var mapa = {};
    for (var i = 0; i < atenciones.length; i++) {
      var a = atenciones[i];
      if (!a.ID_VENTA || a.ESTADO === 'ANULADA') continue;
      var tieneDx = a.DIAGNOSTICO && String(a.DIAGNOSTICO).trim() !== '' && a.DIAGNOSTICO !== '-';
      // Si ya hay una completada, no la bajes a pendiente
      if (mapa[a.ID_VENTA] === 'COMPLETADA') continue;
      mapa[a.ID_VENTA] = tieneDx ? 'COMPLETADA' : 'EN_PROCESO';
    }
    return respuestaOK(mapa, 'Estados de atención.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
