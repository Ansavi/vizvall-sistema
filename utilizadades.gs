// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Utilidades.gs
// Descripción: Funciones de uso general en todo el sistema
// ============================================================

// ── ACCESO AL SPREADSHEET ────────────────────────────────
/**
 * Retorna el objeto Spreadsheet principal.
 * Centraliza el acceso para facilitar cambios futuros.
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Retorna una hoja por nombre.
 * Lanza error si la hoja no existe.
 * @param {string} nombre - Nombre exacto de la hoja
 */
function getHoja(nombre) {
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(nombre);
  if (!hoja) throw new Error('Hoja no encontrada: ' + nombre);
  return hoja;
}

/**
 * Lee todos los datos de una hoja como array de objetos.
 * La primera fila se usa como cabecera (nombres de columnas).
 * @param {string} nombreHoja
 * @returns {Object[]} Array de objetos con los datos
 */
function leerHoja(nombreHoja) {
  const hoja = getHoja(nombreHoja);
  const datos = hoja.getDataRange().getValues();
  if (datos.length <= 1) return [];           // Solo cabecera o vacía
  const cabecera = datos[0];
  return datos.slice(1).map(fila => {
    const obj = {};
    cabecera.forEach((col, i) => { obj[col] = fila[i]; });
    return obj;
  });
}

/**
 * Agrega una nueva fila al final de la hoja.
 * @param {string} nombreHoja
 * @param {Object} datos - Objeto con los datos (claves = nombres de columna)
 * @returns {number} Número de fila insertada
 */
function insertarFila(nombreHoja, datos) {
  const hoja     = getHoja(nombreHoja);
  const cabecera = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const fila     = cabecera.map(function(col){ return datos[col] !== undefined ? datos[col] : ''; });
  const nuevaFila = hoja.getLastRow() + 1;

  // ORDEN CRÍTICO: poner formato TEXTO en columnas de hora ANTES de escribir,
  // si no Sheets convierte "08:00" a Date (bug 1899-12-30).
  // También para números largos (NUMERO_COMPROBANTE, documentos) que Sheets
  // convertiría a notación científica y perdería dígitos.
  for (var i = 0; i < cabecera.length; i++) {
    var val = fila[i];
    var colName = String(cabecera[i] || '');
    var esColNumLarga = /NUMERO_COMPROBANTE|NUMERO_DOCUMENTO|RUC|TELEFONO|NUMERO_CMP|APO_DNI/.test(colName);
    if (typeof val === 'string' && /^\d{1,2}:\d{2}$/.test(val)) {
      hoja.getRange(nuevaFila, i + 1).setNumberFormat('@');
    } else if (esColNumLarga) {
      hoja.getRange(nuevaFila, i + 1).setNumberFormat('@');
    } else if (typeof val === 'string' && /^\d{8,}$/.test(val)) {
      // cualquier texto de 8+ dígitos: guardar como texto
      hoja.getRange(nuevaFila, i + 1).setNumberFormat('@');
    }
  }

  // Escribir la fila completa (las celdas de hora ya tienen formato texto)
  hoja.getRange(nuevaFila, 1, 1, fila.length).setValues([fila]);
  return nuevaFila;
}

/**
 * Actualiza una fila existente buscando por valor de columna.
 * @param {string} nombreHoja
 * @param {string} columnaId - Nombre de la columna ID
 * @param {*}      valorId   - Valor a buscar
 * @param {Object} datos     - Datos a actualizar
 * @returns {boolean} true si actualizó, false si no encontró
 */
function actualizarFila(nombreHoja, columnaId, valorId, datos) {
  const hoja      = getHoja(nombreHoja);
  const todoDatos = hoja.getDataRange().getValues();
  const cabecera  = todoDatos[0];
  const colIdx    = cabecera.indexOf(columnaId);
  if (colIdx === -1) throw new Error('Columna no encontrada: ' + columnaId);

  for (let i = 1; i < todoDatos.length; i++) {
    if (String(todoDatos[i][colIdx]) === String(valorId)) {
      const filaActualizada = cabecera.map((col, j) =>
        datos[col] !== undefined ? datos[col] : todoDatos[i][j]
      );
      hoja.getRange(i + 1, 1, 1, cabecera.length).setValues([filaActualizada]);
      return true;
    }
  }
  return false;
}

