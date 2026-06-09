// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: ProfApoyo.gs
// Profesionales de Área de Apoyo
// ============================================================

// ============================================================
// Validación de datos de profesional de apoyo (reutilizable)
// Devuelve null si OK, o un string con el error.
// excluirId: al editar, ignora ese ID en la verificación de duplicados.
// ============================================================
function _validarProfApoyo(params, excluirId) {
  // ── Tipo + número de documento ──
  var tipo = String(params.ID_TIPO_DOCUMENTO || '').trim(); // 1=DNI 2=CE 3=PASAPORTE
  var doc  = String(params.NUMERO_DOCUMENTO || '').trim();
  if (doc && doc !== '-') {
    if (tipo === '1') { // DNI
      if (!/^[0-9]{8}$/.test(doc)) return 'El DNI debe tener exactamente 8 dígitos numéricos.';
    } else if (tipo === '2') { // Carné de extranjería
      if (!/^[A-Za-z0-9]{8,15}$/.test(doc)) return 'El Carné de Extranjería debe tener entre 8 y 15 caracteres (letras y números).';
    } else if (tipo === '3') { // Pasaporte
      if (!/^[A-Za-z0-9]{6,20}$/.test(doc)) return 'El Pasaporte debe tener entre 6 y 20 caracteres (letras y números).';
    }
  }

  // ── Nombres ──
  var nombres = String(params.NOMBRES || '').trim();
  if (nombres.length < 2) return 'Los nombres deben tener al menos 2 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(nombres)) return 'Los nombres no son válidos (deben contener letras).';

  // ── Apellidos ──
  var apellidos = String(params.APELLIDOS || '').trim();
  if (apellidos.length < 2) return 'Los apellidos deben tener al menos 2 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(apellidos)) return 'Los apellidos no son válidos (deben contener letras).';

  // ── Área de apoyo ──
  if (!params.ID_AREA_APOYO || String(params.ID_AREA_APOYO).trim() === '') return 'Debe seleccionar un área de apoyo.';

  // ── Profesión ──
  var prof = String(params.PROFESION || '').trim();
  if (prof.length < 3) return 'La profesión debe tener al menos 3 caracteres.';

  // ── Teléfono (opcional) ──
  var tel = String(params.TELEFONO || '').replace(/\s/g,'');
  if (tel && tel !== '-') {
    if (!/^[0-9]{9}$/.test(tel)) return 'El teléfono debe tener 9 dígitos numéricos.';
  }

  // ── Email (opcional) ──
  var email = String(params.EMAIL || '').trim();
  if (email && email !== '-') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'El email no tiene un formato válido.';
  }

  // ── Documento duplicado ──
  if (doc && doc !== '-') {
    var existentes = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    for (var i = 0; i < existentes.length; i++) {
      if (excluirId && existentes[i].ID_PROFESIONAL === excluirId) continue;
      if (String(existentes[i].NUMERO_DOCUMENTO || '').trim().toUpperCase() === doc.toUpperCase()
          && existentes[i].ESTADO !== 'INACTIVO') {
        return 'Ya existe un profesional registrado con ese documento.';
      }
    }
  }

  // ── Email duplicado (si se ingresa) ──
  if (email && email !== '-') {
    var existentes2 = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    for (var j = 0; j < existentes2.length; j++) {
      if (excluirId && existentes2[j].ID_PROFESIONAL === excluirId) continue;
      if (String(existentes2[j].EMAIL || '').trim().toUpperCase() === email.toUpperCase()
          && existentes2[j].ESTADO !== 'INACTIVO') {
        return 'Ya existe un profesional registrado con ese email.';
      }
    }
  }

  return null; // todo OK
}

