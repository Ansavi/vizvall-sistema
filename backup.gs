// ════════════════════════════════════════════════════════════
//  SISTEMA DE BACKUP AUTOMÁTICO — VIZVALL
//  Copia diaria del spreadsheet a una carpeta de Google Drive.
//  Retención: últimos 30 días (borra automáticamente los viejos).
//
//  INSTALACIÓN (una sola vez):
//    1. Ejecutar ▶ instalarBackupAutomatico   → programa el backup diario
//    2. (Opcional) Ejecutar ▶ ejecutarBackupAhora → crea un backup de prueba
//
//  Para quitar el backup automático: ▶ desinstalarBackupAutomatico
// ════════════════════════════════════════════════════════════

var BACKUP_CONFIG = {
  SPREADSHEET_ID: '1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o',
  CARPETA_NOMBRE: 'VIZVALL - Backups',   // carpeta en tu Drive
  RETENCION_DIAS: 30,                    // cuántos días conservar
  HORA_BACKUP:    1                      // 1 = 1:00 AM
};

/**
 * Crea un backup AHORA (copia del spreadsheet con fecha).
 * Se puede ejecutar manualmente o lo llama el trigger automático.
 */
function ejecutarBackupAhora() {
  try {
    var carpeta = _backupObtenerCarpeta();
    var original = DriveApp.getFileById(BACKUP_CONFIG.SPREADSHEET_ID);

    // Nombre con fecha: VIZVALL_2026-06-16_0130
    var ahora = new Date();
    var fecha = Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
    var nombre = 'VIZVALL_' + fecha;

    // Crear la copia dentro de la carpeta de backups
    var copia = original.makeCopy(nombre, carpeta);

    // Limpiar backups viejos (más de RETENCION_DIAS)
    var borrados = _backupLimpiarViejos(carpeta);

    var msg = '✓ Backup creado: ' + nombre + '\n' +
              '  Carpeta: ' + BACKUP_CONFIG.CARPETA_NOMBRE + '\n' +
              '  Backups viejos eliminados: ' + borrados;
    Logger.log(msg);
    return msg;
  } catch (e) {
    var err = '❌ Error al crear backup: ' + e.message;
    Logger.log(err);
    return err;
  }
}

/**
 * Programa el backup automático diario.
 * Ejecutar UNA vez con ▶.
 */
function instalarBackupAutomatico() {
  // Quitar triggers anteriores para no duplicar
  desinstalarBackupAutomatico();

  // Crear trigger diario a la hora configurada
  ScriptApp.newTrigger('ejecutarBackupAhora')
    .timeBased()
    .everyDays(1)
    .atHour(BACKUP_CONFIG.HORA_BACKUP)
    .create();

  // Crear un primer backup de inmediato para confirmar que funciona
  var resultado = ejecutarBackupAhora();

  var msg = '✓ Backup automático INSTALADO.\n' +
            '  Se ejecutará todos los días a la(s) ' + BACKUP_CONFIG.HORA_BACKUP + ':00 AM.\n' +
            '  Retención: ' + BACKUP_CONFIG.RETENCION_DIAS + ' días.\n\n' +
            'Primer backup de prueba:\n' + resultado;
  Logger.log(msg);
  return msg;
}

/**
 * Quita el backup automático (elimina el trigger).
 * Ejecutar con ▶ si quieres desactivarlo.
 */
function desinstalarBackupAutomatico() {
  var triggers = ScriptApp.getProjectTriggers();
  var quitados = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'ejecutarBackupAhora') {
      ScriptApp.deleteTrigger(triggers[i]);
      quitados++;
    }
  }
  Logger.log('Triggers de backup eliminados: ' + quitados);
  return 'Backup automático desinstalado (' + quitados + ' trigger eliminado).';
}

/**
 * Lista los backups existentes (para verificar).
 * Ejecutar con ▶ para ver qué backups tienes.
 */
