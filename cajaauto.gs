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

    // Guarda de hora: solo abrir cerca de la hora configurada.
    // Evita aperturas a deshora por ejecucion manual, trigger desfasado
    // o zona horaria del proyecto distinta a la de la clinica.
    var chk = _cajaHoraEsperada(cfg.HORA_APERTURA, 'apertura');
    if (!chk.ok) { lock.releaseLock(); Logger.log(chk.motivo); return; }

    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abiertaVieja = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO !== 'ABIERTA') continue;
      var fAb = String(aperturas[i].FECHA || '').substring(0, 10);
      if (fAb === hoyF) {
        // Ya hay caja abierta de HOY: no abrir otra
        lock.releaseLock();
        Logger.log('Ya hay caja abierta de hoy.');
        return;
      }
      abiertaVieja = aperturas[i];   // quedo abierta de un dia anterior
    }
    // Si arrastramos una caja abierta de dias previos, cerrarla antes de abrir la de hoy
    if (abiertaVieja) {
      lock.releaseLock();
      Logger.log('Caja de ' + abiertaVieja.FECHA + ' quedo abierta: se cierra antes de abrir la de hoy.');
      cajaCierreAutomatica(true);   // forzar: cerrar la caja vieja sin mirar la hora
      try { lock.waitLock(10000); } catch(e) { return; }
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
function cajaCierreAutomatica(forzar) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return; }
  try {
    // Guarda de hora (se omite si lo llama la apertura para cerrar una caja vieja)
    if (forzar !== true) {
      var cfgC = _cajaAutoLeerConfig();
      var chkC = _cajaHoraEsperada(cfgC.HORA_CIERRE, 'cierre');
      if (!chkC.ok) { lock.releaseLock(); Logger.log(chkC.motivo); return; }
    }
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
    existentes[_fFecha(datos[r][0])] = true;
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
        var f = _fFecha(datos[r][iFecha]);
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
        abrioAuto = { hora: a.HORA_APERTURA, monto: a.MONTO_INICIAL, estado: a.ESTADO, fecha: String(a.FECHA||'').substring(0,10) };
      }
      if (String(a.USUARIO_CIERRE || '').toUpperCase().indexOf('AUTO') >= 0 && a.HORA_CIERRE && a.HORA_CIERRE !== '-') {
        cerroAuto = { hora: a.HORA_CIERRE, fecha: String(a.FECHA||'').substring(0,10) };
      }
    });
    return respuestaOK({ abrioAuto: abrioAuto, cerroAuto: cerroAuto, fecha: hoy }, 'Aviso auto.');
  } catch (err) {
    return respuestaError('Error aviso auto: ' + err.message);
  }
}


// Devuelve los días marcados como NO laborables de un mes (para el calendario visual).
// params.mes = 'YYYY-MM'. Retorna { dias: ['YYYY-MM-DD', ...] }
// Normaliza una celda de fecha (Date de Sheets o texto) a 'yyyy-MM-dd'.
// CAUSA RAIZ: getValues() devuelve Date, y String(Date) da "Wed Jul 22" (no compara).
function _fFecha(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return String(v || '').substring(0, 10);
}

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
        var f = _fFecha(datos[r][iF]);
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

    // Buscar TODAS las filas de esa fecha (pueden haber duplicados de versiones previas)
    var filas = [], hayActivo = false;
    for (var r = 1; r < datos.length; r++) {
      if (_fFecha(datos[r][iF]) !== fecha) continue;
      filas.push(r + 1);                                        // fila real en la hoja
      if (String(datos[r][iE]).toUpperCase() !== 'INACTIVO') hayActivo = true;
    }

    // No existia: crearla como NO laborable
    if (!filas.length) {
      hoja.appendRow([fecha, params.nombre || 'No laborable', 'MANUAL', 'ACTIVO']);
      try { hoja.getRange(hoja.getLastRow(), 1).setNumberFormat('@').setValue(fecha); } catch(e) {}
      lock.releaseLock();
      return respuestaOK({ fecha: fecha, noLaborable: true }, 'Dia marcado como no laborable.');
    }

    // Alternar segun el estado REAL (si alguna fila esta activa, el dia esta marcado)
    var nuevo = hayActivo ? 'INACTIVO' : 'ACTIVO';

    // La primera fila queda con el estado nuevo
    hoja.getRange(filas[0], iE + 1).setValue(nuevo);

    // Las duplicadas se limpian para que no vuelvan a interferir (sin borrar filas)
    for (var k = 1; k < filas.length; k++) {
      hoja.getRange(filas[k], 1, 1, hoja.getLastColumn()).clearContent();
    }

    lock.releaseLock();
    return respuestaOK({
      fecha: fecha,
      noLaborable: (nuevo === 'ACTIVO'),
      duplicadosLimpiados: filas.length - 1
    }, 'Dia actualizado.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al marcar el dia: ' + err.message);
  }
}


