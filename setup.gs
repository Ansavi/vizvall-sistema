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
    'CORREO','TELEFONO','FOTO','ESTADO','ULTIMO_ACCESO','FECHA_REGISTRO'
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
    'NUMERO_CMP','TELEFONO','EMAIL','ESTADO',
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
    'ESTADO_PAGO','ESTADO','OBSERVACIONES'
  ]},
  { nombre: 'DVENTA', columnas: [
    'ID_DVENTA','ID_VENTA','TIPO','ID_SERVICIO','ID_PAQUETE',
    'CANTIDAD','PRECIO_UNITARIO','DESCUENTO','SUBTOTAL'
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
    'ID_COMISION','ID_VENTA','ID_MEDICO','NOMBRE_MEDICO','BASE_VENTA',
    'TIPO_CALCULO','VALOR','MONTO_COMISION','ESTADO','ID_PAGO_HONORARIO',
    'OBSERVACION','USUARIO','FECHA_REGISTRO'
  ]},
  { nombre: 'FICHA_CLINICA', columnas: [
    'ID_FICHA','ID_PACIENTE','GRUPO_SANGUINEO','ALERGIAS',
    'ENFERMEDADES_CRONICAS','CIRUGIAS_PREVIAS','MEDICACION_HABITUAL',
    'ANTECEDENTES_FAMILIARES','OBSERVACIONES','ESTADO',
    'USUARIO_ACTUALIZA','FECHA_ACTUALIZACION','FECHA_REGISTRO'
  ]},
  { nombre: 'ATENCION_MEDICA', columnas: [
    'ID_ATENCION','ID_VENTA','ID_PACIENTE','NOMBRE_PACIENTE',
    'ID_MEDICO','NOMBRE_MEDICO','ID_CITA','FECHA_ATENCION',
    'MOTIVO','PA','TEMPERATURA','PESO','TALLA','FREC_CARDIACA','SAT_O2',
    'DIAGNOSTICO','TRATAMIENTO','INDICACIONES','ORDENES','PROXIMO_CONTROL',
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

  // ── USUARIOS DE PRUEBA ──
// Ejecutar solo en desarrollo
function crearUsuariosPrueba() {
  var fecha = getFecha('fecha');

  // Solo inserta si no existen
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
    var existe = usuarios.find(function(x) {
      return x.USUARIO === u.USUARIO;
    });
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
    var existe = usuarioRoles.find(function(x) {
      return x.ID_USUARIO === a.ID_USUARIO;
    });
    if (!existe) {
      insertarFila(HOJAS.USUARIO_ROL, a);
      Logger.log('✓ Rol asignado: ' + a.ID_USUARIO + ' → ' + a.ID_ROL);
    }
  });

  Logger.log('✓ Usuarios de prueba listos');
}

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
//  USUARIO ROOT — johannsavi (acceso total, salvaguarda)
//  Ejecutar UNA vez con ▶ : crearUsuarioRoot
// ════════════════════════════════════════════════════════════
function crearUsuarioRoot() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');

  // 1. Crear el ROL "ROOT" si no existe
  var hojaRol = ss.getSheetByName('ROL');
  var rolData = hojaRol.getDataRange().getValues();
  var cabRol = rolData[0];
  var iIdRol = cabRol.indexOf('ID_ROL');
  var iNomRol = cabRol.indexOf('NOMBRE');
  var rootRolId = 'ROL-ROOT';
  var existeRol = false;
  for (var r = 1; r < rolData.length; r++) {
    if (String(rolData[r][iNomRol]).toUpperCase() === 'ROOT') { existeRol = true; rootRolId = rolData[r][iIdRol]; break; }
  }
  if (!existeRol) {
    var filaRol = new Array(cabRol.length).fill('');
    filaRol[iIdRol] = rootRolId;
    filaRol[iNomRol] = 'ROOT';
    if (cabRol.indexOf('DESCRIPCION') >= 0) filaRol[cabRol.indexOf('DESCRIPCION')] = 'SUPER USUARIO - ACCESO TOTAL PERMANENTE';
    if (cabRol.indexOf('ESTADO') >= 0) filaRol[cabRol.indexOf('ESTADO')] = 'ACTIVO';
    hojaRol.appendRow(filaRol);
  }

  // 2. Crear el USUARIO johannsavi si no existe
  var hojaUsr = ss.getSheetByName('USUARIO');
  var usrData = hojaUsr.getDataRange().getValues();
  var cabUsr = usrData[0];
  var iIdUsr = cabUsr.indexOf('ID_USUARIO');
  var iUsuario = cabUsr.indexOf('USUARIO');
  var rootUsrId = 'USR-ROOT';
  var existeUsr = false;
  for (var u = 1; u < usrData.length; u++) {
    if (String(usrData[u][iUsuario]).toLowerCase() === 'johannsavi') { existeUsr = true; rootUsrId = usrData[u][iIdUsr]; break; }
  }
  if (!existeUsr) {
    var fila = new Array(cabUsr.length).fill('');
    fila[iIdUsr] = rootUsrId;
    if (cabUsr.indexOf('NOMBRES') >= 0) fila[cabUsr.indexOf('NOMBRES')] = 'JOHANN';
    if (cabUsr.indexOf('APELLIDOS') >= 0) fila[cabUsr.indexOf('APELLIDOS')] = 'SAVI';
    fila[iUsuario] = 'johannsavi';
    fila[cabUsr.indexOf('CLAVE')] = hashClave('J0h4nn1983');
    if (cabUsr.indexOf('CORREO') >= 0) fila[cabUsr.indexOf('CORREO')] = 'johann@vizvall.pe';
    if (cabUsr.indexOf('ESTADO') >= 0) fila[cabUsr.indexOf('ESTADO')] = 'ACTIVO';
    if (cabUsr.indexOf('FECHA_REGISTRO') >= 0) fila[cabUsr.indexOf('FECHA_REGISTRO')] = new Date().toISOString();
    hojaUsr.appendRow(fila);
  } else {
    // Si ya existe, asegurar su clave y estado
    for (var u2 = 1; u2 < usrData.length; u2++) {
      if (String(usrData[u2][iUsuario]).toLowerCase() === 'johannsavi') {
        hojaUsr.getRange(u2+1, cabUsr.indexOf('CLAVE')+1).setValue(hashClave('J0h4nn1983'));
        if (cabUsr.indexOf('ESTADO') >= 0) hojaUsr.getRange(u2+1, cabUsr.indexOf('ESTADO')+1).setValue('ACTIVO');
        break;
      }
    }
  }

  // 3. Asignar el rol ROOT al usuario (USUARIO_ROL)
  var hojaUR = ss.getSheetByName('USUARIO_ROL');
  var urData = hojaUR.getDataRange().getValues();
  var cabUR = urData[0];
  var iIdU = cabUR.indexOf('ID_USUARIO');
  var iIdR = cabUR.indexOf('ID_ROL');
  var yaAsignado = false;
  for (var x = 1; x < urData.length; x++) {
    if (String(urData[x][iIdU]) === rootUsrId && String(urData[x][iIdR]) === rootRolId) { yaAsignado = true; break; }
  }
  if (!yaAsignado) {
    var filaUR = new Array(cabUR.length).fill('');
    if (cabUR.indexOf('ID_USUARIO_ROL') >= 0) filaUR[cabUR.indexOf('ID_USUARIO_ROL')] = 'UR-ROOT';
    filaUR[iIdU] = rootUsrId;
    filaUR[iIdR] = rootRolId;
    hojaUR.appendRow(filaUR);
  }

  Logger.log('✓ Usuario ROOT creado: johannsavi / J0h4nn1983 (rol ROOT, acceso total)');
  return 'Usuario root johannsavi creado correctamente. Rol: ROOT (acceso total permanente).';
}

