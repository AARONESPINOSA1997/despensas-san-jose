// pos.js - Con sucursal fija y PIN para cambio
const $ = (sel, ctx=document) => ctx.querySelector(sel);

const selPOS = $("#posSucursal");
const inpBuscar = $("#posBuscar");
const resultadosBusqueda = $("#resultadosBusqueda");
const infoSocio = $("#infoSocio");
const inpQuienRecoge = $("#posQuienRecoge");
const inpCantidad = $("#posCantidad");
const btnEntregar = $("#btnEntregar");
const btnCambiarSucursal = $("#btnCambiarSucursal");

let socioSeleccionado = null;
let sucursalesDisponibles = [];
let sucursalActual = null;

// PIN de supervisor para cambiar sucursal
const PIN_SUPERVISOR = '1234';

// Cargar sucursales permitidas para este usuario
async function cargarSucursales() {
  try {
    const data = await window.api.getInventario();
    sucursalesDisponibles = data.sucursales || [];
    
    const sucursalesPermitidas = sessionStorage.getItem('dsj_sucursales') || 'all';
    const rol = sessionStorage.getItem('dsj_rol');
    
    let sucursalesFiltradas = sucursalesDisponibles;
    
    if (sucursalesPermitidas !== 'all') {
      const idsPermitidos = sucursalesPermitidas.split(',').map(id => parseInt(id));
      sucursalesFiltradas = sucursalesDisponibles.filter(s => idsPermitidos.includes(s.id));
    }
    
    const valorAnterior = sucursalActual || selPOS.value;
    
    selPOS.innerHTML = sucursalesFiltradas
      .sort((a,b) => a.nombre.localeCompare(b.nombre))
      .map(s => `<option value="${s.id}">${s.nombre}</option>`)
      .join("");
    
    const sucursalGuardada = sessionStorage.getItem('pos_sucursal_actual');
    const valorRestaurar = sucursalGuardada || valorAnterior;

    if (valorRestaurar && [...selPOS.options].some(o => o.value === valorRestaurar)) {
      selPOS.value = valorRestaurar;
      sucursalActual = valorRestaurar;
      sessionStorage.setItem('pos_sucursal_actual', valorRestaurar);
    } else if (selPOS.options.length > 0) {
      sucursalActual = selPOS.value;
      sessionStorage.setItem('pos_sucursal_actual', selPOS.value);
    }
    
    selPOS.disabled = true;
    
    // Mostrar nombre de la sucursal para roles específicos
    if (rol === 'encargado' || rol === 'cajero' || rol === 'cajero_volante') {
      const nombreSucursalActual = selPOS.options[selPOS.selectedIndex]?.text || 'Sin asignar';
      const labelSucursal = document.querySelector('label[for="posSucursal"]');
      if (labelSucursal) {
        labelSucursal.innerHTML = `🔒 Sucursal: <strong>${nombreSucursalActual}</strong>`;
      }
    }
    
  } catch (error) {
    console.error('Error cargando sucursales:', error);
    alert('Error al cargar sucursales');
  }
}

// Mostrar/ocultar botón cambiar sucursal según rol
document.addEventListener('DOMContentLoaded', () => {
  const rol = sessionStorage.getItem('dsj_rol');
  if (rol === 'super' || rol === 'admin' || rol === 'cajero_volante') {
    if (btnCambiarSucursal) btnCambiarSucursal.style.display = 'inline-block';
  } else {
    if (btnCambiarSucursal) btnCambiarSucursal.style.display = 'none';
  }
});

// Sistema de cambio de sucursal con PIN
btnCambiarSucursal?.addEventListener('click', () => {
  const pin = prompt('🔒 Ingresa el PIN de supervisor para cambiar de sucursal:');
  
  if (!pin) return;
  
  if (pin === PIN_SUPERVISOR) {
    selPOS.disabled = false;
    selPOS.focus();
    
    alert('✅ Autorizado. Selecciona la nueva sucursal y presiona OK.');
    
    selPOS.addEventListener('change', function handler() {
      sucursalActual = selPOS.value;
      sessionStorage.setItem('pos_sucursal_actual', selPOS.value);
      selPOS.disabled = true;
      alert(`✅ Sucursal cambiada a: ${selPOS.options[selPOS.selectedIndex].text}`);
      selPOS.removeEventListener('change', handler);
      
      // Actualizar label
      const rol = sessionStorage.getItem('dsj_rol');
      if (rol === 'encargado' || rol === 'cajero' || rol === 'cajero_volante') {
        const nombreSucursalActual = selPOS.options[selPOS.selectedIndex]?.text || 'Sin asignar';
        const labelSucursal = document.querySelector('label[for="posSucursal"]');
        if (labelSucursal) {
          labelSucursal.innerHTML = `🔒 Sucursal: <strong>${nombreSucursalActual}</strong>`;
        }
      }
    }, { once: true });
    
  } else {
    alert('❌ PIN incorrecto. Contacta a tu supervisor.');
  }
});

// Buscar socios (con debounce)
let timeoutBusqueda;
inpBuscar?.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  
  clearTimeout(timeoutBusqueda);
  
  if (query.length < 2) {
    resultadosBusqueda.innerHTML = '';
    resultadosBusqueda.style.display = 'none';
    return;
  }
  
  timeoutBusqueda = setTimeout(async () => {
    try {
      const data = await window.api.buscarSocios(query);
      mostrarResultados(data.socios || []);
    } catch (error) {
      console.error('Error buscando socios:', error);
    }
  }, 300);
});