// ════════════════════════════════════════════════════════════════════════
//  ▶ Repara la hoja FERIADOS:
//   1. Normaliza las fechas a TEXTO 'yyyy-MM-dd' (estaban como Date)
//   2. Elimina filas duplicadas (el bug agregaba una por cada clic)
//  Conserva el último estado de cada fecha. Idempotente.
// ════════════════════════════════════════════════════════════════════════
function repararFeriados() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var hoja = ss.getSheetByName('FERIADOS');
  if (!hoja) return 'X No existe la hoja FERIADOS. Corra primero crearHojaFeriados.';

  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return 'La hoja no tiene datos.';
  var cab = datos[0];

  // Consolidar por fecha, conservando la ULTIMA aparicion
  var mapa = {}, orden = [];
  for (var r = 1; r < datos.length; r++) {
    var f = _fFecha(datos[r][0]);
    if (!f || f.length < 10) continue;
    if (!mapa[f]) orden.push(f);
    mapa[f] = [f, datos[r][1] || 'No laborable', datos[r][2] || 'MANUAL', datos[r][3] || 'ACTIVO'];
  }

  var filas = orden.map(function(f){ return mapa[f]; });
  filas.sort(function(a, b){ return a[0] > b[0] ? 1 : -1; });

  // Reescribir la hoja limpia, con la columna FECHA como TEXTO
  hoja.clear();
  hoja.appendRow(cab);
  hoja.setFrozenRows(1);
  if (filas.length) {
    hoja.getRange(2, 1, filas.length, 4).setValues(filas);
    hoja.getRange(2, 1, filas.length, 1).setNumberFormat('@');
    // reescribir para asegurar texto
    var soloFechas = filas.map(function(x){ return [x[0]]; });
    hoja.getRange(2, 1, filas.length, 1).setValues(soloFechas);
  }

  var eliminadas = (datos.length - 1) - filas.length;
  var msg = 'REPARAR FERIADOS\n\n' +
            'Filas antes:      ' + (datos.length - 1) + '\n' +
            'Filas ahora:      ' + filas.length + '\n' +
            'Duplicadas fuera: ' + eliminadas + '\n\n' +
            'Fechas normalizadas a texto yyyy-MM-dd.\n' +
            'El calendario ya deberia mostrar y guardar bien.';
  Logger.log(msg);
  return msg;
}


// ════════════════════════════════════════════════════════════════════════
//  ¿Estamos en la hora esperada para esta tarea automática?
//  Los disparadores de Apps Script corren en una ventana aproximada, así que
//  se admite una tolerancia. Si la hora real se aleja demasiado, NO se ejecuta:
//  suele indicar una ejecución manual por error o un desfase de zona horaria
//  entre el proyecto de Apps Script y la zona de la clínica.
// ════════════════════════════════════════════════════════════════════════
function _cajaHoraEsperada(horaConfig, etiqueta) {
  var TOLERANCIA = 2;   // horas de margen
  var horaAhora = parseInt(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'HH'), 10);
  var esperada  = parseInt(horaConfig, 10);
  if (isNaN(esperada)) return { ok: true };   // sin config: no bloquear

  var dif = Math.abs(horaAhora - esperada);
  if (dif > 12) dif = 24 - dif;               // cruce de medianoche

  if (dif <= TOLERANCIA) return { ok: true };

  return {
    ok: false,
    motivo: 'Se omitio la ' + etiqueta + ' automatica: son las ' +
            ('0' + horaAhora).slice(-2) + ':00 y estaba programada para las ' +
            ('0' + esperada).slice(-2) + ':00 (diferencia de ' + dif + ' h). ' +
            'Si esto se repite, revise la zona horaria del proyecto en ' +
            'Configuracion del proyecto de Apps Script: debe ser America/Lima.'
  };
}