function listarProfesionalApoyo(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR','RECEPCION','CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    var profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    var areas = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);

    profs = profs.map(function(p) {
      var areaNombre = '—';
      for(var _a=0;_a<areas.length;_a++){if(areas[_a].ID_AREA_APOYO===p.ID_AREA_APOYO){areaNombre=areas[_a].NOMBRE||'—';break;}}
      return {ID_PROFESIONAL:p.ID_PROFESIONAL,ID_TIPO_DOCUMENTO:p.ID_TIPO_DOCUMENTO,NUMERO_DOCUMENTO:p.NUMERO_DOCUMENTO,NOMBRES:p.NOMBRES,APELLIDOS:p.APELLIDOS,ID_AREA_APOYO:p.ID_AREA_APOYO,PROFESION:p.PROFESION,TELEFONO:p.TELEFONO,EMAIL:p.EMAIL,ESTADO:p.ESTADO,FECHA_REGISTRO:p.FECHA_REGISTRO,AREA_NOMBRE:areaNombre};
    });

    if (params.estado)     profs = profs.filter(function(p){ return p.ESTADO === params.estado.toUpperCase(); });
    if (params.area)       profs = profs.filter(function(p){ return p.ID_AREA_APOYO === params.area; });
    if (params.query) {
      var q = params.query.toUpperCase();
      profs = profs.filter(function(p){ return (p.NOMBRES+' '+p.APELLIDOS+' '+p.PROFESION+' '+p.ID_PROFESIONAL).toUpperCase().includes(q); });
    }

    var limite  = parseInt(params.limite) || 50;
    var pagina  = parseInt(params.pagina) || 1;
    var total   = profs.length;
    var datos   = profs.slice((pagina-1)*limite, pagina*limite);

    return respuestaOK({ datos, total, pagina, limite, paginas: Math.ceil(total/limite) },
      total + ' profesional(es) encontrado(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function guardarProfesionalApoyo(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Solo el Administrador puede registrar profesionales.', 'ERR_PERMISO');
    }

    var requeridos = ['NOMBRES','APELLIDOS','ID_AREA_APOYO','PROFESION','ESTADO'];
    for (var campo of requeridos) {
      if (!params[campo]) return respuestaError('El campo ' + campo + ' es requerido.');
    }

    // Validaciones completas (documento, nombres, profesión, teléfono, email, duplicados)
    var _err = _validarProfApoyo(params, null);
    if (_err) return respuestaError(_err);

    var profs   = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    var ultimos = profs.map(function(p){ return parseInt((p.ID_PROFESIONAL||'').replace('PAP-','')); });
    var _f=ultimos.filter(function(n){return !isNaN(n);});
    var sig = (_f.length ? Math.max.apply(null,_f) : 0) + 1;
    var id      = 'PAP-' + String(sig).padStart(4,'0');
    var fecha   = getFecha('fecha');

    insertarFila(HOJAS.PROFESIONAL_APOYO, {
      ID_PROFESIONAL:    id,
      ID_TIPO_DOCUMENTO: params.ID_TIPO_DOCUMENTO || '-',
      NUMERO_DOCUMENTO:  String(params.NUMERO_DOCUMENTO || '-').toUpperCase().trim(),
      NOMBRES:           normalizar(params.NOMBRES),
      APELLIDOS:         normalizar(params.APELLIDOS),
      ID_AREA_APOYO:     params.ID_AREA_APOYO,
      PROFESION:         normalizar(params.PROFESION),
      TELEFONO:          String(params.TELEFONO || '-').replace(/\s/g,'') || '-',
      EMAIL:             String(params.EMAIL || '-').toUpperCase().trim() || '-',
      ESTADO:            String(params.ESTADO).toUpperCase(),
      FECHA_REGISTRO:    fecha,
    });

    return respuestaOK({ ID_PROFESIONAL: id }, 'Profesional registrado correctamente.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function actualizarProfesionalApoyo(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_PROFESIONAL) return respuestaError('ID_PROFESIONAL requerido.');

    // Validaciones completas (excluyendo el propio registro en duplicados)
    var _err = _validarProfApoyo(params, params.ID_PROFESIONAL);
    if (_err) return respuestaError(_err);

    var datos = {};
    if (params.ID_TIPO_DOCUMENTO) datos.ID_TIPO_DOCUMENTO = String(params.ID_TIPO_DOCUMENTO);
    if (params.NUMERO_DOCUMENTO)  datos.NUMERO_DOCUMENTO = String(params.NUMERO_DOCUMENTO).toUpperCase().trim();
    if (params.NOMBRES)           datos.NOMBRES      = normalizar(params.NOMBRES);
    if (params.APELLIDOS)         datos.APELLIDOS     = normalizar(params.APELLIDOS);
    if (params.ID_AREA_APOYO)     datos.ID_AREA_APOYO = params.ID_AREA_APOYO;
    if (params.PROFESION)         datos.PROFESION     = normalizar(params.PROFESION);
    if (params.TELEFONO !== undefined) datos.TELEFONO = String(params.TELEFONO || '-').replace(/\s/g,'') || '-';
    if (params.EMAIL !== undefined)    datos.EMAIL    = String(params.EMAIL || '-').toUpperCase().trim() || '-';
    if (params.ESTADO)            datos.ESTADO        = String(params.ESTADO).toUpperCase();

    actualizarFila(HOJAS.PROFESIONAL_APOYO, 'ID_PROFESIONAL', params.ID_PROFESIONAL, datos);
    return respuestaOK({}, 'Profesional actualizado.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
