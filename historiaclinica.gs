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
