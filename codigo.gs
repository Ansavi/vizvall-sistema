// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Codigo.gs
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: '1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o',
  APP_NOMBRE:     'VIZVALL',
  APP_VERSION:    '1.0.0',
  TIMEZONE:       'America/Lima',
  FECHA_FORMATO:  'dd/MM/yyyy',
  DEBUG:          false,
};

const HOJAS = {
  USUARIO:'USUARIO', ROL:'ROL', PERMISO:'PERMISO',
  ROL_PERMISO:'ROL_PERMISO', USUARIO_ROL:'USUARIO_ROL', AUDITORIA:'AUDITORIA',
  TIPO_DOCUMENTO:'TIPO_DOCUMENTO', ESPECIALIDAD:'ESPECIALIDAD',
  TSERVICIO:'TSERVICIO', TPAQUETE:'TPAQUETE', TCITA:'TCITA',
  TCOMPROBANTE:'TCOMPROBANTE', TMODO_PAGO:'TMODO_PAGO',
  TCONCEPTO_CAJA:'TCONCEPTO_CAJA', TCONTROL_SESIONES:'TCONTROL_SESIONES',
  PACIENTE:'PACIENTE', MEDICO:'MEDICO', SERVICIO:'SERVICIO',
  PAQUETE:'PAQUETE', DPAQUETE:'DPAQUETE', HORARIO_MEDICO:'HORARIO_MEDICO', HORARIO_APOYO:'HORARIO_APOYO',
  CITA:'CITA', HISTORIAL_CITA:'HISTORIAL_CITA',
  VENTA:'VENTA', DVENTA:'DVENTA', PAGO_VENTA:'PAGO_VENTA',
  CONTROL_SESIONES:'CONTROL_SESIONES', DCONTROL_SESIONES:'DCONTROL_SESIONES',
  CAJA:'CAJA', APERTURA_CAJA:'APERTURA_CAJA',
  AREA_APOYO:'AREA_APOYO', PROFESIONAL_APOYO:'PROFESIONAL_APOYO',
  MEDICO_ESPECIALIDAD:'MEDICO_ESPECIALIDAD',
  // ── Finanzas / Compras / Inventario ──
  PROVEEDOR:'PROVEEDOR', TIPO_OBLIGACION:'TIPO_OBLIGACION',
  OBLIGACION:'OBLIGACION', PAGO_OBLIGACION:'PAGO_OBLIGACION',
  PRODUCTO_INSUMO:'PRODUCTO_INSUMO', TIPO_MOVIMIENTO_INVENTARIO:'TIPO_MOVIMIENTO_INVENTARIO',
  MOVIMIENTO_INVENTARIO:'MOVIMIENTO_INVENTARIO',
  COMPRA_INSUMO:'COMPRA_INSUMO', DCOMPRA_INSUMO:'DCOMPRA_INSUMO',
  PAGO_OBLIGACION_DETALLE:'PAGO_OBLIGACION_DETALLE',
  SERVICIO_INSUMO:'SERVICIO_INSUMO', LOTE_PRODUCTO:'LOTE_PRODUCTO',
};

// ── PUNTO DE ENTRADA WEB APP ──────────────────────────────────
function doGet(e) {
  try {
    return HtmlService
      .createTemplateFromFile('Index')
      .evaluate()
      .setTitle('VIZVALL — Sistema de Gestión Médica')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<h2>Error al cargar el sistema</h2><p>' + err.message + '</p>'
    );
  }
}

