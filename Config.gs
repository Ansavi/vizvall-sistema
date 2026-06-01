// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Config.gs
// Tablas maestras de configuración
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR MAESTRA GENÉRICA
// ════════════════════════════════════════════════════════════
function listarMaestras(tabla) {
  try {
    const tablasPermitidas = [
      'TIPO_DOCUMENTO','ESPECIALIDAD','TSERVICIO','TPAQUETE',
      'TCITA','TCOMPROBANTE','TMODO_PAGO','TCONCEPTO_CAJA',
      'TCONTROL_SESIONES','ROL',
      'AREA_APOYO','PROFESIONAL_APOYO','MEDICO_ESPECIALIDAD'
    ];
    if (!tablasPermitidas.includes(tabla)) {
      return respuestaError('Tabla no permitida: ' + tabla);
    }
    const datos = leerHoja(tabla).map(limpiarFila);
    return respuestaOK(datos, datos.length + ' registro(s).');
  } catch (err) {
    return respuestaError('Error al leer ' + tabla + ': ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR REGISTRO EN MAESTRA
// ════════════════════════════════════════════════════════════
function guardarMaestra(params) {
  try {
    const rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Solo el Administrador puede modificar tablas maestras.', 'ERR_PERMISO');
    }
    if (!params.tabla || !params.datos) {
      return respuestaError('tabla y datos son requeridos.');
    }
    insertarFila(params.tabla, params.datos);
    return respuestaOK({}, 'Registro guardado en ' + params.tabla);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  CARGAR TODAS LAS MAESTRAS DE UNA VEZ
// ════════════════════════════════════════════════════════════
function cargarTodasMaestras() {
  try {
    return respuestaOK({
      tiposDoc:       leerHoja(HOJAS.TIPO_DOCUMENTO).map(limpiarFila),
      especialidades: leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila),
      tservicios:     leerHoja(HOJAS.TSERVICIO).map(limpiarFila),
      tpaquetes:      leerHoja(HOJAS.TPAQUETE).map(limpiarFila),
      tcitas:         leerHoja(HOJAS.TCITA).map(limpiarFila),
      tcomprobantes:  leerHoja(HOJAS.TCOMPROBANTE).map(limpiarFila),
      tmodosPago:     leerHoja(HOJAS.TMODO_PAGO).map(limpiarFila),
      tconceptosCaja: leerHoja(HOJAS.TCONCEPTO_CAJA).map(limpiarFila),
      tcontrolSes:    leerHoja(HOJAS.TCONTROL_SESIONES).map(limpiarFila),
    }, 'Maestras cargadas.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
