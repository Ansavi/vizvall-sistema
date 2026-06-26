// ════════════════════════════════════════════════════════════
//  RECETA MÉDICA DEL PACIENTE — Backend
//  Prefijo: rm  ·  Tabla: RECETA_MEDICA
//  Flujo: al guardar la atención → se prepara/abre la receta
// ════════════════════════════════════════════════════════════

// Helper: obtiene la especialidad asociada a una venta (vía su cita)
function _rmEspecialidadDeVenta(idVenta) {
  try {
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === idVenta) { venta = ventas[i]; break; } }
    if (!venta || !venta.ID_CITA || venta.ID_CITA === '-') return '';
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var cita = null;
    for (var j = 0; j < citas.length; j++) { if (citas[j].ID_CITA === venta.ID_CITA) { cita = citas[j]; break; } }
    if (!cita || !cita.ID_ESPECIALIDAD) return '';
    var esps = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    for (var k = 0; k < esps.length; k++) {
      if (esps[k].ID_ESPECIALIDAD === cita.ID_ESPECIALIDAD) return esps[k].ESPECIALIDAD || '';
    }
    return '';
  } catch (e) { return ''; }
}

// Prepara los datos de la receta a partir de una atención (para precargar la pantalla)
// Hereda: paciente, médico (CMP/RNE), especialidad, diagnóstico y tratamiento.
function prepararRecetaDesdeAtencion(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR', 'MEDICO', 'RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_ATENCION) return respuestaError('Atención requerida.');

    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var at = null;
    for (var i = 0; i < atenciones.length; i++) {
      if (atenciones[i].ID_ATENCION === params.ID_ATENCION) { at = atenciones[i]; break; }
    }
    if (!at) return respuestaError('No se encontró la atención.');

    // Seguridad: un médico solo prepara recetas de SUS atenciones
    if (rol === 'MEDICO') {
      var miMed = (typeof _hcMedicoDelUsuario === 'function') ? _hcMedicoDelUsuario(params) : null;
      if (!miMed) return respuestaError('Su usuario no está vinculado a un médico.', 'ERR_PERMISO');
      if (String(at.ID_MEDICO) !== String(miMed))
        return respuestaError('No puede generar la receta de la atención de otro médico.', 'ERR_PERMISO');
    }

    // Datos del médico (CMP / RNE)
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var cmp = '', rne = '', nomMed = at.NOMBRE_MEDICO || '';
    for (var m = 0; m < medicos.length; m++) {
      if (medicos[m].ID_MEDICO === at.ID_MEDICO) {
        cmp = (medicos[m].NUMERO_CMP && medicos[m].NUMERO_CMP !== '-') ? medicos[m].NUMERO_CMP : '';
        rne = (medicos[m].NUMERO_RNE && medicos[m].NUMERO_RNE !== '-') ? medicos[m].NUMERO_RNE : '';
        if (!nomMed) nomMed = ((medicos[m].NOMBRES || '') + ' ' + (medicos[m].APELLIDOS || '')).trim();
        break;
      }
    }

    // Edad del paciente
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var edad = '', fnac = '';
    for (var p = 0; p < pacientes.length; p++) {
      if (pacientes[p].ID_PACIENTE === at.ID_PACIENTE) { fnac = pacientes[p].FECHA_NACIMIENTO || ''; break; }
    }
    if (fnac && fnac !== '-') {
      var fn = new Date(String(fnac).substring(0, 10));
      if (!isNaN(fn.getTime())) {
        var hoyD = new Date();
        edad = hoyD.getFullYear() - fn.getFullYear();
        var mm = hoyD.getMonth() - fn.getMonth();
        if (mm < 0 || (mm === 0 && hoyD.getDate() < fn.getDate())) edad--;
      }
    }

    // ¿Ya existe una receta para esta atención? (para no duplicar)
    var existente = null;
    var recetas = leerHoja(HOJAS.RECETA_MEDICA).map(limpiarFila);
    for (var r = 0; r < recetas.length; r++) {
      if (recetas[r].ID_ATENCION === params.ID_ATENCION && recetas[r].ESTADO !== 'ANULADA') {
        existente = recetas[r]; break;
      }
    }

    return respuestaOK({
      ID_ATENCION:     at.ID_ATENCION,
      ID_VENTA:        at.ID_VENTA,
      ID_PACIENTE:     at.ID_PACIENTE,
      NOMBRE_PACIENTE: at.NOMBRE_PACIENTE || '',
      EDAD:            edad,
      ID_MEDICO:       at.ID_MEDICO,
      NOMBRE_MEDICO:   nomMed,
      MEDICO_CMP:      cmp,
      MEDICO_RNE:      rne,
      ESPECIALIDAD:    _rmEspecialidadDeVenta(at.ID_VENTA),
      DIAGNOSTICO:     (at.DIAGNOSTICO && at.DIAGNOSTICO !== '-') ? at.DIAGNOSTICO : '',
      TRATAMIENTO:     (at.TRATAMIENTO && at.TRATAMIENTO !== '-') ? at.TRATAMIENTO : '',
      PROXIMO_CONTROL: (at.PROXIMO_CONTROL && at.PROXIMO_CONTROL !== '-') ? at.PROXIMO_CONTROL : '',
      RECETA_EXISTENTE: existente // si no es null, ya hay receta guardada (para editar)
    }, 'Datos de receta preparados.');
  } catch (err) {
    return respuestaError('Error al preparar receta: ' + err.message);
  }
}

