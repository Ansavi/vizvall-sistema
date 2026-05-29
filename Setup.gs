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
  { nombre: 'TCONTROL_SESIONES', columnas: [
    'ID_TCONTROL','NOMBRE','DESCRIPCION','ESTADO'
  ]},

  // ── ENTIDADES PRINCIPALES ──
  { nombre: 'PACIENTE', columnas: [
    'ID_PACIENTE','ID_TIPO_DOCUMENTO','NUMERO_DOCUMENTO',
    'NOMBRES','APELLIDOS','FECHA_NACIMIENTO','SEXO',
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
    'NUMERO_CMP','ID_ESPECIALIDAD',
    'TELEFONO','EMAIL','ESTADO',
    'OBSERVACIONES','FECHA_REGISTRO'
  ]},
  { nombre: 'SERVICIO', columnas: [
    'ID_SERVICIO','ID_ESPECIALIDAD','ID_TSERVICIO',
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
    'ID_HORARIO','ID_MEDICO','DIA_SEMANA',
    'HORA_INICIO','HORA_FIN','INTERVALO_MIN','ESTADO'
  ]},

  // ── TRANSACCIONALES ──
  { nombre: 'CITA', columnas: [
    'ID_CITA','ID_PACIENTE','ID_MEDICO','ID_ESPECIALIDAD',
    'FECHA_CITA','HORA_CITA','MOTIVO_CONSULTA','ESTADO_CITA',
    'ID_TCITA','CONSULTORIO','OBSERVACIONES','FECHA_REGISTRO'
  ]},
  { nombre: 'HISTORIAL_CITA', columnas: [
    'ID_HISTORIAL','ID_CITA','ESTADO_ANTERIOR',
    'ESTADO_NUEVO','FECHA','ID_USUARIO','OBSERVACION'
  ]},
  { nombre: 'VENTA', columnas: [
    'ID_VENTA','FECHA_VENTA','ID_TCOMPROBANTE',
    'NUMERO_COMPROBANTE','ID_PACIENTE','ID_TMODO_PAGO',
    'SUBTOTAL','DESCUENTO','IGV','TOTAL','ESTADO','OBSERVACIONES'
  ]},
  { nombre: 'DVENTA', columnas: [
    'ID_DVENTA','ID_VENTA','ID_SERVICIO',
    'CANTIDAD','PRECIO_UNITARIO','DESCUENTO','SUBTOTAL'
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
  { nombre: 'CAJADIARIA', columnas: [
    'ID_CAJA','FECHA','HORA','TURNO','TIPO',
    'ID_TCONCEPTO_CAJA','ID_VENTA','MODO_PAGO',
    'MONTO','USUARIO','ESTADO','OBSERVACIONES'
  ]},
];

// ── FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ─────────────────
/**
 * Crea todas las hojas con sus cabeceras y carga datos de ejemplo.
 * Ejecutar UNA SOLA VEZ al iniciar el proyecto.
 */
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
    { ID_ESPECIALIDAD: 'ESP-001', ESPECIALIDAD: 'MEDICINA GENERAL',   DESCRIPCION: 'ATENCION PRIMARIA Y DIAGNOSTICO GENERAL',         ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-002', ESPECIALIDAD: 'CARDIOLOGIA',         DESCRIPCION: 'ATENCION EN ENFERMEDADES DEL CORAZON',            ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-003', ESPECIALIDAD: 'PEDIATRIA',           DESCRIPCION: 'ATENCION MEDICA A NINOS Y ADOLESCENTES',          ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-004', ESPECIALIDAD: 'GINECOLOGIA',         DESCRIPCION: 'SALUD REPRODUCTIVA Y FEMENINA',                  ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-005', ESPECIALIDAD: 'LABORATORIO CLINICO', DESCRIPCION: 'ANALISIS Y EXAMENES DE LABORATORIO',              ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-006', ESPECIALIDAD: 'TOPICO ENFERMERIA',   DESCRIPCION: 'CURACIONES INYECTABLES Y PROCEDIMIENTOS MENORES', ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-007', ESPECIALIDAD: 'FISIOTERAPIA',        DESCRIPCION: 'REHABILITACION FISICA Y TERAPIAS',               ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
    { ID_ESPECIALIDAD: 'ESP-008', ESPECIALIDAD: 'NUTRICION',           DESCRIPCION: 'ALIMENTACION Y DIETETICA CLINICA',               ESTADO: 'ACTIVO', FECHA_REGISTRO: fecha },
  ]);

  // ── TSERVICIO ──
  _insertarSiVacia('TSERVICIO', [
    { ID_TSERVICIO: 'TSV-001', NOMBRE: 'CONSULTA',      ESTADO: 'ACTIVO' },
    { ID_TSERVICIO: 'TSV-002', NOMBRE: 'ANALISIS',      ESTADO: 'ACTIVO' },
    { ID_TSERVICIO: 'TSV-003', NOMBRE: 'PROCEDIMIENTO', ESTADO: 'ACTIVO' },
    { ID_TSERVICIO: 'TSV-004', NOMBRE: 'TERAPIA',       ESTADO: 'ACTIVO' },
  ]);

  // ── TPAQUETE ──
  _insertarSiVacia('TPAQUETE', [
    { ID_TPAQUETE: 'TPQ-001', NOMBRE: 'GENERAL',    ESTADO: 'ACTIVO' },
    { ID_TPAQUETE: 'TPQ-002', NOMBRE: 'LABORATORIO',ESTADO: 'ACTIVO' },
    { ID_TPAQUETE: 'TPQ-003', NOMBRE: 'PREMIUM VIP',ESTADO: 'ACTIVO' },
    { ID_TPAQUETE: 'TPQ-004', NOMBRE: 'PREVENTIVO', ESTADO: 'ACTIVO' },
  ]);

  // ── TCITA ──
  _insertarSiVacia('TCITA', [
    { ID_TCITA: 'TCT-001', NOMBRE: 'PRIMERA VEZ',  ESTADO: 'ACTIVO' },
    { ID_TCITA: 'TCT-002', NOMBRE: 'SEGUIMIENTO',  ESTADO: 'ACTIVO' },
    { ID_TCITA: 'TCT-003', NOMBRE: 'EMERGENCIA',   ESTADO: 'ACTIVO' },
    { ID_TCITA: 'TCT-004', NOMBRE: 'CONTROL',      ESTADO: 'ACTIVO' },
  ]);

  // ── TCOMPROBANTE ──
  _insertarSiVacia('TCOMPROBANTE', [
    { ID_TCOMPROBANTE: 'TCB-001', NOMBRE: 'BOLETA DE VENTA', SERIE: 'B001', ESTADO: 'ACTIVO' },
    { ID_TCOMPROBANTE: 'TCB-002', NOMBRE: 'FACTURA',         SERIE: 'F001', ESTADO: 'ACTIVO' },
    { ID_TCOMPROBANTE: 'TCB-003', NOMBRE: 'TICKET',          SERIE: 'T001', ESTADO: 'ACTIVO' },
  ]);

  // ── TMODO_PAGO ──
  _insertarSiVacia('TMODO_PAGO', [
    { ID_TMODO_PAGO: 'TMP-001', NOMBRE: 'EFECTIVO',             ESTADO: 'ACTIVO' },
    { ID_TMODO_PAGO: 'TMP-002', NOMBRE: 'TARJETA DEBITO',       ESTADO: 'ACTIVO' },
    { ID_TMODO_PAGO: 'TMP-003', NOMBRE: 'TARJETA CREDITO',      ESTADO: 'ACTIVO' },
    { ID_TMODO_PAGO: 'TMP-004', NOMBRE: 'YAPE / PLIN',          ESTADO: 'ACTIVO' },
    { ID_TMODO_PAGO: 'TMP-005', NOMBRE: 'TRANSFERENCIA',        ESTADO: 'ACTIVO' },
  ]);

  // ── TCONCEPTO_CAJA ──
  _insertarSiVacia('TCONCEPTO_CAJA', [
    { ID_TCONCEPTO_CAJA: 'TCC-001', NOMBRE: 'VENTA DE SERVICIOS', TIPO: 'INGRESO', ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-002', NOMBRE: 'PAQUETES VENDIDOS',  TIPO: 'INGRESO', ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-003', NOMBRE: 'OTROS INGRESOS',     TIPO: 'INGRESO', ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-004', NOMBRE: 'COMPRA INSUMOS',     TIPO: 'EGRESO',  ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-005', NOMBRE: 'PAGO SERVICIOS',     TIPO: 'EGRESO',  ESTADO: 'ACTIVO' },
    { ID_TCONCEPTO_CAJA: 'TCC-006', NOMBRE: 'GASTOS VARIOS',      TIPO: 'EGRESO',  ESTADO: 'ACTIVO' },
  ]);

  // ── TCONTROL_SESIONES ──
  _insertarSiVacia('TCONTROL_SESIONES', [
    { ID_TCONTROL: 'TCS-001', NOMBRE: 'FISIOTERAPIA', DESCRIPCION: 'SESIONES DE REHABILITACION FISICA', ESTADO: 'ACTIVO' },
    { ID_TCONTROL: 'TCS-002', NOMBRE: 'NUTRICION',    DESCRIPCION: 'SESIONES DE SEGUIMIENTO NUTRICIONAL', ESTADO: 'ACTIVO' },
    { ID_TCONTROL: 'TCS-003', NOMBRE: 'PSICOLOGIA',   DESCRIPCION: 'SESIONES DE TERAPIA PSICOLOGICA', ESTADO: 'ACTIVO' },
    { ID_TCONTROL: 'TCS-004', NOMBRE: 'OTRO',         DESCRIPCION: 'OTRO TIPO DE CONTROL', ESTADO: 'ACTIVO' },
  ]);

  // ── ROL ──
  _insertarSiVacia('ROL', [
    { ID_ROL: 'ROL-001', NOMBRE: 'ADMINISTRADOR', DESCRIPCION: 'ACCESO TOTAL AL SISTEMA',          ESTADO: 'ACTIVO' },
    { ID_ROL: 'ROL-002', NOMBRE: 'CAJERO',        DESCRIPCION: 'GESTION DE VENTAS Y CAJA',         ESTADO: 'ACTIVO' },
    { ID_ROL: 'ROL-003', NOMBRE: 'MEDICO',        DESCRIPCION: 'AGENDA CITAS Y PACIENTES',         ESTADO: 'ACTIVO' },
    { ID_ROL: 'ROL-004', NOMBRE: 'RECEPCION',     DESCRIPCION: 'REGISTRO DE PACIENTES Y CITAS',    ESTADO: 'ACTIVO' },
  ]);

  // ── USUARIO (admin inicial con clave hasheada) ──
  _insertarSiVacia('USUARIO', [
    {
      ID_USUARIO:    'USR-001',
      NOMBRES:       'ADMINISTRADOR',
      APELLIDOS:     'GENERAL',
      USUARIO:       'admin',
      CLAVE:         hashClave('admin123'),   // SHA-256
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
      ID_USUARIO:'USR-002', NOMBRES:'MARIA', APELLIDOS:'PEREZ',
      USUARIO:'cajero', CLAVE:hashClave('cajero123'),
      CORREO:'cajero@vizvall.pe', TELEFONO:'', FOTO:'',
      ESTADO:'ACTIVO', ULTIMO_ACCESO:'', FECHA_REGISTRO:fecha
    },
    {
      ID_USUARIO:'USR-003', NOMBRES:'JUAN CARLOS', APELLIDOS:'TORRES',
      USUARIO:'drtorres', CLAVE:hashClave('medico123'),
      CORREO:'drtorres@vizvall.pe', TELEFONO:'', FOTO:'',
      ESTADO:'ACTIVO', ULTIMO_ACCESO:'', FECHA_REGISTRO:fecha
    },
    {
      ID_USUARIO:'USR-004', NOMBRES:'ANA', APELLIDOS:'MARTINEZ',
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
    { ID_USUARIO_ROL:'UR-002', ID_USUARIO:'USR-002', ID_ROL:'ROL-002' }, // cajero
    { ID_USUARIO_ROL:'UR-003', ID_USUARIO:'USR-003', ID_ROL:'ROL-003' }, // médico
    { ID_USUARIO_ROL:'UR-004', ID_USUARIO:'USR-004', ID_ROL:'ROL-004' }, // recepción
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
    { ID_PERMISO:'PER-001', MODULO:'DASHBOARD',      ACCION:'VER',       DESCRIPCION:'Ver dashboard principal',            ESTADO:'ACTIVO' },
    // PACIENTES
    { ID_PERMISO:'PER-010', MODULO:'PACIENTES',      ACCION:'VER',       DESCRIPCION:'Ver lista de pacientes',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-011', MODULO:'PACIENTES',      ACCION:'CREAR',     DESCRIPCION:'Registrar nuevo paciente',            ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-012', MODULO:'PACIENTES',      ACCION:'EDITAR',    DESCRIPCION:'Editar datos del paciente',           ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-013', MODULO:'PACIENTES',      ACCION:'ELIMINAR',  DESCRIPCION:'Cambiar estado del paciente',         ESTADO:'ACTIVO' },
    // MEDICOS
    { ID_PERMISO:'PER-020', MODULO:'MEDICOS',        ACCION:'VER',       DESCRIPCION:'Ver lista de médicos',                ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-021', MODULO:'MEDICOS',        ACCION:'CREAR',     DESCRIPCION:'Registrar nuevo médico',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-022', MODULO:'MEDICOS',        ACCION:'EDITAR',    DESCRIPCION:'Editar datos del médico',             ESTADO:'ACTIVO' },
    // SERVICIOS
    { ID_PERMISO:'PER-030', MODULO:'SERVICIOS',      ACCION:'VER',       DESCRIPCION:'Ver lista de servicios',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-031', MODULO:'SERVICIOS',      ACCION:'CREAR',     DESCRIPCION:'Registrar nuevo servicio',            ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-032', MODULO:'SERVICIOS',      ACCION:'EDITAR',    DESCRIPCION:'Editar servicio',                     ESTADO:'ACTIVO' },
    // PAQUETES
    { ID_PERMISO:'PER-040', MODULO:'PAQUETES',       ACCION:'VER',       DESCRIPCION:'Ver lista de paquetes',               ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-041', MODULO:'PAQUETES',       ACCION:'CREAR',     DESCRIPCION:'Registrar nuevo paquete',             ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-042', MODULO:'PAQUETES',       ACCION:'EDITAR',    DESCRIPCION:'Editar paquete',                      ESTADO:'ACTIVO' },
    // CITAS
    { ID_PERMISO:'PER-050', MODULO:'CITAS',          ACCION:'VER',       DESCRIPCION:'Ver agenda de citas',                 ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-051', MODULO:'CITAS',          ACCION:'CREAR',     DESCRIPCION:'Registrar nueva cita',                ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-052', MODULO:'CITAS',          ACCION:'EDITAR',    DESCRIPCION:'Editar y reprogramar cita',           ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-053', MODULO:'CITAS',          ACCION:'CANCELAR',  DESCRIPCION:'Cancelar cita',                       ESTADO:'ACTIVO' },
    // VENTAS
    { ID_PERMISO:'PER-060', MODULO:'VENTAS',         ACCION:'VER',       DESCRIPCION:'Ver historial de ventas',             ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-061', MODULO:'VENTAS',         ACCION:'CREAR',     DESCRIPCION:'Registrar nueva venta',               ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-062', MODULO:'VENTAS',         ACCION:'ANULAR',    DESCRIPCION:'Anular venta registrada',             ESTADO:'ACTIVO' },
    // CAJA
    { ID_PERMISO:'PER-070', MODULO:'CAJA',           ACCION:'VER',       DESCRIPCION:'Ver movimientos de caja',             ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-071', MODULO:'CAJA',           ACCION:'CREAR',     DESCRIPCION:'Registrar movimiento de caja',        ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-072', MODULO:'CAJA',           ACCION:'CERRAR',    DESCRIPCION:'Realizar cierre de caja',             ESTADO:'ACTIVO' },
    // SESIONES
    { ID_PERMISO:'PER-080', MODULO:'SESIONES',       ACCION:'VER',       DESCRIPCION:'Ver control de sesiones',             ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-081', MODULO:'SESIONES',       ACCION:'CREAR',     DESCRIPCION:'Crear plan de sesiones',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-082', MODULO:'SESIONES',       ACCION:'REGISTRAR', DESCRIPCION:'Registrar sesión realizada',          ESTADO:'ACTIVO' },
    // REPORTES
    { ID_PERMISO:'PER-090', MODULO:'REPORTES',       ACCION:'VER',       DESCRIPCION:'Ver reportes del sistema',            ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-091', MODULO:'REPORTES',       ACCION:'EXPORTAR',  DESCRIPCION:'Exportar reportes',                   ESTADO:'ACTIVO' },
    // SEGURIDAD
    { ID_PERMISO:'PER-100', MODULO:'SEGURIDAD',      ACCION:'VER',       DESCRIPCION:'Ver usuarios y roles',                ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-101', MODULO:'SEGURIDAD',      ACCION:'CREAR',     DESCRIPCION:'Crear usuarios y roles',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-102', MODULO:'SEGURIDAD',      ACCION:'EDITAR',    DESCRIPCION:'Editar usuarios y roles',             ESTADO:'ACTIVO' },
    // CONFIGURACION
    { ID_PERMISO:'PER-110', MODULO:'CONFIGURACION',  ACCION:'VER',       DESCRIPCION:'Ver tablas de configuración',         ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-111', MODULO:'CONFIGURACION',  ACCION:'EDITAR',    DESCRIPCION:'Editar tablas de configuración',      ESTADO:'ACTIVO' },
  ]);

  // ── ROL_PERMISO ──
  // ADMINISTRADOR (ROL-001) → TODOS los permisos
  // CAJERO        (ROL-002) → Dashboard, Ventas, Caja, Reportes
  // MEDICO        (ROL-003) → Dashboard, Pacientes(ver), Citas, Sesiones, Reportes
  // RECEPCION     (ROL-004) → Dashboard, Pacientes, Médicos(ver), Citas
  _insertarSiVacia('ROL_PERMISO', [
    // ── ADMINISTRADOR: todos ──
    { ID_ROL_PERMISO:'RP-001', ID_ROL:'ROL-001', ID_PERMISO:'PER-001' },
    { ID_ROL_PERMISO:'RP-002', ID_ROL:'ROL-001', ID_PERMISO:'PER-010' },
    { ID_ROL_PERMISO:'RP-003', ID_ROL:'ROL-001', ID_PERMISO:'PER-011' },
    { ID_ROL_PERMISO:'RP-004', ID_ROL:'ROL-001', ID_PERMISO:'PER-012' },
    { ID_ROL_PERMISO:'RP-005', ID_ROL:'ROL-001', ID_PERMISO:'PER-013' },
    { ID_ROL_PERMISO:'RP-006', ID_ROL:'ROL-001', ID_PERMISO:'PER-020' },
    { ID_ROL_PERMISO:'RP-007', ID_ROL:'ROL-001', ID_PERMISO:'PER-021' },
    { ID_ROL_PERMISO:'RP-008', ID_ROL:'ROL-001', ID_PERMISO:'PER-022' },
    { ID_ROL_PERMISO:'RP-009', ID_ROL:'ROL-001', ID_PERMISO:'PER-030' },
    { ID_ROL_PERMISO:'RP-010', ID_ROL:'ROL-001', ID_PERMISO:'PER-031' },
    { ID_ROL_PERMISO:'RP-011', ID_ROL:'ROL-001', ID_PERMISO:'PER-032' },
    { ID_ROL_PERMISO:'RP-012', ID_ROL:'ROL-001', ID_PERMISO:'PER-040' },
    { ID_ROL_PERMISO:'RP-013', ID_ROL:'ROL-001', ID_PERMISO:'PER-041' },
    { ID_ROL_PERMISO:'RP-014', ID_ROL:'ROL-001', ID_PERMISO:'PER-042' },
    { ID_ROL_PERMISO:'RP-015', ID_ROL:'ROL-001', ID_PERMISO:'PER-050' },
    { ID_ROL_PERMISO:'RP-016', ID_ROL:'ROL-001', ID_PERMISO:'PER-051' },
    { ID_ROL_PERMISO:'RP-017', ID_ROL:'ROL-001', ID_PERMISO:'PER-052' },
    { ID_ROL_PERMISO:'RP-018', ID_ROL:'ROL-001', ID_PERMISO:'PER-053' },
    { ID_ROL_PERMISO:'RP-019', ID_ROL:'ROL-001', ID_PERMISO:'PER-060' },
    { ID_ROL_PERMISO:'RP-020', ID_ROL:'ROL-001', ID_PERMISO:'PER-061' },
    { ID_ROL_PERMISO:'RP-021', ID_ROL:'ROL-001', ID_PERMISO:'PER-062' },
    { ID_ROL_PERMISO:'RP-022', ID_ROL:'ROL-001', ID_PERMISO:'PER-070' },
    { ID_ROL_PERMISO:'RP-023', ID_ROL:'ROL-001', ID_PERMISO:'PER-071' },
    { ID_ROL_PERMISO:'RP-024', ID_ROL:'ROL-001', ID_PERMISO:'PER-072' },
    { ID_ROL_PERMISO:'RP-025', ID_ROL:'ROL-001', ID_PERMISO:'PER-080' },
    { ID_ROL_PERMISO:'RP-026', ID_ROL:'ROL-001', ID_PERMISO:'PER-081' },
    { ID_ROL_PERMISO:'RP-027', ID_ROL:'ROL-001', ID_PERMISO:'PER-082' },
    { ID_ROL_PERMISO:'RP-028', ID_ROL:'ROL-001', ID_PERMISO:'PER-090' },
    { ID_ROL_PERMISO:'RP-029', ID_ROL:'ROL-001', ID_PERMISO:'PER-091' },
    { ID_ROL_PERMISO:'RP-030', ID_ROL:'ROL-001', ID_PERMISO:'PER-100' },
    { ID_ROL_PERMISO:'RP-031', ID_ROL:'ROL-001', ID_PERMISO:'PER-101' },
    { ID_ROL_PERMISO:'RP-032', ID_ROL:'ROL-001', ID_PERMISO:'PER-102' },
    { ID_ROL_PERMISO:'RP-033', ID_ROL:'ROL-001', ID_PERMISO:'PER-110' },
    { ID_ROL_PERMISO:'RP-034', ID_ROL:'ROL-001', ID_PERMISO:'PER-111' },

    // ── CAJERO: Dashboard, Ventas, Caja, Reportes ──
    { ID_ROL_PERMISO:'RP-035', ID_ROL:'ROL-002', ID_PERMISO:'PER-001' },
    { ID_ROL_PERMISO:'RP-036', ID_ROL:'ROL-002', ID_PERMISO:'PER-060' },
    { ID_ROL_PERMISO:'RP-037', ID_ROL:'ROL-002', ID_PERMISO:'PER-061' },
    { ID_ROL_PERMISO:'RP-038', ID_ROL:'ROL-002', ID_PERMISO:'PER-062' },
    { ID_ROL_PERMISO:'RP-039', ID_ROL:'ROL-002', ID_PERMISO:'PER-070' },
    { ID_ROL_PERMISO:'RP-040', ID_ROL:'ROL-002', ID_PERMISO:'PER-071' },
    { ID_ROL_PERMISO:'RP-041', ID_ROL:'ROL-002', ID_PERMISO:'PER-072' },
    { ID_ROL_PERMISO:'RP-042', ID_ROL:'ROL-002', ID_PERMISO:'PER-090' },
    { ID_ROL_PERMISO:'RP-043', ID_ROL:'ROL-002', ID_PERMISO:'PER-091' },

    // ── MEDICO: Dashboard, Pacientes(ver), Citas, Sesiones, Reportes ──
    { ID_ROL_PERMISO:'RP-044', ID_ROL:'ROL-003', ID_PERMISO:'PER-001' },
    { ID_ROL_PERMISO:'RP-045', ID_ROL:'ROL-003', ID_PERMISO:'PER-010' },
    { ID_ROL_PERMISO:'RP-046', ID_ROL:'ROL-003', ID_PERMISO:'PER-050' },
    { ID_ROL_PERMISO:'RP-047', ID_ROL:'ROL-003', ID_PERMISO:'PER-051' },
    { ID_ROL_PERMISO:'RP-048', ID_ROL:'ROL-003', ID_PERMISO:'PER-052' },
    { ID_ROL_PERMISO:'RP-049', ID_ROL:'ROL-003', ID_PERMISO:'PER-053' },
    { ID_ROL_PERMISO:'RP-050', ID_ROL:'ROL-003', ID_PERMISO:'PER-080' },
    { ID_ROL_PERMISO:'RP-051', ID_ROL:'ROL-003', ID_PERMISO:'PER-081' },
    { ID_ROL_PERMISO:'RP-052', ID_ROL:'ROL-003', ID_PERMISO:'PER-082' },
    { ID_ROL_PERMISO:'RP-053', ID_ROL:'ROL-003', ID_PERMISO:'PER-090' },

    // ── RECEPCION: Dashboard, Pacientes, Medicos(ver), Citas ──
    { ID_ROL_PERMISO:'RP-054', ID_ROL:'ROL-004', ID_PERMISO:'PER-001' },
    { ID_ROL_PERMISO:'RP-055', ID_ROL:'ROL-004', ID_PERMISO:'PER-010' },
    { ID_ROL_PERMISO:'RP-056', ID_ROL:'ROL-004', ID_PERMISO:'PER-011' },
    { ID_ROL_PERMISO:'RP-057', ID_ROL:'ROL-004', ID_PERMISO:'PER-012' },
    { ID_ROL_PERMISO:'RP-058', ID_ROL:'ROL-004', ID_PERMISO:'PER-020' },
    { ID_ROL_PERMISO:'RP-059', ID_ROL:'ROL-004', ID_PERMISO:'PER-050' },
    { ID_ROL_PERMISO:'RP-060', ID_ROL:'ROL-004', ID_PERMISO:'PER-051' },
    { ID_ROL_PERMISO:'RP-061', ID_ROL:'ROL-004', ID_PERMISO:'PER-052' },
  ]);

  // ── USUARIO_ROL ──
  _insertarSiVacia('USUARIO_ROL', [
    { ID_USUARIO_ROL:'UR-001', ID_USUARIO:'USR-001', ID_ROL:'ROL-001' }, // admin → ADMINISTRADOR
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
