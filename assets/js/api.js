// api.js - Cliente para comunicarse con el backend
const API_URL = 'https://despensas-san-jose.onrender.com';

class API {
  constructor() {
    this.token = sessionStorage.getItem('token');
  }

  // Guardar token después del login
  setToken(token) {
    this.token = token;
    sessionStorage.setItem('token', token);
  }

  // Headers con autenticación
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Método genérico para hacer peticiones
  async request(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: this.getHeaders()
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la petición');
      }

      return data;
    } catch (error) {
      console.error('Error en API:', error);
      throw error;
    }
  }

  // ============================================
  // AUTENTICACIÓN
  // ============================================

  async login(usuario, password) {
    const data = await this.request('/auth/login', 'POST', { usuario, password });
    this.setToken(data.token);
    return data;
  }

  logout() {
    this.token = null;
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'index.html';
  }

  // ============================================
  // DASHBOARD
  // ============================================

  async getDashboard() {
    return await this.request('/dashboard');
  }

  // ============================================
  // INVENTARIO
  // ============================================

  async getInventario() {
    return await this.request('/inventario');
  }

  async asignarDesdeBodega(sucursal_id, cantidad) {
    return await this.request('/inventario/asignar', 'POST', { 
      sucursal_id, 
      cantidad 
    });
  }

  async devolverABodega(sucursal_id, cantidad) {
    return await this.request('/inventario/devolver', 'POST', { 
      sucursal_id, 
      cantidad 
    });
  }

  // ============================================
  // POS / SOCIOS
  // ============================================

  async buscarSocios(query) {
    return await this.request(`/socios/buscar?query=${encodeURIComponent(query)}`);
  }

  async registrarEntrega(socio_id, sucursal_id, cantidad, quien_recoge) {
    return await this.request('/pos/entregar', 'POST', {
      socio_id,
      sucursal_id,
      cantidad,
      quien_recoge
    });
  }

  // ============================================
  // GESTIÓN DE SOCIOS (NUEVO)
  // ============================================

  async getSocios(page, limit, search, filtro) {
    const params = new URLSearchParams({ page, limit, search, filtro });
    return await this.request(`/socios?${params}`);
  }

  async agregarSocio(numero_socio, nombre, credencial) {
    return await this.request('/socios', 'POST', {
      numero_socio,
      nombre,
      credencial
    });
  }

  async cambiarEstatusSocio(id, entregado) {
    return await this.request(`/socios/${id}/estatus`, 'PATCH', { entregado });
  }

  async eliminarSocio(id) {
    return await this.request(`/socios/${id}`, 'DELETE');
  }
}

// Instancia global
window.api = new API();