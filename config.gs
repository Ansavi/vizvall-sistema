// ============================================================
// VIZVALL — Config.gs — Tablas maestras de configuración
// ============================================================

// Esquema de cada tabla maestra: prefijo ID + columnas editables
var CONFIG_SCHEMAS = {
  TIPO_DOCUMENTO:    { idCol:'ID_TIPO_DOCUMENTO', prefijo:'TD',  campos:['TIPO','LONGITUD'], conEstado:false,
                       numericos:['LONGITUD'], minLen:{TIPO:2}, etiqueta:'tipo de documento', unico:'TIPO' },
  ESPECIALIDAD:      { idCol:'ID_ESPECIALIDAD',   prefijo:'ESP', campos:['ESPECIALIDAD','DESCRIPCION'], conEstado:true,
                       minLen:{ESPECIALIDAD:3}, maxLen:{DESCRIPCION:300}, etiqueta:'especialidad', unico:'ESPECIALIDAD' },
  TSERVICIO:         { idCol:'ID_TSERVICIO',      prefijo:'TS',  campos:['NOMBRE'], conEstado:true,
                       minLen:{NOMBRE:3}, etiqueta:'tipo de servicio', unico:'NOMBRE' },
  TPAQUETE:          { idCol:'ID_TPAQUETE',       prefijo:'TP',  campos:['NOMBRE'], conEstado:true,
                       minLen:{NOMBRE:3}, etiqueta:'tipo de paquete', unico:'NOMBRE' },
  TCITA:             { idCol:'ID_TCITA',          prefijo:'TC',  campos:['NOMBRE'], conEstado:true,
                       minLen:{NOMBRE:3}, etiqueta:'tipo de cita', unico:'NOMBRE' },
  TCOMPROBANTE:      { idCol:'ID_TCOMPROBANTE',   prefijo:'TCO', campos:['NOMBRE','SERIE'], conEstado:true,
                       minLen:{NOMBRE:3}, etiqueta:'tipo de comprobante', unico:'NOMBRE' },
  TMODO_PAGO:        { idCol:'ID_TMODO_PAGO',     prefijo:'TMP', campos:['NOMBRE'], conEstado:true,
                       minLen:{NOMBRE:3}, etiqueta:'método de pago', unico:'NOMBRE' },
  TCONCEPTO_CAJA:    { idCol:'ID_TCONCEPTO_CAJA', prefijo:'TCC', campos:['NOMBRE','TIPO'], conEstado:true,
                       minLen:{NOMBRE:3}, lista:{TIPO:['INGRESO','EGRESO']}, etiqueta:'concepto de caja', unico:'NOMBRE' },
  TCONTROL_SESIONES: { idCol:'ID_TCONTROL',       prefijo:'TCS', campos:['NOMBRE','DESCRIPCION'], conEstado:true,
                       minLen:{NOMBRE:3}, maxLen:{DESCRIPCION:300}, etiqueta:'estado de control de sesiones', unico:'NOMBRE' },
  AREA_APOYO:        { idCol:'ID_AREA_APOYO',     prefijo:'AAP', campos:['NOMBRE','DESCRIPCION'], conEstado:true,
                       minLen:{NOMBRE:3}, maxLen:{DESCRIPCION:300}, etiqueta:'área de apoyo', unico:'NOMBRE' },
  UNIDAD_MEDIDA:     { idCol:'ID_UNIDAD',        prefijo:'UM',  campos:['NOMBRE','ABREVIATURA'], conEstado:true,
                       minLen:{NOMBRE:2}, maxLen:{ABREVIATURA:10}, etiqueta:'unidad de medida', unico:'NOMBRE' },
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
// ════════════════════════════════════════════════════════════
//  Validación + normalización centralizada de maestras
//  Devuelve {ok, error, valores} con los valores ya en MAYÚSCULAS
// ════════════════════════════════════════════════════════════
function _validarMaestra(schema, tabla, params, idActual) {
  var valores = {};
  for (var j = 0; j < schema.campos.length; j++) {
    var campo = schema.campos[j];
    var crudo = params[campo] !== undefined ? String(params[campo]).trim() : '';
    var esNumerico = schema.numericos && schema.numericos.indexOf(campo) >= 0;

    // Primer campo (o requeridos): obligatorio
    if (j === 0 && crudo === '') {
      return { ok:false, error:'El campo ' + campo + ' es obligatorio.' };
    }
    // Longitud mínima
    if (schema.minLen && schema.minLen[campo] && crudo !== '' && crudo.length < schema.minLen[campo]) {
      return { ok:false, error:'El campo ' + campo + ' debe tener al menos ' + schema.minLen[campo] + ' caracteres.' };
    }
    // Longitud máxima
    if (schema.maxLen && schema.maxLen[campo] && crudo.length > schema.maxLen[campo]) {
      return { ok:false, error:'El campo ' + campo + ' no puede superar ' + schema.maxLen[campo] + ' caracteres.' };
    }
    // Numérico
    if (esNumerico && crudo !== '') {
      if (isNaN(parseFloat(crudo)) || parseFloat(crudo) < 0) {
        return { ok:false, error:'El campo ' + campo + ' debe ser un número válido.' };
      }
      valores[campo] = String(parseInt(crudo));
      continue;
    }
    // Lista cerrada
    if (schema.lista && schema.lista[campo]) {
      var v = crudo.toUpperCase();
      if (crudo !== '' && schema.lista[campo].indexOf(v) < 0) {
        return { ok:false, error:'El campo ' + campo + ' debe ser uno de: ' + schema.lista[campo].join(', ') + '.' };
      }
      valores[campo] = v;
      continue;
    }
    // Texto normal → MAYÚSCULAS
    valores[campo] = crudo.toUpperCase();
  }

  // Unicidad del campo clave
  if (schema.unico) {
    var registros = leerHoja(tabla).map(limpiarFila);
    var valorUnico = String(valores[schema.unico] || '').toUpperCase();
    for (var i = 0; i < registros.length; i++) {
      if (idActual && String(registros[i][schema.idCol]) === String(idActual)) continue;
      var existente = String(registros[i][schema.unico] || '').toUpperCase();
      var estadoReg = registros[i].ESTADO;
      if (existente === valorUnico && estadoReg !== 'INACTIVO') {
        return { ok:false, error:'Ya existe un registro de ' + (schema.etiqueta || 'este tipo') + ' con ese nombre.' };
      }
    }
  }

  return { ok:true, valores:valores };
}

function guardarMaestra(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede modificar configuración.', 'ERR_PERMISO');
    }
    var tabla = params.tabla;
    var schema = CONFIG_SCHEMAS[tabla];
    if (!schema) return respuestaError('Tabla no permitida: ' + tabla);

    // Validar + normalizar (MAYÚSCULAS) de forma centralizada
    var val = _validarMaestra(schema, tabla, params, null);
    if (!val.ok) return respuestaError(val.error);

    // Generar ID
    var registros = leerHoja(tabla).map(limpiarFila);
    var maxNum = 0;
    for (var i = 0; i < registros.length; i++) {
      var idVal = String(registros[i][schema.idCol] || '');
      var num = parseInt(idVal.replace(schema.prefijo + '-', ''));
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    var nuevoId = schema.prefijo + '-' + String(maxNum + 1).padStart(4, '0');

    // Construir fila con los valores ya validados y en MAYÚSCULAS
    var fila = {};
    fila[schema.idCol] = nuevoId;
    for (var j = 0; j < schema.campos.length; j++) {
      var campo = schema.campos[j];
      fila[campo] = val.valores[campo] !== undefined ? val.valores[campo] : '';
    }
    if (schema.conEstado) fila.ESTADO = (params.ESTADO || 'ACTIVO').toUpperCase();
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

    // Validar + normalizar (MAYÚSCULAS), excluyendo el propio registro en unicidad
    var val = _validarMaestra(schema, tabla, params, params.id);
    if (!val.ok) return respuestaError(val.error);

    var datos = {};
    for (var j = 0; j < schema.campos.length; j++) {
      var campo = schema.campos[j];
      if (params[campo] !== undefined) datos[campo] = val.valores[campo];
    }
    if (schema.conEstado && params.ESTADO) datos.ESTADO = String(params.ESTADO).toUpperCase();

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