// ▶ Diagnostico: compara la hora del proyecto con la de la clinica y lista los disparadores.
function diagnosticarHorarioCaja() {
  var ahora = new Date();
  var horaProyecto = Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var horaClinica  = Utilities.formatDate(ahora, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
  var cfg = _cajaAutoLeerConfig();

  var out = ['DIAGNOSTICO DE HORARIO - CAJA AUTOMATICA', ''];
  out.push('Zona horaria del proyecto : ' + Session.getScriptTimeZone());
  out.push('Zona horaria de la clinica: ' + CONFIG.TIMEZONE);
  out.push('');
  out.push('Hora segun el proyecto : ' + horaProyecto);
  out.push('Hora segun la clinica  : ' + horaClinica);
  out.push('');

  if (Session.getScriptTimeZone() !== CONFIG.TIMEZONE) {
    out.push('*** ATENCION ***');
    out.push('Las zonas horarias NO coinciden. Los disparadores usan la del PROYECTO,');
    out.push('por eso la caja puede abrir a una hora distinta de la configurada.');
    out.push('Solucion: Apps Script > Configuracion del proyecto > Zona horaria');
    out.push('          y elija ' + CONFIG.TIMEZONE + '.');
  } else {
    out.push('Las zonas horarias coinciden. Correcto.');
  }

  out.push('');
  out.push('Configurado: apertura ' + cfg.HORA_APERTURA + ':00 | cierre ' + cfg.HORA_CIERRE + ':00');
  out.push('');
  out.push('Disparadores instalados:');
  var trigs = ScriptApp.getProjectTriggers();
  var hay = false;
  for (var i = 0; i < trigs.length; i++) {
    var fn = trigs[i].getHandlerFunction();
    if (fn.indexOf('caja') === 0 || fn.indexOf('Backup') >= 0 || fn.indexOf('backup') >= 0) {
      out.push('  - ' + fn);
      hay = true;
    }
  }
  if (!hay) out.push('  (ninguno) La automatizacion no esta activa.');

  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}


// ▶ Diagnóstico: muestra las últimas filas de APERTURA_CAJA tal como están guardadas.
//   Sirve para ver si la fecha/hora se guardó como texto o como valor de Sheets.
function diagnosticarAperturasCaja() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var hoja = ss.getSheetByName('APERTURA_CAJA');
  if (!hoja) return 'X No existe la hoja APERTURA_CAJA.';

  var datos = hoja.getDataRange().getValues();
  var cab = datos[0];
  var iId  = cab.indexOf('ID_APERTURA');
  var iF   = cab.indexOf('FECHA');
  var iHA  = cab.indexOf('HORA_APERTURA');
  var iHC  = cab.indexOf('HORA_CIERRE');
  var iUA  = cab.indexOf('USUARIO_APERTURA');
  var iEs  = cab.indexOf('ESTADO');

  var hoy = getFecha('fecha');
  var ahora = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'HH:mm');

  var out = ['ULTIMAS APERTURAS DE CAJA', ''];
  out.push('Hoy es ' + hoy + ' y son las ' + ahora);
  out.push('');

  var desde = Math.max(1, datos.length - 8);
  for (var r = desde; r < datos.length; r++) {
    var vF  = datos[r][iF];
    var vHA = datos[r][iHA];
    out.push('Fila ' + (r + 1) + ' | ' + String(datos[r][iId]));
    out.push('   FECHA         : ' + String(vF) +
             '   [tipo: ' + (vF instanceof Date ? 'Fecha de Sheets' : typeof vF) + ']');
    out.push('   HORA_APERTURA : ' + String(vHA) +
             '   [tipo: ' + (vHA instanceof Date ? 'Hora de Sheets' : typeof vHA) + ']');
    if (vHA instanceof Date) {
      out.push('                   formateada -> ' +
               Utilities.formatDate(vHA, CONFIG.TIMEZONE, 'HH:mm') +
               '  |  sin zona -> ' + Utilities.formatDate(vHA, Session.getScriptTimeZone(), 'HH:mm'));
    }
    out.push('   HORA_CIERRE   : ' + String(datos[r][iHC]));
    out.push('   ABIERTA POR   : ' + String(datos[r][iUA]) + '   ESTADO: ' + String(datos[r][iEs]));
    out.push('');
  }

  out.push('----------------------------------------');
  out.push('Si la HORA_APERTURA aparece como "Hora de Sheets" y la formateada');
  out.push('no coincide con la que muestra el aviso, el desfase viene de ahi.');

  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}