// ── INCLUDE: inyecta archivos HTML como fragmentos ────────────
// Uso en Index.html: <?!= include('pac-nuevo') ?>
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── DISPATCHER CENTRAL ───────────────────────────────────────
function ejecutar(accion, params) {
  try {
    // Verificar sesión para todas las acciones excepto login
    if (accion !== 'login') {
      var sesCheck = validarSesionActual_(params);
      if (!sesCheck.ok) return respuestaError('Sesión inválida. Inicie sesión nuevamente.');
      params._sesion = sesCheck.datos;
    }

    switch (accion) {

      // ── AUTH ──
      case 'login':                return login(params.usuario, params.clave, params.rol);
      case 'logout':               return logout(params._sesion);
      case 'cambiarClave':         return cambiarClave(params);
      case 'resetearClave':        return resetearClave(params);

      // ── PACIENTE ──
      case 'listarPacientes':      return listarPacientes(params);
      case 'buscarPaciente':       return buscarPaciente(params.query);
      case 'obtenerPaciente':      return obtenerPaciente(params.ID_PACIENTE);
      case 'guardarPaciente':      return guardarPaciente(params);
      case 'actualizarPaciente':   return actualizarPaciente(params);
      case 'cambiarEstadoPaciente':return cambiarEstadoPaciente(params);
      case 'obtenerHistorialPaciente': return obtenerHistorialPaciente(params);

      // ── MÉDICO ──
      case 'listarEspecialidadesMedico': return listarEspecialidadesMedico(params);
      case 'agregarEspecialidadMedico':  return agregarEspecialidadMedico(params);
      case 'quitarEspecialidadMedico':   return quitarEspecialidadMedico(params);
      case 'listarMedicos':        return listarMedicos(params);
      case 'buscarMedico':         return buscarMedico(params.query);
      case 'obtenerMedico':        return obtenerMedico(params.ID_MEDICO);
      case 'guardarMedico':        return guardarMedico(params);
      case 'actualizarMedico':     return actualizarMedico(params);
      case 'cambiarEstadoMedico':  return cambiarEstadoMedico(params);
      case 'listarTodosHorarios':              return listarTodosHorarios(params);
      case 'listarTodasEspecialidadesMedicos': return listarTodasEspecialidadesMedicos(params);
      case 'listarHorariosMedico': return listarHorariosMedico(params);
      case 'guardarHorarioMedico': return guardarHorarioMedico(params);
      case 'eliminarHorarioMedico':return eliminarHorarioMedico(params);
      // ── HORARIOS DE APOYO ──
      case 'listarHorariosApoyo':  return listarHorariosApoyo(params);
      case 'guardarHorarioApoyo':  return guardarHorarioApoyo(params);
      case 'eliminarHorarioApoyo': return eliminarHorarioApoyo(params);
      case 'listarProfesionalesPorArea': return listarProfesionalesPorArea(params);
      case 'obtenerSlotsApoyo':    return obtenerSlotsApoyo(params);
      case 'obtenerSlotsDisponibles': return obtenerSlotsDisponibles(params);

      // ── ÁREA DE APOYO ──
      case 'listarAreaApoyo':      return listarMaestras('AREA_APOYO');
      case 'listarProfApoyo':      return listarProfesionalApoyo(params);
      case 'guardarProfApoyo':     return guardarProfesionalApoyo(params);
      case 'actualizarProfApoyo':  return actualizarProfesionalApoyo(params);

      // ── TABLAS MAESTRAS / CONFIGURACIÓN ──
      case 'obtenerEsquemaMaestra': return obtenerEsquemaMaestra(params.tabla);
      case 'actualizarMaestra':     return actualizarMaestra(params);
      case 'cambiarEstadoMaestra':  return cambiarEstadoMaestra(params);
      case 'listarMaestras':       return listarMaestras(params.tabla);
      case 'guardarMaestra':       return guardarMaestra(params);
      case 'cargarTodasMaestras':  return cargarTodasMaestras();

      // ── CITA ──
      case 'listarCitas':          return listarCitas(params);
      case 'guardarCita':          return guardarCita(params);
      case 'actualizarEstadoCita': return actualizarEstadoCita(params);
      case 'actualizarPagoCita':   return actualizarPagoCita(params);
      case 'obtenerSlotsCita':     return obtenerSlotsCita(params);
      case 'listarMedicosPorEspecialidad': return listarMedicosPorEspecialidad(params);

      // ── SERVICIOS ──
      case 'listarServicios':      return listarServicios(params);
      case 'guardarServicio':      return guardarServicio(params);
      case 'actualizarServicio':   return actualizarServicio(params);
      case 'listarCitasPendientesPago': return listarCitasPendientesPago(params);

      // ── PAQUETES ──
      case 'listarPaquetes':       return listarPaquetes(params);
      case 'guardarPaquete':       return guardarPaquete(params);
      case 'actualizarPaquete':    return actualizarPaquete(params);
      case 'obtenerHistorialCita': return obtenerHistorialCita(params);

      // ── VENTA ──
      case 'guardarVenta':         return guardarVenta(params);
      // ── RECETAS (insumos por servicio) ──
      case 'listarRecetaServicio': return listarRecetaServicio(params);
      case 'agregarInsumoReceta':  return agregarInsumoReceta(params);
      case 'quitarInsumoReceta':   return quitarInsumoReceta(params);
      case 'registrarPagoVenta':   return registrarPagoVenta(params);
      case 'listarPagosVenta':     return listarPagosVenta(params);
      case 'listarVentas':         return listarVentas(params);
      case 'obtenerDetalleVenta':  return obtenerDetalleVenta(params);
      case 'anularVenta':          return anularVenta(params);
      case 'registrarComprobante': return registrarComprobante(params);
      case 'listarCitasDePaciente': return listarCitasDePaciente(params);

      // ── CAJA ──
      case 'estadoCaja':           return estadoCaja(params);
      case 'abrirCaja':            return abrirCaja(params);
      case 'listarCaja':           return listarCaja(params);
      case 'registrarMovimiento':  return registrarMovimiento(params);
      case 'cerrarCaja':           return cerrarCaja(params);
      case 'listarAperturas':      return listarAperturas(params);

      // ── HISTORIALES ──
      case 'historialPaciente':    return historialPaciente(params);
      case 'historialCitas':       return historialCitas(params);
      case 'controlSesiones':      return controlSesiones(params);

      // ── SESIONES ──
      case 'listarSesiones':       return listarSesiones(params);
      case 'crearControlSesiones': return crearControlSesiones(params);
      case 'registrarSesion':      return registrarSesion(params);
      case 'obtenerDetalleControl':return obtenerDetalleControl(params);
      case 'actualizarControl':      return actualizarControl(params);

      // ── PROVEEDORES ──
      case 'listarProveedores':    return listarProveedores(params);
      case 'guardarProveedor':     return guardarProveedor(params);
      case 'eliminarProveedor':    return eliminarProveedor(params);

      // ── INVENTARIO ──
      case 'listarProductos':      return listarProductos(params);
      case 'guardarProducto':      return guardarProducto(params);
      case 'registrarMovInv':      return registrarMovimiento_inv(params);
      case 'listarKardex':         return listarKardex(params);
      case 'listarLotes':          return listarLotes(params);

      // ── FINANZAS (obligaciones / pagos) ──
      case 'listarObligaciones':   return listarObligaciones(params);
      case 'guardarObligacion':    return guardarObligacion(params);
      case 'registrarPagoObligacion': return registrarPagoObligacion(params);
      case 'listarPagosObligacion':   return listarPagosObligacion(params);
      case 'anularObligacion':        return anularObligacion(params);

      // ── COMPRAS ──
      case 'guardarCompra':        return guardarCompra(params);
      case 'listarCompras':        return listarCompras(params);
      case 'obtenerDetalleCompra': return obtenerDetalleCompra(params);
      case 'historialPreciosCompra': return historialPreciosCompra(params);
      case 'anularCompra':         return anularCompra(params);

      // ── DASHBOARD ──
      case 'dashboardData':        return dashboardData(params);

      // ── REPORTES (módulo reportes.gs, prefijo rpt) ──
      case 'rptVentas':            return rptVentas(params);
      case 'rptCitas':             return rptCitas(params);
      case 'rptPacientes':         return rptPacientes(params);
      case 'rptMedicos':           return rptMedicos(params);
      case 'rptCaja':              return rptCaja(params);
      case 'rptSesiones':          return rptSesiones(params);
      case 'rptPaquetes':          return rptPaquetes(params);

      // ── SEGURIDAD ──
      case 'listarUsuarios':       return listarUsuarios(params);
      case 'guardarUsuario':       return guardarUsuario(params);
      case 'actualizarUsuario':    return actualizarUsuario(params);
      case 'cambiarEstadoUsuario': return cambiarEstadoUsuario(params);
      case 'listarRoles':          return listarRoles(params);
      case 'guardarRol':           return guardarRol(params);
      case 'listarPermisos':       return listarPermisos(params);
      case 'guardarPermiso':       return guardarPermiso(params);
      case 'obtenerPermisosDeRol': return obtenerPermisosDeRol(params);
      case 'guardarPermisosRol':   return guardarPermisosRol(params);
      case 'asignarPermisoRol':    return asignarPermisoRol(params);
      case 'retirarPermisoRol':    return retirarPermisoRol(params);
      case 'listarAuditoria':      return listarAuditoria(params);

      default:
        return respuestaError('Acción no reconocida: ' + accion);
    }

  } catch (err) {
    if (CONFIG.DEBUG) Logger.log('ERROR [' + accion + ']: ' + err.message);
    return respuestaError('Error interno: ' + err.message);
  }
}

