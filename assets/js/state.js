// assets/js/state.js
(function () {
  const KEY = 'dsj_state_v1';
  const LAST = 'dsj_last_update';

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('Error leyendo estado:', err);
      return null;
    }
  }

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      localStorage.setItem(LAST, String(Date.now()));
    } catch (err) {
      console.error('Error guardando estado:', err);
    }
  }

  function lastUpdate() {
    const v = localStorage.getItem(LAST);
    return v ? Number(v) : 0;
  }

  // API pública
  window.AppState = {
    KEY,
    LAST,
    
    get() {
      const s = read();
      // Si aún no hay estado, inicializamos uno mínimo
      if (!s) {
        const init = {
          bodega: 10500,
          sucursales: []  // ✅ CORREGIDO: ahora es array
        };
        write(init);
        return init;
      }
      return s;
    },
    
    set(next) {
      write(next);
    },
    
    touch() {
      localStorage.setItem(LAST, String(Date.now()));
    },
    
    last() {
      return lastUpdate();
    },
    
    // util: actualizar con función
    update(mutator) {
      const s = this.get();
      mutator(s);
      write(s);
    },
    
    // NUEVO: método para resetear estado
    reset() {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LAST);
    }
  };
})();