// ════════════════════════════════════════════════════════════
//  RESCATE — restaura acceso total de ROOT y ADMINISTRADOR
//  Ejecutar con ▶ : rescatarAccesos   (si algo se corrompe)
// ════════════════════════════════════════════════════════════
function rescatarAccesos() {
  // 1. Re-crear/asegurar el usuario root
  crearUsuarioRoot();

  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');

  // 2. Asegurar que el rol ADMINISTRADOR tenga TODOS los permisos
  var hojaRol = ss.getSheetByName('ROL');
  var rolData = hojaRol.getDataRange().getValues();
  var iIdRol = rolData[0].indexOf('ID_ROL');
  var iNomRol = rolData[0].indexOf('NOMBRE');
  var adminRolId = null;
  for (var r = 1; r < rolData.length; r++) {
    if (String(rolData[r][iNomRol]).toUpperCase() === 'ADMINISTRADOR') { adminRolId = rolData[r][iIdRol]; break; }
  }
  if (!adminRolId) { Logger.log('No se encontró rol ADMINISTRADOR'); return 'No hay rol ADMINISTRADOR'; }

  // Todos los permisos
  var hojaPer = ss.getSheetByName('PERMISO');
  var perData = hojaPer.getDataRange().getValues();
  var iIdPer = perData[0].indexOf('ID_PERMISO');
  var todosPermisos = [];
  for (var p = 1; p < perData.length; p++) { if (perData[p][iIdPer]) todosPermisos.push(perData[p][iIdPer]); }

  // ROL_PERMISO actuales del admin
  var hojaRP = ss.getSheetByName('ROL_PERMISO');
  var rpData = hojaRP.getDataRange().getValues();
  var cabRP = rpData[0];
  var iRpRol = cabRP.indexOf('ID_ROL');
  var iRpPer = cabRP.indexOf('ID_PERMISO');
  var yaTiene = {};
  for (var x = 1; x < rpData.length; x++) {
    if (String(rpData[x][iRpRol]) === String(adminRolId)) yaTiene[rpData[x][iRpPer]] = true;
  }

  // Agregar los permisos faltantes al admin
  var agregados = 0;
  var maxNum = rpData.length;
  for (var t = 0; t < todosPermisos.length; t++) {
    if (!yaTiene[todosPermisos[t]]) {
      var fila = new Array(cabRP.length).fill('');
      if (cabRP.indexOf('ID_ROL_PERMISO') >= 0) fila[cabRP.indexOf('ID_ROL_PERMISO')] = 'RP-FIX-' + (maxNum + agregados);
      fila[iRpRol] = adminRolId;
      fila[iRpPer] = todosPermisos[t];
      hojaRP.appendRow(fila);
      agregados++;
    }
  }

  Logger.log('✓ Rescate completo. Root asegurado. Admin: ' + agregados + ' permisos restaurados.');
  return 'Rescate OK. Usuario root listo. Admin con ' + agregados + ' permisos añadidos (acceso total).';
}

