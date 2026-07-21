// ════════════════════════════════════════════════════════════
//  AUTOMATIZACIÓN DE CAJA — configurable desde la pantalla
//  Apertura automática (monto fijo) + cierre red de seguridad.
//  La config (hora apertura, hora cierre, monto) se guarda en
//  PropertiesService y se edita desde "Caja diaria".
// ════════════════════════════════════════════════════════════

// Valores por defecto (si nunca se configuró)
var CAJA_AUTO_DEF = { MONTO: 20, HORA_APERTURA: 8, HORA_CIERRE: 20 };

// ── Leer la config guardada ──
function _cajaAutoLeerConfig() {
  var p = PropertiesService.getScriptProperties();
  var monto = parseFloat(p.getProperty('CAJA_AUTO_MONTO'));
  var hAp = parseInt(p.getProperty('CAJA_AUTO_HORA_APERTURA'), 10);
  var hCi = parseInt(p.getProperty('CAJA_AUTO_HORA_CIERRE'), 10);
  return {
    MONTO:         isNaN(monto) ? CAJA_AUTO_DEF.MONTO : monto,
    HORA_APERTURA: isNaN(hAp) ? CAJA_AUTO_DEF.HORA_APERTURA : hAp,
    HORA_CIERRE:   isNaN(hCi) ? CAJA_AUTO_DEF.HORA_CIERRE : hCi
  };
}

// ── APERTURA AUTOMÁTICA (la ejecuta el trigger) ──
function cajaAperturaAutomatica() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return; }
  try {
    // Respetar calendario: no abrir domingos ni feriados
    var hoyF = getFecha('fecha');
    var habil = _cajaEsDiaHabil(hoyF);
    if (!habil.habil) {
      lock.releaseLock();
      Logger.log('No se abre caja hoy (' + habil.motivo + (habil.nombre ? ': ' + habil.nombre : '') + ').');
      return;
    }
    var cfg = _cajaAutoLeerConfig();
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { lock.releaseLock(); Logger.log('Ya hay caja abierta.'); return; }
    }
    insertarFila(HOJAS.APERTURA_CAJA, {
      ID_APERTURA:       generarID(HOJAS.APERTURA_CAJA, 'ID_APERTURA', 'AP', 4),
      FECHA:             getFecha('fecha'),
      TURNO:             'ÚNICO',
      MONTO_INICIAL:     cfg.MONTO.toFixed(2),
      TOTAL_INGRESOS:    '0.00',
      TOTAL_EGRESOS:     '0.00',
      EFECTIVO_ESPERADO: cfg.MONTO.toFixed(2),
      EFECTIVO_CONTADO:  '-',
      DIFERENCIA:        '-',
      HORA_APERTURA:     getFecha('hora'),
      HORA_CIERRE:       '-',
      USUARIO_APERTURA:  'SISTEMA (AUTO)',
      USUARIO_CIERRE:    '-',
      ESTADO:            'ABIERTA',
      OBSERVACIONES:     'Apertura automática a las ' + cfg.HORA_APERTURA + ':00'
    });
    lock.releaseLock();
    Logger.log('✓ Caja abierta automáticamente con S/ ' + cfg.MONTO);
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    Logger.log('Error apertura automática: ' + err.message);
  }
}