// Guarda (o actualiza) la receta médica
function guardarRecetaMedica(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR', 'MEDICO'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Solo médico o administrador.', 'ERR_PERMISO'); }
    if (!params.ID_ATENCION) { lock.releaseLock(); return respuestaError('Atención requerida.'); }

    // Seguridad: un médico solo guarda recetas de sus atenciones
    if (rol === 'MEDICO') {
      var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
      var atMed = '';
      for (var a = 0; a < atenciones.length; a++) { if (atenciones[a].ID_ATENCION === params.ID_ATENCION) { atMed = atenciones[a].ID_MEDICO; break; } }
      var miMed = (typeof _hcMedicoDelUsuario === 'function') ? _hcMedicoDelUsuario(params) : null;
      if (miMed && String(atMed) !== String(miMed)) { lock.releaseLock(); return respuestaError('No puede modificar la receta de otro médico.', 'ERR_PERMISO'); }
    }

    var idUsuario = params._sesion ? (params._sesion.ID_USUARIO || params._sesion.USUARIO || '-') : '-';

    var campos = {
      ID_ATENCION:      String(params.ID_ATENCION),
      ID_VENTA:         String(params.ID_VENTA || '-'),
      ID_PACIENTE:      String(params.ID_PACIENTE || '-'),
      NOMBRE_PACIENTE:  String(params.NOMBRE_PACIENTE || '-').toUpperCase(),
      ID_MEDICO:        String(params.ID_MEDICO || '-'),
      NOMBRE_MEDICO:    String(params.NOMBRE_MEDICO || '-').toUpperCase(),
      ESPECIALIDAD:     String(params.ESPECIALIDAD || '-'),
      FECHA_RECETA:     getFecha('fecha'),
      DIAGNOSTICO:      String(params.DIAGNOSTICO || '-').toUpperCase(),
      MEDICAMENTOS_JSON: String(params.MEDICAMENTOS_JSON || '[]'),
      INDICACIONES:     String(params.INDICACIONES || '-').toUpperCase(),
      DIAS_TRATAMIENTO: String(params.DIAS_TRATAMIENTO || '-'),
      PROXIMO_CONTROL:  String(params.PROXIMO_CONTROL || '-'),
      ESTADO:           'ACTIVA',
      USUARIO:          String(idUsuario),
      FECHA_REGISTRO:   getFecha('datetime')
    };

    // ¿Editar existente o crear nueva?
    var recetas = leerHoja(HOJAS.RECETA_MEDICA).map(limpiarFila);
    var existenteId = null;
    if (params.ID_RECETA) {
      existenteId = params.ID_RECETA;
    } else {
      for (var i = 0; i < recetas.length; i++) {
        if (recetas[i].ID_ATENCION === params.ID_ATENCION && recetas[i].ESTADO !== 'ANULADA') { existenteId = recetas[i].ID_RECETA; break; }
      }
    }

    if (existenteId) {
      actualizarFila(HOJAS.RECETA_MEDICA, 'ID_RECETA', existenteId, campos);
      lock.releaseLock();
      return respuestaOK({ ID_RECETA: existenteId }, 'Receta actualizada.');
    } else {
      var id = generarID('REC');
      campos.ID_RECETA = id;
      insertarFila(HOJAS.RECETA_MEDICA, campos);
      lock.releaseLock();
      return respuestaOK({ ID_RECETA: id }, 'Receta registrada.');
    }
  } catch (err) {
    lock.releaseLock();
    return respuestaError('Error al guardar receta: ' + err.message);
  }
}

// Obtiene una receta por su ID (para ver/imprimir)
function obtenerRecetaMedica(params) {
  try {
    if (!params.ID_RECETA) return respuestaError('Receta requerida.');
    var recetas = leerHoja(HOJAS.RECETA_MEDICA).map(limpiarFila);
    for (var i = 0; i < recetas.length; i++) {
      if (recetas[i].ID_RECETA === params.ID_RECETA) return respuestaOK(recetas[i], 'OK');
    }
    return respuestaError('No se encontró la receta.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// Lista las recetas de un paciente (respetando privacidad por médico)
function listarRecetasPaciente(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR', 'MEDICO', 'RECEPCION'].indexOf(rol) < 0) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_PACIENTE) return respuestaError('Paciente requerido.');

    var lista = leerHoja(HOJAS.RECETA_MEDICA).map(limpiarFila)
      .filter(function (r) { return r.ID_PACIENTE === params.ID_PACIENTE && r.ESTADO !== 'ANULADA'; });

    // Privacidad: el médico ve solo sus recetas
    if (rol === 'MEDICO') {
      var miMed = (typeof _hcMedicoDelUsuario === 'function') ? _hcMedicoDelUsuario(params) : null;
      if (!miMed) return respuestaOK([], 'Su usuario no está vinculado a un médico.');
      lista = lista.filter(function (r) { return String(r.ID_MEDICO) === String(miMed); });
    }

    lista.sort(function (a, b) { return (a.FECHA_REGISTRO || '') > (b.FECHA_REGISTRO || '') ? -1 : 1; });
    return respuestaOK(lista, lista.length + ' receta(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