// ════════════════════════════════════════════════════════════
//  GENERAR PERMISOS POR ENLACE — recorre el menú y crea un
//  permiso por cada enlace (MODULO=grupo, ACCION=enlace)
//  Ejecutar UNA vez con ▶ : generarPermisosMenu
// ════════════════════════════════════════════════════════════
function generarPermisosMenu() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');

  // Lista de enlaces: [GRUPO, ENLACE]  (debe coincidir con el menú del index.html)
  var ENLACES = [
    ['DASHBOARD','Dashboard'],
    ['PACIENTES','Nuevo paciente'], ['PACIENTES','Lista de pacientes'], ['PACIENTES','Historial del paciente'], ['PACIENTES','Control de sesiones'],
    ['HISTORIA CLINICA','Tópico — Signos vitales'], ['HISTORIA CLINICA','Historia clínica'],
    ['PERSONAL','Nuevo médico'], ['PERSONAL','Lista de médicos'], ['PERSONAL','Médico por especialidades'], ['PERSONAL','Horarios médicos'], ['PERSONAL','Nuevo profesional'], ['PERSONAL','Lista de profesionales'], ['PERSONAL','Profesionales por área de apoyo'], ['PERSONAL','Horarios de profesionales'],
    ['SERVICIOS','Catálogo de servicios'], ['SERVICIOS','Tipos de servicio'],
    ['PAQUETES','Catálogo de paquetes'], ['PAQUETES','Tipos de paquete'],
    ['CITAS','Gestión de citas'], ['CITAS','Historial de citas'],
    ['VENTAS','Gestión de ventas'], ['VENTAS','Comprobantes'], ['VENTAS','Modos de pago'],
    ['CAJA','Apertura de caja'], ['CAJA','Caja diaria'], ['CAJA','Ingresos y egresos'], ['CAJA','Cierre de caja'], ['CAJA','Conceptos de caja'],
    ['CONTROL SESIONES','Control de sesiones'], ['CONTROL SESIONES','Sesiones activas'], ['CONTROL SESIONES','Sesiones completadas'],
    ['REPORTES','Reporte de ventas'], ['REPORTES','Reporte de citas'], ['REPORTES','Reporte de pacientes'], ['REPORTES','Reporte de médicos'], ['REPORTES','Reporte de caja'], ['REPORTES','Reporte de sesiones'], ['REPORTES','Reporte de paquetes vendidos'],
    ['COMPRAS','Proveedores'], ['COMPRAS','Registrar compra'], ['COMPRAS','Historial de compras'],
    ['INVENTARIO','Stock actual'], ['INVENTARIO','Kardex de movimientos'], ['INVENTARIO','Productos bajo stock mínimo'], ['INVENTARIO','Vencimientos'], ['INVENTARIO','Recetas de insumos'],
    ['FINANZAS','Resumen financiero'], ['FINANZAS','Reporte'], ['FINANZAS','Liquidez'], ['FINANZAS','Indicadores'], ['FINANZAS','Gastos varios'], ['FINANZAS','Obligaciones pendientes'], ['FINANZAS','Obligaciones vencidas'], ['FINANZAS','Historial de pagos'], ['FINANZAS','Honorarios del personal'],
    ['SEGURIDAD','Usuarios'], ['SEGURIDAD','Roles'], ['SEGURIDAD','Permisos'], ['SEGURIDAD','Auditoría'],
    ['CONFIGURACION','Datos de la empresa'], ['CONFIGURACION','Tipos de documento'], ['CONFIGURACION','Especialidades'], ['CONFIGURACION','Áreas de apoyo'], ['CONFIGURACION','Unidades de medida'], ['CONFIGURACION','Tipos de servicio'], ['CONFIGURACION','Tipos de paquete'], ['CONFIGURACION','Tipos de cita'], ['CONFIGURACION','Tipos de comprobante'], ['CONFIGURACION','Modos de pago'], ['CONFIGURACION','Conceptos de caja'], ['CONFIGURACION','Estados de control']
  ];

  var hojaPer = ss.getSheetByName('PERMISO');
  var perData = hojaPer.getDataRange().getValues();
  var cab = perData[0];
  var iId = cab.indexOf('ID_PERMISO');
  var iMod = cab.indexOf('MODULO');
  var iAcc = cab.indexOf('ACCION');
  var iDesc = cab.indexOf('DESCRIPCION');
  var iEst = cab.indexOf('ESTADO');

  // Permisos existentes (clave MODULO|ACCION)
  var existentes = {};
  var maxNum = 0;
  for (var r = 1; r < perData.length; r++) {
    var clave = String(perData[r][iMod]).toUpperCase() + '|' + String(perData[r][iAcc]).toUpperCase();
    existentes[clave] = true;
    var idp = String(perData[r][iId] || '');
    var num = parseInt(idp.replace(/[^0-9]/g,''), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }

  var creados = 0;
  for (var e = 0; e < ENLACES.length; e++) {
    var modulo = ENLACES[e][0];
    var accion = ENLACES[e][1];
    var clave = modulo.toUpperCase() + '|' + accion.toUpperCase();
    if (existentes[clave]) continue;
    maxNum++;
    var fila = new Array(cab.length).fill('');
    fila[iId] = 'PER-' + ('0000' + maxNum).slice(-4);
    fila[iMod] = modulo;
    fila[iAcc] = accion;
    if (iDesc >= 0) fila[iDesc] = modulo + ' · ' + accion;
    if (iEst >= 0) fila[iEst] = 'ACTIVO';
    hojaPer.appendRow(fila);
    existentes[clave] = true;
    creados++;
  }

  Logger.log('✓ Permisos de menú generados: ' + creados + ' nuevos (total enlaces: ' + ENLACES.length + ')');
  return 'Se generaron ' + creados + ' permisos nuevos. Total de enlaces mapeados: ' + ENLACES.length;
}
