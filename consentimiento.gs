// ════════════════════════════════════════════════════════════════════════
//  CONSENTIMIENTO INFORMADO DE PROCEDIMIENTO MÉDICO
//  Acto clínico: el paciente autoriza un procedimiento específico tras ser
//  informado de en qué consiste, sus riesgos y alternativas.
//  Vinculado a la ATENCIÓN MÉDICA. Registro digital + documento imprimible.
// ════════════════════════════════════════════════════════════════════════

/**
 * Registra (o actualiza) el consentimiento de un procedimiento para una atención.
 * params: ID_ATENCION, ID_PACIENTE, NOMBRE_PACIENTE, ID_MEDICO, NOMBRE_MEDICO,
 *         PROCEDIMIENTO, DESCRIPCION, RIESGOS, ALTERNATIVAS, ACEPTADO ('SI'/'NO')
 */
function guardarConsentimientoProc(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) {
      lock.releaseLock();
      return respuestaError('Sin permiso para registrar consentimientos.', 'ERR_PERMISO');
    }
    if (!params.ID_ATENCION) { lock.releaseLock(); return respuestaError('Atención no especificada.'); }
    if (!params.PROCEDIMIENTO || String(params.PROCEDIMIENTO).trim() === '') {
      lock.releaseLock(); return respuestaError('Indique el nombre del procedimiento.');
    }

    var ses = params._sesion || {};
    var campos = {
      ID_ATENCION:      params.ID_ATENCION,
      ID_PACIENTE:      params.ID_PACIENTE || '-',
      NOMBRE_PACIENTE:  String(params.NOMBRE_PACIENTE || '-').toUpperCase(),
      ID_MEDICO:        params.ID_MEDICO || '-',
      NOMBRE_MEDICO:    String(params.NOMBRE_MEDICO || '-').toUpperCase(),
      PROCEDIMIENTO:    String(params.PROCEDIMIENTO || '').toUpperCase(),
      DESCRIPCION:      String(params.DESCRIPCION || ''),
      RIESGOS:          String(params.RIESGOS || ''),
      ALTERNATIVAS:     String(params.ALTERNATIVAS || ''),
      ACEPTADO:         (String(params.ACEPTADO).toUpperCase() === 'SI') ? 'SI' : 'NO',
      FECHA_CONSENT:    getFecha('datetime'),
      USUARIO_REGISTRA: ses.USUARIO || params.usuario || '-',
      ESTADO:           'ACTIVO',
    };

    // ¿Ya existe un consentimiento activo para esta atención + procedimiento? → actualizar
    var filas = leerHoja(HOJAS.CONSENTIMIENTO_PROC).map(limpiarFila);
    var existente = null;
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].ID_ATENCION === params.ID_ATENCION &&
          String(filas[i].PROCEDIMIENTO).toUpperCase() === campos.PROCEDIMIENTO &&
          filas[i].ESTADO !== 'ANULADO') { existente = filas[i]; break; }
    }

    var idConsent;
    if (existente) {
      idConsent = existente.ID_CONSENT;
      actualizarFila(HOJAS.CONSENTIMIENTO_PROC, 'ID_CONSENT', idConsent, campos);
    } else {
      idConsent = generarID(HOJAS.CONSENTIMIENTO_PROC, 'ID_CONSENT', 'CNS', 5);
      campos.ID_CONSENT = idConsent;
      insertarFila(HOJAS.CONSENTIMIENTO_PROC, campos);
    }

    // Trazabilidad clínica (si está disponible)
    if (typeof registrarTrazaHC_ === 'function') {
      registrarTrazaHC_(params, params.ID_PACIENTE, params.NOMBRE_PACIENTE,
        'CONSENTIMIENTO', 'Consentimiento de procedimiento: ' + campos.PROCEDIMIENTO + ' (' + (campos.ACEPTADO==='SI'?'aceptado':'no aceptado') + ')');
    }

    lock.releaseLock();
    return respuestaOK({ ID_CONSENT: idConsent }, 'Consentimiento registrado correctamente.');
  } catch (err) {
    lock.releaseLock();
    return respuestaError('Error al registrar consentimiento: ' + err.message);
  }
}

/**
 * Lista los consentimientos de una atención (o de un paciente).
 * params: ID_ATENCION  (o)  ID_PACIENTE
 */
function listarConsentimientosProc(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) {
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    }
    var filas = leerHoja(HOJAS.CONSENTIMIENTO_PROC).map(limpiarFila)
      .filter(function(r){ return r.ID_CONSENT && r.ESTADO !== 'ANULADO'; });

    if (params.ID_ATENCION) filas = filas.filter(function(r){ return r.ID_ATENCION === params.ID_ATENCION; });
    else if (params.ID_PACIENTE) filas = filas.filter(function(r){ return r.ID_PACIENTE === params.ID_PACIENTE; });

    filas.sort(function(a,b){ return String(b.FECHA_CONSENT).localeCompare(String(a.FECHA_CONSENT)); });

    return respuestaOK({ consentimientos: filas, total: filas.length }, 'Consentimientos.');
  } catch (err) {
    return respuestaError('Error al listar consentimientos: ' + err.message);
  }
}

// ── Función ▶ para crear la hoja CONSENTIMIENTO_PROC sin reiniciar ──
function instalarConsentimientoProc() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'CONSENTIMIENTO_PROC';
  var cab = ['ID_CONSENT','ID_ATENCION','ID_PACIENTE','NOMBRE_PACIENTE','ID_MEDICO','NOMBRE_MEDICO',
             'PROCEDIMIENTO','DESCRIPCION','RIESGOS','ALTERNATIVAS','ACEPTADO',
             'FECHA_CONSENT','USUARIO_REGISTRA','ESTADO'];
  var hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, cab.length).setValues([cab]);
    hoja.setFrozenRows(1);
    Logger.log('✓ Hoja CONSENTIMIENTO_PROC creada.');
  } else {
    Logger.log('• La hoja CONSENTIMIENTO_PROC ya existe.');
  }
  return '✓ Consentimiento de procedimiento listo.';
}