function mostrarResultados(socios) {
  if (socios.length === 0) {
    resultadosBusqueda.innerHTML = '<div style="padding:10px;color:#999;">No se encontraron socios</div>';
    resultadosBusqueda.style.display = 'block';
    return;
  }
  
  resultadosBusqueda.innerHTML = socios.map(s => `
    <div class="resultado-socio" data-id="${s.id}" data-numero="${s.numero_socio}" data-nombre="${s.nombre}" data-entregado="${s.entregado}">
      <div style="font-weight:600;">${s.numero_socio} - ${s.nombre}</div>
      <div style="font-size:12px;color:#666;">${s.entregado ? '⚠️ Ya recogió su despensa' : '✅ Disponible'}</div>
    </div>
  `).join('');
  
  resultadosBusqueda.style.display = 'block';
}

// Seleccionar socio
resultadosBusqueda?.addEventListener('click', (e) => {
  const item = e.target.closest('.resultado-socio');
  if (!item) return;
  
  const id = parseInt(item.dataset.id);
  const numero = item.dataset.numero;
  const nombre = item.dataset.nombre;
  const entregado = item.dataset.entregado === '1';
  
  if (entregado) {
    alert('⚠️ Este socio ya recogió su despensa');
    return;
  }
  
  socioSeleccionado = { id, numero, nombre };
  
  inpBuscar.value = `${numero} - ${nombre}`;
  resultadosBusqueda.style.display = 'none';
  
  infoSocio.innerHTML = `
    <div style="background:#e8f5e9;border:1px solid #4caf50;padding:12px;border-radius:8px;margin:10px 0;">
      <strong>✅ Socio seleccionado:</strong><br>
      ${numero} - ${nombre}
    </div>
  `;
  
  inpQuienRecoge.focus();
});

// Ocultar resultados al hacer click fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('#posBuscar') && !e.target.closest('#resultadosBusqueda')) {
    resultadosBusqueda.style.display = 'none';
  }
});

// Registrar entrega
btnEntregar?.addEventListener('click', async () => {
  if (!socioSeleccionado) {
    alert('⚠️ Primero busca y selecciona un socio');
    inpBuscar.focus();
    return;
  }
  
  const sucursal_id = parseInt(selPOS.value);
  const cantidad = parseInt(inpCantidad.value || "1", 10);
  const quien_recoge = inpQuienRecoge.value.trim();
  const quien_recoge_final = quien_recoge || socioSeleccionado.nombre;
  const nombreSucursal = selPOS.options[selPOS.selectedIndex].text;
  
  if (!confirm(`¿Confirmar entrega?\n\nSucursal: ${nombreSucursal}\nSocio: ${socioSeleccionado.nombre}\nRecoge: ${quien_recoge_final}`)) {
    return;
  }
  
  btnEntregar.disabled = true;
  btnEntregar.textContent = 'Registrando...';
  
  try {
    const response = await window.api.registrarEntrega(
      socioSeleccionado.id,
      sucursal_id,
      cantidad,
      quien_recoge_final
    );
    
    imprimirTicket({
      folio: response.entrega_id,
      sucursal: nombreSucursal,
      socio_numero: socioSeleccionado.numero,
      socio_nombre: socioSeleccionado.nombre,
      quien_recoge: quien_recoge_final,
      usuario: sessionStorage.getItem('dsj_nombre'),
      fecha: new Date().toLocaleString('es-MX', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    });
    
    limpiarFormulario();
    await cargarSucursales();
    
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  } finally {
    btnEntregar.disabled = false;
    btnEntregar.textContent = 'Entregar e Imprimir';
  }
});

function limpiarFormulario() {
  socioSeleccionado = null;
  inpBuscar.value = '';
  inpQuienRecoge.value = '';
  inpCantidad.value = '1';
  infoSocio.innerHTML = '';
  resultadosBusqueda.innerHTML = '';
  resultadosBusqueda.style.display = 'none';
  inpBuscar.focus();
}

function imprimirTicket(datos) {
  const ventanaImpresion = window.open('', '_blank', 'width=300,height=600');
  
  const ticketHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket #${datos.folio}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          margin: 0;
          padding: 10px;
          font-size: 12px;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .linea { border-top: 1px dashed #000; margin: 10px 0; }
        .campo { margin: 5px 0; }
        .firma {
          margin-top: 30px;
          border-top: 1px solid #000;
          width: 200px;
          text-align: center;
          margin-left: auto;
          margin-right: auto;
          padding-top: 5px;
        }
        @media print {
          body { margin: 0; padding: 5px; }
        }
      </style>
    </head>
    <body>
      <div class="center bold">*** CAJA POPULAR SAN RAFAEL ***</div>
      <div class="center bold">*** DESPENSAS 2025 ***</div>
      <div class="center bold">* RECIBO DE DESPENSA ENTREGADA *</div>
      <div class="linea"></div>
      <div class="campo"><strong>Entregado en:</strong> ${datos.sucursal}</div>
      <div class="campo"><strong>Entregó:</strong> ${datos.usuario}</div>
      <div class="campo"><strong>Fecha:</strong> ${datos.fecha}</div>
      <div class="campo"><strong>Folio:</strong> ${datos.folio}</div>
      <div class="linea"></div>
      <div class="campo"><strong>Socio Núm:</strong> ${datos.socio_numero}</div>
      <div class="campo"><strong>${datos.socio_nombre}</strong></div>
      <div class="linea"></div>
      <div class="firma">Firma de conformidad</div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;
  
  ventanaImpresion.document.write(ticketHTML);
  ventanaImpresion.document.close();
}

// Cargar al inicio
cargarSucursales();
inpBuscar.focus();

// Bloquear cantidad en 1
inpCantidad.value = 1;
inpCantidad.readOnly = true;