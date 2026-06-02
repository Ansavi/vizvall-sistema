// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: ProfApoyo.gs
// Profesionales de Área de Apoyo
// ============================================================

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

    var datos = {};
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
