// dashboard.js - Con API Real
const $  = (s, c=document) => c.querySelector(s);

const grid      = $("#grid");
const totMetaEl = $("#totMeta");
const totStockEl= $("#totStock");
const totEntEl  = $("#totEnt");

function sum(arr, sel){ return (arr||[]).reduce((a,x)=> a + (sel(x)||0), 0); }
function fmt(n){ return new Intl.NumberFormat('es-MX',{maximumFractionDigits:0}).format(n||0); }

function semaforo(meta, ent){
  if (!meta) return "baja";
  const p = (ent/meta)*100;
  if (p >= 75) return "alta";
  if (p >= 40) return "media";
  return "baja";
}

function calcularPorcentaje(meta, ent) {
  if (!meta) return 0;
  return Math.min(100, Math.round((ent / meta) * 100));
}

async function render() {
  try {
    // Llamar a la API
    const data = await window.api.getDashboard();
    const rol = sessionStorage.getItem('dsj_rol');
    const sucursalesPermitidas = sessionStorage.getItem('dsj_sucursales');
    
    let suc = data.sucursales || [];
    
    // Filtrar sucursales según permisos
    if (sucursalesPermitidas !== 'all' && sucursalesPermitidas) {
      const idsPermitidos = sucursalesPermitidas.split(',').map(id => parseInt(id));
      suc = data.sucursales.filter(s => idsPermitidos.includes(s.id));
    }
    
    // Cajero volante: solo mostrar la sucursal activa del POS
if (rol === 'cajero_volante') {
  const sucursalPOS = sessionStorage.getItem('pos_sucursal_actual');
  if (sucursalPOS) {
    suc = data.sucursales.filter(s => s.id === parseInt(sucursalPOS));
  } else {
    // Si no tiene sucursal activa, mostrar mensaje
    grid.innerHTML = '<p style="padding:20px;text-align:center;color:#666;">⚠️ Primero selecciona una sucursal en el POS</p>';
    return; // Detener aquí
  }
}

    // Totales de la banda superior
    const tMeta  = sum(suc, x=>x.meta);
    const tStock = sum(suc, x=>x.en_sucursal);
    const tEnt   = sum(suc, x=>x.entregadas);
    
    totMetaEl.textContent  = fmt(tMeta);
    totStockEl.textContent = fmt(tStock);
    totEntEl.textContent   = fmt(tEnt);

    // Tarjetas por sucursal
    grid.innerHTML = suc.map(s=>{
      const sem = semaforo(s.meta||0, s.entregadas||0);
      const porcentaje = calcularPorcentaje(s.meta||0, s.entregadas||0);
      
      return `
        <article class="card">
          <header>
            <span>${s.nombre}</span>
          </header>
          <div class="body">
            <div class="metrics">
              <div class="metric muted">
                <small>ASIGNADAS</small>
                <strong>${fmt(s.meta||0)}</strong>
              </div>
              <div class="metric emph stock">
                <small>EN STOCK</small>
                <strong>${fmt(s.en_sucursal||0)}</strong>
              </div>
              <div class="metric emph ent">
                <small>ENTREGADAS</small>
                <strong>${fmt(s.entregadas||0)}</strong>
              </div>
            </div>
            <div style="margin-top: 16px;">
              <div class="progress-info">
                <span class="progress-label">Progreso</span>
                <span class="progress-percent">${porcentaje}%</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar ${sem}" style="width: ${porcentaje}%"></div>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

  } catch (error) {
    console.error('Error cargando dashboard:', error);
    grid.innerHTML = '<p style="padding:20px;color:#ef4444;">Error al cargar datos. Verifica tu conexión.</p>';
  }
}

// Auto-refresh cada 5 segundos
setInterval(render, 5000);

// Renderizar al cargar
render();