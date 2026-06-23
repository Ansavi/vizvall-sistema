// ════════════════════════════════════════════════════════════
//  AUTOMATIZACIÓN DE CAJA (apertura 8am / cierre red de seguridad 8pm)
//  Diseño contable sano:
//   - Apertura automática con monto fijo (no requiere conteo)
//   - Cierre automático SOLO si nadie cerró manualmente, marcado
//     como "PENDIENTE DE ARQUEO" (no inventa un conteo de efectivo)
//  Lo ejecutan triggers; no requieren sesión de usuario.
// ════════════════════════════════════════════════════════════

var CAJA_AUTO_MONTO_INICIAL = 20;   // S/ 20 fijos al abrir
var CAJA_AUTO_HORA_APERTURA = 8;    // 8 AM
var CAJA_AUTO_HORA_CIERRE   = 20;   // 8 PM (20h)

// ── APERTURA AUTOMÁTICA (la ejecuta el trigger de las 8am) ──
function cajaAperturaAutomatica() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return; }
  try {
    // ¿Ya hay una caja abierta? No abrir otra.
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { lock.releaseLock(); Logger.log('Ya hay caja abierta. No se abre otra.'); return; }
    }
    var idApertura = generarID(HOJAS.APERTURA_CAJA, 'ID_APERTURA', 'AP', 4);
    insertarFila(HOJAS.APERTURA_CAJA, {
      ID_APERTURA:       idApertura,
      FECHA:             getFecha('fecha'),
      TURNO:             'ÚNICO',
      MONTO_INICIAL:     CAJA_AUTO_MONTO_INICIAL.toFixed(2),
      TOTAL_INGRESOS:    '0.00',
      TOTAL_EGRESOS:     '0.00',
      EFECTIVO_ESPERADO: CAJA_AUTO_MONTO_INICIAL.toFixed(2),
      EFECTIVO_CONTADO:  '-',
      DIFERENCIA:        '-',
      HORA_APERTURA:     getFecha('hora'),
      HORA_CIERRE:       '-',
      USUARIO_APERTURA:  'SISTEMA (AUTO)',
      USUARIO_CIERRE:    '-',
      ESTADO:            'ABIERTA',
      OBSERVACIONES:     'Apertura automática a las ' + CAJA_AUTO_HORA_APERTURA + ':00'
    });
    lock.releaseLock();
    Logger.log('✓ Caja abierta automáticamente con S/ ' + CAJA_AUTO_MONTO_INICIAL);
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    Logger.log('Error en apertura automática: ' + err.message);
  }
}

// ── CIERRE AUTOMÁTICO (red de seguridad, lo ejecuta el trigger de las 8pm) ──
//  NO inventa arqueo: si nadie cerró, cierra marcando PENDIENTE DE ARQUEO.
function cajaCierreAutomatico() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return; }
  try {
    var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
    var abierta = null;
    for (var i = 0; i < aperturas.length; i++) {
      if (aperturas[i].ESTADO === 'ABIERTA') { abierta = aperturas[i]; break; }
    }
    // Si NO hay caja abierta, es porque ya la cerraron manualmente. No hacer nada.
    if (!abierta) { lock.releaseLock(); Logger.log('No hay caja abierta (ya se cerró manualmente). Nada que hacer.'); return; }

    // Hay caja abierta = nadie cerró. Cerrar como PENDIENTE DE ARQUEO.
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
      EFECTIVO_CONTADO:  '-',                 // NO se contó (automático)
      DIFERENCIA:        'PENDIENTE',         // marca clara para revisar
      HORA_CIERRE:       getFecha('hora'),
      USUARIO_CIERRE:    'SISTEMA (AUTO)',
      ESTADO:            'CERRADA',
      OBSERVACIONES:     (abierta.OBSERVACIONES && abierta.OBSERVACIONES !== '-' ? abierta.OBSERVACIONES + ' · ' : '') + 'CIERRE AUTOMÁTICO 8PM - PENDIENTE DE ARQUEO (no se contó efectivo físico)'
    });
    lock.releaseLock();
    Logger.log('✓ Caja cerrada automáticamente (PENDIENTE DE ARQUEO). Esperado: S/ ' + esperado.toFixed(2));
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    Logger.log('Error en cierre automático: ' + err.message);
  }
}

// ── INSTALAR los triggers (ejecutar UNA vez ▶ instalarAutomatizacionCaja) ──
function instalarAutomatizacionCaja() {
  // Quitar triggers previos de estas funciones
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'cajaAperturaAutomatica' || fn === 'cajaCierreAutomatica') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Crear el trigger de apertura (8am) y cierre (8pm)
  ScriptApp.newTrigger('cajaAperturaAutomatica').timeBased().everyDays(1).atHour(CAJA_AUTO_HORA_APERTURA).create();
  ScriptApp.newTrigger('cajaCierreAutomatica').timeBased().everyDays(1).atHour(CAJA_AUTO_HORA_CIERRE).create();
  var msg = '✓ Automatización de caja instalada:\n' +
            '• Apertura automática todos los días a las ' + CAJA_AUTO_HORA_APERTURA + ':00 con S/ ' + CAJA_AUTO_MONTO_INICIAL + '\n' +
            '• Cierre automático (red de seguridad) a las ' + CAJA_AUTO_HORA_CIERRE + ':00\n' +
            '  Si cerraste manualmente, el automático respeta tu cierre.\n' +
            '  Si lo olvidaste, cierra como PENDIENTE DE ARQUEO.';
  Logger.log(msg);
  return msg;
}

// ── DESINSTALAR los triggers (ejecutar ▶ desinstalarAutomatizacionCaja) ──
function desinstalarAutomatizacionCaja() {
  var triggers = ScriptApp.getProjectTriggers();
  var quitados = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'cajaAperturaAutomatica' || fn === 'cajaCierreAutomatica') {
      ScriptApp.deleteTrigger(triggers[i]); quitados++;
    }
  }
  Logger.log('Triggers de automatización de caja quitados: ' + quitados);
  return 'Automatización de caja desactivada (' + quitados + ' triggers quitados).';
}
