// ════════════════════════════════════════════════════════════════════════
//  LIMPIEZA DE DATOS DE PRUEBA
//
//  Sirve para arrancar el sistema en limpio, conservando la configuración.
//
//  IMPORTANTE — cómo usarlo:
//    1. Primero corra un SIMULACRO (no borra nada, solo informa).
//    2. Revise el log con calma.
//    3. Recién entonces corra la función de LIMPIAR que corresponda.
//
//  La primera función de este archivo es un simulacro a propósito: si
//  alguien pulsa ▶ sin fijarse, no se pierde ningún dato.
//
//  Nunca usa deleteRow: limpia el contenido y conserva las cabeceras.
// ════════════════════════════════════════════════════════════════════════


// ── Hojas de MOVIMIENTOS: lo que se genera día a día ──────────────────
function _limpGrupoMovimientos() {
  return [
    'VENTA', 'DVENTA', 'PAGO_VENTA',
    'CITA', 'HISTORIAL_CITA',
    'CAJA', 'APERTURA_CAJA',
    'CAJA_CHICA', 'APERTURA_CC',
    'ATENCION_MEDICA', 'FICHA_CLINICA', 'TRAZABILIDAD_HC',
    'RECETA_MEDICA', 'RESULTADO_APOYO', 'CONSENTIMIENTO_PROC',
    'CONTROL_SESIONES', 'DCONTROL_SESIONES',
    'COMISION_VENTA', 'PAGO_HONORARIO', 'ASISTENCIA_PERSONAL',
    'COMPRA_INSUMO', 'DCOMPRA_INSUMO',
    'MOVIMIENTO_INVENTARIO', 'LOTE_PRODUCTO',
    'OBLIGACION', 'PAGO_OBLIGACION', 'PAGO_OBLIGACION_DETALLE',
    'DESCANSO_MEDICO', 'AUDITORIA'
  ];
}

// ── Hojas MAESTRAS: pacientes, personal y catálogo comercial ──────────
function _limpGrupoMaestros() {
  return [
    'PACIENTE',
    'MEDICO', 'PROFESIONAL_APOYO', 'MEDICO_ESPECIALIDAD', 'MEDICO_AREA_APOYO',
    'HORARIO_MEDICO', 'HORARIO_APOYO',
    'SERVICIO', 'SERVICIO_INSUMO',
    'PAQUETE', 'DPAQUETE', 'PAQUETE_INSUMO',
    'PRODUCTO_INSUMO', 'PROVEEDOR',
    'HONORARIO_CONFIG', 'COMISION_REGLA'
  ];
}

// ── Hojas PROTEGIDAS: nunca se tocan ──────────────────────────────────
function _limpGrupoProtegidas() {
  return [
    'CONFIG_EMPRESA',
    'TIPO_DOCUMENTO', 'ESPECIALIDAD', 'AREA_APOYO', 'UNIDAD_MEDIDA',
    'TSERVICIO', 'TPAQUETE', 'TCITA', 'TCOMPROBANTE', 'TMODO_PAGO',
    'TCONCEPTO_CAJA', 'TCONTROL_SESIONES', 'TIPO_OBLIGACION',
    'TIPO_MOVIMIENTO_INVENTARIO', 'CONCEPTO_CC',
    'USUARIO', 'ROL', 'PERMISO', 'ROL_PERMISO', 'USUARIO_ROL',
    'FERIADOS'
  ];
}


// ════════════════════════════════════════════════════════════════════════
//  ▶ SIMULACRO (no borra nada). Muestra cuántas filas tiene cada hoja.
// ════════════════════════════════════════════════════════════════════════
function simularLimpiezaDatosPrueba() {
  return _limpInforme(false, false);
}

// ▶ SIMULACRO ampliado: incluye pacientes, personal y catálogo.
function simularLimpiezaTotal() {
  return _limpInforme(true, false);
}


