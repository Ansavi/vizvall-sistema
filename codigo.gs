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
  HONORARIO_CONFIG:'HONORARIO_CONFIG', PAGO_HONORARIO:'PAGO_HONORARIO',
  ASISTENCIA_PERSONAL:'ASISTENCIA_PERSONAL',
  COMISION_VENTA:'COMISION_VENTA',
  FICHA_CLINICA:'FICHA_CLINICA',
  ATENCION_MEDICA:'ATENCION_MEDICA', RECETA_MEDICA:'RECETA_MEDICA', RESULTADO_APOYO:'RESULTADO_APOYO',
  DESCANSO_MEDICO:'DESCANSO_MEDICO',
  CONFIG_EMPRESA:'CONFIG_EMPRESA',
  UNIDAD_MEDIDA:'UNIDAD_MEDIDA',
  PACIENTE:'PACIENTE', MEDICO:'MEDICO', SERVICIO:'SERVICIO',
  PAQUETE:'PAQUETE', DPAQUETE:'DPAQUETE', HORARIO_MEDICO:'HORARIO_MEDICO', HORARIO_APOYO:'HORARIO_APOYO',
  CITA:'CITA', HISTORIAL_CITA:'HISTORIAL_CITA',
  VENTA:'VENTA', DVENTA:'DVENTA', PAGO_VENTA:'PAGO_VENTA',
  CONTROL_SESIONES:'CONTROL_SESIONES', DCONTROL_SESIONES:'DCONTROL_SESIONES',
  CAJA:'CAJA', APERTURA_CAJA:'APERTURA_CAJA',
  CAJA_CHICA:'CAJA_CHICA', APERTURA_CC:'APERTURA_CC', CONCEPTO_CC:'CONCEPTO_CC',
  AREA_APOYO:'AREA_APOYO', PROFESIONAL_APOYO:'PROFESIONAL_APOYO',
  MEDICO_ESPECIALIDAD:'MEDICO_ESPECIALIDAD', MEDICO_AREA_APOYO:'MEDICO_AREA_APOYO',
  // ── Finanzas / Compras / Inventario ──
  PROVEEDOR:'PROVEEDOR', TIPO_OBLIGACION:'TIPO_OBLIGACION',
  OBLIGACION:'OBLIGACION', PAGO_OBLIGACION:'PAGO_OBLIGACION',
  PRODUCTO_INSUMO:'PRODUCTO_INSUMO', TIPO_MOVIMIENTO_INVENTARIO:'TIPO_MOVIMIENTO_INVENTARIO',
  MOVIMIENTO_INVENTARIO:'MOVIMIENTO_INVENTARIO',
  COMPRA_INSUMO:'COMPRA_INSUMO', DCOMPRA_INSUMO:'DCOMPRA_INSUMO',
  PAGO_OBLIGACION_DETALLE:'PAGO_OBLIGACION_DETALLE',
  SERVICIO_INSUMO:'SERVICIO_INSUMO', PAQUETE_INSUMO:'PAQUETE_INSUMO', LOTE_PRODUCTO:'LOTE_PRODUCTO',
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
      case 'importarPacientesMasivo': return importarPacientesMasivo(params);
      case 'actualizarPaciente':   return actualizarPaciente(params);
      case 'cambiarEstadoPaciente':return cambiarEstadoPaciente(params);
      case 'obtenerHistorialPaciente': return obtenerHistorialPaciente(params);

      // ── MÉDICO ──
      case 'listarEspecialidadesMedico': return listarEspecialidadesMedico(params);
      case 'agregarEspecialidadMedico':  return agregarEspecialidadMedico(params);
      case 'quitarEspecialidadMedico':   return quitarEspecialidadMedico(params);
      // ── MÉDICO ↔ ÁREAS DE APOYO ──
      case 'listarAreasMedico':    return listarAreasMedico(params);
      case 'agregarAreaMedico':    return agregarAreaMedico(params);
      case 'quitarAreaMedico':     return quitarAreaMedico(params);
      case 'listarMedicosConApoyo':return listarMedicosConApoyo(params);
      case 'listarMedicos':        return listarMedicos(params);
      case 'buscarMedico':         return buscarMedico(params.query);
      case 'obtenerMedico':        return obtenerMedico(params.ID_MEDICO);
      case 'guardarMedico':        return guardarMedico(params);
      case 'importarMedicosMasivo': return importarMedicosMasivo(params);
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
      case 'listarUnidadMedida':   return listarMaestras('UNIDAD_MEDIDA');
      case 'listarProfApoyo':      return listarProfesionalApoyo(params);
      case 'guardarProfApoyo':     return guardarProfesionalApoyo(params);
      case 'importarProfesionalesMasivo': return importarProfesionalesMasivo(params);
      case 'actualizarProfApoyo':  return actualizarProfesionalApoyo(params);

      // ── TABLAS MAESTRAS / CONFIGURACIÓN ──
      case 'obtenerEsquemaMaestra': return obtenerEsquemaMaestra(params.tabla);
      case 'actualizarMaestra':     return actualizarMaestra(params);
      case 'cambiarEstadoMaestra':  return cambiarEstadoMaestra(params);
      case 'listarMaestras':       return listarMaestras(params.tabla);
      case 'guardarMaestra':       return guardarMaestra(params);

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
      case 'importarServiciosMasivo': return importarServiciosMasivo(params);
      case 'actualizarServicio':   return actualizarServicio(params);
      case 'listarCitasPendientesPago': return listarCitasPendientesPago(params);

      // ── PAQUETES ──
      case 'listarPaquetes':       return listarPaquetes(params);
      case 'guardarPaquete':       return guardarPaquete(params);
      case 'importarPaquetesMasivo': return importarPaquetesMasivo(params);
      case 'actualizarPaquete':    return actualizarPaquete(params);
      case 'obtenerHistorialCita': return obtenerHistorialCita(params);

      // ── VENTA ──
      case 'guardarProforma':       return guardarProforma(params);
      case 'listarProformas':       return listarProformas(params);
      case 'anularProforma':        return anularProforma(params);
      case 'convertirProformaEnVenta': return convertirProformaEnVenta(params);
      case 'editarProforma':        return editarProforma(params);
      case 'obtenerProforma':       return obtenerProforma(params);
      // ── BACKUP ──
      case 'obtenerAlertas':        return obtenerAlertas(params);
      // ── CAJA CHICA ──
      // ── AUTOMATIZACIÓN CAJA ──
      case 'cajaAutoEstado':        return cajaAutoEstado(params);
      case 'cajaAutoActivar':       return cajaAutoActivar(params);
      case 'cajaAutoDesactivar':    return cajaAutoDesactivar(params);
      case 'ccEstado':              return ccEstado(params);
      case 'ccAbrirFondo':          return ccAbrirFondo(params);
      case 'ccRegistrarGasto':      return ccRegistrarGasto(params);
      case 'ccReponer':             return ccReponer(params);
      case 'ccListar':              return ccListar(params);
      case 'ccAnularMovimiento':    return ccAnularMovimiento(params);
      case 'ccCerrar':              return ccCerrar(params);
      case 'ccListarConceptos':     return ccListarConceptos(params);
      case 'backupEstado':          return backupEstado(params);
      case 'backupActivar':         return backupActivar(params);
      case 'backupDesactivar':      return backupDesactivar(params);
      case 'backupAhoraUI':         return backupAhoraUI(params);
      case 'listarEjecutoresDeServicio': return listarEjecutoresDeServicio(params);
      case 'guardarVenta':         return guardarVenta(params);
      case 'consultarDeudaPaciente': return consultarDeudaPaciente(params);
      // ── RECETAS (insumos por servicio) ──
      case 'listarRecetaServicio': return listarRecetaServicio(params);
      case 'listarServiciosConReceta': return listarServiciosConReceta(params);
      case 'agregarInsumoReceta':  return agregarInsumoReceta(params);
      case 'quitarInsumoReceta':   return quitarInsumoReceta(params);
      case 'listarRecetaPaquete':  return listarRecetaPaquete(params);
      case 'listarPaquetesConReceta': return listarPaquetesConReceta(params);
      case 'agregarInsumoRecetaPaquete': return agregarInsumoRecetaPaquete(params);
      case 'quitarInsumoRecetaPaquete':  return quitarInsumoRecetaPaquete(params);
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
      case 'anularMovimientoCaja': return anularMovimientoCaja(params);
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
      case 'cambiarEstadoSesion':  return cambiarEstadoSesion(params);
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
      case 'resumenFinanciero':       return resumenFinanciero(params);
      case 'reporteFinanciero':       return reporteFinanciero(params);
      case 'reporteLiquidez':         return reporteLiquidez(params);
      case 'reporteIndicadores':      return reporteIndicadores(params);
      case 'obtenerFichaClinica':     return obtenerFichaClinica(params);
      case 'guardarFichaClinica':     return guardarFichaClinica(params);
      case 'obtenerAtencionDeVenta':  return obtenerAtencionDeVenta(params);
      case 'listarPacientesParaDescanso': return listarPacientesParaDescanso(params);
      case 'guardarDescanso':             return guardarDescanso(params);
      case 'listarDescansos':             return listarDescansos(params);
      case 'obtenerDescanso':             return obtenerDescanso(params);
      case 'anularDescanso':              return anularDescanso(params);
      case 'guardarAtencionMedica':   return guardarAtencionMedica(params);
      case 'listarAtencionesPaciente': return listarAtencionesPaciente(params);
      case 'obtenerAtencionPorId':     return obtenerAtencionPorId(params);
      case 'prepararRecetaDesdeAtencion': return prepararRecetaDesdeAtencion(params);
      case 'guardarRecetaMedica':      return guardarRecetaMedica(params);
      case 'obtenerRecetaMedica':      return obtenerRecetaMedica(params);
      case 'listarRecetasPaciente':    return listarRecetasPaciente(params);
      case 'listarBandejaRecetas':     return listarBandejaRecetas(params);
      case 'listarBandejaResultados':  return listarBandejaResultados(params);
      case 'prepararResultadoApoyo':   return prepararResultadoApoyo(params);
      case 'guardarResultadoApoyo':    return guardarResultadoApoyo(params);
      case 'obtenerResultadoApoyo':    return obtenerResultadoApoyo(params);
      case 'listarEjecutoresApoyo':    return listarEjecutoresApoyo(params);
      case 'estadoAtencionVentas':     return estadoAtencionVentas(params);
      case 'listarTopicoDelDia':      return listarTopicoDelDia(params);
      case 'guardarSignosVitales':    return guardarSignosVitales(params);
      case 'obtenerSignosVitales':    return obtenerSignosVitales(params);
      case 'listarBandejaMedico':     return listarBandejaMedico(params);
      case 'obtenerConfigEmpresa':    return obtenerConfigEmpresa(params);
      case 'guardarConfigEmpresa':    return guardarConfigEmpresa(params);
      case 'listarHonorarioConfig':   return listarHonorarioConfig(params);
      case 'guardarHonorarioConfig':  return guardarHonorarioConfig(params);
      case 'desactivarHonorarioConfig': return desactivarHonorarioConfig(params);
      case 'registrarPagoHonorario':  return registrarPagoHonorario(params);
      case 'listarPagosHonorario':    return listarPagosHonorario(params);
      case 'registrarAsistencia':     return registrarAsistencia(params);
      case 'listarAsistencia':        return listarAsistencia(params);
      case 'anularAsistencia':        return anularAsistencia(params);
      case 'calcularAsistenciaPeriodo': return calcularAsistenciaPeriodo(params);
      case 'registrarComisionVenta':  return registrarComisionVenta(params);
      case 'registrarComisionesPorServicio': return registrarComisionesPorServicio(params);
      case 'marcarVentaSinComision':  return marcarVentaSinComision(params);
      case 'estadoComisionVentas':    return estadoComisionVentas(params);
      case 'medicoDeVentaPublico':    return medicoDeVentaPublico(params);
      case 'listarComisiones':        return listarComisiones(params);
      case 'resumenHonorarios':       return resumenHonorarios(params);
      case 'listarVentasParaComision': return listarVentasParaComision(params);
      case 'detalleVentaParaComision': return detalleVentaParaComision(params);
      case 'guardarComisionesDeVenta': return guardarComisionesDeVenta(params);
      case 'anularComision':          return anularComision(params);
      case 'totalComisionesPendientes': return totalComisionesPendientes(params);
      case 'pagarComisiones':         return pagarComisiones(params);

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
      case 'rptHonorarios':        return rptHonorarios(params);
      case 'rptCaja':              return rptCaja(params);
      case 'rptSesiones':          return rptSesiones(params);
      case 'rptPaquetes':          return rptPaquetes(params);

      // ── SEGURIDAD ──
      case 'listarUsuarios':       return listarUsuarios(params);
      case 'guardarUsuario':       return guardarUsuario(params);
      case 'actualizarUsuario':    return actualizarUsuario(params);
      case 'desbloquearUsuario':    return desbloquearUsuario(params);
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