function listarBackups() {
  var carpeta = _backupObtenerCarpeta();
  var archivos = carpeta.getFiles();
  var lista = [];
  while (archivos.hasNext()) {
    var f = archivos.next();
    lista.push({
      nombre: f.getName(),
      fecha: Utilities.formatDate(f.getDateCreated(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
      tamano: Math.round(f.getSize() / 1024) + ' KB'
    });
  }
  // Ordenar por nombre (que incluye fecha) descendente
  lista.sort(function(a, b) { return b.nombre.localeCompare(a.nombre); });

  var msg = '═══ BACKUPS EXISTENTES (' + lista.length + ') ═══\n';
  for (var i = 0; i < lista.length; i++) {
    msg += (i + 1) + '. ' + lista[i].nombre + '  ·  ' + lista[i].fecha + '\n';
  }
  if (!lista.length) msg += '(No hay backups aún. Ejecuta instalarBackupAutomatico)';
  Logger.log(msg);
  return msg;
}

// ── Helpers internos ──────────────────────────────────────────

/** Obtiene (o crea) la carpeta de backups en Drive */
function _backupObtenerCarpeta() {
  var carpetas = DriveApp.getFoldersByName(BACKUP_CONFIG.CARPETA_NOMBRE);
  if (carpetas.hasNext()) {
    return carpetas.next();
  }
  return DriveApp.createFolder(BACKUP_CONFIG.CARPETA_NOMBRE);
}

/** Borra backups con más de RETENCION_DIAS días. Devuelve cuántos borró. */
function _backupLimpiarViejos(carpeta) {
  var limite = new Date();
  limite.setDate(limite.getDate() - BACKUP_CONFIG.RETENCION_DIAS);

  var archivos = carpeta.getFiles();
  var borrados = 0;
  while (archivos.hasNext()) {
    var f = archivos.next();
    // Solo tocar archivos de backup VIZVALL
    if (f.getName().indexOf('VIZVALL_') === 0 && f.getDateCreated() < limite) {
      f.setTrashed(true);  // a la papelera (recuperable 30 días más)
      borrados++;
    }
  }
  return borrados;
}

// ════════════════════════════════════════════════════════════
//  FUNCIONES PARA LA PANTALLA DE BACKUPS (interfaz web)
//  No reemplazan las existentes; las complementan.
// ════════════════════════════════════════════════════════════

/** Lee la config guardada (hora/retención) o usa los valores por defecto */
function _backupLeerConfig() {
  var props = PropertiesService.getScriptProperties();
  var hora = parseInt(props.getProperty('BACKUP_HORA'), 10);
  var ret = parseInt(props.getProperty('BACKUP_RETENCION'), 10);
  return {
    HORA: isNaN(hora) ? BACKUP_CONFIG.HORA_BACKUP : hora,
    RETENCION: isNaN(ret) ? BACKUP_CONFIG.RETENCION_DIAS : ret
  };
}

/** Estado del backup automático: activo o no, hora, retención, próximo, lista */
function backupEstado(params) {
  try {
    if (params && params._sesion && params._sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede ver los backups.', 'ERR_PERMISO');
    }
    // ¿Hay trigger activo?
    var triggers = ScriptApp.getProjectTriggers();
    var activo = false;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'ejecutarBackupAhora') { activo = true; break; }
    }
    var cfg = _backupLeerConfig();

    // Lista de backups
    var carpeta = _backupObtenerCarpeta();
    var archivos = carpeta.getFiles();
    var lista = [];
    while (archivos.hasNext()) {
      var f = archivos.next();
      lista.push({
        nombre: f.getName(),
        fecha: Utilities.formatDate(f.getDateCreated(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
        tamano: Math.round(f.getSize() / 1024) + ' KB',
        url: f.getUrl()
      });
    }
    lista.sort(function(a, b) { return b.nombre.localeCompare(a.nombre); });

    return respuestaOK({
      activo: activo,
      hora: cfg.HORA,
      retencion: cfg.RETENCION,
      carpeta: BACKUP_CONFIG.CARPETA_NOMBRE,
      totalBackups: lista.length,
      ultimoBackup: lista.length ? lista[0].fecha : null,
      backups: lista
    }, 'Estado del backup.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

/** Activa el backup automático con hora y retención elegidas desde la UI */
function backupActivar(params) {
  try {
    if (params && params._sesion && params._sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede configurar backups.', 'ERR_PERMISO');
    }
    var hora = parseInt(params.HORA, 10);
    var ret = parseInt(params.RETENCION, 10);
    if (isNaN(hora) || hora < 0 || hora > 23) return respuestaError('Hora inválida (0-23).');
    if (isNaN(ret) || ret < 1) ret = 30;

    // Guardar config
    var props = PropertiesService.getScriptProperties();
    props.setProperty('BACKUP_HORA', String(hora));
    props.setProperty('BACKUP_RETENCION', String(ret));
    BACKUP_CONFIG.HORA_BACKUP = hora;
    BACKUP_CONFIG.RETENCION_DIAS = ret;

    // Quitar triggers viejos y crear el nuevo
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'ejecutarBackupAhora') ScriptApp.deleteTrigger(triggers[i]);
    }
    ScriptApp.newTrigger('ejecutarBackupAhora').timeBased().everyDays(1).atHour(hora).create();

    return respuestaOK({ activo: true, hora: hora, retencion: ret },
      'Backup automático activado: todos los días a las ' + hora + ':00, conservando ' + ret + ' días.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

/** Desactiva el backup automático desde la UI */
function backupDesactivar(params) {
  try {
    if (params && params._sesion && params._sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede configurar backups.', 'ERR_PERMISO');
    }
    var triggers = ScriptApp.getProjectTriggers();
    var quitados = 0;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'ejecutarBackupAhora') { ScriptApp.deleteTrigger(triggers[i]); quitados++; }
    }
    return respuestaOK({ activo: false }, 'Backup automático desactivado.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

/** Crea un backup ahora mismo desde la UI */
function backupAhoraUI(params) {
  try {
    if (params && params._sesion && params._sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede crear backups.', 'ERR_PERMISO');
    }
    var resultado = ejecutarBackupAhora();
    if (String(resultado).indexOf('❌') === 0) return respuestaError(resultado);
    return respuestaOK({}, resultado);
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}
