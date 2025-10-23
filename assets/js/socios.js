// socios.js - Gestión completa de socios
const $ = (s) => document.querySelector(s);

const searchSocios = $('#searchSocios');
const filtroEstatus = $('#filtroEstatus');
const tablaSocios = $('#tablaSocios');
const paginacion = $('#paginacion');
const totalSocios = $('#totalSocios');
const btnAgregarSocio = $('#btnAgregarSocio');
const btnExportar = $('#btnExportar');
const modalAgregar = $('#modalAgregar');

const PIN_ADMIN = '1234'; // TODO: Cambiar en producción

let paginaActual = 1;
let busquedaActual = '';
let filtroActual = 'todos';

// Cargar socios
async function cargarSocios(page = 1) {
  paginaActual = page;
  
  try {
    const params = new URLSearchParams({
      page,
      limit: 50,
      search: busquedaActual,
      filtro: filtroActual
    });

    const response = await fetch(`https://despensas-san-jose.onrender.com/api/socios?${params}`, {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    renderTabla(data.socios);
    renderPaginacion(data.page, data.totalPages);
    totalSocios.textContent = `(${data.total} socios)`;

  } catch (error) {
    console.error('Error cargando socios:', error);
    tablaSocios.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:20px;">Error al cargar socios</td></tr>';
  }
}

function renderTabla(socios) {
  if (socios.length === 0) {
    tablaSocios.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">No se encontraron socios</td></tr>';
    return;
  }

  tablaSocios.innerHTML = socios.map(s => `
    <tr>
      <td><strong>${s.numero_socio}</strong></td>
      <td>${s.nombre}</td>
      <td>${s.credencial || '-'}</td>
      <td>
        <span class="badge-status ${s.entregado ? 'badge-entregado' : 'badge-pendiente'}">
          ${s.entregado ? '✅ Entregado' : '⏳ Pendiente'}
        </span>
      </td>
      <td class="right">
        <div class="table-actions">
          <button class="btn-sm btn-warning" onclick="cambiarEstatus(${s.id}, ${s.entregado})">
            ${s.entregado ? '🔄 Marcar Pendiente' : '✅ Marcar Entregado'}
          </button>
          <button class="btn-sm btn-danger" onclick="eliminarSocio(${s.id}, '${s.numero_socio}', '${s.nombre}')">
            🗑️ Eliminar
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPaginacion(pagina, totalPaginas) {
  if (totalPaginas <= 1) {
    paginacion.innerHTML = '';
    return;
  }

  let html = `
    <button ${pagina === 1 ? 'disabled' : ''} onclick="cargarSocios(${pagina - 1})">
      ← Anterior
    </button>
    <span style="padding:0 10px;">Página ${pagina} de ${totalPaginas}</span>
    <button ${pagina === totalPaginas ? 'disabled' : ''} onclick="cargarSocios(${pagina + 1})">
      Siguiente →
    </button>
  `;

  paginacion.innerHTML = html;
}

// Búsqueda con debounce
let timeoutSearch;
searchSocios.addEventListener('input', (e) => {
  clearTimeout(timeoutSearch);
  busquedaActual = e.target.value.trim();
  timeoutSearch = setTimeout(() => cargarSocios(1), 300);
});

// Filtro
filtroEstatus.addEventListener('change', (e) => {
  filtroActual = e.target.value;
  cargarSocios(1);
});

// Abrir modal agregar
btnAgregarSocio.addEventListener('click', () => {
  modalAgregar.classList.add('show');
  $('#nuevoNumero').value = '';
  $('#nuevoNombre').value = '';
  $('#nuevaCredencial').value = '';
  $('#nuevoNumero').focus();
});

// Cerrar modal
window.cerrarModal = () => {
  modalAgregar.classList.remove('show');
};

// Guardar nuevo socio
$('#btnGuardarSocio').addEventListener('click', async () => {
  const numero = $('#nuevoNumero').value.trim();
  const nombre = $('#nuevoNombre').value.trim();
  const credencial = $('#nuevaCredencial').value.trim();

  if (!numero || !nombre) {
    alert('⚠️ Número de socio y nombre son obligatorios');
    return;
  }

  // Solicitar PIN
  const pin = prompt('🔒 Ingresa el PIN de administrador:');
  if (pin !== PIN_ADMIN) {
    alert('❌ PIN incorrecto');
    return;
  }

  try {
    const response = await fetch('https://despensas-san-jose.onrender.com/api/socios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      },
      body: JSON.stringify({
        numero_socio: numero,
        nombre: nombre,
        credencial: credencial || numero
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    alert('✅ Socio agregado exitosamente');
    cerrarModal();
    cargarSocios(paginaActual);

  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  }
});

// Cambiar estatus
window.cambiarEstatus = async (id, estatusActual) => {
  const nuevoEstatus = estatusActual ? 0 : 1;
  const accion = nuevoEstatus ? 'ENTREGADO' : 'PENDIENTE';

  if (!confirm(`¿Cambiar estatus a ${accion}?\n\n⚠️ Esta acción debe usarse solo en casos especiales (despensa dañada, etc.)`)) {
    return;
  }

  const pin = prompt('🔒 Ingresa el PIN de administrador:');
  if (pin !== PIN_ADMIN) {
    alert('❌ PIN incorrecto');
    return;
  }

  try {
    const response = await fetch(`https://despensas-san-jose.onrender.com/api/socios/${id}/estatus`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      },
      body: JSON.stringify({ entregado: nuevoEstatus })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    alert('✅ Estatus actualizado');
    cargarSocios(paginaActual);

  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  }
};

// Eliminar socio
window.eliminarSocio = async (id, numero, nombre) => {
  if (!confirm(`⚠️ ¿Eliminar socio?\n\nNúmero: ${numero}\nNombre: ${nombre}\n\nEsta acción NO se puede deshacer.`)) {
    return;
  }

  const pin = prompt('🔒 Ingresa el PIN de administrador:');
  if (pin !== PIN_ADMIN) {
    alert('❌ PIN incorrecto');
    return;
  }

  try {
    const response = await fetch(`https://despensas-san-jose.onrender.com/api/socios/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    alert('✅ Socio eliminado');
    cargarSocios(paginaActual);

  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  }
};

// Exportar a Excel
btnExportar.addEventListener('click', async () => {
  if (!confirm('📊 ¿Exportar todos los socios a Excel?')) {
    return;
  }

  try {
    const response = await fetch('https://despensas-san-jose.onrender.com/api/socios?limit=999999', {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Error al exportar');
    }

    const data = await response.json();
    
    // CORRECCIÓN: El API devuelve "socios", no "data"
    if (!data.socios || data.socios.length === 0) {
      alert('❌ No hay socios para exportar');
      return;
    }
    
    // Preparar datos para Excel
    const datos = data.socios.map(socio => ({
      'Numero Socio': socio.numero_socio,
      'Nombre': socio.nombre,
      'Credencial': socio.credencial,
      'Estatus': socio.entregado ? 'ENTREGADO' : 'PENDIENTE',
      'Fecha Entrega': socio.fecha_entrega || 'N/A'
    }));
    
    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 15 },  // Numero Socio
      { wch: 30 },  // Nombre
      { wch: 15 },  // Credencial
      { wch: 12 },  // Estatus
      { wch: 20 }   // Fecha Entrega
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Socios');
    
    // Generar nombre de archivo con fecha
    const fecha = new Date().toISOString().split('T')[0];
    const nombreArchivo = `socios_${fecha}.xlsx`;
    
    // Descargar
    XLSX.writeFile(wb, nombreArchivo);
    
    alert(`✅ Exportado: ${datos.length} socios\n📁 Archivo: ${nombreArchivo}`);

  } catch (error) {
    console.error('Error:', error);
    alert(`❌ Error al exportar: ${error.message}`);
  }
});

// Importar desde Excel
function importarExcel() {
  document.getElementById('fileExcel').click();
}

async function procesarExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Preguntar si reemplazar o agregar
  const modo = confirm(
    '🔄 ¿Cómo quieres importar?\n\n' +
    '✅ OK = REEMPLAZAR todos los socios (borra todo y carga el Excel)\n' +
    '❌ CANCELAR = AGREGAR socios nuevos (mantiene los actuales)'
  );
  
  const accion = modo ? 'reemplazar' : 'agregar';
  
  if (accion === 'reemplazar') {
    if (!confirm('⚠️ ADVERTENCIA: Esto borrará TODOS los socios actuales. ¿Estás seguro?')) {
      event.target.value = '';
      return;
    }
  }
  
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    
    if (jsonData.length === 0) {
      alert('❌ El archivo está vacío');
      return;
    }
    
    // Si es reemplazar, borrar todos primero
    if (accion === 'reemplazar') {
      const response = await fetch('https://despensas-san-jose.onrender.com/api/socios/borrar-todos', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error al borrar socios');
    }
    
    // Procesar cada fila
    let exitosos = 0;
    let errores = 0;
    
    for (const row of jsonData) {
      try {
        const numero = row['Numero Socio'] || row['Numero'] || row['No. Socio'] || row['numero_socio'];
        const nombre = row['Nombre'] || row['Nombre Completo'] || row['nombre'];
        const credencial = row['Credencial'] || row['credencial'] || numero;
        
        if (!numero || !nombre) {
          errores++;
          continue;
        }
        
        const response = await fetch('https://despensas-san-jose.onrender.com/api/socios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
          },
          body: JSON.stringify({
            numero_socio: String(numero).trim(),
            nombre: String(nombre).trim(),
            credencial: String(credencial).trim()
          })
        });
        
        if (response.ok) {
          exitosos++;
        } else {
          errores++;
        }
        
      } catch (error) {
        errores++;
      }
    }
    
    const modoTexto = accion === 'reemplazar' ? 'REEMPLAZADOS' : 'AGREGADOS';
    alert(`✅ Importación completada:\n\n✓ ${modoTexto}: ${exitosos}\n✗ Errores: ${errores}`);
    cargarSocios();
    
  } catch (error) {
    alert(`❌ Error al procesar el archivo: ${error.message}`);
  }
  
  event.target.value = '';
}

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cerrarModal();
  }
});

// Cargar socios al iniciar
cargarSocios();