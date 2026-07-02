// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Setup.gs
// Descripción: Inicialización del Spreadsheet completo
// INSTRUCCIONES:
//   1. Abre Apps Script en tu proyecto VIZVALL
//   2. Selecciona la función inicializarSistema()
//   3. Haz clic en ▶ Ejecutar (solo una vez)
// ============================================================

// ── DEFINICIÓN COMPLETA DE TODAS LAS HOJAS ──────────────
const ESTRUCTURA_HOJAS = [

  // ── SEGURIDAD ──
  { nombre: 'USUARIO', columnas: [
    'ID_USUARIO','NOMBRES','APELLIDOS','USUARIO','CLAVE',
    'CORREO','TELEFONO','FOTO','ID_MEDICO','ESTADO','ULTIMO_ACCESO','FECHA_REGISTRO'
  ]},
  { nombre: 'ROL', columnas: [
    'ID_ROL','NOMBRE','DESCRIPCION','ESTADO'
  ]},
  { nombre: 'PERMISO', columnas: [
    'ID_PERMISO','MODULO','ACCION','DESCRIPCION','ESTADO'
  ]},
  { nombre: 'ROL_PERMISO', columnas: [
    'ID_ROL_PERMISO','ID_ROL','ID_PERMISO'
  ]},
  { nombre: 'USUARIO_ROL', columnas: [
    'ID_USUARIO_ROL','ID_USUARIO','ID_ROL'
  ]},
  { nombre: 'AUDITORIA', columnas: [
    'ID_AUDITORIA','ID_USUARIO','MODULO','ACCION','FECHA','DETALLE'
  ]},

  // ── MAESTRAS SIMPLES ──
  { nombre: 'TIPO_DOCUMENTO', columnas: [
    'ID_TIPO_DOCUMENTO','TIPO','LONGITUD'
  ]},
  { nombre: 'ESPECIALIDAD', columnas: [
    'ID_ESPECIALIDAD','ESPECIALIDAD','DESCRIPCION','ESTADO','FECHA_REGISTRO'
  ]},
  { nombre: 'TSERVICIO', columnas: [
    'ID_TSERVICIO','NOMBRE','ESTADO'
  ]},
  { nombre: 'TPAQUETE', columnas: [
    'ID_TPAQUETE','NOMBRE','ESTADO'
  ]},
  { nombre: 'TCITA', columnas: [
    'ID_TCITA','NOMBRE','ESTADO'
  ]},
  { nombre: 'TCOMPROBANTE', columnas: [
    'ID_TCOMPROBANTE','NOMBRE','SERIE','ESTADO'
  ]},
  { nombre: 'TMODO_PAGO', columnas: [
    'ID_TMODO_PAGO','NOMBRE','ESTADO'
  ]},
  { nombre: 'TCONCEPTO_CAJA', columnas: [
    'ID_TCONCEPTO_CAJA','NOMBRE','TIPO','ESTADO'
  ]},
  // ── CAJA: movimientos individuales (apertura, ventas, gastos, cierre) ──
  { nombre: 'CAJA', columnas: [
    'ID_CAJA','ID_APERTURA','FECHA','HORA','TURNO','TIPO',
    'ID_TCONCEPTO_CAJA','ID_VENTA','MODO_PAGO','MONTO',
    'USUARIO','ESTADO','OBSERVACIONES'
  ]},
  // ── APERTURA_CAJA: resumen diario + arqueo (abierta/cerrada) ──
  { nombre: 'APERTURA_CAJA', columnas: [
    'ID_APERTURA','FECHA','TURNO','MONTO_INICIAL',
    'TOTAL_INGRESOS','TOTAL_EGRESOS','EFECTIVO_ESPERADO',
    'EFECTIVO_CONTADO','DIFERENCIA',
    'HORA_APERTURA','HORA_CIERRE','USUARIO_APERTURA','USUARIO_CIERRE',
    'ESTADO','OBSERVACIONES'
  ]},
  // ── CAJA CHICA: fondo fijo separado de la caja de ventas ──
  { nombre: 'CAJA_CHICA', columnas: [
    'ID_CC','FECHA','HORA','TIPO','ID_CONCEPTO_CC','CONCEPTO_LIBRE',
    'MONTO','NUM_RECIBO','BENEFICIARIO','ORIGEN_FONDO','ID_APERTURA_CC',
    'USUARIO','ESTADO','OBSERVACIONES'
  ]},
  // ── APERTURA_CC: control del fondo (abierto/cerrado) + arqueo ──
  { nombre: 'APERTURA_CC', columnas: [
    'ID_APERTURA_CC','FECHA_APERTURA','HORA_APERTURA','MONTO_FONDO',
    'TOTAL_GASTOS','TOTAL_REPOSICIONES','SALDO_ESPERADO',
    'SALDO_CONTADO','DIFERENCIA','FECHA_CIERRE','HORA_CIERRE',
    'USUARIO_APERTURA','USUARIO_CIERRE','ESTADO','OBSERVACIONES'
  ]},
  // ── CONCEPTO_CC: categorías de gasto de caja chica ──
  { nombre: 'CONCEPTO_CC', columnas: [
    'ID_CONCEPTO_CC','NOMBRE','DESCRIPCION','ESTADO'
  ]},
  { nombre: 'TCONTROL_SESIONES', columnas: [
    'ID_TCONTROL','NOMBRE','DESCRIPCION','ESTADO'
  ]},
  { nombre: 'UNIDAD_MEDIDA', columnas: [
    'ID_UNIDAD','NOMBRE','ABREVIATURA','ESTADO'
  ]},

  // ── ÁREAS DE APOYO ──
  { nombre: 'AREA_APOYO', columnas: [
    'ID_AREA_APOYO','NOMBRE','DESCRIPCION','ESTADO','FECHA_REGISTRO'
  ]},
  { nombre: 'PROFESIONAL_APOYO', columnas: [
    'ID_PROFESIONAL','ID_TIPO_DOCUMENTO','NUMERO_DOCUMENTO',
    'NOMBRES','APELLIDOS','ID_AREA_APOYO','PROFESION',
    'TELEFONO','EMAIL','ESTADO','FECHA_REGISTRO'
  ]},
  { nombre: 'MEDICO_ESPECIALIDAD', columnas: [
    'ID_MEDICO_ESPECIALIDAD','ID_MEDICO','ID_ESPECIALIDAD',
    'ESPECIALIDAD_PRINCIPAL','ESTADO','FECHA_REGISTRO'
  ]},
  // ── Médico ↔ áreas de apoyo (un médico también hace servicios de apoyo) ──
  { nombre: 'MEDICO_AREA_APOYO', columnas: [
    'ID_MEDICO_AREA','ID_MEDICO','ID_AREA_APOYO','ESTADO','FECHA_REGISTRO'
  ]},

  // ── ENTIDADES PRINCIPALES ──
  { nombre: 'PACIENTE', columnas: [
    'ID_PACIENTE','ID_TIPO_DOCUMENTO','NUMERO_DOCUMENTO',
    'NOMBRES','APELLIDOS','RAZON_SOCIAL','FECHA_NACIMIENTO','SEXO',
    'TELEFONO','TELEFONO_ALTERNATIVO','CORREO',
    // ── DIRECCIÓN ESTRUCTURADA ──
    'TIPO_VIA','NOMBRE_VIA','NUMERO','MZ','LT',
    'URBANIZACION','INTERIOR','PISO','REFERENCIA',
    'DEPARTAMENTO','PROVINCIA','DISTRITO',
    // ── APODERADO (solo si ES_MENOR = SI) ──
    'ES_MENOR','APO_NOMBRES','APO_APELLIDOS',
    'APO_PARENTESCO','APO_TELEFONO','APO_DNI',
    // ── CONTROL ──
    'ESTADO','FECHA_REGISTRO'
  ]},
  { nombre: 'MEDICO', columnas: [
    'ID_MEDICO','ID_TIPO_DOCUMENTO','NUMERO_DOCUMENTO',
    'NOMBRES','APELLIDOS','FECHA_NACIMIENTO','SEXO',
    'NUMERO_CMP','NUMERO_RNE','TELEFONO','EMAIL','ESTADO',
    'OBSERVACIONES','FECHA_REGISTRO'
  ]},
  { nombre: 'SERVICIO', columnas: [
    'ID_SERVICIO','ID_ESPECIALIDAD','ID_AREA_APOYO','ID_TSERVICIO',
    'NOMBRE_SERVICIO','PRECIO_BASE','TIEMPO_ESTIMADO',
    'OBSERVACION','ESTADO'
  ]},
  { nombre: 'PAQUETE', columnas: [
    'ID_PAQUETE','NOMBRE_PAQUETE','TIPO','DESCRIPCION',
    'TOTAL_SESIONES','PRECIO_TOTAL','VIGENCIA_DIAS',
    'ESTADO','FECHA_REGISTRO'
  ]},
  { nombre: 'DPAQUETE', columnas: [
    'ID_DPAQUETE','ID_PAQUETE','ID_SERVICIO',
    'CANTIDAD','PRECIO_REFERENCIAL'
  ]},
  { nombre: 'HORARIO_MEDICO', columnas: [
    'ID_HORARIO','ID_MEDICO','ID_ESPECIALIDAD','DIA_SEMANA',
    'HORA_INICIO','HORA_FIN','INTERVALO_MIN','ESTADO'
  ]},
  // ── Horarios de profesionales de apoyo ──
  { nombre: 'HORARIO_APOYO', columnas: [
    'ID_HORARIO_APOYO','TIPO_EJECUTOR','ID_PROFESIONAL','ID_MEDICO','ID_AREA_APOYO','DIA_SEMANA',
    'HORA_INICIO','HORA_FIN','INTERVALO_MIN','ESTADO'
  ]},

  // ── TRANSACCIONALES ──
  { nombre: 'CITA', columnas: [
    'ID_CITA','ID_PACIENTE','TIPO_ATENCION','TIPO_EJECUTOR','ID_MEDICO','ID_ESPECIALIDAD',
    'ID_PROFESIONAL','ID_AREA_APOYO',
    'FECHA_CITA','HORA_CITA','MOTIVO_CONSULTA','ESTADO_CITA',
    'ID_TCITA','CONSULTORIO','ESTADO_PAGO','ID_VENTA','OBSERVACIONES','FECHA_REGISTRO'
  ]},
  { nombre: 'HISTORIAL_CITA', columnas: [
    'ID_HISTORIAL','ID_CITA','ESTADO_ANTERIOR',
    'ESTADO_NUEVO','FECHA','ID_USUARIO','OBSERVACION'
  ]},
  { nombre: 'VENTA', columnas: [
    'ID_VENTA','FECHA_VENTA','ID_TCOMPROBANTE',
    'NUMERO_COMPROBANTE','ESTADO_COMPROBANTE','RUC_CLIENTE','RAZON_SOCIAL',
    'ID_PACIENTE','ID_CITA','ID_USUARIO','ID_TMODO_PAGO',
    'SUBTOTAL','DESCUENTO','IGV','TOTAL','MONTO_PAGADO','SALDO',
    'ESTADO_PAGO','ESTADO','OBSERVACIONES','PROF_VENCE','PROF_DIAS','PROF_ORIGEN'
  ]},
  { nombre: 'DVENTA', columnas: [
    'ID_DVENTA','ID_VENTA','TIPO','ID_SERVICIO','ID_PAQUETE',
    'CANTIDAD','PRECIO_UNITARIO','DESCUENTO','SUBTOTAL',
    'ID_EJECUTOR','TIPO_EJECUTOR','NOMBRE_EJECUTOR'
  ]},
  // ── Pagos de venta (adelantos, cuotas, cancelación) ──
  { nombre: 'PAGO_VENTA', columnas: [
    'ID_PAGO_VENTA','ID_VENTA','ID_CAJA','ID_TMODO_PAGO','NUMERO_OPERACION',
    'FECHA_PAGO','MONTO','TIPO','OBSERVACION','ESTADO','FECHA_REGISTRO'
  ]},
  { nombre: 'CONTROL_SESIONES', columnas: [
    'ID_CONTROL','ID_VENTA','FECHA_INICIO','FECHA_FIN',
    'ID_PACIENTE','TIPO','ID_PAQUETE','TOTAL_SESIONES',
    'SESIONES_USADAS','SESIONES_RESTANTES','PRECIO_TOTAL',
    'MONTO_PAGADO','SALDO','ID_MEDICO','PROXIMA_CITA',
    'ESTADO','OBSERVACIONES'
  ]},
  { nombre: 'DCONTROL_SESIONES', columnas: [
    'ID_DCONTROL','ID_CONTROL','FECHA','HORA','ID_MEDICO',
    'NUMERO_SESION','DURACION_MIN','DESCRIPCION_SESION',
    'ESTADO_SESION','OBSERVACIONES'
  ]},

  // ═══════════ FINANZAS / COMPRAS / INVENTARIO ═══════════
  // ── Proveedores ──
  { nombre: 'PROVEEDOR', columnas: [
    'ID_PROVEEDOR','RUC','RAZON_SOCIAL','DIRECCION','TELEFONO',
    'EMAIL','CONTACTO','ESTADO','FECHA_REGISTRO'
  ]},
  // ── Tipo de obligación (maestra) ──
  { nombre: 'TIPO_OBLIGACION', columnas: [
    'ID_TIPO_OBLIGACION','NOMBRE','ESTADO'
  ]},
  // ── Obligaciones (cuentas por pagar) ──
  { nombre: 'OBLIGACION', columnas: [
    'ID_OBLIGACION','ID_TIPO_OBLIGACION','ID_PROVEEDOR','ID_TCOMPROBANTE',
    'NUMERO_COMPROBANTE','FECHA_EMISION','FECHA_VENCIMIENTO','DESCRIPCION',
    'MONTO_TOTAL','MONTO_PENDIENTE','ARCHIVO_ADJUNTO','ESTADO',
    'OBSERVACION','FECHA_REGISTRO'
  ]},
  // ── Pagos de obligaciones (abonos parciales) ──
  { nombre: 'PAGO_OBLIGACION', columnas: [
    'ID_PAGO_OBLIGACION','ID_OBLIGACION','ID_CAJA','ID_TMODO_PAGO',
    'FECHA_PAGO','MONTO','OBSERVACION','ESTADO','FECHA_REGISTRO'
  ]},
  // ── Productos / insumos médicos ──
  { nombre: 'PRODUCTO_INSUMO', columnas: [
    'ID_PRODUCTO','CODIGO','NOMBRE','DESCRIPCION','UNIDAD_MEDIDA',
    'STOCK','STOCK_MINIMO','PRECIO_REFERENCIAL','ESTADO','FECHA_REGISTRO'
  ]},
  // ── Tipo de movimiento de inventario (maestra) ──
  { nombre: 'TIPO_MOVIMIENTO_INVENTARIO', columnas: [
    'ID_TMOVIMIENTO','NOMBRE','ESTADO'
  ]},
  // ── Movimientos de inventario (kardex) ──
  { nombre: 'MOVIMIENTO_INVENTARIO', columnas: [
    'ID_MOVIMIENTO','ID_PRODUCTO','ID_TMOVIMIENTO','CANTIDAD',
    'STOCK_ANTERIOR','STOCK_ACTUAL','OBSERVACION','ID_USUARIO',
    'FECHA_MOVIMIENTO','FECHA_REGISTRO'
  ]},
  // ── Compras de insumos ──
  { nombre: 'COMPRA_INSUMO', columnas: [
    'ID_COMPRA','ID_PROVEEDOR','ID_OBLIGACION','FECHA_COMPRA',
    'CONDICION','ID_TMODO_PAGO','ID_CAJA',
    'TOTAL','ESTADO','OBSERVACION','ID_USUARIO','FECHA_REGISTRO'
  ]},
  // ── Detalle de compra de insumos ──
  { nombre: 'DCOMPRA_INSUMO', columnas: [
    'ID_DCOMPRA_INSUMO','ID_COMPRA','ID_PRODUCTO','ID_LOTE','CANTIDAD',
    'PRECIO_UNITARIO','SUBTOTAL','OBSERVACION'
  ]},
  // ── Receta: insumos que consume cada servicio ──
  { nombre: 'SERVICIO_INSUMO', columnas: [
    'ID_SERVICIO_INSUMO','ID_SERVICIO','ID_PRODUCTO','CANTIDAD','OBSERVACION'
  ]},
  { nombre: 'PAQUETE_INSUMO', columnas: [
    'ID_PAQUETE_INSUMO','ID_PAQUETE','ID_PRODUCTO','CANTIDAD','OBSERVACION'
  ]},
  { nombre: 'HONORARIO_CONFIG', columnas: [
    'ID_HONORARIO_CONFIG','TIPO_PERSONAL','ID_PERSONAL','NOMBRE_PERSONAL',
    'MODALIDAD','MONTO','DESCRIPCION','ESTADO','FECHA_REGISTRO'
  ]},
  { nombre: 'PAGO_HONORARIO', columnas: [
    'ID_PAGO_HONORARIO','TIPO_PERSONAL','ID_PERSONAL','NOMBRE_PERSONAL',
    'PERIODO_DESDE','PERIODO_HASTA','MODALIDAD','MONTO','MODO_PAGO',
    'ID_CAJA','OBSERVACION','ESTADO','USUARIO','FECHA_PAGO'
  ]},
  { nombre: 'ASISTENCIA_PERSONAL', columnas: [
    'ID_ASISTENCIA','TIPO_PERSONAL','ID_PERSONAL','NOMBRE_PERSONAL',
    'FECHA','TURNO','HORAS','ASISTIO','OBSERVACION','ESTADO',
    'USUARIO','FECHA_REGISTRO'
  ]},
  { nombre: 'COMISION_VENTA', columnas: [
    'ID_COMISION','ID_VENTA','ID_SERVICIO','SERVICIO_NOMBRE','ID_MEDICO','NOMBRE_MEDICO','TIPO_EJECUTOR','BASE_VENTA',
    'TIPO_CALCULO','VALOR','MONTO_COMISION','ESTADO','ID_PAGO_HONORARIO',
    'OBSERVACION','USUARIO','FECHA_REGISTRO'
  ]},
  { nombre: 'FICHA_CLINICA', columnas: [
    'ID_FICHA','ID_PACIENTE','GRUPO_SANGUINEO','ALERGIAS',
    'ENFERMEDADES_CRONICAS','CIRUGIAS_PREVIAS','MEDICACION_HABITUAL',
    'ANTECEDENTES_FAMILIARES','OBSERVACIONES','ESTADO',
    'USUARIO_ACTUALIZA','FECHA_ACTUALIZACION','FECHA_REGISTRO'
  ]},
  { nombre: 'DESCANSO_MEDICO', columnas: [
    'ID_DESCANSO','ID_PACIENTE','NOMBRE_PACIENTE','ID_ATENCION','ID_VENTA',
    'DIAGNOSTICO','CIE10','DIAS','DESDE','HASTA','TIPO',
    'ID_MEDICO','NOMBRE_MEDICO','OBSERVACION','INDICACION','ESTADO','USUARIO','FECHA_REGISTRO'
  ]},
  { nombre: 'RESULTADO_APOYO', columnas: [
    'ID_RESULTADO','ID_VENTA','ID_DVENTA','ID_PACIENTE','NOMBRE_PACIENTE',
    'ID_SERVICIO','SERVICIO_NOMBRE','ID_AREA_APOYO','AREA_NOMBRE',
    'TIPO_EJECUTOR','ID_EJECUTOR','NOMBRE_EJECUTOR','FECHA_RESULTADO',
    'INFORME','OBSERVACIONES','ESTADO','USUARIO','FECHA_REGISTRO'
  ]},
  { nombre: 'RECETA_MEDICA', columnas: [
    'ID_RECETA','ID_ATENCION','ID_VENTA','ID_PACIENTE','NOMBRE_PACIENTE',
    'ID_MEDICO','NOMBRE_MEDICO','ESPECIALIDAD','FECHA_RECETA',
    'DIAGNOSTICO','MEDICAMENTOS_JSON','INDICACIONES','DIAS_TRATAMIENTO','PROXIMO_CONTROL',
    'ESTADO','USUARIO','FECHA_REGISTRO'
  ]},
  { nombre: 'ATENCION_MEDICA', columnas: [
    'ID_ATENCION','ID_VENTA','ID_PACIENTE','NOMBRE_PACIENTE',
    'ID_MEDICO','NOMBRE_MEDICO','ID_CITA','FECHA_ATENCION',
    'MOTIVO','PA','TEMPERATURA','PESO','TALLA','FREC_CARDIACA','FREC_RESPIRATORIA','SAT_O2',
    'ENFERMEDAD_ACTUAL','ANT_CARDIOPULMONAR','ANT_RENAL','ANT_DIABETES','ANT_ALERGIAS','ANT_OTROS',
    'ANT_NO_PATOLOGICOS','ANT_FAMILIARES','EXPLORACION_FISICA','LABORATORIOS_IMAGENES','OBSERVACIONES_HC',
    'DIAGNOSTICO','CIE10','DM_DIAS','DM_DESDE','DM_HASTA','DM_TIPO','TRATAMIENTO','INDICACIONES','ORDENES','PROXIMO_CONTROL',
    'PED_PESO_NACER','PED_TALLA_NACER','PED_TIPO_PARTO','PED_APGAR','PED_SEM_GESTACION',
    'PED_NUM_EMBARAZO','PED_CONTROLES_PRENATALES','PED_LACTANCIA',
    'PED_PERIMETRO_CEFALICO','PED_PERCENTIL','PED_DESARROLLO_PSICOMOTOR','PED_VACUNAS',
    'ESTADO','USUARIO','FECHA_REGISTRO'
  ]},
  { nombre: 'CONFIG_EMPRESA', columnas: [
    'ID_CONFIG','NOMBRE','RUC','DIRECCION','TELEFONO','EMAIL',
    'LOGO_URL','LEMA','FECHA_ACTUALIZACION'
  ]},
  // ── Lotes de producto (control de vencimientos, FEFO) ──
  { nombre: 'LOTE_PRODUCTO', columnas: [
    'ID_LOTE','ID_PRODUCTO','NUMERO_LOTE','FECHA_INGRESO','FECHA_VENCIMIENTO',
    'CANTIDAD_INICIAL','CANTIDAD_DISPONIBLE','ESTADO','OBSERVACION','FECHA_REGISTRO'
  ]},
  // ── Detalle de pago (datos de transferencia/Yape/tarjeta) ──
  { nombre: 'PAGO_OBLIGACION_DETALLE', columnas: [
    'ID_PAGO_DETALLE','ID_PAGO_OBLIGACION','NUMERO_OPERACION',
    'BANCO','CELULAR','VOUCHER','ENTIDAD','OBSERVACION'
  ]},
];

// ── FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ─────────────────
/**
 * Crea todas las hojas con sus cabeceras y carga datos de ejemplo.
 * Ejecutar UNA SOLA VEZ al iniciar el proyecto.
 */

// ════════════════════════════════════════════════════════════
//  REINICIAR SISTEMA — BORRA TODOS LOS DATOS y recrea limpio
//  ⚠️ USAR CON CUIDADO: elimina todos los registros existentes
// ════════════════════════════════════════════════════════════
function reinicializarSistema() {
  var ss = getSpreadsheet();
  Logger.log('=== VIZVALL: REINICIO TOTAL (borrando datos) ===');

  ESTRUCTURA_HOJAS.forEach(function(def) {
    var hoja = ss.getSheetByName(def.nombre);
    if (!hoja) {
      hoja = ss.insertSheet(def.nombre);
      Logger.log('✓ Hoja creada: ' + def.nombre);
    } else {
      // BORRAR todo el contenido (datos + cabeceras viejas)
      hoja.clear();
      Logger.log('🗑 Hoja limpiada: ' + def.nombre);
    }
    // Reescribir cabeceras correctas
    var rango = hoja.getRange(1, 1, 1, def.columnas.length);
    rango.setValues([def.columnas]);
    rango.setBackground('#2C2C2C').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(8);
    hoja.setFrozenRows(1);
    // Quitar columnas sobrantes
    var ultCol = hoja.getMaxColumns();
    if (ultCol > def.columnas.length) {
      hoja.deleteColumns(def.columnas.length + 1, ultCol - def.columnas.length);
    }
  });

  // Forzar carga de datos iniciales (las hojas están vacías ahora)
  cargarDatosIniciales_();

  Logger.log('=== REINICIO COMPLETADO — todo con IDs de 4 dígitos ===');
  try {
    SpreadsheetApp.getUi().alert('✅ Sistema reiniciado. Todos los datos recreados con IDs de 4 dígitos (ej: ESP-0001, MED-0001).');
  } catch(e) {}
}

function inicializarSistema() {
  const ss = getSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  Logger.log('=== VIZVALL: Iniciando configuración del sistema ===');

  let hojasCreadaas = 0;
  let hojasExistentes = 0;

  ESTRUCTURA_HOJAS.forEach(def => {
    let hoja = ss.getSheetByName(def.nombre);

    if (!hoja) {
      // Crear hoja nueva
      hoja = ss.insertSheet(def.nombre);
      Logger.log('✓ Hoja creada: ' + def.nombre);
      hojasCreadaas++;
    } else {
      Logger.log('→ Hoja ya existe: ' + def.nombre);
      hojasExistentes++;
    }

    // Escribir cabeceras
    const rango = hoja.getRange(1, 1, 1, def.columnas.length);
    rango.setValues([def.columnas]);
    rango.setBackground('#2C2C2C')
         .setFontColor('#FFFFFF')
         .setFontWeight('bold')
         .setFontSize(08);

    // Congelar fila de cabecera
    hoja.setFrozenRows(1);

    // Ajustar ancho de columnas
    hoja.autoResizeColumns(1, def.columnas.length);
  });

  // Eliminar hoja por defecto "Hoja 1" si existe
  const hojaDefault = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hojaDefault && ss.getSheets().length > ESTRUCTURA_HOJAS.length) {
    ss.deleteSheet(hojaDefault);
    Logger.log('→ Hoja por defecto eliminada');
  }

  // Cargar datos iniciales
  cargarDatosIniciales_();

  Logger.log('=== Inicialización completada ===');
  Logger.log('Hojas creadas: ' + hojasCreadaas);
  Logger.log('Hojas existentes: ' + hojasExistentes);
  Logger.log('Total hojas: ' + ESTRUCTURA_HOJAS.length);
}