// ════════════════════════════════════════════════════════════════════════
//  ▶ LIMPIAR SOLO MOVIMIENTOS
//  Borra ventas, citas, caja, historias, comisiones, compras, inventario.
//  CONSERVA: pacientes, personal, servicios, paquetes y toda la config.
//  Es la opción recomendada para arrancar en limpio.
// ════════════════════════════════════════════════════════════════════════
function LIMPIAR_movimientos_CONFIRMO() {
  return _limpInforme(false, true);
}

// ════════════════════════════════════════════════════════════════════════
//  ▶ LIMPIAR TODO MENOS LA CONFIGURACIÓN
//  Además de los movimientos, borra pacientes, personal y catálogo.
//  CONSERVA: datos de empresa, catálogos de configuración, usuarios,
//  roles, permisos y el calendario de feriados.
//  Úselo solo si quiere partir de cero con los maestros.
// ════════════════════════════════════════════════════════════════════════
function LIMPIAR_todo_menos_config_CONFIRMO() {
  return _limpInforme(true, true);
}


// ── Motor: informa o ejecuta según los parámetros ─────────────────────
function _limpInforme(incluirMaestros, ejecutar) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  var hojas = _limpGrupoMovimientos();
  if (incluirMaestros) hojas = hojas.concat(_limpGrupoMaestros());

  var out = [];
  out.push(ejecutar ? '*** LIMPIEZA EJECUTADA ***' : 'SIMULACRO - no se borro nada');
  out.push(incluirMaestros ? 'Alcance: movimientos + pacientes/personal/catalogo'
                           : 'Alcance: solo movimientos');
  out.push('');

  var totalFilas = 0, tocadas = 0, ausentes = [];

  for (var i = 0; i < hojas.length; i++) {
    var nombre = hojas[i];
    var hoja = ss.getSheetByName(nombre);
    if (!hoja) { ausentes.push(nombre); continue; }

    var ultima = hoja.getLastRow();
    var filas = Math.max(0, ultima - 1);       // sin contar la cabecera
    totalFilas += filas;

    if (filas > 0) {
      tocadas++;
      out.push('  ' + (ejecutar ? 'borradas' : 'se borrarian') + ' ' +
               ('    ' + filas).slice(-5) + ' fila(s)  ->  ' + nombre);
      if (ejecutar) {
        // Nunca deleteRow: se limpia el contenido y queda la cabecera
        hoja.getRange(2, 1, filas, hoja.getLastColumn()).clearContent();
      }
    }
  }

  out.push('');
  out.push('----------------------------------------');
  out.push('Hojas con datos : ' + tocadas);
  out.push('Filas en total  : ' + totalFilas);
  if (ausentes.length) out.push('Hojas no encontradas (se omiten): ' + ausentes.join(', '));
  out.push('');
  out.push('SE CONSERVAN SIEMPRE:');
  out.push('  ' + _limpGrupoProtegidas().join(', '));

  if (!incluirMaestros) {
    out.push('');
    out.push('TAMBIEN SE CONSERVAN (por ser solo movimientos):');
    out.push('  ' + _limpGrupoMaestros().join(', '));
  }

  out.push('');
  if (!ejecutar) {
    out.push('========================================');
    out.push('Esto fue un SIMULACRO. No se modifico nada.');
    out.push('');
    out.push('Antes de limpiar de verdad:');
    out.push('  1. Cree un respaldo desde Configuracion > Automatizaciones');
    out.push('     (boton "Crear copia ahora") y confirme que aparece en la lista.');
    out.push('  2. Corra la funcion que corresponda:');
    out.push('       LIMPIAR_movimientos_CONFIRMO         (recomendada)');
    out.push('       LIMPIAR_todo_menos_config_CONFIRMO   (borra tambien los maestros)');
    out.push('========================================');
  } else {
    out.push('========================================');
    out.push('Listo. Las cabeceras y la configuracion quedaron intactas.');
    out.push('Los correlativos (V-0001, AP-0001...) vuelven a empezar.');
    out.push('Recargue el sistema con Ctrl+Shift+R.');
    out.push('========================================');
  }

  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}
