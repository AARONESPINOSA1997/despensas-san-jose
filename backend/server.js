// server.js - Servidor principal de Despensas San José
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret temporal (mientras arreglamos el .env)
const JWT_SECRET = 'mi_secreto_temporal_12345';

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ============================================
// AUTENTICACIÓN
// ============================================

// Middleware para verificar token
const verificarToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar roles
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
};

// Middleware para verificar acceso a sucursales
const verificarSucursal = (req, res, next) => {
  const { rol, sucursales_permitidas } = req.usuario;
  
  // Super usuario y admin tienen acceso a todo
  if (rol === 'super' || rol === 'admin') {
    return next();
  }
  
  // Cajero volante también tiene acceso a todas (con PIN)
  if (rol === 'cajero_volante') {
    return next();
  }
  
  // Encargados y cajeros fijos: verificar sucursal
  const sucursal_id = req.body.sucursal_id || req.params.sucursal_id || req.query.sucursal_id;
  
  if (sucursales_permitidas === 'all' || sucursales_permitidas.split(',').includes(String(sucursal_id))) {
    return next();
  }
  
  return res.status(403).json({ error: 'No tienes acceso a esta sucursal' });
};

// Login
app.post('/api/auth/login', (req, res) => {
  const { usuario, password } = req.body;

  db.get('SELECT * FROM usuarios WHERE usuario = ?', [usuario], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const passwordValido = await bcryptjs.compare(password, user.password);
    
    if (!passwordValido) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        usuario: user.usuario, 
        rol: user.rol,
        sucursales_permitidas: user.sucursales_permitidas 
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        rol: user.rol,
        sucursales_permitidas: user.sucursales_permitidas
      }
    });
  });
});

// ============================================
// DASHBOARD
// ============================================

app.get('/api/dashboard', verificarToken, (req, res) => {
  const sql = `
    SELECT 
      s.id,
      s.nombre,
      s.meta,
      s.en_sucursal,
      COALESCE(SUM(e.cantidad), 0) as entregadas
    FROM sucursales s
    LEFT JOIN entregas e ON s.id = e.sucursal_id
    GROUP BY s.id
    ORDER BY s.meta DESC
  `;

  db.all(sql, [], (err, sucursales) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener datos' });
    }

    res.json({ sucursales });
  });
});

// ============================================
// INVENTARIO
// ============================================

// Obtener estado de inventario
app.get('/api/inventario', verificarToken, verificarRol('super', 'admin'), (req, res) => {
  db.get('SELECT bodega FROM inventario WHERE id = 1', [], (err, inv) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }

    db.all('SELECT * FROM sucursales ORDER BY meta DESC', [], (err, sucursales) => {
      if (err) {
        return res.status(500).json({ error: 'Error del servidor' });
      }

      res.json({
        bodega: inv.bodega,
        sucursales
      });
    });
  });
});

// Asignar desde bodega a sucursal
app.post('/api/inventario/asignar', verificarToken, verificarRol('super'), (req, res) => {
  const { sucursal_id, cantidad } = req.body;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Verificar bodega
    db.get('SELECT bodega FROM inventario WHERE id = 1', [], (err, inv) => {
      if (err || !inv || inv.bodega < cantidad) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'No hay suficiente en bodega' });
      }

      // Descontar de bodega
      db.run('UPDATE inventario SET bodega = bodega - ? WHERE id = 1', [cantidad], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Error al actualizar bodega' });
        }

        // Sumar a sucursal
        db.run('UPDATE sucursales SET en_sucursal = en_sucursal + ? WHERE id = ?', 
          [cantidad, sucursal_id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Error al actualizar sucursal' });
            }

            db.run('COMMIT');
            res.json({ success: true, mensaje: 'Asignación exitosa' });
          }
        );
      });
    });
  });
});

