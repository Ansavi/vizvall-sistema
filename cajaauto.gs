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
