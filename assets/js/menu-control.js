// menu-control.js - Control de menús según rol de usuario

(function() {
  const rol = sessionStorage.getItem('dsj_rol');
  
  if (!rol) return; // Si no hay rol, no hacer nada
  
  // Definir qué puede ver cada rol
  const permisos = {
    super: ['dashboard', 'inventario', 'pos', 'socios', 'usuarios'],
    admin: ['dashboard', 'pos', 'socios', 'usuarios'],
    encargado: ['dashboard', 'pos', 'socios'],
    cajero: ['dashboard', 'pos'],
    cajero_volante: ['dashboard', 'pos']
  };
  
  const menuPermitido = permisos[rol] || [];
  
  // Ocultar opciones del menú según rol
  document.addEventListener('DOMContentLoaded', function() {
    const menuItems = document.querySelectorAll('nav a[href]');
    
    menuItems.forEach(item => {
      const href = item.getAttribute('href');
      
      // Determinar qué módulo es cada link
      let modulo = null;
      if (href.includes('dashboard')) modulo = 'dashboard';
      else if (href.includes('inventario')) modulo = 'inventario';
      else if (href.includes('pos')) modulo = 'pos';
      else if (href.includes('socios')) modulo = 'socios';
      else if (href.includes('usuarios')) modulo = 'usuarios';
      
      // Si el usuario NO tiene permiso, ocultar el menú
      if (modulo && !menuPermitido.includes(modulo)) {
        item.style.display = 'none';
      }
    });
    
    // Ocultar botones según permisos
    ocultarBotonesPorRol();
  });
  
  function ocultarBotonesPorRol() {
    // Botón "Reset demo" - solo super usuario
    const btnReset = document.querySelector('#btnReset, button[onclick*="reset"]');
    if (btnReset && rol !== 'super') {
      btnReset.style.display = 'none';
    }
    
    // Inventario - solo super puede asignar/devolver
    if (window.location.href.includes('inventario')) {
      const btnAsignar = document.querySelector('#btnAsignar, button[onclick*="asignar"]');
      const btnDevolver = document.querySelectorAll('.btn-devolver');
      
      if (rol !== 'super') {
        if (btnAsignar) btnAsignar.style.display = 'none';
        btnDevolver.forEach(btn => btn.style.display = 'none');
      }
    }
    
    // Socios - cajeros solo pueden consultar
    if (window.location.href.includes('socios')) {
      if (rol === 'cajero' || rol === 'cajero_volante') {
        const btnAgregar = document.querySelector('button[onclick*="agregar"], #btnAgregarSocio');
        const botonesEditar = document.querySelectorAll('button[onclick*="editar"], .btn-editar');
        const botonesEliminar = document.querySelectorAll('button[onclick*="eliminar"], .btn-eliminar');
        
        if (btnAgregar) btnAgregar.style.display = 'none';
        botonesEditar.forEach(btn => btn.style.display = 'none');
        botonesEliminar.forEach(btn => btn.style.display = 'none');
      }
    }
  }
})();