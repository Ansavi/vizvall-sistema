// ════════════════════════════════════════════════════════════
//  TABLERO BI — URL del reporte Looker Studio embebido en VIZVALL
//  Solo ADMINISTRADOR/gerencia (datos sensibles: ventas, comisiones).
//  La URL se guarda en ScriptProperties (un solo valor, sin hoja nueva).
// ════════════════════════════════════════════════════════════

var _TABLERO_BI_KEY = 'TABLERO_BI_URL';

/** Devuelve la URL del tablero configurado. */
function obtenerTableroBI(params) {
  try {
    var rol = (params._sesion && params._sesion.ROL) ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') {
      return respuestaError('Solo gerencia puede ver el tablero BI.', 'ERR_PERMISO');
    }
    var url = PropertiesService.getScriptProperties().getProperty(_TABLERO_BI_KEY) || '';
    return respuestaOK({ URL: url }, 'Tablero BI.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

/** Guarda/actualiza la URL del tablero. Solo ADMINISTRADOR. */
function guardarTableroBI(params) {
  try {
    var rol = (params._sesion && params._sesion.ROL) ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') {
      return respuestaError('Solo gerencia puede configurar el tablero BI.', 'ERR_PERMISO');
    }
    var url = String(params.URL || '').trim();
    if (!url) return respuestaError('URL requerida.');

    PropertiesService.getScriptProperties().setProperty(_TABLERO_BI_KEY, url);
    registrarAuditoria((params._sesion ? params._sesion.ID_USUARIO : '-'), 'REPORTES', 'CONFIG_TABLERO_BI',
      'Tablero BI configurado');
    return respuestaOK({ URL: url }, 'Tablero BI guardado.');
  } catch (e) {
    return respuestaError('Error: ' + e.message);
  }
}

// ── Función ▶ para asignar el permiso del Tablero BI (solo ADMINISTRADOR) ──
function agregarPermisoTableroBI() {
  var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');

  // 1. Buscar/crear el permiso en PERMISO
  var hPer = ss.getSheetByName('PERMISO');
  var perData = hPer.getDataRange().getValues();
  var perHead = perData[0];
  var iMod = perHead.indexOf('MODULO'), iAcc = perHead.indexOf('ACCION');
  var iIdP = perHead.indexOf('ID_PERMISO'), iDesc = perHead.indexOf('DESCRIPCION');

  var idPermiso = null;
  for (var i = 1; i < perData.length; i++) {
    if (perData[i][iMod] === 'Reportes' && perData[i][iAcc] === 'Tablero BI') {
      idPermiso = perData[i][iIdP]; break;
    }
  }
  if (!idPermiso) {
    var maxN = 0;
    for (var j = 1; j < perData.length; j++) {
      var m = String(perData[j][iIdP] || '').match(/(\d+)/);
      if (m && parseInt(m[1]) > maxN) maxN = parseInt(m[1]);
    }
    idPermiso = 'PERM-' + ('000' + (maxN + 1)).slice(-3);
    var fila = [];
    for (var k = 0; k < perHead.length; k++) fila.push('');
    fila[iIdP] = idPermiso; fila[iMod] = 'Reportes'; fila[iAcc] = 'Tablero BI';
    if (iDesc >= 0) fila[iDesc] = 'Tablero analítico Looker Studio (solo gerencia)';
    hPer.appendRow(fila);
    Logger.log('✓ Permiso creado: ' + idPermiso);
  } else {
    Logger.log('• Permiso ya existía: ' + idPermiso);
  }

  // 2. Asignar SOLO a ADMINISTRADOR en ROL_PERMISO
  var hRol = ss.getSheetByName('ROL');
  var rolData = hRol.getDataRange().getValues();
  var rHead = rolData[0];
  var iNom = rHead.indexOf('NOMBRE');           // OJO: la hoja ROL usa 'NOMBRE'
  var iIdR = rHead.indexOf('ID_ROL');

  var idAdmin = null;
  for (var r = 1; r < rolData.length; r++) {
    if (String(rolData[r][iNom]).toUpperCase() === 'ADMINISTRADOR') { idAdmin = rolData[r][iIdR]; break; }
  }
  if (!idAdmin) { Logger.log('✗ No se encontró el rol ADMINISTRADOR'); return; }

  var hRP = ss.getSheetByName('ROL_PERMISO');
  var rpData = hRP.getDataRange().getValues();
  var rpHead = rpData[0];
  var iRP_Rol = rpHead.indexOf('ID_ROL'), iRP_Per = rpHead.indexOf('ID_PERMISO');

  var yaAsignado = false;
  for (var p = 1; p < rpData.length; p++) {
    if (rpData[p][iRP_Rol] === idAdmin && rpData[p][iRP_Per] === idPermiso) { yaAsignado = true; break; }
  }
  if (!yaAsignado) {
    var filaRP = [];
    for (var q = 0; q < rpHead.length; q++) filaRP.push('');
    filaRP[iRP_Rol] = idAdmin; filaRP[iRP_Per] = idPermiso;
    hRP.appendRow(filaRP);
    Logger.log('✓ Permiso asignado a ADMINISTRADOR');
  } else {
    Logger.log('• Ya estaba asignado a ADMINISTRADOR');
  }
  Logger.log('▶ Listo. Cierre sesión y reingrese para ver el enlace "Tablero BI".');
}