// Devolver de sucursal a bodega
app.post('/api/inventario/devolver', verificarToken, verificarRol('super'), (req, res) => {
  const { sucursal_id, cantidad } = req.body;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.get('SELECT en_sucursal FROM sucursales WHERE id = ?', [sucursal_id], (err, suc) => {
      if (err || !suc || suc.en_sucursal < cantidad) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'No hay suficiente en sucursal' });
      }

      db.run('UPDATE sucursales SET en_sucursal = en_sucursal - ? WHERE id = ?', 
        [cantidad, sucursal_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Error' });
          }

          db.run('UPDATE inventario SET bodega = bodega + ? WHERE id = 1', [cantidad], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Error' });
            }

            db.run('COMMIT');
            res.json({ success: true, mensaje: 'Devolución exitosa' });
          });
        }
      );
    });
  });
});
// ============================================
// POS - ENTREGAS
// ============================================

// Buscar socio por número o nombre
app.get('/api/socios/buscar', verificarToken, (req, res) => {
  const { query } = req.query;

  const sql = `
    SELECT * FROM socios 
    WHERE numero_socio LIKE ? OR nombre LIKE ?
    LIMIT 10
  `;

  db.all(sql, [`%${query}%`, `%${query}%`], (err, socios) => {
    if (err) {
      return res.status(500).json({ error: 'Error al buscar' });
    }
    res.json({ socios });
  });
});

// Registrar entrega
app.post('/api/pos/entregar', verificarToken, verificarSucursal, (req, res) => {
  const { socio_id, sucursal_id, cantidad, quien_recoge } = req.body;
  const usuario_id = req.usuario.id;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Verificar que el socio no haya recogido
    db.get('SELECT entregado FROM socios WHERE id = ?', [socio_id], (err, socio) => {
      if (err || !socio) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Socio no encontrado' });
      }

      if (socio.entregado === 1) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'Este socio ya recogió su despensa' });
      }

      // Verificar stock en sucursal
      db.get('SELECT en_sucursal FROM sucursales WHERE id = ?', [sucursal_id], (err, suc) => {
        if (err || !suc || suc.en_sucursal < cantidad) {
          db.run('ROLLBACK');
          return res.status(400).json({ error: 'No hay suficiente stock en sucursal' });
        }

        // Registrar entrega
        const sql = `
          INSERT INTO entregas (socio_id, sucursal_id, usuario_id, cantidad, quien_recoge)
          VALUES (?, ?, ?, ?, ?)
        `;

        db.run(sql, [socio_id, sucursal_id, usuario_id, cantidad, quien_recoge], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Error al registrar entrega' });
          }

          // Marcar socio como entregado
          db.run('UPDATE socios SET entregado = 1 WHERE id = ?', [socio_id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Error' });
            }

            // Descontar de sucursal
            db.run('UPDATE sucursales SET en_sucursal = en_sucursal - ? WHERE id = ?', 
              [cantidad, sucursal_id], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Error' });
                }

                db.run('COMMIT');
                res.json({ 
                  success: true, 
                  mensaje: 'Entrega registrada exitosamente',
                  entrega_id: this.lastID
                });
              }
            );
          });
        });
      });
    });
  });
});