/**
 * Busca filas que coincidan con un filtro.
 * @param {string} nombreHoja
 * @param {Object} filtros - { columna: valor, ... }
 * @returns {Object[]} Filas que cumplen todos los filtros
 */
function buscarEnHoja(nombreHoja, filtros) {
  const datos = leerHoja(nombreHoja);
  return datos.filter(fila =>
    Object.entries(filtros).every(([col, val]) => {
      if (val === undefined || val === null || val === '') return true;
      return String(fila[col]).toUpperCase().includes(String(val).toUpperCase());
    })
  );
}

// ── GENERACIÓN DE IDs ────────────────────────────────────
/**
 * Genera el próximo ID autoincremental para una hoja.
 * Formato: PAC-001, MED-042, VENTA-0001, etc.
 * @param {string} nombreHoja
 * @param {string} columnaId  - Nombre de la columna ID
 * @param {string} prefijo    - Ej: 'PAC', 'MED', 'VENTA'
 * @param {number} digitos    - Cantidad de dígitos (default 3)
 */
function generarID(nombreHoja, columnaId, prefijo, digitos) {
  digitos = digitos || 4;
  var hoja = getHoja(nombreHoja);
  var ult  = hoja.getLastRow();
  if (ult <= 1) return prefijo + '-' + String(1).padStart(digitos, '0');
  var ids  = hoja.getRange(2, 1, ult - 1, 1).getValues().flat()
    .filter(function(v){ return String(v).startsWith(prefijo + '-'); })
    .map(function(v){ return parseInt(String(v).split('-')[1]) || 0; });
  var max  = ids.length ? Math.max.apply(null, ids) : 0;
  // padStart NUNCA trunca: PAC-0001 … PAC-9999 … PAC-10000 (crece sin límite)
  return prefijo + '-' + String(max + 1).padStart(digitos, '0');
}

/**
 * Genera número de comprobante correlativo por serie.
 * Ej: B001-00000124
 * @param {string} serie - Ej: 'B001', 'F001'
 */
function generarNumeroComprobante(serie) {
  const datos = leerHoja(HOJAS.VENTA).filter(v => v.NUMERO_COMPROBANTE && String(v.NUMERO_COMPROBANTE).startsWith(serie));
  const nums  = datos.map(v => parseInt(String(v.NUMERO_COMPROBANTE).split('-')[1]) || 0);
  const sig   = nums.length ? Math.max(...nums) + 1 : 1;
  return serie + '-' + String(sig).padStart(8, '0');
}

// ── FECHAS Y TIEMPO ──────────────────────────────────────
/**
 * Fecha actual formateada según timezone de Lima.
 * @param {string} formato - 'fecha' | 'datetime' | 'hora'
 */
function getFecha(formato) {
  const ahora = new Date();
  const tz    = CONFIG.TIMEZONE;
  formato = formato || 'fecha';
  if (formato === 'fecha')    return Utilities.formatDate(ahora, tz, 'yyyy-MM-dd');
  if (formato === 'datetime') return Utilities.formatDate(ahora, tz, 'yyyy-MM-dd HH:mm:ss');
  if (formato === 'hora')     return Utilities.formatDate(ahora, tz, 'HH:mm:ss');
  return Utilities.formatDate(ahora, tz, formato);
}

/**
 * Formatea una fecha para mostrar en el frontend.
 * @param {Date|string} fecha
 * @returns {string} Ej: '25/05/2025'
 */
function formatearFecha(fecha) {
  if (!fecha) return '';
  try {
    const d = new Date(fecha);
    return Utilities.formatDate(d, CONFIG.TIMEZONE, CONFIG.FECHA_FORMATO);
  } catch (e) { return String(fecha); }
}