// ── DATOS INICIALES ──────────────────────────────────────
function cargarDatosIniciales_() {
  const fecha = getFecha('fecha');

  // ── TIPO_DOCUMENTO ──
  _insertarSiVacia('TIPO_DOCUMENTO', [
    { ID_TIPO_DOCUMENTO: 1, TIPO: 'DNI',                LONGITUD: 8  },
    { ID_TIPO_DOCUMENTO: 2, TIPO: 'CARNÉ EXTRANJERÍA',  LONGITUD: 12 },
    { ID_TIPO_DOCUMENTO: 3, TIPO: 'PASAPORTE',          LONGITUD: 20 },
    { ID_TIPO_DOCUMENTO: 4, TIPO: 'RUC',                LONGITUD: 11 },
    { ID_TIPO_DOCUMENTO: 5, TIPO: 'PARTIDA NACIMIENTO', LONGITUD: 15 },
  ]);

  // ── ESPECIALIDAD ──
  _insertarSiVacia('ESPECIALIDAD', [
    { ID_ESPECIALIDAD: 'ESP-0001', ESPECIALIDAD: 'MEDICINA GENERAL',   DESCRIPCION: 'ATENCION PRIMARIA Y DIAGNOSTICO GENERAL',         ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-0002', ESPECIALIDAD: 'CARDIOLOGIA',         DESCRIPCION: 'ATENCION EN ENFERMEDADES DEL CORAZON',            ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-0003', ESPECIALIDAD: 'PEDIATRIA',           DESCRIPCION: 'ATENCION MEDICA A NINOS Y ADOLESCENTES',          ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-0004', ESPECIALIDAD: 'GINECOLOGIA',         DESCRIPCION: 'SALUD REPRODUCTIVA Y FEMENINA',                  ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-0005', ESPECIALIDAD: 'LABORATORIO CLINICO', DESCRIPCION: 'ANALISIS Y EXAMENES DE LABORATORIO',              ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-0006', ESPECIALIDAD: 'TOPICO ENFERMERIA',   DESCRIPCION: 'CURACIONES INYECTABLES Y PROCEDIMIENTOS MENORES', ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-0007', ESPECIALIDAD: 'FISIOTERAPIA',        DESCRIPCION: 'REHABILITACION FISICA Y TERAPIAS',               ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-0008', ESPECIALIDAD: 'NUTRICION',           DESCRIPCION: 'ALIMENTACION Y DIETETICA CLINICA',               ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
  ]);

  // ── TSERVICIO ──
  _insertarSiVacia('TSERVICIO', [
    { ID_TSERVICIO: 'TSV-0001', NOMBRE: 'CONSULTA',      ESTADO: 'ACTIVO' },
    { ID_TSERVICIO: 'TSV-0002', NOMBRE: 'ANALISIS',      ESTADO: 'ACTIVO' },
    { ID_TSERVICIO: 'TSV-0003', NOMBRE: 'PROCEDIMIENTO', ESTADO: 'ACTIVO' },
    { ID_TSERVICIO: 'TSV-0004', NOMBRE: 'TERAPIA',       ESTADO: 'ACTIVO' },
  ]);

  // ── TPAQUETE ──
  _insertarSiVacia('TPAQUETE', [
    { ID_TPAQUETE: 'TPQ-0001', NOMBRE: 'GENERAL',    ESTADO: 'ACTIVO' },
    { ID_TPAQUETE: 'TPQ-0002', NOMBRE: 'LABORATORIO',ESTADO: 'ACTIVO' },
    { ID_TPAQUETE: 'TPQ-0003', NOMBRE: 'PREMIUM VIP',ESTADO: 'ACTIVO' },
    { ID_TPAQUETE: 'TPQ-0004', NOMBRE: 'PREVENTIVO', ESTADO: 'ACTIVO' },
  ]);

  // ── TCITA ──
  _insertarSiVacia('TCITA', [
    { ID_TCITA: 'TCT-0001', NOMBRE: 'PRIMERA VEZ',  ESTADO: 'ACTIVO' },
    { ID_TCITA: 'TCT-0002', NOMBRE: 'SEGUIMIENTO',  ESTADO: 'ACTIVO' },
    { ID_TCITA: 'TCT-0003', NOMBRE: 'EMERGENCIA',   ESTADO: 'ACTIVO' },
    { ID_TCITA: 'TCT-0004', NOMBRE: 'CONTROL',      ESTADO: 'ACTIVO' },
  ]);

  // ── TCOMPROBANTE ──
  _insertarSiVacia('TCOMPROBANTE', [
    { ID_TCOMPROBANTE: 'TCB-0001', NOMBRE: 'BOLETA DE VENTA', SERIE: 'B001', ESTADO: 'ACTIVO' },
    { ID_TCOMPROBANTE: 'TCB-0002', NOMBRE: 'FACTURA',         SERIE: 'F001', ESTADO: 'ACTIVO' },
    { ID_TCOMPROBANTE: 'TCB-0003', NOMBRE: 'TICKET',          SERIE: 'T001', ESTADO: 'ACTIVO' },
  ]);

  // ── TMODO_PAGO ──
  _insertarSiVacia('TMODO_PAGO', [
    { ID_TMODO_PAGO: 'TMP-0001', NOMBRE: 'EFECTIVO',             ESTADO: 'ACTIVO' },
    { ID_TMODO_PAGO: 'TMP-0002', NOMBRE: 'TARJETA DEBITO',       ESTADO: 'ACTIVO' },
    { ID_TMODO_PAGO: 'TMP-0003', NOMBRE: 'TARJETA CREDITO',      ESTADO: 'ACTIVO' },
    { ID_TMODO_PAGO: 'TMP-0004', NOMBRE: 'YAPE / PLIN',          ESTADO: 'ACTIVO' },
    { ID_TMODO_PAGO: 'TMP-0005', NOMBRE: 'TRANSFERENCIA',        ESTADO: 'ACTIVO' },
  ]);

  // ── TCONCEPTO_CAJA ──
  _insertarSiVacia('TCONCEPTO_CAJA', [
    { ID_TCONCEPTO_CAJA: 'TCC-0001', NOMBRE: 'VENTA DE SERVICIOS', TIPO: 'INGRESO', ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-0002', NOMBRE: 'PAQUETES VENDIDOS',  TIPO: 'INGRESO', ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-0003', NOMBRE: 'OTROS INGRESOS',     TIPO: 'INGRESO', ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-0004', NOMBRE: 'COMPRA INSUMOS',     TIPO: 'EGRESO',  ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-0005', NOMBRE: 'PAGO SERVICIOS',     TIPO: 'EGRESO',  ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-0006', NOMBRE: 'GASTOS VARIOS',      TIPO: 'EGRESO',  ESTADO: 'ACTIVO' },
  ]);

  // ── TCONTROL_SESIONES ──
  _insertarSiVacia('TCONTROL_SESIONES', [
    { ID_TCONTROL: 'TCS-0001', NOMBRE: 'FISIOTERAPIA', DESCRIPCION: 'SESIONES DE REHABILITACION FISICA', ESTADO: 'ACTIVO' },
    { ID_TCONTROL: 'TCS-0002', NOMBRE: 'NUTRICION',    DESCRIPCION: 'SESIONES DE SEGUIMIENTO NUTRICIONAL', ESTADO: 'ACTIVO' },
    { ID_TCONTROL: 'TCS-0003', NOMBRE: 'PSICOLOGIA',   DESCRIPCION: 'SESIONES DE TERAPIA PSICOLOGICA', ESTADO: 'ACTIVO' },
    { ID_TCONTROL: 'TCS-0004', NOMBRE: 'OTRO',         DESCRIPCION: 'OTRO TIPO DE CONTROL', ESTADO: 'ACTIVO' },
  ]);

  // ── UNIDAD_MEDIDA (unidades típicas de clínica) ──
  _insertarSiVacia('UNIDAD_MEDIDA', [
    { ID_UNIDAD: 'UM-0001', NOMBRE: 'UNIDAD',     ABREVIATURA: 'UND',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0002', NOMBRE: 'CAJA',       ABREVIATURA: 'CJA',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0003', NOMBRE: 'FRASCO',     ABREVIATURA: 'FRC',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0004', NOMBRE: 'AMPOLLA',    ABREVIATURA: 'AMP',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0005', NOMBRE: 'TABLETA',    ABREVIATURA: 'TAB',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0006', NOMBRE: 'BLISTER',    ABREVIATURA: 'BLI',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0007', NOMBRE: 'SOBRE',      ABREVIATURA: 'SOB',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0008', NOMBRE: 'MILILITRO',  ABREVIATURA: 'ML',     ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0009', NOMBRE: 'LITRO',      ABREVIATURA: 'L',      ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0010', NOMBRE: 'MILIGRAMO',  ABREVIATURA: 'MG',     ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0011', NOMBRE: 'GRAMO',      ABREVIATURA: 'G',      ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0012', NOMBRE: 'KILOGRAMO',  ABREVIATURA: 'KG',     ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0013', NOMBRE: 'PAR',        ABREVIATURA: 'PAR',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0014', NOMBRE: 'ROLLO',      ABREVIATURA: 'ROL',    ESTADO: 'ACTIVO' },
    { ID_UNIDAD: 'UM-0015', NOMBRE: 'BOLSA',      ABREVIATURA: 'BOL',    ESTADO: 'ACTIVO' },
  ]);

  // ── AREA_APOYO ──
  _insertarSiVacia('AREA_APOYO', [
    { ID_AREA_APOYO:'AAP-0001', NOMBRE:'LABORATORIO',  DESCRIPCION:'Análisis clínicos y exámenes de laboratorio', ESTADO:'ACTIVO', FECHA_REGISTRO:fecha },
    { ID_AREA_APOYO:'AAP-0002', NOMBRE:'ECOGRAFIA',    DESCRIPCION:'Ecografías obstétricas y abdominales',         ESTADO:'ACTIVO', FECHA_REGISTRO:fecha },
    { ID_AREA_APOYO:'AAP-0003', NOMBRE:'RAYOS X',      DESCRIPCION:'Radiografías y estudios de imagen',            ESTADO:'ACTIVO', FECHA_REGISTRO:fecha },
    { ID_AREA_APOYO:'AAP-0004', NOMBRE:'TOPICO',       DESCRIPCION:'Curaciones, inyectables y procedimientos menores', ESTADO:'ACTIVO', FECHA_REGISTRO:fecha },
  ]);

  // ── TIPO_OBLIGACION ──
  _insertarSiVacia('TIPO_OBLIGACION', [
    { ID_TIPO_OBLIGACION:'TOB-0001', NOMBRE:'COMPRA DE INSUMOS',   ESTADO:'ACTIVO' },
    { ID_TIPO_OBLIGACION:'TOB-0002', NOMBRE:'SERVICIOS (LUZ/AGUA)', ESTADO:'ACTIVO' },
    { ID_TIPO_OBLIGACION:'TOB-0003', NOMBRE:'ALQUILER',            ESTADO:'ACTIVO' },
    { ID_TIPO_OBLIGACION:'TOB-0004', NOMBRE:'PLANILLA / SUELDOS',  ESTADO:'ACTIVO' },
    { ID_TIPO_OBLIGACION:'TOB-0005', NOMBRE:'IMPUESTOS',           ESTADO:'ACTIVO' },
    { ID_TIPO_OBLIGACION:'TOB-0006', NOMBRE:'OTROS',               ESTADO:'ACTIVO' },
  ]);

  // ── TIPO_MOVIMIENTO_INVENTARIO ──
  _insertarSiVacia('TIPO_MOVIMIENTO_INVENTARIO', [
    { ID_TMOVIMIENTO:'TMI-0001', NOMBRE:'ENTRADA',  ESTADO:'ACTIVO' },
    { ID_TMOVIMIENTO:'TMI-0002', NOMBRE:'SALIDA',   ESTADO:'ACTIVO' },
    { ID_TMOVIMIENTO:'TMI-0003', NOMBRE:'AJUSTE',   ESTADO:'ACTIVO' },
    { ID_TMOVIMIENTO:'TMI-0004', NOMBRE:'MERMA',    ESTADO:'ACTIVO' },
  ]);

  // ── ROL ──
  _insertarSiVacia('ROL', [
    { ID_ROL: 'ROL-0001', NOMBRE: 'ADMINISTRADOR', DESCRIPCION: 'ACCESO TOTAL AL SISTEMA',          ESTADO: 'ACTIVO' },
    { ID_ROL: 'ROL-0002', NOMBRE: 'CAJERO',        DESCRIPCION: 'GESTION DE VENTAS Y CAJA',         ESTADO: 'ACTIVO' },
    { ID_ROL: 'ROL-0003', NOMBRE: 'MEDICO',        DESCRIPCION: 'AGENDA CITAS Y PACIENTES',         ESTADO: 'ACTIVO' },
    { ID_ROL: 'ROL-0004', NOMBRE: 'RECEPCION',     DESCRIPCION: 'REGISTRO DE PACIENTES Y CITAS',    ESTADO: 'ACTIVO' },
  ]);

  // ── USUARIO (admin inicial con clave hasheada) ──
  _insertarSiVacia('USUARIO', [
    {
      ID_USUARIO:    'USR-0001',
      NOMBRES:       'ADMINISTRADOR',
      APELLIDOS:     'GENERAL',
      USUARIO:       'admin',
      CLAVE:         hashClave('admin123'),   // SHA-0256
      CORREO:        'admin@vizvall.pe',
      TELEFONO:      '',
      FOTO:          '',
      ESTADO:        'ACTIVO',
      ULTIMO_ACCESO: '',
      FECHA_REGISTRO: fecha,
    },
  ]);



  // ── PERMISO ──
  _insertarSiVacia('PERMISO', [
    // DASHBOARD
    { ID_PERMISO:'PER-0001', MODULO:'DASHBOARD',      ACCION:'VER',       DESCRIPCION:'Ver dashboard principal',            ESTADO:'ACTIVO' },
    // PACIENTES
    { ID_PERMISO:'PER-0010', MODULO:'PACIENTES',      ACCION:'VER',       DESCRIPCION:'Ver lista de pacientes',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0011', MODULO:'PACIENTES',      ACCION:'CREAR',     DESCRIPCION:'Registrar nuevo paciente',            ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0012', MODULO:'PACIENTES',      ACCION:'EDITAR',    DESCRIPCION:'Editar datos del paciente',           ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0013', MODULO:'PACIENTES',      ACCION:'ELIMINAR',  DESCRIPCION:'Cambiar estado del paciente',         ESTADO:'ACTIVO' },
    // MEDICOS
    { ID_PERMISO:'PER-0020', MODULO:'MEDICOS',        ACCION:'VER',       DESCRIPCION:'Ver lista de médicos',                ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0021', MODULO:'MEDICOS',        ACCION:'CREAR',     DESCRIPCION:'Registrar nuevo médico',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0022', MODULO:'MEDICOS',        ACCION:'EDITAR',    DESCRIPCION:'Editar datos del médico',             ESTADO:'ACTIVO' },
    // SERVICIOS
    { ID_PERMISO:'PER-0030', MODULO:'SERVICIOS',      ACCION:'VER',       DESCRIPCION:'Ver lista de servicios',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0031', MODULO:'SERVICIOS',      ACCION:'CREAR',     DESCRIPCION:'Registrar nuevo servicio',            ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0032', MODULO:'SERVICIOS',      ACCION:'EDITAR',    DESCRIPCION:'Editar servicio',                     ESTADO:'ACTIVO' },
    // PAQUETES
    { ID_PERMISO:'PER-0040', MODULO:'PAQUETES',       ACCION:'VER',       DESCRIPCION:'Ver lista de paquetes',               ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0041', MODULO:'PAQUETES',       ACCION:'CREAR',     DESCRIPCION:'Registrar nuevo paquete',             ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0042', MODULO:'PAQUETES',       ACCION:'EDITAR',    DESCRIPCION:'Editar paquete',                      ESTADO:'ACTIVO' },
    // CITAS
    { ID_PERMISO:'PER-0050', MODULO:'CITAS',          ACCION:'VER',       DESCRIPCION:'Ver agenda de citas',                 ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0051', MODULO:'CITAS',          ACCION:'CREAR',     DESCRIPCION:'Registrar nueva cita',                ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0052', MODULO:'CITAS',          ACCION:'EDITAR',    DESCRIPCION:'Editar y reprogramar cita',           ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0053', MODULO:'CITAS',          ACCION:'CANCELAR',  DESCRIPCION:'Cancelar cita',                       ESTADO:'ACTIVO' },
    // VENTAS
    { ID_PERMISO:'PER-0060', MODULO:'VENTAS',         ACCION:'VER',       DESCRIPCION:'Ver historial de ventas',             ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0061', MODULO:'VENTAS',         ACCION:'CREAR',     DESCRIPCION:'Registrar nueva venta',               ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0062', MODULO:'VENTAS',         ACCION:'ANULAR',    DESCRIPCION:'Anular venta registrada',             ESTADO:'ACTIVO' },
    // CAJA
    { ID_PERMISO:'PER-0070', MODULO:'CAJA',           ACCION:'VER',       DESCRIPCION:'Ver movimientos de caja',             ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0071', MODULO:'CAJA',           ACCION:'CREAR',     DESCRIPCION:'Registrar movimiento de caja',        ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0072', MODULO:'CAJA',           ACCION:'CERRAR',    DESCRIPCION:'Realizar cierre de caja',             ESTADO:'ACTIVO' },
    // SESIONES
    { ID_PERMISO:'PER-0080', MODULO:'SESIONES',       ACCION:'VER',       DESCRIPCION:'Ver control de sesiones',             ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0081', MODULO:'SESIONES',       ACCION:'CREAR',     DESCRIPCION:'Crear plan de sesiones',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0082', MODULO:'SESIONES',       ACCION:'REGISTRAR', DESCRIPCION:'Registrar sesión realizada',          ESTADO:'ACTIVO' },
    // REPORTES
    { ID_PERMISO:'PER-0090', MODULO:'REPORTES',       ACCION:'VER',       DESCRIPCION:'Ver reportes del sistema',            ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0091', MODULO:'REPORTES',       ACCION:'EXPORTAR',  DESCRIPCION:'Exportar reportes',                   ESTADO:'ACTIVO' },
    // SEGURIDAD
    { ID_PERMISO:'PER-0100', MODULO:'SEGURIDAD',      ACCION:'VER',       DESCRIPCION:'Ver usuarios y roles',                ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0101', MODULO:'SEGURIDAD',      ACCION:'CREAR',     DESCRIPCION:'Crear usuarios y roles',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0102', MODULO:'SEGURIDAD',      ACCION:'EDITAR',    DESCRIPCION:'Editar usuarios y roles',             ESTADO:'ACTIVO' },
    // CONFIGURACION
    { ID_PERMISO:'PER-0110', MODULO:'CONFIGURACION',  ACCION:'VER',       DESCRIPCION:'Ver tablas de configuración',         ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-0111', MODULO:'CONFIGURACION',  ACCION:'EDITAR',    DESCRIPCION:'Editar tablas de configuración',      ESTADO:'ACTIVO' },
  ]);

  // ── ROL_PERMISO ──
  // ADMINISTRADOR (ROL-0001) → TODOS los permisos
  // CAJERO        (ROL-0002) → Dashboard, Ventas, Caja, Reportes
  // MEDICO        (ROL-0003) → Dashboard, Pacientes(ver), Citas, Sesiones, Reportes
  // RECEPCION     (ROL-0004) → Dashboard, Pacientes, Médicos(ver), Citas
  _insertarSiVacia('ROL_PERMISO', [
    // ── ADMINISTRADOR: todos ──
    { ID_ROL_PERMISO:'RP-0001', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0001' },
    { ID_ROL_PERMISO:'RP-0002', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0010' },
    { ID_ROL_PERMISO:'RP-0003', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0011' },
    { ID_ROL_PERMISO:'RP-0004', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0012' },
    { ID_ROL_PERMISO:'RP-0005', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0013' },
    { ID_ROL_PERMISO:'RP-0006', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0020' },
    { ID_ROL_PERMISO:'RP-0007', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0021' },
    { ID_ROL_PERMISO:'RP-0008', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0022' },
    { ID_ROL_PERMISO:'RP-0009', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0030' },
    { ID_ROL_PERMISO:'RP-0010', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0031' },
    { ID_ROL_PERMISO:'RP-0011', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0032' },
    { ID_ROL_PERMISO:'RP-0012', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0040' },
    { ID_ROL_PERMISO:'RP-0013', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0041' },
    { ID_ROL_PERMISO:'RP-0014', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0042' },
    { ID_ROL_PERMISO:'RP-0015', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0050' },
    { ID_ROL_PERMISO:'RP-0016', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0051' },
    { ID_ROL_PERMISO:'RP-0017', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0052' },
    { ID_ROL_PERMISO:'RP-0018', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0053' },
    { ID_ROL_PERMISO:'RP-0019', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0060' },
    { ID_ROL_PERMISO:'RP-0020', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0061' },
    { ID_ROL_PERMISO:'RP-0021', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0062' },
    { ID_ROL_PERMISO:'RP-0022', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0070' },
    { ID_ROL_PERMISO:'RP-0023', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0071' },
    { ID_ROL_PERMISO:'RP-0024', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0072' },
    { ID_ROL_PERMISO:'RP-0025', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0080' },
    { ID_ROL_PERMISO:'RP-0026', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0081' },
    { ID_ROL_PERMISO:'RP-0027', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0082' },
    { ID_ROL_PERMISO:'RP-0028', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0090' },
    { ID_ROL_PERMISO:'RP-0029', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0091' },
    { ID_ROL_PERMISO:'RP-0030', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0100' },
    { ID_ROL_PERMISO:'RP-0031', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0101' },
    { ID_ROL_PERMISO:'RP-0032', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0102' },
    { ID_ROL_PERMISO:'RP-0033', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0110' },
    { ID_ROL_PERMISO:'RP-0034', ID_ROL:'ROL-0001', ID_PERMISO:'PER-0111' },

    // ── CAJERO: Dashboard, Ventas, Caja, Reportes ──
    { ID_ROL_PERMISO:'RP-0035', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0001' },
    { ID_ROL_PERMISO:'RP-0036', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0060' },
    { ID_ROL_PERMISO:'RP-0037', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0061' },
    { ID_ROL_PERMISO:'RP-0038', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0062' },
    { ID_ROL_PERMISO:'RP-0039', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0070' },
    { ID_ROL_PERMISO:'RP-0040', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0071' },
    { ID_ROL_PERMISO:'RP-0041', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0072' },
    { ID_ROL_PERMISO:'RP-0042', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0090' },
    { ID_ROL_PERMISO:'RP-0043', ID_ROL:'ROL-0002', ID_PERMISO:'PER-0091' },

    // ── MEDICO: Dashboard, Pacientes(ver), Citas, Sesiones, Reportes ──
    { ID_ROL_PERMISO:'RP-0044', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0001' },
    { ID_ROL_PERMISO:'RP-0045', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0010' },
    { ID_ROL_PERMISO:'RP-0046', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0050' },
    { ID_ROL_PERMISO:'RP-0047', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0051' },
    { ID_ROL_PERMISO:'RP-0048', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0052' },
    { ID_ROL_PERMISO:'RP-0049', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0053' },
    { ID_ROL_PERMISO:'RP-0050', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0080' },
    { ID_ROL_PERMISO:'RP-0051', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0081' },
    { ID_ROL_PERMISO:'RP-0052', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0082' },
    { ID_ROL_PERMISO:'RP-0053', ID_ROL:'ROL-0003', ID_PERMISO:'PER-0090' },

    // ── RECEPCION: Dashboard, Pacientes, Medicos(ver), Citas ──
    { ID_ROL_PERMISO:'RP-0054', ID_ROL:'ROL-0004', ID_PERMISO:'PER-0001' },
    { ID_ROL_PERMISO:'RP-0055', ID_ROL:'ROL-0004', ID_PERMISO:'PER-0010' },
    { ID_ROL_PERMISO:'RP-0056', ID_ROL:'ROL-0004', ID_PERMISO:'PER-0011' },
    { ID_ROL_PERMISO:'RP-0057', ID_ROL:'ROL-0004', ID_PERMISO:'PER-0012' },
    { ID_ROL_PERMISO:'RP-0058', ID_ROL:'ROL-0004', ID_PERMISO:'PER-0020' },
    { ID_ROL_PERMISO:'RP-0059', ID_ROL:'ROL-0004', ID_PERMISO:'PER-0050' },
    { ID_ROL_PERMISO:'RP-0060', ID_ROL:'ROL-0004', ID_PERMISO:'PER-0051' },
    { ID_ROL_PERMISO:'RP-0061', ID_ROL:'ROL-0004', ID_PERMISO:'PER-0052' },
  ]);

  // ── USUARIO_ROL ──
  _insertarSiVacia('USUARIO_ROL', [
    { ID_USUARIO_ROL:'UR-0001', ID_USUARIO:'USR-0001', ID_ROL:'ROL-0001' }, // admin → ADMINISTRADOR
  ]);

  Logger.log('✓ Datos iniciales cargados');
}

// ── HELPER: insertar solo si la hoja está vacía ──────────
function _insertarSiVacia(nombreHoja, filas) {
  const hoja = getHoja(nombreHoja);
  if (hoja.getLastRow() > 1) {
    Logger.log('  → ' + nombreHoja + ': ya tiene datos, omitido');
    return;
  }
  filas.forEach(fila => insertarFila(nombreHoja, fila));
  Logger.log('  ✓ ' + nombreHoja + ': ' + filas.length + ' filas insertadas');
}

// ── FUNCIÓN DE VERIFICACIÓN ──────────────────────────────
/**
 * Verifica que el Spreadsheet esté correctamente configurado.
 * Ejecutar para diagnosticar problemas.
 */
function verificarEstructura() {
  const ss      = getSpreadsheet();
  const hojas   = ss.getSheets().map(h => h.getName());
  const faltantes = ESTRUCTURA_HOJAS
    .map(d => d.nombre)
    .filter(n => !hojas.includes(n));

  Logger.log('=== VERIFICACIÓN DE ESTRUCTURA ===');
  Logger.log('Hojas encontradas: ' + hojas.length);
  Logger.log('Hojas requeridas:  ' + ESTRUCTURA_HOJAS.length);

  if (faltantes.length === 0) {
    Logger.log('✓ Todas las hojas están presentes');
  } else {
    Logger.log('✗ Hojas faltantes: ' + faltantes.join(', '));
    Logger.log('  → Ejecuta inicializarSistema() para crearlas');
  }

  // Verificar usuario admin
  const usuarios = leerHoja('USUARIO');
  Logger.log('Usuarios registrados: ' + usuarios.length);
  const admin = usuarios.find(u => u.USUARIO === 'admin');
  Logger.log('Usuario admin: ' + (admin ? '✓ Existe (' + admin.ESTADO + ')' : '✗ No encontrado'));
}

// ── RESET (solo para desarrollo) ────────────────────────
/**
 * ⚠ PELIGROSO: Elimina todos los datos de las hojas.
 * Solo usar en entorno de desarrollo.
 */
function resetDatos_DEV() {
  const ss  = getSpreadsheet();
  const ui  = SpreadsheetApp.getUi();
  const res = ui.alert(
    '⚠ ADVERTENCIA',
    '¿Eliminar TODOS los datos del sistema? Esta acción no se puede deshacer.',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) { Logger.log('Reset cancelado.'); return; }

  ESTRUCTURA_HOJAS.forEach(def => {
    const hoja = ss.getSheetByName(def.nombre);
    if (hoja && hoja.getLastRow() > 1) {
      hoja.deleteRows(2, hoja.getLastRow() - 1);
      Logger.log('→ ' + def.nombre + ': datos eliminados');
    }
  });
  Logger.log('Reset completado. Ejecuta cargarDatosIniciales_() para recargar.');
}

// ════════════════════════════════════════════════════════════
//  Crear SOLO la tabla UNIDAD_MEDIDA y sembrar unidades,
//  SIN borrar el resto de datos. Ejecutar una vez desde el editor.
// ════════════════════════════════════════════════════════════
function crearUnidadesMedida() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('UNIDAD_MEDIDA');
  if (!hoja) {
    hoja = ss.insertSheet('UNIDAD_MEDIDA');
    hoja.appendRow(['ID_UNIDAD','NOMBRE','ABREVIATURA','ESTADO']);
  }
  // Si ya tiene datos (más que el encabezado), no duplicar
  if (hoja.getLastRow() > 1) {
    return 'La tabla UNIDAD_MEDIDA ya tiene datos. No se sembró de nuevo.';
  }
  var unidades = [
    ['UM-0001','UNIDAD','UND','ACTIVO'],
    ['UM-0002','CAJA','CJA','ACTIVO'],
    ['UM-0003','FRASCO','FRC','ACTIVO'],
    ['UM-0004','AMPOLLA','AMP','ACTIVO'],
    ['UM-0005','TABLETA','TAB','ACTIVO'],
    ['UM-0006','BLISTER','BLI','ACTIVO'],
    ['UM-0007','SOBRE','SOB','ACTIVO'],
    ['UM-0008','MILILITRO','ML','ACTIVO'],
    ['UM-0009','LITRO','L','ACTIVO'],
    ['UM-0010','MILIGRAMO','MG','ACTIVO'],
    ['UM-0011','GRAMO','G','ACTIVO'],
    ['UM-0012','KILOGRAMO','KG','ACTIVO'],
    ['UM-0013','PAR','PAR','ACTIVO'],
    ['UM-0014','ROLLO','ROL','ACTIVO'],
    ['UM-0015','BOLSA','BOL','ACTIVO'],
  ];
  hoja.getRange(2, 1, unidades.length, 4).setValues(unidades);
  return '✓ Tabla UNIDAD_MEDIDA creada con ' + unidades.length + ' unidades.';
}

// DIAGNÓSTICO: ejecutar en Apps Script para ver qué pasa con las unidades
function testUnidades() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('UNIDAD_MEDIDA');
  if (!hoja) {
    Logger.log('❌ La hoja UNIDAD_MEDIDA NO EXISTE. Ejecuta crearUnidadesMedida primero.');
    return 'La hoja NO existe';
  }
  var filas = hoja.getLastRow();
  Logger.log('✓ La hoja existe. Filas (con encabezado): ' + filas);
  if (filas <= 1) {
    Logger.log('⚠ La hoja está VACÍA (solo encabezado). Ejecuta crearUnidadesMedida.');
    return 'Hoja vacía';
  }
  var datos = hoja.getRange(1, 1, Math.min(filas, 4), 4).getValues();
  Logger.log('Primeras filas: ' + JSON.stringify(datos));
  // Probar listarMaestras
  var resp = listarMaestras('UNIDAD_MEDIDA');
  Logger.log('listarMaestras devuelve: ' + JSON.stringify(resp));
  return 'OK - revisa el registro de ejecución (Ver > Registros)';
}

// DIAGNÓSTICO: ver áreas de apoyo asignadas a médicos
function testAreasMedico() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('MEDICO_AREA_APOYO');
  if (!hoja) { Logger.log('❌ La tabla MEDICO_AREA_APOYO NO EXISTE'); return 'No existe la tabla'; }
  var datos = hoja.getDataRange().getValues();
  Logger.log('Filas en MEDICO_AREA_APOYO: ' + (datos.length - 1));
  Logger.log('Contenido: ' + JSON.stringify(datos));
  return 'Revisa Ver > Registros';
}

// DIAGNÓSTICO: ver profesionales de apoyo directamente
function testProfesionales() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('PROFESIONAL_APOYO');
  if (!hoja) { Logger.log('❌ La tabla PROFESIONAL_APOYO NO EXISTE'); return 'No existe'; }
  var datos = hoja.getDataRange().getValues();
  Logger.log('Filas (con encabezado): ' + datos.length);
  Logger.log('Encabezados: ' + JSON.stringify(datos[0]));
  if (datos.length > 1) Logger.log('Primera fila datos: ' + JSON.stringify(datos[1]));

  // Probar la función real
  try {
    var resp = listarProfesionalApoyo({ limite:500, _sesion:{ROL:'ADMINISTRADOR'} });
    Logger.log('listarProfesionalApoyo OK: ' + JSON.stringify(resp).substring(0,500));
  } catch(e) {
    Logger.log('❌ ERROR en listarProfesionalApoyo: ' + e.message);
  }
  return 'Revisa Ver > Registros';
}


// ════════════════════════════════════════════════════════════
//  CREAR TABLA PAQUETE_INSUMO (sin borrar datos existentes)
//  Ejecutar manualmente UNA vez desde el editor.
// ════════════════════════════════════════════════════════════
function crearTablaPaqueteInsumo() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'PAQUETE_INSUMO';
  var existe = ss.getSheetByName(nombre);
  if (existe) { Logger.log('La tabla ' + nombre + ' ya existe. Nada que hacer.'); return 'Ya existe'; }
  var hoja = ss.insertSheet(nombre);
  var cols = ['ID_PAQUETE_INSUMO','ID_PAQUETE','ID_PRODUCTO','CANTIDAD','OBSERVACION'];
  hoja.getRange(1, 1, 1, cols.length).setValues([cols]);
  hoja.setFrozenRows(1);
  Logger.log('✓ Tabla ' + nombre + ' creada con columnas: ' + cols.join(', '));
  return 'Tabla creada correctamente';
}

// ════════════════════════════════════════════════════════════
//  CREAR TABLAS DE HONORARIOS (sin borrar datos) — ejecutar UNA vez
// ════════════════════════════════════════════════════════════
function crearTablasHonorarios() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var tablas = [
    { nombre:'HONORARIO_CONFIG', cols:['ID_HONORARIO_CONFIG','TIPO_PERSONAL','ID_PERSONAL','NOMBRE_PERSONAL','MODALIDAD','MONTO','DESCRIPCION','ESTADO','FECHA_REGISTRO'] },
    { nombre:'PAGO_HONORARIO', cols:['ID_PAGO_HONORARIO','TIPO_PERSONAL','ID_PERSONAL','NOMBRE_PERSONAL','PERIODO_DESDE','PERIODO_HASTA','MODALIDAD','MONTO','MODO_PAGO','ID_CAJA','OBSERVACION','ESTADO','USUARIO','FECHA_PAGO'] },
  ];
  var creadas = [];
  tablas.forEach(function(t){
    if (ss.getSheetByName(t.nombre)) { Logger.log('Ya existe: ' + t.nombre); return; }
    var hoja = ss.insertSheet(t.nombre);
    hoja.getRange(1,1,1,t.cols.length).setValues([t.cols]);
    hoja.setFrozenRows(1);
    creadas.push(t.nombre);
    Logger.log('✓ Creada: ' + t.nombre);
  });
  return creadas.length ? ('Tablas creadas: ' + creadas.join(', ')) : 'Todas las tablas ya existían.';
}

// ════════════════════════════════════════════════════════════
//  CREAR TABLA ASISTENCIA_PERSONAL (sin borrar) — ejecutar UNA vez
// ════════════════════════════════════════════════════════════
function crearTablaAsistencia() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'ASISTENCIA_PERSONAL';
  if (ss.getSheetByName(nombre)) { Logger.log('Ya existe: ' + nombre); return 'Ya existe'; }
  var cols = ['ID_ASISTENCIA','TIPO_PERSONAL','ID_PERSONAL','NOMBRE_PERSONAL','FECHA','TURNO','HORAS','ASISTIO','OBSERVACION','ESTADO','USUARIO','FECHA_REGISTRO'];
  var hoja = ss.insertSheet(nombre);
  hoja.getRange(1,1,1,cols.length).setValues([cols]);
  hoja.setFrozenRows(1);
  Logger.log('✓ Tabla creada: ' + nombre);
  return 'Tabla creada correctamente';
}

// ════════════════════════════════════════════════════════════
//  CREAR TABLA COMISION_VENTA (sin borrar) — ejecutar UNA vez
// ════════════════════════════════════════════════════════════
function crearTablaComision() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'COMISION_VENTA';
  if (ss.getSheetByName(nombre)) { Logger.log('Ya existe: ' + nombre); return 'Ya existe'; }
  var cols = ['ID_COMISION','ID_VENTA','ID_MEDICO','NOMBRE_MEDICO','BASE_VENTA','TIPO_CALCULO','VALOR','MONTO_COMISION','ESTADO','ID_PAGO_HONORARIO','OBSERVACION','USUARIO','FECHA_REGISTRO'];
  var hoja = ss.insertSheet(nombre);
  hoja.getRange(1,1,1,cols.length).setValues([cols]);
  hoja.setFrozenRows(1);
  Logger.log('✓ Tabla creada: ' + nombre);
  return 'Tabla creada correctamente';
}

// ════════════════════════════════════════════════════════════
//  CREAR TABLA FICHA_CLINICA (sin borrar) — ejecutar UNA vez
// ════════════════════════════════════════════════════════════
function crearTablaFichaClinica() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'FICHA_CLINICA';
  if (ss.getSheetByName(nombre)) { Logger.log('Ya existe: ' + nombre); return 'Ya existe'; }
  var cols = ['ID_FICHA','ID_PACIENTE','GRUPO_SANGUINEO','ALERGIAS','ENFERMEDADES_CRONICAS','CIRUGIAS_PREVIAS','MEDICACION_HABITUAL','ANTECEDENTES_FAMILIARES','OBSERVACIONES','ESTADO','USUARIO_ACTUALIZA','FECHA_ACTUALIZACION','FECHA_REGISTRO'];
  var hoja = ss.insertSheet(nombre);
  hoja.getRange(1,1,1,cols.length).setValues([cols]);
  hoja.setFrozenRows(1);
  Logger.log('✓ Tabla creada: ' + nombre);
  return 'Tabla creada correctamente';
}

// ════════════════════════════════════════════════════════════
//  CREAR TABLA ATENCION_MEDICA (sin borrar) — ejecutar UNA vez
// ════════════════════════════════════════════════════════════
function crearTablaAtencionMedica() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'ATENCION_MEDICA';
  if (ss.getSheetByName(nombre)) { Logger.log('Ya existe: ' + nombre); return 'Ya existe'; }
  var cols = ['ID_ATENCION','ID_VENTA','ID_PACIENTE','NOMBRE_PACIENTE','ID_MEDICO','NOMBRE_MEDICO','ID_CITA','FECHA_ATENCION','MOTIVO','PA','TEMPERATURA','PESO','TALLA','FREC_CARDIACA','SAT_O2','DIAGNOSTICO','TRATAMIENTO','INDICACIONES','ORDENES','PROXIMO_CONTROL','ESTADO','USUARIO','FECHA_REGISTRO'];
  var hoja = ss.insertSheet(nombre);
  hoja.getRange(1,1,1,cols.length).setValues([cols]);
  hoja.setFrozenRows(1);
  Logger.log('✓ Tabla creada: ' + nombre);
  return 'Tabla creada correctamente';
}

// ── MIGRACIÓN: agregar columna ORDENES a ATENCION_MEDICA existente — ejecutar UNA vez ──
function agregarColumnaOrdenes() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('ATENCION_MEDICA');
  if (!hoja) { Logger.log('La tabla ATENCION_MEDICA no existe aún. Ejecute crearTablaAtencionMedica primero.'); return 'Tabla no existe'; }
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  if (cab.indexOf('ORDENES') >= 0) { Logger.log('La columna ORDENES ya existe.'); return 'Ya existe'; }
  // Insertar ORDENES después de INDICACIONES
  var idxInd = cab.indexOf('INDICACIONES');
  if (idxInd < 0) { hoja.insertColumnAfter(hoja.getLastColumn()); hoja.getRange(1, hoja.getLastColumn()).setValue('ORDENES'); }
  else { hoja.insertColumnAfter(idxInd + 1); hoja.getRange(1, idxInd + 2).setValue('ORDENES'); }
  Logger.log('✓ Columna ORDENES agregada.');
  return 'Columna ORDENES agregada correctamente';
}

// ════════════════════════════════════════════════════════════
//  CREAR TABLA CONFIG_EMPRESA con fila inicial — ejecutar UNA vez
// ════════════════════════════════════════════════════════════
function crearTablaConfigEmpresa() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'CONFIG_EMPRESA';
  if (ss.getSheetByName(nombre)) { Logger.log('Ya existe: ' + nombre); return 'Ya existe'; }
  var cols = ['ID_CONFIG','NOMBRE','RUC','DIRECCION','TELEFONO','EMAIL','LOGO_URL','LEMA','FECHA_ACTUALIZACION'];
  var hoja = ss.insertSheet(nombre);
  hoja.getRange(1,1,1,cols.length).setValues([cols]);
  hoja.setFrozenRows(1);
  // Fila inicial por defecto
  hoja.getRange(2,1,1,cols.length).setValues([['CFG-0001','VIZVALL Consultorios Médicos','','','','','','Consultorios Médicos', new Date().toISOString()]]);
  Logger.log('✓ Tabla CONFIG_EMPRESA creada con datos por defecto.');
  return 'Tabla creada correctamente';
}
// ════════════════════════════════════════════════════════════
//  CORRECCIÓN: marcar ATENDIDA las citas viejas que ya tienen
//  diagnóstico pero quedaron en PROGRAMADA — ejecutar UNA vez
// ════════════════════════════════════════════════════════════
function corregirCitasAtendidas() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hojaAt = ss.getSheetByName('ATENCION_MEDICA');
  var hojaCita = ss.getSheetByName('CITA');
  if (!hojaAt || !hojaCita) { Logger.log('Faltan tablas.'); return 'Faltan tablas'; }

  // Leer atenciones con diagnóstico
  var datosAt = hojaAt.getDataRange().getValues();
  var cabAt = datosAt[0];
  var iIdCita = cabAt.indexOf('ID_CITA');
  var iDx = cabAt.indexOf('DIAGNOSTICO');
  var iEstAt = cabAt.indexOf('ESTADO');
  var citasConDx = {};
  for (var r = 1; r < datosAt.length; r++) {
    var idCita = datosAt[r][iIdCita];
    var dx = String(datosAt[r][iDx] || '').trim();
    var estAt = String(datosAt[r][iEstAt] || '').toUpperCase();
    if (idCita && idCita !== '-' && dx && dx !== '-' && estAt !== 'ANULADA') {
      citasConDx[idCita] = true;
    }
  }

  // Recorrer citas y marcar ATENDIDA las que tienen diagnóstico
  var datosCita = hojaCita.getDataRange().getValues();
  var cabCita = datosCita[0];
  var iIdC = cabCita.indexOf('ID_CITA');
  var iEstC = cabCita.indexOf('ESTADO_CITA');
  var corregidas = 0;
  for (var c = 1; c < datosCita.length; c++) {
    var idC = datosCita[c][iIdC];
    var estC = String(datosCita[c][iEstC] || '').toUpperCase();
    if (citasConDx[idC] && estC !== 'ATENDIDA' && estC !== 'CANCELADA') {
      hojaCita.getRange(c + 1, iEstC + 1).setValue('ATENDIDA');
      corregidas++;
    }
  }
  Logger.log('✓ Citas corregidas a ATENDIDA: ' + corregidas);
  return 'Se corrigieron ' + corregidas + ' cita(s).';
}



// ════════════════════════════════════════════════════════════
function regenerarPermisosLimpio() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');

  // Lista DEFINITIVA: [GRUPO, ENLACE] — coincide exactamente con el menú del index
  var ENLACES = [
    ['Dashboard','Dashboard'],
    ['Pacientes','Nuevo paciente'], ['Pacientes','Lista de pacientes'], ['Pacientes','Historial del paciente'], ['Pacientes','Control de sesiones'],
    ['Historia Clínica','Tópico — Signos vitales'], ['Historia Clínica','Historia clínica'], ['Historia Clínica','Receta médica'], ['Historia Clínica','Resultados de apoyo'],
    ['Personal','Nuevo médico'], ['Personal','Lista de médicos'], ['Personal','Médico por especialidades'], ['Personal','Horarios médicos'], ['Personal','Nuevo profesional'], ['Personal','Lista de profesionales'], ['Personal','Profesionales por área de apoyo'], ['Personal','Horarios de profesionales'],
    ['Servicios','Catálogo de servicios'],
    ['Paquetes','Catálogo de paquetes'],
    ['Citas','Gestión de citas'], ['Citas','Historial de citas'], ['Citas','Nueva cita'],
    ['Ventas','Gestión de proformas'], ['Ventas','Gestión de ventas'], ['Ventas','Nueva venta'],
    ['Caja','Apertura de caja'], ['Caja','Caja diaria'], ['Caja','Ingresos y egresos'], ['Caja','Cierre de caja'], ['Caja','Caja chica'],
    ['Control Sesiones','Control de sesiones'], ['Control Sesiones','Sesiones activas'], ['Control Sesiones','Sesiones completadas'],
    ['Reportes','Reporte de ventas'], ['Reportes','Reporte de citas'], ['Reportes','Reporte de pacientes'], ['Reportes','Reporte de médicos'], ['Reportes','Reporte de caja'], ['Reportes','Reporte de sesiones'], ['Reportes','Reporte de paquetes vendidos'],
    ['Compras','Proveedores'], ['Compras','Registrar compra'], ['Compras','Historial de compras'],
    ['Inventario','Stock actual'], ['Inventario','Kardex de movimientos'], ['Inventario','Productos bajo stock mínimo'], ['Inventario','Vencimientos'], ['Inventario','Recetas de insumos'],
    ['Finanzas','Resumen financiero'], ['Finanzas','Reporte'], ['Finanzas','Liquidez'], ['Finanzas','Indicadores'], ['Finanzas','Gastos varios'], ['Finanzas','Obligaciones pendientes'], ['Finanzas','Obligaciones vencidas'], ['Finanzas','Historial de pagos'],
    ['Honorarios','Resumen'], ['Honorarios','Configuración'], ['Honorarios','Asistencia'], ['Honorarios','Pagar honorario'], ['Honorarios','Comisiones'], ['Honorarios','Historial de pagos'],
    ['Seguridad','Usuarios'], ['Seguridad','Roles'], ['Seguridad','Permisos'], ['Seguridad','Auditoría'], ['Seguridad','Copias de seguridad'],
    ['Configuración','Datos de la empresa'], ['Configuración','Tipos de documento'], ['Configuración','Especialidades'], ['Configuración','Áreas de apoyo'], ['Configuración','Unidades de medida'], ['Configuración','Tipos de servicio'], ['Configuración','Tipos de paquete'], ['Configuración','Tipos de cita'], ['Configuración','Tipos de comprobante'], ['Configuración','Modos de pago'], ['Configuración','Conceptos de caja'], ['Configuración','Estados de control']
  ];

  // 1. BORRAR todos los permisos viejos (vaciar tabla PERMISO menos cabecera)
  var hojaPer = ss.getSheetByName('PERMISO');
  var ultFila = hojaPer.getLastRow();
  if (ultFila > 1) hojaPer.deleteRows(2, ultFila - 1);

  // 2. BORRAR todas las asignaciones viejas (vaciar ROL_PERMISO menos cabecera)
  var hojaRP = ss.getSheetByName('ROL_PERMISO');
  var ultRP = hojaRP.getLastRow();
  if (ultRP > 1) hojaRP.deleteRows(2, ultRP - 1);

  // 3. CREAR los permisos nuevos (uno por enlace)
  var cabPer = hojaPer.getRange(1,1,1,hojaPer.getLastColumn()).getValues()[0];
  var iId = cabPer.indexOf('ID_PERMISO');
  var iMod = cabPer.indexOf('MODULO');
  var iAcc = cabPer.indexOf('ACCION');
  var iDesc = cabPer.indexOf('DESCRIPCION');
  var iEst = cabPer.indexOf('ESTADO');

  var filasPer = [];
  var idsPermisos = [];
  for (var e = 0; e < ENLACES.length; e++) {
    var fila = new Array(cabPer.length).fill('');
    var idp = 'PER-' + ('0000' + (e+1)).slice(-4);
    fila[iId] = idp;
    fila[iMod] = ENLACES[e][0];
    fila[iAcc] = ENLACES[e][1];
    if (iDesc >= 0) fila[iDesc] = ENLACES[e][0] + ' · ' + ENLACES[e][1];
    if (iEst >= 0) fila[iEst] = 'ACTIVO';
    filasPer.push(fila);
    idsPermisos.push(idp);
  }
  if (filasPer.length) hojaPer.getRange(2,1,filasPer.length,cabPer.length).setValues(filasPer);

  // 4. RE-ASIGNAR todos los permisos a ADMINISTRADOR
  var hojaRol = ss.getSheetByName('ROL');
  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL');
  var iNomRol = rolData[0].indexOf('NOMBRE');
  var rolesTotales = []; // solo ADMINISTRADOR
  for (var r = 1; r < rolData.length; r++) {
    var nom = String(rolData[r][iNomRol]).toUpperCase();
    if (nom === 'ADMINISTRADOR') rolesTotales.push(rolData[r][iIdRol]);
  }

  var cabRP = hojaRP.getRange(1,1,1,hojaRP.getLastColumn()).getValues()[0];
  var iRpId = cabRP.indexOf('ID_ROL_PERMISO');
  var iRpRol = cabRP.indexOf('ID_ROL');
  var iRpPer = cabRP.indexOf('ID_PERMISO');
  var filasRP = [];
  var num = 0;
  for (var rt = 0; rt < rolesTotales.length; rt++) {
    for (var pp = 0; pp < idsPermisos.length; pp++) {
      num++;
      var f = new Array(cabRP.length).fill('');
      if (iRpId >= 0) f[iRpId] = 'RP-' + ('0000' + num).slice(-4);
      f[iRpRol] = rolesTotales[rt];
      f[iRpPer] = idsPermisos[pp];
      filasRP.push(f);
    }
  }
  if (filasRP.length) hojaRP.getRange(2,1,filasRP.length,cabRP.length).setValues(filasRP);

  Logger.log('✓ Permisos regenerados: ' + idsPermisos.length + ' permisos. Re-asignados a ' + rolesTotales.length + ' rol(es) total(es).');
  return 'Listo: ' + idsPermisos.length + ' permisos creados (1 por enlace). ADMINISTRADOR tiene acceso total. Los demás roles quedan SIN permisos (asígnalos en el panel).';
}

// ════════════════════════════════════════════════════════════
//  AMPLIAR COMISION_VENTA — agrega ID_SERVICIO y SERVICIO_NOMBRE
//  Ejecutar UNA vez con ▶ : ampliarComisionPorServicio
//  (No borra datos: solo inserta las 2 columnas nuevas)
// ════════════════════════════════════════════════════════════
function ampliarComisionPorServicio() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('COMISION_VENTA');
  if (!hoja) return 'No existe la hoja COMISION_VENTA. Ejecuta primero la instalación.';

  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];

  var faltan = [];
  if (cab.indexOf('ID_SERVICIO') < 0) faltan.push('ID_SERVICIO');
  if (cab.indexOf('SERVICIO_NOMBRE') < 0) faltan.push('SERVICIO_NOMBRE');
  if (cab.indexOf('TIPO_EJECUTOR') < 0) faltan.push('TIPO_EJECUTOR');
  if (!faltan.length) {
    return 'Las columnas ya existen. Nada que hacer.';
  }

  // Agregar las columnas que falten al final
  var ultCol = hoja.getLastColumn();
  for (var i = 0; i < faltan.length; i++) {
    hoja.getRange(1, ultCol + 1 + i).setValue(faltan[i]);
  }

  Logger.log('✓ Columnas agregadas a COMISION_VENTA: ' + faltan.join(', '));
  return 'Listo: COMISION_VENTA ahora tiene ' + faltan.join(', ') + '. Las comisiones viejas quedan con esos campos vacíos (sin afectar nada).';
}

// ════════════════════════════════════════════════════════════
//  ELIMINAR USUARIO ROOT — limpieza de datos
//  Borra el usuario johannsavi, el rol ROOT y sus asignaciones.
//  Ejecutar UNA vez con ▶ : eliminarUsuarioRoot
//  ⚠ Asegúrate de tener otro ADMINISTRADOR antes de ejecutar.
// ════════════════════════════════════════════════════════════
function eliminarUsuarioRoot() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var resumen = [];

  // Helper para borrar filas que cumplan una condición
  function borrarFilas(nombreHoja, colNombre, valorBuscado, comparador) {
    var hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return 0;
    var datos = hoja.getDataRange().getValues();
    var cab = datos[0];
    var col = cab.indexOf(colNombre);
    if (col < 0) return 0;
    var borradas = 0;
    for (var r = datos.length - 1; r >= 1; r--) {
      var val = String(datos[r][col]);
      var coincide = comparador === 'igual_lower'
        ? (val.toLowerCase() === String(valorBuscado).toLowerCase())
        : (val.toUpperCase() === String(valorBuscado).toUpperCase());
      if (coincide) { hoja.deleteRow(r + 1); borradas++; }
    }
    return borradas;
  }

  // 1. Obtener IDs del usuario root y del rol root (antes de borrar)
  var hojaUsr = ss.getSheetByName('USUARIO');
  var usrData = hojaUsr.getDataRange().getValues();
  var iIdUsr = usrData[0].indexOf('ID_USUARIO');
  var iUsuario = usrData[0].indexOf('USUARIO');
  var rootUsrId = null;
  for (var u = 1; u < usrData.length; u++) {
    if (String(usrData[u][iUsuario]).toLowerCase() === 'johannsavi') { rootUsrId = usrData[u][iIdUsr]; break; }
  }

  var hojaRol = ss.getSheetByName('ROL');
  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL');
  var iNomRol = rolData[0].indexOf('NOMBRE');
  var rootRolId = null;
  for (var r = 1; r < rolData.length; r++) {
    if (String(rolData[r][iNomRol]).toUpperCase() === 'ROOT') { rootRolId = rolData[r][iIdRol]; break; }
  }

  // 2. Borrar asignaciones USUARIO_ROL del usuario root y del rol root
  if (rootUsrId) {
    var n1 = borrarFilas('USUARIO_ROL', 'ID_USUARIO', rootUsrId, 'igual_upper');
    resumen.push('USUARIO_ROL (por usuario): ' + n1);
  }
  if (rootRolId) {
    var n2 = borrarFilas('USUARIO_ROL', 'ID_ROL', rootRolId, 'igual_upper');
    resumen.push('USUARIO_ROL (por rol): ' + n2);
    // 3. Borrar permisos del rol root en ROL_PERMISO
    var n3 = borrarFilas('ROL_PERMISO', 'ID_ROL', rootRolId, 'igual_upper');
    resumen.push('ROL_PERMISO: ' + n3);
  }

  // 4. Borrar el usuario johannsavi
  var n4 = borrarFilas('USUARIO', 'USUARIO', 'johannsavi', 'igual_lower');
  resumen.push('USUARIO (johannsavi): ' + n4);

  // 5. Borrar el rol ROOT
  var n5 = borrarFilas('ROL', 'NOMBRE', 'ROOT', 'igual_upper');
  resumen.push('ROL (ROOT): ' + n5);

  var msg = '✓ Limpieza de ROOT completada:\n' + resumen.join('\n') +
            '\n\nEl super usuario ahora es ADMINISTRADOR (admin / admin123).';
  Logger.log(msg);
  return msg;
}

// ════════════════════════════════════════════════════════════
//  USUARIOS DE PRUEBA — ejecutar con ▶ crearUsuariosPrueba
//  Crea: cajero, drtorres (médico), recepcion. Solo si no existen.
// ════════════════════════════════════════════════════════════
function crearUsuariosPrueba() {
  var fecha = getFecha('fecha');
  var usuarios = leerHoja(HOJAS.USUARIO);

  var nuevos = [
    {
      ID_USUARIO:'USR-0002', NOMBRES:'MARIA', APELLIDOS:'PEREZ',
      USUARIO:'cajero', CLAVE:hashClave('cajero123'),
      CORREO:'cajero@vizvall.pe', TELEFONO:'', FOTO:'',
      ESTADO:'ACTIVO', ULTIMO_ACCESO:'', FECHA_REGISTRO:fecha
    },
    {
      ID_USUARIO:'USR-0003', NOMBRES:'JUAN CARLOS', APELLIDOS:'TORRES',
      USUARIO:'drtorres', CLAVE:hashClave('medico123'),
      CORREO:'drtorres@vizvall.pe', TELEFONO:'', FOTO:'',
      ESTADO:'ACTIVO', ULTIMO_ACCESO:'', FECHA_REGISTRO:fecha
    },
    {
      ID_USUARIO:'USR-0004', NOMBRES:'ANA', APELLIDOS:'MARTINEZ',
      USUARIO:'recepcion', CLAVE:hashClave('recep123'),
      CORREO:'recepcion@vizvall.pe', TELEFONO:'', FOTO:'',
      ESTADO:'ACTIVO', ULTIMO_ACCESO:'', FECHA_REGISTRO:fecha
    },
  ];

  nuevos.forEach(function(u) {
    var existe = usuarios.find(function(x) { return x.USUARIO === u.USUARIO; });
    if (!existe) {
      insertarFila(HOJAS.USUARIO, u);
      Logger.log('✓ Usuario creado: ' + u.USUARIO);
    } else {
      Logger.log('→ Ya existe: ' + u.USUARIO);
    }
  });

  // Asignar roles
  var usuarioRoles = leerHoja(HOJAS.USUARIO_ROL);
  var asignaciones = [
    { ID_USUARIO_ROL:'UR-0002', ID_USUARIO:'USR-0002', ID_ROL:'ROL-0002' }, // cajero
    { ID_USUARIO_ROL:'UR-0003', ID_USUARIO:'USR-0003', ID_ROL:'ROL-0003' }, // médico
    { ID_USUARIO_ROL:'UR-0004', ID_USUARIO:'USR-0004', ID_ROL:'ROL-0004' }, // recepción
  ];

  asignaciones.forEach(function(a) {
    var existe = usuarioRoles.find(function(x) { return x.ID_USUARIO === a.ID_USUARIO; });
    if (!existe) {
      insertarFila(HOJAS.USUARIO_ROL, a);
      Logger.log('✓ Rol asignado: ' + a.ID_USUARIO + ' → ' + a.ID_ROL);
    }
  });

  Logger.log('✓ Usuarios de prueba listos');
  return 'Usuarios de prueba creados: cajero, drtorres, recepcion (si no existían).';
}

// ════════════════════════════════════════════════════════════
//  AMPLIAR ATENCION_MEDICA — campos del modelo Medicina General
//  Ejecutar UNA vez con ▶ : ampliarHistoriaClinica
//  (No borra datos: solo agrega las columnas nuevas al final)
// ════════════════════════════════════════════════════════════
function ampliarHistoriaClinica() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('ATENCION_MEDICA');
  if (!hoja) return 'No existe ATENCION_MEDICA. Ejecuta primero crearTablaAtencionMedica.';

  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var nuevas = [
    'FREC_RESPIRATORIA','ENFERMEDAD_ACTUAL',
    'ANT_CARDIOPULMONAR','ANT_RENAL','ANT_DIABETES','ANT_ALERGIAS','ANT_OTROS',
    'ANT_NO_PATOLOGICOS','ANT_FAMILIARES','EXPLORACION_FISICA',
    'LABORATORIOS_IMAGENES','OBSERVACIONES_HC'
  ];
  var faltan = nuevas.filter(function(col){ return cab.indexOf(col) < 0; });
  if (!faltan.length) return 'Todas las columnas ya existen. Nada que hacer.';

  var ultCol = hoja.getLastColumn();
  for (var i = 0; i < faltan.length; i++) {
    hoja.getRange(1, ultCol + 1 + i).setValue(faltan[i]);
  }
  Logger.log('✓ Columnas agregadas a ATENCION_MEDICA: ' + faltan.join(', '));
  return 'Listo: se agregaron ' + faltan.length + ' columnas a ATENCION_MEDICA (' + faltan.join(', ') + '). Datos viejos intactos.';
}

// ════════════════════════════════════════════════════════════
//  AMPLIAR para DESCANSO MÉDICO — ejecutar UNA vez ▶
// ════════════════════════════════════════════════════════════
function ampliarDescansoMedico() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('ATENCION_MEDICA');
  if (!hoja) return 'No existe ATENCION_MEDICA.';
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var nuevas = ['CIE10','DM_DIAS','DM_DESDE','DM_HASTA','DM_TIPO'];
  var faltan = nuevas.filter(function(col){ return cab.indexOf(col) < 0; });
  if (!faltan.length) return 'Las columnas ya existen. Nada que hacer.';
  var ultCol = hoja.getLastColumn();
  for (var i = 0; i < faltan.length; i++) hoja.getRange(1, ultCol + 1 + i).setValue(faltan[i]);
  Logger.log('✓ Columnas descanso médico agregadas: ' + faltan.join(', '));
  return 'Listo: se agregaron ' + faltan.join(', ') + ' a ATENCION_MEDICA.';
}

// ════════════════════════════════════════════════════════════
//  AGREGAR PERMISO "Gestión de proformas" — ejecutar UNA vez ▶
//  Lo añade a la tabla PERMISO y lo asigna al ADMINISTRADOR,
//  SIN tocar los demás permisos ni roles.
// ════════════════════════════════════════════════════════════
function agregarPermisoProformas() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hojaPer = ss.getSheetByName('PERMISO');
  var hojaRP = ss.getSheetByName('ROL_PERMISO');
  var hojaRol = ss.getSheetByName('ROL');

  // ¿Ya existe el permiso?
  var datosPer = hojaPer.getDataRange().getValues();
  var cabPer = datosPer[0];
  var iMod = cabPer.indexOf('MODULO');
  var iAcc = cabPer.indexOf('ACCION');
  var iIdPer = cabPer.indexOf('ID_PERMISO');
  for (var r = 1; r < datosPer.length; r++) {
    if (String(datosPer[r][iMod]) === 'Ventas' && String(datosPer[r][iAcc]) === 'Gestión de proformas') {
      return 'El permiso "Gestión de proformas" ya existe. Nada que hacer.';
    }
  }

  // Crear el permiso con un ID nuevo
  var maxNum = 0;
  for (var p = 1; p < datosPer.length; p++) {
    var m = String(datosPer[p][iIdPer]).match(/PER-(\d+)/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  var nuevoId = 'PER-' + ('0000' + (maxNum + 1)).slice(-4);
  var filaPer = new Array(cabPer.length).fill('');
  filaPer[iIdPer] = nuevoId;
  filaPer[iMod] = 'Ventas';
  filaPer[iAcc] = 'Gestión de proformas';
  var iDesc = cabPer.indexOf('DESCRIPCION'); if (iDesc >= 0) filaPer[iDesc] = 'Ventas · Gestión de proformas';
  var iEst = cabPer.indexOf('ESTADO'); if (iEst >= 0) filaPer[iEst] = 'ACTIVO';
  hojaPer.appendRow(filaPer);

  // Asignarlo al ADMINISTRADOR
  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL');
  var iNomRol = rolData[0].indexOf('NOMBRE');
  var idAdmin = null;
  for (var rr = 1; rr < rolData.length; rr++) {
    if (String(rolData[rr][iNomRol]).toUpperCase() === 'ADMINISTRADOR') { idAdmin = rolData[rr][iIdRol]; break; }
  }
  if (idAdmin) {
    var datosRP = hojaRP.getDataRange().getValues();
    var cabRP = datosRP[0];
    var maxRP = 0;
    for (var x = 1; x < datosRP.length; x++) {
      var mm = String(datosRP[x][cabRP.indexOf('ID_ROL_PERMISO')]).match(/RP-(\d+)/);
      if (mm) maxRP = Math.max(maxRP, parseInt(mm[1], 10));
    }
    var filaRP = new Array(cabRP.length).fill('');
    filaRP[cabRP.indexOf('ID_ROL_PERMISO')] = 'RP-' + ('0000' + (maxRP + 1)).slice(-4);
    filaRP[cabRP.indexOf('ID_ROL')] = idAdmin;
    filaRP[cabRP.indexOf('ID_PERMISO')] = nuevoId;
    hojaRP.appendRow(filaRP);
  }

  Logger.log('✓ Permiso "Gestión de proformas" creado (' + nuevoId + ') y asignado a ADMINISTRADOR.');
  return 'Listo: permiso "Gestión de proformas" creado y asignado al administrador. Recarga la app (Ctrl+Shift+R).';
}

// ════════════════════════════════════════════════════════════
//  RECLASIFICAR ESPECIALIDADES MAL UBICADAS → ÁREAS DE APOYO
//  Ejecutar UNA vez con ▶ : reclasificarEspecialidades
//  - Crea Fisioterapia y Nutrición en AREA_APOYO (si faltan)
//  - Mueve los servicios de esas "especialidades" a su área de apoyo
//  - Desactiva (no borra) esas especialidades mal ubicadas
//  NO borra datos: solo reclasifica y desactiva.
// ════════════════════════════════════════════════════════════
function reclasificarEspecialidades() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var resumen = [];

  // Mapa: ID especialidad mal ubicada → nombre del área de apoyo destino
  var MIGRAR = {
    'ESP-0005': 'LABORATORIO',   // Laboratorio Clínico → Laboratorio
    'ESP-0006': 'TOPICO',        // Tópico Enfermería → Tópico
    'ESP-0007': 'FISIOTERAPIA',  // Fisioterapia → (área nueva)
    'ESP-0008': 'NUTRICION'      // Nutrición → (área nueva)
  };

  // 1. Asegurar que existan las áreas de apoyo destino
  var hojaArea = ss.getSheetByName('AREA_APOYO');
  var areaData = hojaArea.getDataRange().getValues();
  var cabA = areaData[0];
  var iIdA = cabA.indexOf('ID_AREA_APOYO');
  var iNomA = cabA.indexOf('NOMBRE');
  var iEstA = cabA.indexOf('ESTADO');
  var iDescA = cabA.indexOf('DESCRIPCION');

  // Buscar el nombre del área → su ID (las que ya existen)
  var areaPorNombre = {};
  var maxAAP = 0;
  for (var a = 1; a < areaData.length; a++) {
    areaPorNombre[String(areaData[a][iNomA]).toUpperCase()] = areaData[a][iIdA];
    var mm = String(areaData[a][iIdA]).match(/AAP-(\d+)/);
    if (mm) maxAAP = Math.max(maxAAP, parseInt(mm[1], 10));
  }

  // Crear Fisioterapia y Nutrición si faltan
  ['FISIOTERAPIA','NUTRICION'].forEach(function(nom){
    if (!areaPorNombre[nom]) {
      maxAAP++;
      var nuevoId = 'AAP-' + ('0000' + maxAAP).slice(-4);
      var fila = new Array(cabA.length).fill('');
      fila[iIdA] = nuevoId;
      fila[iNomA] = nom;
      if (iDescA >= 0) fila[iDescA] = nom === 'FISIOTERAPIA' ? 'Rehabilitación física y terapias' : 'Alimentación y dietética clínica';
      if (iEstA >= 0) fila[iEstA] = 'ACTIVO';
      hojaArea.appendRow(fila);
      areaPorNombre[nom] = nuevoId;
      resumen.push('Área creada: ' + nom + ' (' + nuevoId + ')');
    }
  });

  // 2. Reasignar servicios que usaban esas especialidades → área de apoyo
  var hojaSrv = ss.getSheetByName('SERVICIO');
  var srvData = hojaSrv.getDataRange().getValues();
  var cabS = srvData[0];
  var iEspS = cabS.indexOf('ID_ESPECIALIDAD');
  var iAreaS = cabS.indexOf('ID_AREA_APOYO');
  var movidos = 0;
  for (var s = 1; s < srvData.length; s++) {
    var espActual = String(srvData[s][iEspS]);
    if (MIGRAR[espActual]) {
      var areaDestino = areaPorNombre[MIGRAR[espActual]];
      if (areaDestino) {
        hojaSrv.getRange(s + 1, iAreaS + 1).setValue(areaDestino);  // poner área
        hojaSrv.getRange(s + 1, iEspS + 1).setValue('');            // quitar especialidad
        movidos++;
      }
    }
  }
  resumen.push('Servicios reasignados a su área de apoyo: ' + movidos);

  // 3. Desactivar (no borrar) las especialidades mal ubicadas
  var hojaEsp = ss.getSheetByName('ESPECIALIDAD');
  var espData = hojaEsp.getDataRange().getValues();
  var cabE = espData[0];
  var iIdE = cabE.indexOf('ID_ESPECIALIDAD');
  var iEstE = cabE.indexOf('ESTADO');
  var desactivadas = 0;
  for (var e = 1; e < espData.length; e++) {
    if (MIGRAR[String(espData[e][iIdE])]) {
      hojaEsp.getRange(e + 1, iEstE + 1).setValue('INACTIVO');
      desactivadas++;
    }
  }
  resumen.push('Especialidades desactivadas: ' + desactivadas);

  var msg = '✓ Reclasificación completada:\n' + resumen.join('\n');
  Logger.log(msg);
  return msg;
}

// ════════════════════════════════════════════════════════════
//  AMPLIAR VENTA para vencimiento de proformas — ejecutar UNA vez ▶
//  Agrega: PROF_VENCE (fecha límite), PROF_DIAS (días duración),
//          PROF_ORIGEN (marca venta que vino de proforma)
// ════════════════════════════════════════════════════════════
function ampliarProformaVencimiento() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('VENTA');
  if (!hoja) return 'No existe la hoja VENTA.';
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var nuevas = ['PROF_VENCE','PROF_DIAS','PROF_ORIGEN'];
  var faltan = nuevas.filter(function(col){ return cab.indexOf(col) < 0; });
  if (!faltan.length) return 'Las columnas ya existen. Nada que hacer.';
  var ultCol = hoja.getLastColumn();
  for (var i = 0; i < faltan.length; i++) hoja.getRange(1, ultCol + 1 + i).setValue(faltan[i]);
  Logger.log('✓ Columnas agregadas a VENTA: ' + faltan.join(', '));
  return 'Listo: se agregaron ' + faltan.join(', ') + ' a VENTA. Datos viejos intactos.';
}

// ════════════════════════════════════════════════════════════
//  AGREGAR PERMISO "Copias de seguridad" — ejecutar UNA vez ▶
// ════════════════════════════════════════════════════════════
function agregarPermisoBackups() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hojaPer = ss.getSheetByName('PERMISO');
  var hojaRP = ss.getSheetByName('ROL_PERMISO');
  var hojaRol = ss.getSheetByName('ROL');
  var datosPer = hojaPer.getDataRange().getValues();
  var cabPer = datosPer[0];
  var iMod = cabPer.indexOf('MODULO'), iAcc = cabPer.indexOf('ACCION'), iIdPer = cabPer.indexOf('ID_PERMISO');
  for (var r = 1; r < datosPer.length; r++) {
    if (String(datosPer[r][iMod]) === 'Seguridad' && String(datosPer[r][iAcc]) === 'Copias de seguridad') {
      return 'El permiso "Copias de seguridad" ya existe.';
    }
  }
  var maxNum = 0;
  for (var p = 1; p < datosPer.length; p++) { var m = String(datosPer[p][iIdPer]).match(/PER-(\d+)/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); }
  var nuevoId = 'PER-' + ('0000' + (maxNum + 1)).slice(-4);
  var filaPer = new Array(cabPer.length).fill('');
  filaPer[iIdPer] = nuevoId; filaPer[iMod] = 'Seguridad'; filaPer[iAcc] = 'Copias de seguridad';
  var iDesc = cabPer.indexOf('DESCRIPCION'); if (iDesc >= 0) filaPer[iDesc] = 'Seguridad · Copias de seguridad';
  var iEst = cabPer.indexOf('ESTADO'); if (iEst >= 0) filaPer[iEst] = 'ACTIVO';
  hojaPer.appendRow(filaPer);
  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL'), iNomRol = rolData[0].indexOf('NOMBRE');
  var idAdmin = null;
  for (var rr = 1; rr < rolData.length; rr++) { if (String(rolData[rr][iNomRol]).toUpperCase() === 'ADMINISTRADOR') { idAdmin = rolData[rr][iIdRol]; break; } }
  if (idAdmin) {
    var datosRP = hojaRP.getDataRange().getValues(); var cabRP = datosRP[0]; var maxRP = 0;
    for (var x = 1; x < datosRP.length; x++) { var mm = String(datosRP[x][cabRP.indexOf('ID_ROL_PERMISO')]).match(/RP-(\d+)/); if (mm) maxRP = Math.max(maxRP, parseInt(mm[1], 10)); }
    var filaRP = new Array(cabRP.length).fill('');
    filaRP[cabRP.indexOf('ID_ROL_PERMISO')] = 'RP-' + ('0000' + (maxRP + 1)).slice(-4);
    filaRP[cabRP.indexOf('ID_ROL')] = idAdmin; filaRP[cabRP.indexOf('ID_PERMISO')] = nuevoId;
    hojaRP.appendRow(filaRP);
  }
  return 'Permiso "Copias de seguridad" creado y asignado al administrador. Recarga (Ctrl+Shift+R).';
}
// ════════════════════════════════════════════════════════════
//  INSTALAR CAJA CHICA — ejecutar UNA vez ▶ instalarCajaChica
//  Crea las hojas, los conceptos de gasto y el permiso del menú.
// ════════════════════════════════════════════════════════════
function instalarCajaChica() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var resumen = [];

  // 1. Crear las 3 hojas si no existen (con sus cabeceras)
  var hojas = {
    'CAJA_CHICA': ['ID_CC','FECHA','HORA','TIPO','ID_CONCEPTO_CC','CONCEPTO_LIBRE','MONTO','NUM_RECIBO','BENEFICIARIO','ORIGEN_FONDO','ID_APERTURA_CC','USUARIO','ESTADO','OBSERVACIONES'],
    'APERTURA_CC': ['ID_APERTURA_CC','FECHA_APERTURA','HORA_APERTURA','MONTO_FONDO','TOTAL_GASTOS','TOTAL_REPOSICIONES','SALDO_ESPERADO','SALDO_CONTADO','DIFERENCIA','FECHA_CIERRE','HORA_CIERRE','USUARIO_APERTURA','USUARIO_CIERRE','ESTADO','OBSERVACIONES'],
    'CONCEPTO_CC': ['ID_CONCEPTO_CC','NOMBRE','DESCRIPCION','ESTADO']
  };
  Object.keys(hojas).forEach(function(nombre){
    var h = ss.getSheetByName(nombre);
    if (!h) {
      h = ss.insertSheet(nombre);
      h.getRange(1, 1, 1, hojas[nombre].length).setValues([hojas[nombre]]);
      h.getRange(1, 1, 1, hojas[nombre].length).setFontWeight('bold');
      h.setFrozenRows(1);
      resumen.push('Hoja creada: ' + nombre);
    } else {
      resumen.push('Hoja ya existía: ' + nombre);
    }
  });

  // 2. Conceptos/categorías de gasto semilla
  var hojaCon = ss.getSheetByName('CONCEPTO_CC');
  var datosCon = hojaCon.getDataRange().getValues();
  if (datosCon.length <= 1) { // solo cabecera
    var conceptos = [
      ['CC-0001', 'ÚTILES DE OFICINA', 'Papelería, tóner, materiales', 'ACTIVO'],
      ['CC-0002', 'LIMPIEZA', 'Productos e insumos de limpieza', 'ACTIVO'],
      ['CC-0003', 'MOVILIDAD', 'Pasajes, taxis, combustible', 'ACTIVO'],
      ['CC-0004', 'REFRIGERIOS', 'Alimentos y bebidas', 'ACTIVO'],
      ['CC-0005', 'ADELANTO PERSONAL', 'Adelantos o préstamos al personal', 'ACTIVO'],
      ['CC-0006', 'SERVICIOS', 'Luz, agua, internet, teléfono', 'ACTIVO'],
      ['CC-0007', 'MANTENIMIENTO', 'Reparaciones menores', 'ACTIVO'],
      ['CC-0008', 'OTROS', 'Gastos varios', 'ACTIVO']
    ];
    hojaCon.getRange(2, 1, conceptos.length, 4).setValues(conceptos);
    resumen.push('Conceptos de gasto creados: ' + conceptos.length);
  } else {
    resumen.push('Conceptos ya existían.');
  }

  // 3. Permiso del menú "Caja chica" para ADMINISTRADOR
  try {
    var msgP = agregarPermisoCajaChica();
    resumen.push(msgP);
  } catch (e) {
    resumen.push('Permiso: ' + e.message);
  }

  var msg = '✓ Caja chica instalada:\n' + resumen.join('\n');
  Logger.log(msg);
  return msg;
}

// ── Permiso del menú Caja chica (idempotente) ──
function agregarPermisoCajaChica() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hojaPer = ss.getSheetByName('PERMISO');
  var hojaRP = ss.getSheetByName('ROL_PERMISO');
  var hojaRol = ss.getSheetByName('ROL');
  var datosPer = hojaPer.getDataRange().getValues();
  var cabPer = datosPer[0];
  var iMod = cabPer.indexOf('MODULO'), iAcc = cabPer.indexOf('ACCION'), iIdPer = cabPer.indexOf('ID_PERMISO');
  for (var r = 1; r < datosPer.length; r++) {
    if (String(datosPer[r][iMod]) === 'Caja' && String(datosPer[r][iAcc]) === 'Caja chica') {
      return 'El permiso "Caja chica" ya existe.';
    }
  }
  var maxNum = 0;
  for (var p = 1; p < datosPer.length; p++) { var m = String(datosPer[p][iIdPer]).match(/PER-(\d+)/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); }
  var nuevoId = 'PER-' + ('0000' + (maxNum + 1)).slice(-4);
  var filaPer = new Array(cabPer.length).fill('');
  filaPer[iIdPer] = nuevoId; filaPer[iMod] = 'Caja'; filaPer[iAcc] = 'Caja chica';
  var iDesc = cabPer.indexOf('DESCRIPCION'); if (iDesc >= 0) filaPer[iDesc] = 'Caja · Caja chica';
  var iEst = cabPer.indexOf('ESTADO'); if (iEst >= 0) filaPer[iEst] = 'ACTIVO';
  hojaPer.appendRow(filaPer);
  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL'), iNomRol = rolData[0].indexOf('NOMBRE');
  var idAdmin = null;
  for (var rr = 1; rr < rolData.length; rr++) { if (String(rolData[rr][iNomRol]).toUpperCase() === 'ADMINISTRADOR') { idAdmin = rolData[rr][iIdRol]; break; } }
  if (idAdmin) {
    var datosRP = hojaRP.getDataRange().getValues(); var cabRP = datosRP[0]; var maxRP = 0;
    for (var x = 1; x < datosRP.length; x++) { var mm = String(datosRP[x][cabRP.indexOf('ID_ROL_PERMISO')]).match(/RP-(\d+)/); if (mm) maxRP = Math.max(maxRP, parseInt(mm[1], 10)); }
    var filaRP = new Array(cabRP.length).fill('');
    filaRP[cabRP.indexOf('ID_ROL_PERMISO')] = 'RP-' + ('0000' + (maxRP + 1)).slice(-4);
    filaRP[cabRP.indexOf('ID_ROL')] = idAdmin; filaRP[cabRP.indexOf('ID_PERMISO')] = nuevoId;
    hojaRP.appendRow(filaRP);
  }
  return 'Permiso "Caja chica" creado y asignado al administrador.';
}

// ════════════════════════════════════════════════════════════
//  AMPLIAR HISTORIA CLÍNICA PEDIÁTRICA — ejecutar UNA vez ▶
//  Agrega las columnas pediátricas a la hoja ATENCION_MEDICA.
// ════════════════════════════════════════════════════════════
function ampliarHistoriaPediatrica() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('ATENCION_MEDICA');
  if (!hoja) return '❌ No existe la hoja ATENCION_MEDICA.';
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var nuevas = ['PED_PESO_NACER','PED_TALLA_NACER','PED_TIPO_PARTO','PED_APGAR','PED_SEM_GESTACION',
    'PED_NUM_EMBARAZO','PED_CONTROLES_PRENATALES','PED_LACTANCIA',
    'PED_PERIMETRO_CEFALICO','PED_PERCENTIL','PED_DESARROLLO_PSICOMOTOR','PED_VACUNAS'];
  var agregadas = 0;
  nuevas.forEach(function(col){
    if (cab.indexOf(col) === -1) {
      hoja.getRange(1, hoja.getLastColumn() + 1).setValue(col);
      agregadas++;
    }
  });
  return '✓ Historia pediátrica ampliada. Columnas agregadas: ' + agregadas + ' (de ' + nuevas.length + ').';
}

// ════════════════════════════════════════════════════════════
//  AGREGAR CAMPO RNE AL MÉDICO — ejecutar UNA vez ▶ ampliarMedicoRNE
// ════════════════════════════════════════════════════════════
function ampliarMedicoRNE() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('MEDICO');
  if (!hoja) return '❌ No existe la hoja MEDICO.';
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  if (cab.indexOf('NUMERO_RNE') !== -1) return 'El campo NUMERO_RNE ya existe.';
  // Insertar NUMERO_RNE justo después de NUMERO_CMP
  var iCmp = cab.indexOf('NUMERO_CMP');
  if (iCmp === -1) { hoja.getRange(1, hoja.getLastColumn() + 1).setValue('NUMERO_RNE'); return '✓ NUMERO_RNE agregado al final.'; }
  hoja.insertColumnAfter(iCmp + 1);
  hoja.getRange(1, iCmp + 2).setValue('NUMERO_RNE');
  return '✓ Campo NUMERO_RNE agregado al médico (después de NUMERO_CMP).';
}

// ════════════════════════════════════════════════════════════
//  VINCULAR USUARIO-MÉDICO — ejecutar UNA vez ▶ ampliarUsuarioMedico
//  Agrega la columna ID_MEDICO a USUARIO (para filtrar atenciones).
// ════════════════════════════════════════════════════════════
function ampliarUsuarioMedico() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('USUARIO');
  if (!hoja) return '❌ No existe la hoja USUARIO.';
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  if (cab.indexOf('ID_MEDICO') !== -1) return 'El campo ID_MEDICO ya existe en USUARIO.';
  var iFoto = cab.indexOf('FOTO');
  if (iFoto === -1) { hoja.getRange(1, hoja.getLastColumn() + 1).setValue('ID_MEDICO'); return '✓ ID_MEDICO agregado al final.'; }
  hoja.insertColumnAfter(iFoto + 1);
  hoja.getRange(1, iFoto + 2).setValue('ID_MEDICO');
  return '✓ Campo ID_MEDICO agregado a USUARIO (después de FOTO). Ahora vincula cada usuario-médico desde la pantalla de Usuarios.';
}

// ════════════════════════════════════════════════════════════
//  INSTALAR RECETA MÉDICA — ejecutar UNA vez ▶ instalarRecetaMedica
// ════════════════════════════════════════════════════════════
function instalarRecetaMedica() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var nombre = 'RECETA_MEDICA';
  var cols = ['ID_RECETA','ID_ATENCION','ID_VENTA','ID_PACIENTE','NOMBRE_PACIENTE',
    'ID_MEDICO','NOMBRE_MEDICO','ESPECIALIDAD','FECHA_RECETA',
    'DIAGNOSTICO','MEDICAMENTOS_JSON','INDICACIONES','DIAS_TRATAMIENTO','PROXIMO_CONTROL',
    'ESTADO','USUARIO','FECHA_REGISTRO'];
  var hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, cols.length).setValues([cols]);
    hoja.setFrozenRows(1);
    return '✓ Hoja RECETA_MEDICA creada con ' + cols.length + ' columnas.';
  }
  // Si ya existe, completar columnas faltantes
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var faltan = 0;
  cols.forEach(function(col){
    if (cab.indexOf(col) === -1) { hoja.getRange(1, hoja.getLastColumn() + 1).setValue(col); faltan++; }
  });
  return faltan > 0 ? ('✓ RECETA_MEDICA actualizada: ' + faltan + ' columnas agregadas.') : 'La hoja RECETA_MEDICA ya estaba completa.';
}

// ════════════════════════════════════════════════════════════
//  AGREGAR PERMISO RECETA MÉDICA — ejecutar UNA vez ▶
//  Crea el permiso y lo asigna a ADMINISTRADOR y MEDICO.
// ════════════════════════════════════════════════════════════
function agregarPermisoRecetaMedica() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hojaPer = ss.getSheetByName('PERMISO');
  var hojaRP = ss.getSheetByName('ROL_PERMISO');
  var hojaRol = ss.getSheetByName('ROL');
  var datosPer = hojaPer.getDataRange().getValues();
  var cabPer = datosPer[0];
  var iMod = cabPer.indexOf('MODULO'), iAcc = cabPer.indexOf('ACCION'), iIdPer = cabPer.indexOf('ID_PERMISO');

  // ¿Ya existe?
  var idPermiso = null;
  for (var r = 1; r < datosPer.length; r++) {
    if (String(datosPer[r][iMod]) === 'Historia Clínica' && String(datosPer[r][iAcc]) === 'Receta médica') {
      idPermiso = datosPer[r][iIdPer]; break;
    }
  }
  // Crear el permiso si no existe
  if (!idPermiso) {
    var maxNum = 0;
    for (var p = 1; p < datosPer.length; p++) { var m = String(datosPer[p][iIdPer]).match(/PER-(\d+)/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); }
    idPermiso = 'PER-' + ('0000' + (maxNum + 1)).slice(-4);
    var filaPer = new Array(cabPer.length).fill('');
    filaPer[iIdPer] = idPermiso; filaPer[iMod] = 'Historia Clínica'; filaPer[iAcc] = 'Receta médica';
    var iDesc = cabPer.indexOf('DESCRIPCION'); if (iDesc >= 0) filaPer[iDesc] = 'Historia Clínica · Receta médica';
    var iEst = cabPer.indexOf('ESTADO'); if (iEst >= 0) filaPer[iEst] = 'ACTIVO';
    hojaPer.appendRow(filaPer);
  }

  // Asignar a ADMINISTRADOR y MEDICO
  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL'), iNomRol = rolData[0].indexOf('NOMBRE');
  var rolesObjetivo = {};
  for (var rr = 1; rr < rolData.length; rr++) {
    var nom = String(rolData[rr][iNomRol]).toUpperCase();
    if (nom === 'ADMINISTRADOR' || nom === 'MEDICO') rolesObjetivo[nom] = rolData[rr][iIdRol];
  }

  var datosRP = hojaRP.getDataRange().getValues(); var cabRP = datosRP[0];
  var iIdRP = cabRP.indexOf('ID_ROL_PERMISO'), iRpRol = cabRP.indexOf('ID_ROL'), iRpPer = cabRP.indexOf('ID_PERMISO');
  var maxRP = 0;
  for (var x = 1; x < datosRP.length; x++) { var mm = String(datosRP[x][iIdRP]).match(/RP-(\d+)/); if (mm) maxRP = Math.max(maxRP, parseInt(mm[1], 10)); }

  var asignados = [];
  Object.keys(rolesObjetivo).forEach(function(nom){
    var idRol = rolesObjetivo[nom];
    // ¿Ya está asignado?
    var yaTiene = false;
    for (var y = 1; y < datosRP.length; y++) {
      if (String(datosRP[y][iRpRol]) === String(idRol) && String(datosRP[y][iRpPer]) === String(idPermiso)) { yaTiene = true; break; }
    }
    if (!yaTiene) {
      maxRP++;
      var filaRP = new Array(cabRP.length).fill('');
      filaRP[iIdRP] = 'RP-' + ('0000' + maxRP).slice(-4);
      filaRP[iRpRol] = idRol; filaRP[iRpPer] = idPermiso;
      hojaRP.appendRow(filaRP);
      asignados.push(nom);
    }
  });

  return '✓ Permiso "Receta médica" listo. Asignado a: ' + (asignados.length ? asignados.join(', ') : '(ya estaba asignado)') + '. Cierre sesión y vuelva a entrar para verlo.';
}

// ════════════════════════════════════════════════════════════
//  VERIFICAR/CREAR HOJA AUDITORIA — ejecutar ▶ verificarHojaAuditoria
//  Diagnostica si la hoja existe y la crea si falta.
// ════════════════════════════════════════════════════════════
function verificarHojaAuditoria() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var cols = ['ID_AUDITORIA','ID_USUARIO','MODULO','ACCION','FECHA','DETALLE'];
  var hoja = ss.getSheetByName('AUDITORIA');
  if (!hoja) {
    hoja = ss.insertSheet('AUDITORIA');
    hoja.getRange(1, 1, 1, cols.length).setValues([cols]);
    hoja.setFrozenRows(1);
    var m1 = '⚠ La hoja AUDITORIA NO EXISTÍA. Se acaba de crear. Por eso no había registros. Ahora sí funcionará.';
    Logger.log(m1);
    SpreadsheetApp.getActiveSpreadsheet() && Logger.log(m1);
    return m1;
  }
  // Existe: contar registros
  var ultimaFila = hoja.getLastRow();
  var numRegistros = ultimaFila > 1 ? (ultimaFila - 1) : 0;
  // Verificar columnas
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var faltan = cols.filter(function(c){ return cab.indexOf(c) === -1; });
  var msg = '✓ La hoja AUDITORIA existe. Registros actuales: ' + numRegistros + '.';
  if (faltan.length) msg += ' ⚠ Faltan columnas: ' + faltan.join(', ');
  if (numRegistros === 0) msg += ' (Vacía: haga una acción crítica y vuelva a revisar.)';
  Logger.log(msg);
  return msg;
}

// Registra un evento de PRUEBA para confirmar que la auditoría funciona ▶ probarAuditoria
function probarAuditoria() {
  registrarAuditoria('USR-0001', 'PRUEBA', 'TEST', 'Registro de prueba de auditoría · ' + new Date());
  return '✓ Se registró un evento de prueba. Ve a Seguridad → Auditoría para verlo (módulo PRUEBA).';
}

// ════════════════════════════════════════════════════════════
//  INSTALAR RESULTADOS DE APOYO — ejecutar UNA vez ▶ instalarResultadoApoyo
// ════════════════════════════════════════════════════════════
function instalarResultadoApoyo() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var cols = ['ID_RESULTADO','ID_VENTA','ID_DVENTA','ID_PACIENTE','NOMBRE_PACIENTE',
    'ID_SERVICIO','SERVICIO_NOMBRE','ID_AREA_APOYO','AREA_NOMBRE',
    'TIPO_EJECUTOR','ID_EJECUTOR','NOMBRE_EJECUTOR','FECHA_RESULTADO',
    'INFORME','OBSERVACIONES','ESTADO','USUARIO','FECHA_REGISTRO'];
  var hoja = ss.getSheetByName('RESULTADO_APOYO');
  if (!hoja) {
    hoja = ss.insertSheet('RESULTADO_APOYO');
    hoja.getRange(1, 1, 1, cols.length).setValues([cols]);
    hoja.setFrozenRows(1);
    return '✓ Hoja RESULTADO_APOYO creada con ' + cols.length + ' columnas.';
  }
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var faltan = 0;
  cols.forEach(function(col){ if (cab.indexOf(col) === -1){ hoja.getRange(1, hoja.getLastColumn()+1).setValue(col); faltan++; } });
  return faltan > 0 ? ('✓ RESULTADO_APOYO actualizada: '+faltan+' columnas agregadas.') : 'La hoja RESULTADO_APOYO ya estaba completa.';
}

// ════════════════════════════════════════════════════════════
//  AGREGAR PERMISO RESULTADOS DE APOYO — ejecutar UNA vez ▶
// ════════════════════════════════════════════════════════════
function agregarPermisoResultados() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hojaPer = ss.getSheetByName('PERMISO');
  var hojaRP = ss.getSheetByName('ROL_PERMISO');
  var hojaRol = ss.getSheetByName('ROL');
  var datosPer = hojaPer.getDataRange().getValues();
  var cabPer = datosPer[0];
  var iMod = cabPer.indexOf('MODULO'), iAcc = cabPer.indexOf('ACCION'), iIdPer = cabPer.indexOf('ID_PERMISO');

  var idPermiso = null;
  for (var r = 1; r < datosPer.length; r++) {
    if (String(datosPer[r][iMod]) === 'Historia Clínica' && String(datosPer[r][iAcc]) === 'Resultados de apoyo') { idPermiso = datosPer[r][iIdPer]; break; }
  }
  if (!idPermiso) {
    var maxNum = 0;
    for (var p = 1; p < datosPer.length; p++) { var m = String(datosPer[p][iIdPer]).match(/PER-(\d+)/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); }
    idPermiso = 'PER-' + ('0000' + (maxNum + 1)).slice(-4);
    var filaPer = new Array(cabPer.length).fill('');
    filaPer[iIdPer] = idPermiso; filaPer[iMod] = 'Historia Clínica'; filaPer[iAcc] = 'Resultados de apoyo';
    var iDesc = cabPer.indexOf('DESCRIPCION'); if (iDesc >= 0) filaPer[iDesc] = 'Historia Clínica · Resultados de apoyo';
    var iEst = cabPer.indexOf('ESTADO'); if (iEst >= 0) filaPer[iEst] = 'ACTIVO';
    hojaPer.appendRow(filaPer);
  }

  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL'), iNomRol = rolData[0].indexOf('NOMBRE');
  var rolesObjetivo = {};
  for (var rr = 1; rr < rolData.length; rr++) {
    var nom = String(rolData[rr][iNomRol]).toUpperCase();
    if (nom === 'ADMINISTRADOR' || nom === 'MEDICO') rolesObjetivo[nom] = rolData[rr][iIdRol];
  }
  var datosRP = hojaRP.getDataRange().getValues(); var cabRP = datosRP[0];
  var iIdRP = cabRP.indexOf('ID_ROL_PERMISO'), iRpRol = cabRP.indexOf('ID_ROL'), iRpPer = cabRP.indexOf('ID_PERMISO');
  var maxRP = 0;
  for (var x = 1; x < datosRP.length; x++) { var mm = String(datosRP[x][iIdRP]).match(/RP-(\d+)/); if (mm) maxRP = Math.max(maxRP, parseInt(mm[1], 10)); }
  var asignados = [];
  Object.keys(rolesObjetivo).forEach(function(nom){
    var idRol = rolesObjetivo[nom], yaTiene = false;
    for (var y = 1; y < datosRP.length; y++) { if (String(datosRP[y][iRpRol]) === String(idRol) && String(datosRP[y][iRpPer]) === String(idPermiso)) { yaTiene = true; break; } }
    if (!yaTiene) { maxRP++; var filaRP = new Array(cabRP.length).fill(''); filaRP[iIdRP]='RP-'+('0000'+maxRP).slice(-4); filaRP[iRpRol]=idRol; filaRP[iRpPer]=idPermiso; hojaRP.appendRow(filaRP); asignados.push(nom); }
  });
  return '✓ Permiso "Resultados de apoyo" listo. Asignado a: ' + (asignados.length?asignados.join(', '):'(ya estaba)') + '. Cierre sesión y vuelva a entrar.';
}

// ════════════════════════════════════════════════════════════
//  AGREGAR LOS 5 PERMISOS DE HONORARIOS — ejecutar UNA vez ▶
//  Configuración · Asistencia · Pagar honorario · Comisiones · Historial
// ════════════════════════════════════════════════════════════
function agregarPermisosHonorarios() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hojaPer = ss.getSheetByName('PERMISO');
  var hojaRP  = ss.getSheetByName('ROL_PERMISO');
  var hojaRol = ss.getSheetByName('ROL');
  var acciones = ['Resumen','Configuración','Asistencia','Pagar honorario','Comisiones','Historial de pagos'];

  var datosPer = hojaPer.getDataRange().getValues();
  var cabPer = datosPer[0];
  var iMod = cabPer.indexOf('MODULO'), iAcc = cabPer.indexOf('ACCION'), iIdPer = cabPer.indexOf('ID_PERMISO');
  var iDesc = cabPer.indexOf('DESCRIPCION'), iEst = cabPer.indexOf('ESTADO');

  function maxPer(){ var m=0; for(var p=1;p<datosPer.length;p++){ var x=String(datosPer[p][iIdPer]).match(/PER-(\d+)/); if(x) m=Math.max(m,parseInt(x[1],10)); } return m; }

  var idsPermiso = {};
  acciones.forEach(function(acc){
    var existe = null;
    for (var r=1;r<datosPer.length;r++){ if(String(datosPer[r][iMod])==='Honorarios' && String(datosPer[r][iAcc])===acc){ existe=datosPer[r][iIdPer]; break; } }
    if (!existe) {
      var nid = 'PER-' + ('0000'+(maxPer()+1)).slice(-4);
      var fila = new Array(cabPer.length).fill('');
      fila[iIdPer]=nid; fila[iMod]='Honorarios'; fila[iAcc]=acc;
      if(iDesc>=0) fila[iDesc]='Honorarios · '+acc;
      if(iEst>=0) fila[iEst]='ACTIVO';
      hojaPer.appendRow(fila);
      datosPer.push(fila); // para que maxPer cuente el nuevo
      existe = nid;
    }
    idsPermiso[acc] = existe;
  });

  // Asignar TODOS al rol ADMINISTRADOR
  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL'), iNomRol = rolData[0].indexOf('NOMBRE');
  var idAdmin = null;
  for (var rr=1;rr<rolData.length;rr++){ if(String(rolData[rr][iNomRol]).toUpperCase()==='ADMINISTRADOR'){ idAdmin=rolData[rr][iIdRol]; break; } }

  var datosRP = hojaRP.getDataRange().getValues(); var cabRP = datosRP[0];
  var iIdRP=cabRP.indexOf('ID_ROL_PERMISO'), iRpRol=cabRP.indexOf('ID_ROL'), iRpPer=cabRP.indexOf('ID_PERMISO');
  var maxRP=0; for(var x=1;x<datosRP.length;x++){ var mm=String(datosRP[x][iIdRP]).match(/RP-(\d+)/); if(mm) maxRP=Math.max(maxRP,parseInt(mm[1],10)); }

  var nuevos=0;
  if (idAdmin) {
    acciones.forEach(function(acc){
      var idPer=idsPermiso[acc], ya=false;
      for(var y=1;y<datosRP.length;y++){ if(String(datosRP[y][iRpRol])===String(idAdmin) && String(datosRP[y][iRpPer])===String(idPer)){ ya=true; break; } }
      if(!ya){ maxRP++; var f=new Array(cabRP.length).fill(''); f[iIdRP]='RP-'+('0000'+maxRP).slice(-4); f[iRpRol]=idAdmin; f[iRpPer]=idPer; hojaRP.appendRow(f); datosRP.push(f); nuevos++; }
    });
  }
  return '✓ 5 permisos de Honorarios listos (Configuración, Asistencia, Pagar, Comisiones, Historial). Asignados al Administrador: ' + nuevos + ' nuevo(s). Cierre sesión y vuelva a entrar.';
}

// ════════════════════════════════════════════════════════════
//  AMPLIAR DVENTA con el ejecutor del servicio — ejecutar UNA vez ▶
//  Agrega ID_EJECUTOR, TIPO_EJECUTOR, NOMBRE_EJECUTOR al detalle de venta.
//  Permite asignar el médico/profesional que ejecuta cada servicio vendido.
// ════════════════════════════════════════════════════════════
function ampliarVentaEjecutor() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hoja = ss.getSheetByName('DVENTA');
  if (!hoja) return 'No existe la hoja DVENTA. Ejecuta primero la instalación.';

  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var faltan = [];
  if (cab.indexOf('ID_EJECUTOR') < 0)     faltan.push('ID_EJECUTOR');
  if (cab.indexOf('TIPO_EJECUTOR') < 0)   faltan.push('TIPO_EJECUTOR');
  if (cab.indexOf('NOMBRE_EJECUTOR') < 0) faltan.push('NOMBRE_EJECUTOR');
  if (!faltan.length) return 'Las columnas ya existen en DVENTA. Nada que hacer.';

  var ultCol = hoja.getLastColumn();
  for (var i = 0; i < faltan.length; i++) {
    hoja.getRange(1, ultCol + 1 + i).setValue(faltan[i]);
  }
  Logger.log('✓ Columnas agregadas a DVENTA: ' + faltan.join(', '));
  return 'Listo: DVENTA ahora tiene ' + faltan.join(', ') + '. Las ventas viejas quedan con esos campos vacíos (sin afectar nada).';
}

// ════════════════════════════════════════════════════════════
//  INSTALAR MÓDULO DESCANSO MÉDICO — ejecutar UNA vez ▶
//  Crea la hoja DESCANSO_MEDICO (independiente de la atención).
// ════════════════════════════════════════════════════════════
function instalarDescansoMedico() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var cols = ['ID_DESCANSO','ID_PACIENTE','NOMBRE_PACIENTE','ID_ATENCION','ID_VENTA',
    'DIAGNOSTICO','CIE10','DIAS','DESDE','HASTA','TIPO',
    'ID_MEDICO','NOMBRE_MEDICO','OBSERVACION','INDICACION','ESTADO','USUARIO','FECHA_REGISTRO'];
  var hoja = ss.getSheetByName('DESCANSO_MEDICO');
  if (!hoja) {
    hoja = ss.insertSheet('DESCANSO_MEDICO');
    hoja.getRange(1, 1, 1, cols.length).setValues([cols]);
    hoja.setFrozenRows(1);
    return '✓ Hoja DESCANSO_MEDICO creada con ' + cols.length + ' columnas.';
  }
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var faltan = 0;
  cols.forEach(function(col){ if (cab.indexOf(col) === -1){ hoja.getRange(1, hoja.getLastColumn()+1).setValue(col); faltan++; } });
  return faltan > 0 ? ('✓ DESCANSO_MEDICO actualizada: '+faltan+' columnas agregadas.') : 'La hoja DESCANSO_MEDICO ya estaba completa.';
}

// ════════════════════════════════════════════════════════════
//  AGREGAR PERMISO DESCANSO MÉDICO — ejecutar UNA vez ▶
// ════════════════════════════════════════════════════════════
function agregarPermisoDescanso() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hp = ss.getSheetByName('PERMISO');
  var datosPer = hp.getDataRange().getValues();
  var cabPer = datosPer[0];
  var iIdPer = cabPer.indexOf('ID_PERMISO'), iMod = cabPer.indexOf('MODULO'), iAcc = cabPer.indexOf('ACCION');
  var idPermiso = '';
  for (var r = 1; r < datosPer.length; r++) {
    if (String(datosPer[r][iMod]) === 'Historia Clínica' && String(datosPer[r][iAcc]) === 'Descanso médico') { idPermiso = datosPer[r][iIdPer]; break; }
  }
  if (!idPermiso) {
    var nums = [];
    for (var k = 1; k < datosPer.length; k++) { var m = String(datosPer[k][iIdPer]).match(/(\d+)/); if (m) nums.push(parseInt(m[1])); }
    var next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    idPermiso = 'PER-' + String(next).padStart(4, '0');
    var filaPer = new Array(cabPer.length).fill('');
    filaPer[iIdPer] = idPermiso; filaPer[iMod] = 'Historia Clínica'; filaPer[iAcc] = 'Descanso médico';
    var iDesc = cabPer.indexOf('DESCRIPCION'); if (iDesc >= 0) filaPer[iDesc] = 'Historia Clínica · Descanso médico';
    hp.appendRow(filaPer);
  }
  // Asignar el permiso a ADMINISTRADOR y MEDICO
  var hrp = ss.getSheetByName('ROL_PERMISO');
  var hr = ss.getSheetByName('ROL');
  var datosRol = hr.getDataRange().getValues(); var cabRol = datosRol[0];
  var iIdRol = cabRol.indexOf('ID_ROL'), iNomRol = cabRol.indexOf('NOMBRE');
  var datosRP = hrp.getDataRange().getValues(); var cabRP = datosRP[0];
  var iRolRP = cabRP.indexOf('ID_ROL'), iPerRP = cabRP.indexOf('ID_PERMISO');
  var asignados = [];
  for (var x = 1; x < datosRol.length; x++) {
    var rolNom = String(datosRol[x][iNomRol]).toUpperCase();
    if (rolNom === 'ADMINISTRADOR' || rolNom === 'MEDICO') {
      var idRol = datosRol[x][iIdRol], existe = false;
      for (var y = 1; y < datosRP.length; y++) { if (String(datosRP[y][iRolRP])===String(idRol) && String(datosRP[y][iPerRP])===String(idPermiso)) { existe = true; break; } }
      if (!existe) { var f = new Array(cabRP.length).fill(''); f[iRolRP]=idRol; f[iPerRP]=idPermiso; hrp.appendRow(f); asignados.push(rolNom); }
    }
  }
  return '✓ Permiso "Descanso médico" listo. Asignado a: ' + (asignados.length?asignados.join(', '):'(ya estaba)') + '. Cierre sesión y vuelva a entrar.';
}

// ════════════════════════════════════════════════════════════
//  AGREGAR PERMISO REPORTE HISTORIA CLÍNICA — ejecutar UNA vez ▶
// ════════════════════════════════════════════════════════════
function agregarPermisoReporteHC() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
  var hp = ss.getSheetByName('PERMISO');
  var datosPer = hp.getDataRange().getValues();
  var cabPer = datosPer[0];
  var iIdPer = cabPer.indexOf('ID_PERMISO'), iMod = cabPer.indexOf('MODULO'), iAcc = cabPer.indexOf('ACCION');
  var idPermiso = '';
  for (var r = 1; r < datosPer.length; r++) {
    if (String(datosPer[r][iMod]) === 'Historia Clínica' && String(datosPer[r][iAcc]) === 'Reporte de Historia Clínica') { idPermiso = datosPer[r][iIdPer]; break; }
  }
  if (!idPermiso) {
    var nums = [];
    for (var k = 1; k < datosPer.length; k++) { var m = String(datosPer[k][iIdPer]).match(/(\d+)/); if (m) nums.push(parseInt(m[1])); }
    var next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    idPermiso = 'PER-' + String(next).padStart(4, '0');
    var filaPer = new Array(cabPer.length).fill('');
    filaPer[iIdPer] = idPermiso; filaPer[iMod] = 'Historia Clínica'; filaPer[iAcc] = 'Reporte de Historia Clínica';
    var iDesc = cabPer.indexOf('DESCRIPCION'); if (iDesc >= 0) filaPer[iDesc] = 'Historia Clínica · Reporte de Historia Clínica';
    hp.appendRow(filaPer);
  }
  var hrp = ss.getSheetByName('ROL_PERMISO');
  var hr = ss.getSheetByName('ROL');
  var datosRol = hr.getDataRange().getValues(); var cabRol = datosRol[0];
  var iIdRol = cabRol.indexOf('ID_ROL'), iNomRol = cabRol.indexOf('NOMBRE');
  var datosRP = hrp.getDataRange().getValues(); var cabRP = datosRP[0];
  var iRolRP = cabRP.indexOf('ID_ROL'), iPerRP = cabRP.indexOf('ID_PERMISO');
  var asignados = [];
  for (var x = 1; x < datosRol.length; x++) {
    var rolNom = String(datosRol[x][iNomRol]).toUpperCase();
    if (rolNom === 'ADMINISTRADOR' || rolNom === 'MEDICO') {
      var idRol = datosRol[x][iIdRol], existe = false;
      for (var y = 1; y < datosRP.length; y++) { if (String(datosRP[y][iRolRP])===String(idRol) && String(datosRP[y][iPerRP])===String(idPermiso)) { existe = true; break; } }
      if (!existe) { var f = new Array(cabRP.length).fill(''); f[iRolRP]=idRol; f[iPerRP]=idPermiso; hrp.appendRow(f); asignados.push(rolNom); }
    }
  }
  return '✓ Permiso "Reporte de Historia Clínica" listo. Asignado a: ' + (asignados.length?asignados.join(', '):'(ya estaba)') + '. Cierre sesión y vuelva a entrar.';
}