// ============================================
// GESTIÓN DE SOCIOS
// ============================================
// Borrar todos los socios (para importación con reemplazo)
app.delete('/api/socios/borrar-todos', verificarToken, (req, res) => {
  db.run('DELETE FROM socios', (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, mensaje: 'Todos los socios eliminados' });
  });
});
// Obtener todos los socios con paginación
app.get('/api/socios', verificarToken, (req, res) => {
  const { page = 1, limit = 50, search = '', filtro = 'todos' } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = '';
  let params = [];

  if (search) {
    whereClause = 'WHERE numero_socio LIKE ? OR nombre LIKE ?';
    params = [`%${search}%`, `%${search}%`];
  }

  if (filtro === 'entregados' && !search) {
    whereClause = 'WHERE entregado = 1';
  } else if (filtro === 'pendientes' && !search) {
    whereClause = 'WHERE entregado = 0';
  } else if (filtro !== 'todos' && search) {
    whereClause += ` AND entregado = ${filtro === 'entregados' ? 1 : 0}`;
  }

  // Contar total
  db.get(`SELECT COUNT(*) as total FROM socios ${whereClause}`, params, (err, count) => {
    if (err) {
      return res.status(500).json({ error: 'Error al contar socios' });
    }

    // Obtener socios paginados
    const sql = `SELECT * FROM socios ${whereClause} ORDER BY numero_socio ASC LIMIT ? OFFSET ?`;
    db.all(sql, [...params, limit, offset], (err, socios) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener socios' });
      }

      res.json({
        socios,
        total: count.total,
        page: parseInt(page),
        totalPages: Math.ceil(count.total / limit)
      });
    });
  });
});

// Agregar nuevo socio
app.post('/api/socios', verificarToken, verificarRol('super', 'admin', 'encargado'), (req, res) => {
  const { numero_socio, nombre, credencial } = req.body;

  if (!numero_socio || !nombre) {
    return res.status(400).json({ error: 'Número de socio y nombre son requeridos' });
  }

  const sql = 'INSERT INTO socios (numero_socio, nombre, credencial, entregado) VALUES (?, ?, ?, 0)';
  db.run(sql, [numero_socio, nombre, credencial || numero_socio], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Este número de socio ya existe' });
      }
      return res.status(500).json({ error: 'Error al agregar socio' });
    }

    res.json({ success: true, id: this.lastID, mensaje: 'Socio agregado exitosamente' });
  });
});

// Cambiar estatus de entrega
app.patch('/api/socios/:id/estatus', verificarToken, verificarRol('super', 'admin', 'encargado'), (req, res) => {
  const { id } = req.params;
  const { entregado } = req.body;

  if (typeof entregado !== 'number' || (entregado !== 0 && entregado !== 1)) {
    return res.status(400).json({ error: 'Estatus inválido' });
  }

  db.run('UPDATE socios SET entregado = ? WHERE id = ?', [entregado, id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al actualizar estatus' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Socio no encontrado' });
    }

    res.json({ success: true, mensaje: 'Estatus actualizado' });
  });
});

// Eliminar socio
app.delete('/api/socios/:id', verificarToken, verificarRol('super', 'admin', 'encargado'), (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM socios WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar socio' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Socio no encontrado' });
    }

    res.json({ success: true, mensaje: 'Socio eliminado' });
  });
});

// Exportar socios a CSV
app.get('/api/socios/exportar/csv', verificarToken, (req, res) => {
  db.all('SELECT numero_socio, nombre, credencial, entregado FROM socios ORDER BY numero_socio', [], (err, socios) => {
    if (err) {
      return res.status(500).json({ error: 'Error al exportar' });
    }

    // Crear CSV
    const csv = [
      'Numero Socio,Nombre,Credencial,Entregado',
      ...socios.map(s => `${s.numero_socio},"${s.nombre}",${s.credencial},${s.entregado ? 'Si' : 'No'}`)
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=socios.csv');
    res.send('\uFEFF' + csv); // BOM para UTF-8
  });
});

// Reset inventario (solo super admin)
app.post('/api/inventario/reset', verificarToken, verificarRol('super'), (req, res) => {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Resetear bodega a 10500
    db.run('UPDATE inventario SET bodega = 10500 WHERE id = 1', (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Error al resetear bodega' });
      }
      
      // Resetear todas las sucursales a 0
      db.run('UPDATE sucursales SET en_sucursal = 0', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Error al resetear sucursales' });
        }
        
        db.run('COMMIT');
        res.json({ 
          success: true, 
          mensaje: 'Inventario reseteado exitosamente',
          bodega: 10500,
          sucursales_reseteadas: true
        });
      });
    });
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:3000`);
  console.log(`📦 Base de datos inicializada`);
});