// ── SEGURIDAD: HASH DE CONTRASEÑAS ──────────────────────
/**
 * Genera hash SHA-256 de una clave.
 * NUNCA se guarda la clave en texto plano.
 * @param {string} clave
 * @returns {string} Hash hexadecimal
 */
function hashClave(clave) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    clave,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Verifica si una clave coincide con su hash.
 * @param {string} clave     - Clave en texto plano
 * @param {string} hashGuardado - Hash almacenado en USUARIO
 */
function verificarClave(clave, hashGuardado) {
  return hashClave(clave) === hashGuardado;
}

// ── RESPUESTAS ESTÁNDAR ──────────────────────────────────
/**
 * Respuesta exitosa uniforme para todas las funciones.
 * @param {*}      datos   - Datos a retornar al frontend
 * @param {string} mensaje - Mensaje opcional
 */
function respuestaOK(datos, mensaje) {
  return {
    ok:      true,
    datos:   datos || null,
    mensaje: mensaje || 'Operación exitosa',
    fecha:   getFecha('datetime'),
  };
}

/**
 * Respuesta de error uniforme.
 * @param {string} mensaje - Descripción del error
 * @param {*}      codigo  - Código de error opcional
 */
function respuestaError(mensaje, codigo) {
  if (CONFIG.DEBUG) Logger.log('RESPUESTA ERROR: ' + mensaje);
  return {
    ok:      false,
    datos:   null,
    mensaje: mensaje || 'Error desconocido',
    codigo:  codigo  || 'ERR_GENERAL',
    fecha:   getFecha('datetime'),
  };
}

// ── VALIDACIONES GENÉRICAS ───────────────────────────────
/**
 * Valida que los campos requeridos estén presentes.
 * @param {Object}   datos    - Objeto con los datos
 * @param {string[]} campos   - Lista de campos obligatorios
 * @returns {{ ok: boolean, faltantes: string[] }}
 */
function validarCamposRequeridos(datos, campos) {
  const faltantes = campos.filter(c => !datos[c] && datos[c] !== 0);
  return { ok: faltantes.length === 0, faltantes };
}

/**
 * Verifica unicidad de un valor en una columna.
 * @param {string} nombreHoja
 * @param {string} columna
 * @param {*}      valor
 * @param {string} excludeId     - ID a excluir (para edición)
 * @param {string} columnaExclude
 */
function esUnico(nombreHoja, columna, valor, excludeId, columnaExclude) {
  const datos = leerHoja(nombreHoja);
  return !datos.some(fila => {
    const mismoValor = String(fila[columna]).toUpperCase().trim() === String(valor).toUpperCase().trim();
    if (!mismoValor) return false;
    if (excludeId && columnaExclude) {
      return String(fila[columnaExclude]) !== String(excludeId);
    }
    return true;
  });
}

// ── AUDITORÍA ────────────────────────────────────────────
/**
 * Registra cada operación en la hoja AUDITORIA.
 * @param {string} usuario  - ID o nombre del usuario
 * @param {string} modulo   - Módulo afectado
 * @param {string} accion   - Ej: 'CREAR', 'EDITAR', 'ELIMINAR'
 * @param {string} detalle  - Descripción de lo que cambió
 */
function registrarAuditoria(usuario, modulo, accion, detalle) {
  try {
    insertarFila(HOJAS.AUDITORIA, {
      ID_AUDITORIA: generarID(HOJAS.AUDITORIA, 'ID_AUDITORIA', 'AUD', 4),
      ID_USUARIO:   usuario,
      MODULO:       modulo,
      ACCION:       accion,
      FECHA:        getFecha('datetime'),
      DETALLE:      detalle || '',
    });
  } catch (e) {
    if (CONFIG.DEBUG) Logger.log('Error auditoría: ' + e.message);
  }
}