// ── VALIDAR SESIÓN ────────────────────────────────────────────
function validarSesionActual_(params) {
  if (!params) return { ok: false };

  // 1. Token real de Auth.gs
  if (params.token && params.token !== '') {
    try {
      var check = verificarToken(params.token);
      if (check.ok) return check;
    } catch(e) {}
  }

  // 2. Sesión con usuario + rol (viene del login)
  if (params.usuario && params.rol) {
    try {
      var usuarios = leerHoja(HOJAS.USUARIO);
      var usr = null;
      for (var i = 0; i < usuarios.length; i++) {
        if (String(usuarios[i].USUARIO).toLowerCase() === String(params.usuario).toLowerCase()) {
          usr = usuarios[i];
          break;
        }
      }
      return {
        ok: true,
        datos: {
          ID_USUARIO: usr ? usr.ID_USUARIO : 'USR-000',
          NOMBRES:    usr ? usr.NOMBRES    : params.usuario,
          APELLIDOS:  usr ? usr.APELLIDOS  : '',
          USUARIO:    params.usuario,
          ROL:        params.rol,
          TOKEN:      params.token || '',
        }
      };
    } catch(e) {
      return {
        ok: true,
        datos: {
          ID_USUARIO: 'USR-000',
          USUARIO:    params.usuario,
          ROL:        params.rol,
          TOKEN:      params.token || '',
        }
      };
    }
  }

  return { ok: false };
}

// ── TEST TEMPORAL ─────────────────────────────────────────────
function testSesion() {
  Logger.log('INICIO TEST');
  
  try {
    var params = { usuario: 'admin', rol: 'ADMINISTRADOR', token: '' };
    Logger.log('params OK');
    
    var usuarios = leerHoja(HOJAS.USUARIO);
    Logger.log('Total usuarios: ' + usuarios.length);
    
    var result = validarSesionActual_(params);
    Logger.log('ok: ' + result.ok);
    if (result.datos) {
      Logger.log('ROL: ' + result.datos.ROL);
      Logger.log('USUARIO: ' + result.datos.USUARIO);
    }
  } catch(e) {
    Logger.log('ERROR: ' + e.message);
  }
  
  Logger.log('FIN TEST');
}

function testEjecutar() {
  var params = {
    usuario: 'admin',
    rol: 'ADMINISTRADOR', 
    token: '',
    estado: '',
    limite: 10
  };
  var result = ejecutar('listarPacientes', params);
  Logger.log(JSON.stringify(result));
}
