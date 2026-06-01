// ============================================================
// VIZVALL — Config.gs — Tablas maestras de configuración
// ============================================================

// Esquema de cada tabla maestra: prefijo ID + columnas editables
var CONFIG_SCHEMAS = {
  TIPO_DOCUMENTO:    { idCol:'ID_TIPO_DOCUMENTO', prefijo:'TD',  campos:['TIPO','LONGITUD'], conEstado:false },
  ESPECIALIDAD:      { idCol:'ID_ESPECIALIDAD',   prefijo:'ESP', campos:['ESPECIALIDAD','DESCRIPCION'], conEstado:true },
  TSERVICIO:         { idCol:'ID_TSERVICIO',      prefijo:'TS',  campos:['NOMBRE'], conEstado:true },
  TPAQUETE:          { idCol:'ID_TPAQUETE',       prefijo:'TP',  campos:['NOMBRE'], conEstado:true },
  TCITA:             { idCol:'ID_TCITA',          prefijo:'TC',  campos:['NOMBRE'], conEstado:true },
  TCOMPROBANTE:      { idCol:'ID_TCOMPROBANTE',   prefijo:'TCO', campos:['NOMBRE','SERIE'], conEstado:true },
  TMODO_PAGO:        { idCol:'ID_TMODO_PAGO',     prefijo:'TMP', campos:['NOMBRE'], conEstado:true },
  TCONCEPTO_CAJA:    { idCol:'ID_TCONCEPTO_CAJA', prefijo:'TCC', campos:['NOMBRE','TIPO'], conEstado:true },
  TCONTROL_SESIONES: { idCol:'ID_TCONTROL',       prefijo:'TCS', campos:['NOMBRE','DESCRIPCION'], conEstado:true },
  AREA_APOYO:        { idCol:'ID_AREA_APOYO',     prefijo:'AAP', campos:['NOMBRE','DESCRIPCION'], conEstado:true },
};

// ════════════════════════════════════════════════════════════
//  LISTAR MAESTRA
// ════════════════════════════════════════════════════════════
function listarMaestras(tabla) {
  try {
    if (!CONFIG_SCHEMAS[tabla]) {
      return respuestaError('Tabla no permitida: ' + tabla);
    }
    var datos = leerHoja(tabla).map(limpiarFila).filter(function(r) {
      var idc = CONFIG_SCHEMAS[tabla].idCol;
      return r[idc] && String(r[idc]).trim() !== '';
    });
    return respuestaOK(datos, datos.length + ' registro(s).');
  } catch (err) {
    return respuestaError('Error al leer ' + tabla + ': ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  OBTENER ESQUEMA DE UNA TABLA (para el formulario dinámico)
// ════════════════════════════════════════════════════════════
function obtenerEsquemaMaestra(tabla) {
  try {
    if (!CONFIG_SCHEMAS[tabla]) return respuestaError('Tabla no permitida.');
    return respuestaOK(CONFIG_SCHEMAS[tabla]);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR REGISTRO EN MAESTRA (nuevo)
// ════════════════════════════════════════════════════════════
function guardarMaestra(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede modificar configuración.', 'ERR_PERMISO');
    }
    var tabla = params.tabla;
    var schema = CONFIG_SCHEMAS[tabla];
    if (!schema) return respuestaError('Tabla no permitida: ' + tabla);

    // Validar campos requeridos (el primer campo siempre es obligatorio)
    if (!params[schema.campos[0]] || String(params[schema.campos[0]]).trim() === '') {
      return respuestaError('El campo ' + schema.campos[0] + ' es requerido.');
    }

    // Generar ID
    var registros = leerHoja(tabla).map(limpiarFila);
    var maxNum = 0;
    for (var i = 0; i < registros.length; i++) {
      var idVal = String(registros[i][schema.idCol] || '');
      var num = parseInt(idVal.replace(schema.prefijo + '-', ''));
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    var nuevoId = schema.prefijo + '-' + String(maxNum + 1).padStart(3, '0');

    // Construir fila
    var fila = {};
    fila[schema.idCol] = nuevoId;
    for (var j = 0; j < schema.campos.length; j++) {
      var campo = schema.campos[j];
      fila[campo] = params[campo] !== undefined ? String(params[campo]).trim() : '';
    }
    if (schema.conEstado) fila.ESTADO = params.ESTADO || 'ACTIVO';
    // FECHA_REGISTRO si la tabla la tiene
    var cabecera = leerHoja(tabla).length >= 0 ? obtenerCabecera_(tabla) : [];
    if (cabecera.indexOf('FECHA_REGISTRO') >= 0) fila.FECHA_REGISTRO = getFecha('fecha');

    insertarFila(tabla, fila);
    return respuestaOK({ id: nuevoId }, 'Registro creado: ' + nuevoId);
  } catch (err) {
    return respuestaError('Error al guardar: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR REGISTRO EN MAESTRA
// ════════════════════════════════════════════════════════════
function actualizarMaestra(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede modificar configuración.', 'ERR_PERMISO');
    }
    var tabla = params.tabla;
    var schema = CONFIG_SCHEMAS[tabla];
    if (!schema) return respuestaError('Tabla no permitida: ' + tabla);
    if (!params.id) return respuestaError('ID requerido.');

    var datos = {};
    for (var j = 0; j < schema.campos.length; j++) {
      var campo = schema.campos[j];
      if (params[campo] !== undefined) datos[campo] = String(params[campo]).trim();
    }
    if (schema.conEstado && params.ESTADO) datos.ESTADO = params.ESTADO;

    actualizarFila(tabla, schema.idCol, params.id, datos);
    return respuestaOK({}, 'Registro actualizado.');
  } catch (err) {
    return respuestaError('Error al actualizar: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  CAMBIAR ESTADO (activar/desactivar)
// ════════════════════════════════════════════════════════════
function cambiarEstadoMaestra(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    var schema = CONFIG_SCHEMAS[params.tabla];
    if (!schema || !schema.conEstado) return respuestaError('Tabla sin campo estado.');
    if (!params.id) return respuestaError('ID requerido.');
    actualizarFila(params.tabla, schema.idCol, params.id, { ESTADO: params.ESTADO || 'INACTIVO' });
    return respuestaOK({}, 'Estado actualizado.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ── Helper: obtener cabecera de una hoja ──
function obtenerCabecera_(nombreHoja) {
  try {
    var hoja = getHoja(nombreHoja);
    return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  } catch (e) {
    return [];
  }
}