// ── NORMALIZACIÓN DE TEXTO ───────────────────────────────
/**
 * Normaliza texto: trim + mayúsculas + colapsar espacios.
 * @param {string} texto
 */
function normalizar(texto) {
  return String(texto || '').toUpperCase().trim().replace(/\s+/g, ' ');
}

/**
 * Convierte un objeto de fila a formato limpio para el frontend.
 * Convierte fechas Date a strings, vacíos a null.
 */
function limpiarFila(fila) {
  const limpio = {};
  Object.entries(fila).forEach(([k, v]) => {
    if (v instanceof Date) {
      // Google Sheets guarda las HORAS con fecha base 1899-12-30.
      // Si el año es 1899, es un valor de HORA → formatear como HH:mm
      if (v.getFullYear() === 1899) {
        limpio[k] = Utilities.formatDate(v, CONFIG.TIMEZONE, 'HH:mm');
      } else {
        limpio[k] = Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd');
      }
    } else if (v === '' || v === undefined) {
      limpio[k] = null;
    } else {
      limpio[k] = v;
    }
  });
  return limpio;
}

// ════════════════════════════════════════════════════════════
//  PERMISOS REALES EN EL BACKEND
//  Verifica si el rol de la sesión tiene un permiso (módulo|acción)
//  según la tabla ROL_PERMISO. ADMINISTRADOR siempre puede.
//  Uso: if (!_tienePermiso(params, 'Ventas', 'Nueva venta')) return respuestaError(...)
// ════════════════════════════════════════════════════════════
function _tienePermiso(params, modulo, accion) {
  try {
    var rol = (params && params._sesion && params._sesion.ROL) ? params._sesion.ROL : '';
    if (!rol) return false;
    // El administrador siempre tiene acceso total
    if (String(rol).toUpperCase() === 'ADMINISTRADOR') return true;

    // Consultar los permisos reales del rol (tabla ROL_PERMISO)
    var permisos = (typeof obtenerPermisosRol_ === 'function') ? obtenerPermisosRol_(rol) : [];
    if (!permisos || !permisos.length) return false;

    var modU = String(modulo).toUpperCase();
    var accU = String(accion).toUpperCase();
    for (var i = 0; i < permisos.length; i++) {
      var pm = String(permisos[i].modulo || '').toUpperCase();
      var pa = String(permisos[i].accion || '').toUpperCase();
      if (pm === modU && pa === accU) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Verifica si el rol tiene CUALQUIERA de varias acciones dentro de un módulo
// Uso: _tieneAlgunPermiso(params, 'Ventas', ['Nueva venta','Gestión de ventas'])
function _tieneAlgunPermiso(params, modulo, acciones) {
  for (var i = 0; i < acciones.length; i++) {
    if (_tienePermiso(params, modulo, acciones[i])) return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════════
//  PERMISO POR MÓDULO (control general del backend)
//  Verifica si el rol tiene CUALQUIER permiso del módulo indicado.
//  ADMINISTRADOR siempre pasa (llave maestra). Los demás roles
//  (incluidos personalizados) se validan SOLO por permisos reales.
//  Uso: if (!_puedeModulo(params, 'Pacientes')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
// ════════════════════════════════════════════════════════════
function _puedeModulo(params, modulo) {
  try {
    var rol = (params && params._sesion && params._sesion.ROL) ? params._sesion.ROL : '';
    if (!rol) return false;
    // Llave maestra: el administrador siempre puede
    if (String(rol).toUpperCase() === 'ADMINISTRADOR') return true;

    // Consultar permisos reales del rol (tabla ROL_PERMISO)
    var permisos = (typeof obtenerPermisosRol_ === 'function') ? obtenerPermisosRol_(rol) : [];
    if (!permisos || !permisos.length) return false;

    var modU = String(modulo).toUpperCase();
    for (var i = 0; i < permisos.length; i++) {
      if (String(permisos[i].modulo || '').toUpperCase() === modU) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}
