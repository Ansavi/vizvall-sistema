// ════════════════════════════════════════════════════════════════════════
//  TRAZABILIDAD DE HISTORIAS CLÍNICAS
//  Cumplimiento Ley 29733 (Protección de Datos Personales - Perú):
//  registra TODO acceso y edición sobre datos clínicos del paciente.
//  - registrarTrazaHC_(): función central (uso interno desde historiaclinica.gs)
//  - listarTrazabilidadHC(): visor consultable (solo ADMINISTRADOR)
// ════════════════════════════════════════════════════════════════════════

/**
 * Registra un acceso/edición sobre la historia clínica de un paciente.
 * Uso interno: se llama desde las funciones de historia clínica.
 * @param {Object} params  - params de la petición (trae _sesion)
 * @param {string} idPaciente
 * @param {string} nombrePaciente
 * @param {string} accion  - 'CONSULTA' | 'EDICION' | 'CREACION' | 'ATENCION' | etc.
 * @param {string} detalle
 */
function registrarTrazaHC_(params, idPaciente, nombrePaciente, accion, detalle) {
  try {
    var ses = params && params._sesion ? params._sesion : {};
    insertarFila(HOJAS.TRAZABILIDAD_HC, {
      ID_TRAZA:    generarID(HOJAS.TRAZABILIDAD_HC, 'ID_TRAZA', 'THC', 5),
      ID_PACIENTE: idPaciente || '-',
      PACIENTE:    nombrePaciente || '-',
      ID_USUARIO:  ses.ID_USUARIO || (params && params.usuario) || '-',
      USUARIO:     ses.USUARIO || (params && params.usuario) || '-',
      ROL:         ses.ROL || (params && params.rol) || '-',
      ACCION:      accion || 'CONSULTA',
      FECHA:       getFecha('datetime'),
      DETALLE:     detalle || '',
    });
  } catch (e) {
    // La trazabilidad nunca debe romper la operación principal
    try { if (typeof CONFIG !== 'undefined' && CONFIG.DEBUG) Logger.log('Error traza HC: ' + e.message); } catch(_){}
  }
}

/**
 * Visor de trazabilidad de historias clínicas. Solo ADMINISTRADOR.
 * Filtros opcionales: ID_PACIENTE, ID_USUARIO, ACCION, desde, hasta, query.
 */
function listarTrazabilidadHC(params) {
  try {
    var rol = (params._sesion && params._sesion.ROL) ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede ver la trazabilidad clínica.', 'ERR_PERMISO');
    }

    var filas = leerHoja(HOJAS.TRAZABILIDAD_HC).map(limpiarFila)
      .filter(function(r){ return r.ID_TRAZA; });

    // Filtros
    if (params.ID_PACIENTE) filas = filas.filter(function(r){ return String(r.ID_PACIENTE) === String(params.ID_PACIENTE); });
    if (params.ID_USUARIO)  filas = filas.filter(function(r){ return String(r.ID_USUARIO) === String(params.ID_USUARIO); });
    if (params.ACCION)      filas = filas.filter(function(r){ return String(r.ACCION) === String(params.ACCION); });
    if (params.query) {
      var q = String(params.query).toUpperCase();
      filas = filas.filter(function(r){
        return (String(r.PACIENTE)+' '+String(r.USUARIO)+' '+String(r.DETALLE)).toUpperCase().indexOf(q) !== -1;
      });
    }
    if (params.desde) filas = filas.filter(function(r){ return String(r.FECHA).substring(0,10) >= params.desde; });
    if (params.hasta) filas = filas.filter(function(r){ return String(r.FECHA).substring(0,10) <= params.hasta; });

    // Orden descendente por fecha (lo más reciente arriba)
    filas.sort(function(a,b){ return String(b.FECHA).localeCompare(String(a.FECHA)); });

    // Limitar a 500 registros para no saturar (el visor es de auditoría puntual)
    var total = filas.length;
    if (filas.length > 500) filas = filas.slice(0, 500);

    return respuestaOK({ registros: filas, total: total, mostrados: filas.length }, 'Trazabilidad clínica.');
  } catch (e) {
    return respuestaError('Error al listar trazabilidad: ' + e.message);
  }
}

// ── Función ▶ para crear la hoja TRAZABILIDAD_HC si no existe (sin reiniciar) ──
function instalarTrazabilidadHC() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'TRAZABILIDAD_HC';
  var cabecera = ['ID_TRAZA','ID_PACIENTE','PACIENTE','ID_USUARIO','USUARIO','ROL','ACCION','FECHA','DETALLE'];
  var hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, cabecera.length).setValues([cabecera]);
    hoja.setFrozenRows(1);
    Logger.log('✓ Hoja TRAZABILIDAD_HC creada.');
  } else {
    Logger.log('• La hoja TRAZABILIDAD_HC ya existe.');
  }
  return '✓ Trazabilidad clínica lista.';
}