// ▶ Test empírico: escribe una hora conocida, la vuelve a leer y mide el desfase real.
//   Compara las TRES zonas horarias que intervienen (proyecto, hoja de cálculo, config).
function diagnosticarZonaHoraria() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var out = ['TEST DE ZONA HORARIA', ''];

  var tzProyecto = Session.getScriptTimeZone();
  var tzHoja     = ss.getSpreadsheetTimeZone();
  var tzConfig   = CONFIG.TIMEZONE;

  out.push('Zona del proyecto (Apps Script) : ' + tzProyecto);
  out.push('Zona de la hoja de calculo      : ' + tzHoja);
  out.push('Zona de CONFIG                  : ' + tzConfig);
  out.push('');
  if (tzHoja !== tzConfig) {
    out.push('*** La hoja de calculo esta en OTRA zona horaria. ***');
    out.push('    Archivo > Configuracion de la hoja > Zona horaria -> ' + tzConfig);
    out.push('');
  }

  // Hora real segun cada referencia
  var ahora = new Date();
  out.push('Hora real (sistema, ' + tzConfig + ') : ' + Utilities.formatDate(ahora, tzConfig, 'HH:mm:ss'));
  out.push('Hora que devuelve getFecha("hora")    : ' + getFecha('hora'));
  out.push('');

  // Prueba de ida y vuelta: escribir una hora y leerla
  var hojaTmp = ss.getSheetByName('_TEST_TZ');
  if (!hojaTmp) hojaTmp = ss.insertSheet('_TEST_TZ');
  hojaTmp.clear();

  var horaEscrita = getFecha('hora');
  hojaTmp.getRange(1, 1).setValue(horaEscrita);
  SpreadsheetApp.flush();
  var leido = hojaTmp.getRange(1, 1).getValue();

  out.push('PRUEBA DE IDA Y VUELTA');
  out.push('  Se escribio  : ' + horaEscrita);
  out.push('  Se leyo      : ' + String(leido));
  if (leido instanceof Date) {
    var fmt = Utilities.formatDate(leido, tzConfig, 'HH:mm:ss');
    out.push('  Formateada   : ' + fmt);
    out.push('  Coinciden?   : ' + (fmt.substring(0, 5) === horaEscrita.substring(0, 5) ? 'SI - sin desfase' : 'NO - HAY DESFASE'));
  } else {
    out.push('  Se guardo como texto (sin conversion). Correcto.');
  }

  ss.deleteSheet(hojaTmp);

  out.push('');
  out.push('----------------------------------------');
  out.push('Si "Coinciden?" dice NO, el desfase se produce al guardar/leer en la hoja.');
  out.push('Si dice SI, las horas raras de APERTURA_CAJA vienen de registros antiguos,');
  out.push('no de un problema actual.');

  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}
