// ════════════════════════════════════════════════════════════
//  DIAGNÓSTICO — ejecutar con ▶ para ver qué función falta
//  NO modifica nada, solo revisa y reporta en pantalla
// ════════════════════════════════════════════════════════════
function diagnosticarSistema() {
  var funcionesCriticas = [
    // Honorarios / Comisiones
    'registrarComisionVenta', 'listarComisiones', 'pagarComisiones', '_medicoDeVenta',
    'registrarPagoHonorario', 'listarHonorarioConfig',
    // Historia Clínica
    'obtenerFichaClinica', 'guardarFichaClinica', 'listarTopicoDelDia',
    'guardarSignosVitales', 'listarBandejaMedico', 'guardarAtencionMedica',
    '_hcMedicoDeVenta', '_hcFechaHaceDias', '_marcarCitaAtendida',
    // Ventas / Caja
    'guardarVenta', 'listarVentas', 'anularVenta', 'registrarMovimiento',
    // Config
    'obtenerConfigEmpresa', 'guardarConfigEmpresa',
    // Helpers base
    'leerHoja', 'limpiarFila', 'respuestaOK', 'respuestaError', 'generarID', 'insertarFila', 'actualizarFila'
  ];

  var faltantes = [];
  var ok = [];
  for (var i = 0; i < funcionesCriticas.length; i++) {
    var fn = funcionesCriticas[i];
    try {
      if (typeof this[fn] === 'function' || eval('typeof ' + fn) === 'function') {
        ok.push(fn);
      } else {
        faltantes.push(fn);
      }
    } catch (e) {
      faltantes.push(fn + ' (error: ' + e.message + ')');
    }
  }

  var msg = '═══ DIAGNÓSTICO DEL SISTEMA ═══\n\n';
  msg += '✓ Funciones OK: ' + ok.length + ' de ' + funcionesCriticas.length + '\n\n';
  if (faltantes.length === 0) {
    msg += '✅ TODAS las funciones están cargadas correctamente.\n';
    msg += 'Si aún ves errores, recarga con Ctrl+Shift+R.';
  } else {
    msg += '❌ FUNCIONES FALTANTES (' + faltantes.length + '):\n';
    for (var j = 0; j < faltantes.length; j++) {
      msg += '   • ' + faltantes[j] + '\n';
    }
    msg += '\n→ El archivo .gs que contiene estas funciones está roto o no cargó.\n';
    msg += '→ Reemplaza SOLO ese archivo.';
  }

  Logger.log(msg);
  return msg;
}
