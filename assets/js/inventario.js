// inventario.js - Con API Real
const $ = (sel, ctx=document) => ctx.querySelector(sel);

const badgeBodega   = $("#badgeBodega");
const badgeAsignado = $("#badgeAsignado");
const selSucursal   = $("#selSucursal");
const inpCantidad   = $("#inpCantidad");
const btnAsignar    = $("#btnAsignar");
const tbody         = $("#tbodySuc");
const btnReset      = $("#btnReset");

const fmt = (n) => new Intl.NumberFormat('es-MX', {maximumFractionDigits:0}).format(n||0);

let sucursalesData = [];

// Cargar datos del inventario
async function cargarInventario() {
  try {
    const data = await window.api.getInventario();
    
    // Actualizar badges
    badgeBodega.textContent = fmt(data.bodega);
    
    const totalAsignado = (data.sucursales || []).reduce((sum, s) => sum + (s.en_sucursal || 0), 0);
    badgeAsignado.textContent = fmt(totalAsignado);
    
    // Guardar datos
    sucursalesData = data.sucursales || [];
    
    // Llenar select
    fillSelect();
    
    // Renderizar tabla
    renderTabla();
    
  } catch (error) {
    console.error('Error cargando inventario:', error);
    alert('Error al cargar inventario. Verifica tu sesión.');
    if (error.message.includes('Token')) {
      window.location.href = 'index.html';
    }
  }
}

function fillSelect() {
  const prev = selSucursal.value;
  selSucursal.innerHTML = sucursalesData
    .slice()
    .sort((a,b) => (b.meta||0) - (a.meta||0))
    .map(s => `<option value="${s.id}">${s.nombre}</option>`)
    .join("");
  
  if ([...selSucursal.options].some(o => o.value === prev)) {
    selSucursal.value = prev;
  }
}

function renderTabla() {
  tbody.innerHTML = sucursalesData
    .slice()
    .sort((a,b) => (b.meta||0) - (a.meta||0))
    .map(suc => `
      <tr data-id="${suc.id}">
        <td>${suc.nombre}</td>
        <td class="right meta-cell">${fmt(suc.meta || 0)}</td>
        <td class="right">${fmt(suc.en_sucursal || 0)}</td>
        <td class="right">
          <div class="actions">
            <input class="input-devolver" type="number" min="1" step="1" value="50" />
          </div>
        </td>
       <td style="text-align:center;">
  <div class="actions">
    <button class="btn-devolver">Devolver</button>
  </div>
</td>
      </tr>
    `)
    .join("");
}

// Asignar desde bodega
btnAsignar?.addEventListener('click', async () => {
  const sucursal_id = parseInt(selSucursal.value);
  const cantidad = parseInt(inpCantidad.value || "0", 10);
  
  if (!sucursal_id || !Number.isFinite(cantidad) || cantidad <= 0) {
    alert('Ingresa una cantidad válida');
    return;
  }

  btnAsignar.disabled = true;
  btnAsignar.textContent = 'Asignando...';

  try {
    await window.api.asignarDesdeBodega(sucursal_id, cantidad);
    
    // Recargar inventario
    await cargarInventario();
    
    alert(`✅ ${cantidad} despensas asignadas correctamente`);
    
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  } finally {
    btnAsignar.disabled = false;
    btnAsignar.textContent = 'Asignar desde Bodega';
  }
});

// Devolver a bodega (delegación de eventos)
tbody?.addEventListener('click', async (e) => {
  if (!e.target.matches('.btn-devolver')) return;

  const tr = e.target.closest('tr');
  const id = parseInt(tr?.dataset?.id);
  const input = tr?.querySelector('.input-devolver');
  const cantidad = parseInt(input?.value || "0", 10);
  
  if (!id || !Number.isFinite(cantidad) || cantidad <= 0) {
    alert('Ingresa una cantidad válida');
    return;
  }

  e.target.disabled = true;
  e.target.textContent = 'Devolviendo...';

  try {
    await window.api.devolverABodega(id, cantidad);
    
    // Recargar inventario
    await cargarInventario();
    
    alert(`✅ ${cantidad} despensas devueltas a bodega`);
    
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
    e.target.disabled = false;
    e.target.textContent = 'Devolver';
  }
});

// Reset demo - Con PIN de supervisor
const PIN_SUPERVISOR = '1234'; // TODO: Cambiar en producción

btnReset?.addEventListener('click', async () => {
  const pin = prompt('🔒 Ingresa el PIN de supervisor para resetear el inventario:');
  
  if (!pin) return;
  
  if (pin !== PIN_SUPERVISOR) {
    alert('❌ PIN incorrecto. Solo supervisores pueden resetear el inventario.');
    return;
  }
  
  if (!confirm('⚠️ ADVERTENCIA: Esto reiniciará TODO el inventario a valores iniciales.\n\n- Bodega: 10,500\n- Todas las sucursales: 0\n- Entregas: Se mantendrán\n\n¿Estás seguro de continuar?')) {
    return;
  }
  
  btnReset.disabled = true;
  btnReset.textContent = 'Reseteando...';
  
  try {
    // Llamar al endpoint de reset en el backend
    const response = await fetch('http://localhost:3000/api/inventario/reset', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al resetear');
    }
    
    alert('✅ Inventario reseteado exitosamente');
    await cargarInventario();
    
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  } finally {
    btnReset.disabled = false;
    btnReset.textContent = 'Reset demo';
  }
});

// Auto-refresh cada 10 segundos
setInterval(cargarInventario, 10000);

// Cargar al inicio
cargarInventario();