// ── CIERRE AUTOMÁTICO (red de seguridad; no inventa arqueo) ──
function cajaCierreAutomatica() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return; }
  try {
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    if (!abierta) { lock.releaseLock(); Logger.log('No hay caja abierta (ya cerrada manualmente).'); return; }

    var movs = leerHoja(HOJAS.CAJA).map(limpiarFila)
      .filter(function(m){ return m.ID_APERTURA === abierta.ID_APERTURA && m.ESTADO !== 'ANULADO'; });
    var ingresos = 0, egresos = 0;
    movs.forEach(function(m){
      var monto = parseFloat(m.MONTO) || 0;
      if (m.TIPO === 'INGRESO') ingresos += monto;
      else if (m.TIPO === 'EGRESO') egresos += monto;
    });
    var montoInicial = parseFloat(abierta.MONTO_INICIAL) || 0;
    var esperado = montoInicial + ingresos - egresos;

    actualizarFila(HOJAS.APERTURA_CAJA, 'ID_APERTURA', abierta.ID_APERTURA, {
      TOTAL_INGRESOS:    ingresos.toFixed(2),
      TOTAL_EGRESOS:     egresos.toFixed(2),
      EFECTIVO_ESPERADO: esperado.toFixed(2),
      EFECTIVO_CONTADO:  '-',
      DIFERENCIA:        'PENDIENTE',
      HORA_CIERRE:       getFecha('hora'),
      USUARIO_CIERRE:    'SISTEMA (AUTO)',
      ESTADO:            'CERRADA',
      OBSERVACIONES:     (abierta.OBSERVACIONES && abierta.OBSERVACIONES !== '-' ? abierta.OBSERVACIONES + ' · ' : '') + 'CIERRE AUTOMÁTICO - PENDIENTE DE ARQUEO (no se contó efectivo físico)'
    });
    lock.releaseLock();
    Logger.log('✓ Caja cerrada automáticamente (PENDIENTE DE ARQUEO).');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    Logger.log('Error cierre automático: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  FUNCIONES PARA LA PANTALLA (Caja diaria → panel de config)
// ════════════════════════════════════════════════════════════

// ── Estado de la automatización (para mostrar en la UI) ──
function cajaAutoEstado(params) {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var apAct = false, ciAct = false;
    for (var i = 0; i < triggers.length; i++) {
      var fn = triggers[i].getHandlerFunction();
      if (fn === 'cajaAperturaAutomatica') apAct = true;
      if (fn === 'cajaCierreAutomatica') ciAct = true;
    }
    var cfg = _cajaAutoLeerConfig();
    return respuestaOK({
      activo: (apAct && ciAct),
      monto: cfg.MONTO,
      horaApertura: cfg.HORA_APERTURA,
      horaCierre: cfg.HORA_CIERRE
    }, 'Estado de automatización.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

// ── Activar/guardar la automatización con los valores de la UI ──
function cajaAutoActivar(params) {
  try {
    if (params && params._sesion && params._sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede configurar la automatización.', 'ERR_PERMISO');
    }
    var monto = parseFloat(params.MONTO);
    var hAp = parseInt(params.HORA_APERTURA, 10);
    var hCi = parseInt(params.HORA_CIERRE, 10);
    if (isNaN(monto) || monto < 0) return respuestaError('Monto inválido.');
    if (isNaN(hAp) || hAp < 0 || hAp > 23) return respuestaError('Hora de apertura inválida (0-23).');
    if (isNaN(hCi) || hCi < 0 || hCi > 23) return respuestaError('Hora de cierre inválida (0-23).');

    var p = PropertiesService.getScriptProperties();
    p.setProperty('CAJA_AUTO_MONTO', String(monto));
    p.setProperty('CAJA_AUTO_HORA_APERTURA', String(hAp));
    p.setProperty('CAJA_AUTO_HORA_CIERRE', String(hCi));

    // Recrear triggers con las horas nuevas
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      var fn = triggers[i].getHandlerFunction();
      if (fn === 'cajaAperturaAutomatica' || fn === 'cajaCierreAutomatica') ScriptApp.deleteTrigger(triggers[i]);
    }
    ScriptApp.newTrigger('cajaAperturaAutomatica').timeBased().everyDays(1).atHour(hAp).create();
    ScriptApp.newTrigger('cajaCierreAutomatica').timeBased().everyDays(1).atHour(hCi).create();

    return respuestaOK({ activo: true, monto: monto, horaApertura: hAp, horaCierre: hCi },
      'Automatización activada: apertura ' + hAp + ':00 (S/ ' + monto + '), cierre ' + hCi + ':00.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

// ── Desactivar la automatización ──
function cajaAutoDesactivar(params) {
  try {
    if (params && params._sesion && params._sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede configurar la automatización.', 'ERR_PERMISO');
    }
    var triggers = ScriptApp.getProjectTriggers();
    var quitados = 0;
    for (var i = 0; i < triggers.length; i++) {
      var fn = triggers[i].getHandlerFunction();
      if (fn === 'cajaAperturaAutomatica' || fn === 'cajaCierreAutomatica') { ScriptApp.deleteTrigger(triggers[i]); quitados++; }
    }
    return respuestaOK({ activo: false }, 'Automatización de caja desactivada.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}


// ════════════════════════════════════════════════════════════════════════
//  ▶ Crea la hoja FERIADOS y la precarga con los feriados peruanos 2026.
//  Idempotente: si la hoja ya existe, solo agrega los que falten.
//  Columnas: FECHA (YYYY-MM-DD) | NOMBRE | TIPO (NACIONAL/LOCAL) | ESTADO
// ════════════════════════════════════════════════════════════════════════
function crearHojaFeriados() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var hoja = ss.getSheetByName('FERIADOS');
  var out = ['HOJA FERIADOS', ''];

  if (!hoja) {
    hoja = ss.insertSheet('FERIADOS');
    hoja.appendRow(['FECHA', 'NOMBRE', 'TIPO', 'ESTADO']);
    hoja.setFrozenRows(1);
    out.push('Hoja creada.');
  } else {
    out.push('Hoja ya existía.');
  }

  // Feriados nacionales de Perú 2026
  var feriados2026 = [
    ['2026-01-01', 'Año Nuevo', 'NACIONAL'],
    ['2026-04-02', 'Jueves Santo', 'NACIONAL'],
    ['2026-04-03', 'Viernes Santo', 'NACIONAL'],
    ['2026-05-01', 'Día del Trabajo', 'NACIONAL'],
    ['2026-06-07', 'Batalla de Arica y Día de la Bandera', 'NACIONAL'],
    ['2026-06-29', 'San Pedro y San Pablo', 'NACIONAL'],
    ['2026-07-23', 'Día de la Fuerza Aérea', 'NACIONAL'],
    ['2026-07-28', 'Fiestas Patrias', 'NACIONAL'],
    ['2026-07-29', 'Fiestas Patrias', 'NACIONAL'],
    ['2026-08-06', 'Batalla de Junín', 'NACIONAL'],
    ['2026-08-30', 'Santa Rosa de Lima', 'NACIONAL'],
    ['2026-10-08', 'Combate de Angamos', 'NACIONAL'],
    ['2026-11-01', 'Día de Todos los Santos', 'NACIONAL'],
    ['2026-12-08', 'Inmaculada Concepción', 'NACIONAL'],
    ['2026-12-09', 'Batalla de Ayacucho', 'NACIONAL'],
    ['2026-12-25', 'Navidad', 'NACIONAL']
  ];

  // Fechas ya existentes (para no duplicar)
  var existentes = {};
  var datos = hoja.getDataRange().getValues();
  for (var r = 1; r < datos.length; r++) {
    existentes[String(datos[r][0]).substring(0, 10)] = true;
  }

  var agregados = 0;
  feriados2026.forEach(function(f) {
    if (!existentes[f[0]]) {
      hoja.appendRow([f[0], f[1], f[2], 'ACTIVO']);
      agregados++;
    }
  });

  out.push('Feriados 2026 agregados: ' + agregados);
  out.push('Ya existían: ' + (feriados2026.length - agregados));
  out.push('');
  out.push('Puede editar la hoja FERIADOS para agregar feriados locales o de otros años.');

  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}

// ¿Hoy es día hábil para abrir caja? (no domingo, no feriado)
function _cajaEsDiaHabil(fechaStr) {
  // fechaStr = YYYY-MM-DD
  var partes = String(fechaStr).split('-');
  var d = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
  if (d.getDay() === 0) return { habil: false, motivo: 'domingo' };   // 0 = domingo

  // ¿Es feriado?
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var hoja = ss.getSheetByName('FERIADOS');
    if (hoja) {
      var datos = hoja.getDataRange().getValues();
      var iFecha = datos[0].indexOf('FECHA');
      var iNom = datos[0].indexOf('NOMBRE');
      var iEst = datos[0].indexOf('ESTADO');
      for (var r = 1; r < datos.length; r++) {
        var f = String(datos[r][iFecha]).substring(0, 10);
        var est = iEst >= 0 ? String(datos[r][iEst]).toUpperCase() : 'ACTIVO';
        if (f === fechaStr && est !== 'INACTIVO') {
          return { habil: false, motivo: 'feriado', nombre: iNom >= 0 ? datos[r][iNom] : '' };
        }
      }
    }
  } catch (e) {}

  return { habil: true };
}


// Detecta si HOY la caja abrió o cerró automáticamente (para avisar al usuario).
function cajaAvisoAutoHoy(params) {
  try {
    var hoy = getFecha('fecha');
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abrioAuto = null, cerroAuto = null;
    aperturas.forEach(function(a) {
      if (String(a.FECHA).substring(0, 10) !== hoy) return;
      if (String(a.USUARIO_APERTURA || '').toUpperCase().indexOf('AUTO') >= 0) {
        abrioAuto = { hora: a.HORA_APERTURA, monto: a.MONTO_INICIAL, estado: a.ESTADO };
      }
      if (String(a.USUARIO_CIERRE || '').toUpperCase().indexOf('AUTO') >= 0 && a.HORA_CIERRE && a.HORA_CIERRE !== '-') {
        cerroAuto = { hora: a.HORA_CIERRE };
      }
    });
    return respuestaOK({ abrioAuto: abrioAuto, cerroAuto: cerroAuto, fecha: hoy }, 'Aviso auto.');
  } catch (err) {
    return respuestaError('Error aviso auto: ' + err.message);
  }
}


// Devuelve los días marcados como NO laborables de un mes (para el calendario visual).
// params.mes = 'YYYY-MM'. Retorna { dias: ['YYYY-MM-DD', ...] }
function cajaDiasNoLaborables(params) {
  try {
    params = params || {};
    var mes = String(params.mes || getFecha('fecha').substring(0, 7));
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var hoja = ss.getSheetByName('FERIADOS');
    var dias = [];
    if (hoja) {
      var datos = hoja.getDataRange().getValues();
      var iF = datos[0].indexOf('FECHA');
      var iE = datos[0].indexOf('ESTADO');
      var iN = datos[0].indexOf('NOMBRE');
      for (var r = 1; r < datos.length; r++) {
        var f = String(datos[r][iF]).substring(0, 10);
        var est = iE >= 0 ? String(datos[r][iE]).toUpperCase() : 'ACTIVO';
        if (f.substring(0, 7) === mes && est !== 'INACTIVO') {
          dias.push({ fecha: f, nombre: iN >= 0 ? String(datos[r][iN]) : '' });
        }
      }
    }
    return respuestaOK({ mes: mes, dias: dias }, dias.length + ' día(s) no laborable(s).');
  } catch (err) {
    return respuestaError('Error al leer días: ' + err.message);
  }
}

// Alterna un día como laborable / no laborable (clic en el calendario).
// params.fecha = 'YYYY-MM-DD'. Si estaba marcado lo quita; si no, lo agrega.
function cajaToggleDia(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    if (!params || !params.fecha) { lock.releaseLock(); return respuestaError('Falta la fecha.'); }
    var fecha = String(params.fecha).substring(0, 10);
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var hoja = ss.getSheetByName('FERIADOS');
    if (!hoja) {
      hoja = ss.insertSheet('FERIADOS');
      hoja.appendRow(['FECHA', 'NOMBRE', 'TIPO', 'ESTADO']);
      hoja.setFrozenRows(1);
    }
    var datos = hoja.getDataRange().getValues();
    var iF = datos[0].indexOf('FECHA');
    var iE = datos[0].indexOf('ESTADO');

    // ¿Ya existe esa fecha?
    for (var r = 1; r < datos.length; r++) {
      if (String(datos[r][iF]).substring(0, 10) === fecha) {
        var est = String(datos[r][iE]).toUpperCase();
        // Alternar: ACTIVO <-> INACTIVO
        var nuevo = (est === 'INACTIVO') ? 'ACTIVO' : 'INACTIVO';
        hoja.getRange(r + 1, iE + 1).setValue(nuevo);
        lock.releaseLock();
        return respuestaOK({ fecha: fecha, noLaborable: (nuevo === 'ACTIVO') }, 'Día actualizado.');
      }
    }
    // No existía: agregarlo como no laborable
    hoja.appendRow([fecha, params.nombre || 'No laborable', 'MANUAL', 'ACTIVO']);
    lock.releaseLock();
    return respuestaOK({ fecha: fecha, noLaborable: true }, 'Día marcado como no laborable.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al marcar el día: ' + err.message);
  }
}
