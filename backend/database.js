// database.js - Configuración de la base de datos
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'despensas.db');
const db = new sqlite3.Database(dbPath);

// Inicializar base de datos
db.serialize(() => {
  // Tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('super', 'admin', 'encargado', 'cajero', 'cajero_volante')),
      sucursales_permitidas TEXT,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de sucursales
  db.run(`
    CREATE TABLE IF NOT EXISTS sucursales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      meta INTEGER DEFAULT 0,
      en_sucursal INTEGER DEFAULT 0
    )
  `);

  // Tabla de socios
  db.run(`
    CREATE TABLE IF NOT EXISTS socios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_socio TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      credencial TEXT,
      entregado INTEGER DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de entregas
  db.run(`
    CREATE TABLE IF NOT EXISTS entregas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      socio_id INTEGER NOT NULL,
      sucursal_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      cantidad INTEGER DEFAULT 1,
      quien_recoge TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (socio_id) REFERENCES socios(id),
      FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  // Tabla de inventario (bodega central)
  db.run(`
    CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY DEFAULT 1,
      bodega INTEGER DEFAULT 10500
    )
  `);

  // ============================================
  // DATOS DE PRUEBA
  // ============================================

  // Verificar si ya existen datos
  db.get('SELECT COUNT(*) as count FROM usuarios', [], async (err, row) => {
    if (err || row.count > 0) return;

    console.log('📦 Creando datos de prueba...');

    // Usuarios de prueba (password: "123456" para todos)
    const passwordHash = await bcrypt.hash('123456', 10);

    const usuarios = [
      {
        usuario: 'super_usuario',
        password: passwordHash,
        nombre: 'Administrador Principal',
        rol: 'super',
        sucursales_permitidas: 'all'
      },
      {
        usuario: 'admin',
        password: passwordHash,
        nombre: 'Administrador de Promociones',
        rol: 'admin',
        sucursales_permitidas: 'all'
      },
      {
        usuario: 'encargado_matriz',
        password: passwordHash,
        nombre: 'Encargado Matriz',
        rol: 'encargado',
        sucursales_permitidas: '1' // Solo Matriz
      },
      {
        usuario: 'cajero_matriz',
        password: passwordHash,
        nombre: 'Cajero Matriz',
        rol: 'cajero',
        sucursales_permitidas: '1' // Solo Matriz
      },
      {
        usuario: 'cajero_volante',
        password: passwordHash,
        nombre: 'Ejecutivo Comercial',
        rol: 'cajero_volante',
        sucursales_permitidas: 'all'
      }
    ];

    usuarios.forEach(u => {
      db.run(
        'INSERT INTO usuarios (usuario, password, nombre, rol, sucursales_permitidas) VALUES (?, ?, ?, ?, ?)',
        [u.usuario, u.password, u.nombre, u.rol, u.sucursales_permitidas]
      );
    });

    // Sucursales con metas
    const sucursales = [
      ['Matriz', 3350],
      ['Tlaquepaque', 1200],
      ['Insurgentes', 845],
      ['Getsemaní', 640],
      ['Tonalá', 565],
      ['San Eugenio', 590],
      ['El Sauz', 405],
      ['Circunvalación', 380],
      ['Laurel', 385],
      ['La Bandera', 300],
      ['San Sebastián', 250],
      ['Centro Sur', 275],
      ['San Onofre', 230],
      ['Copérnico', 225],
      ['Santa Teresita', 190],
      ['Terraza Belenes', 200],
      ['Constitución', 140],
      ['San Isidro', 135],
      ['Ocotlán', 30],
      ['Plaza Atemajac', 35],
      ['Tepatitlán', 10],
      ['Independencia', 10],
      ['Jocotepec', 10]
    ];

    sucursales.forEach(s => {
      db.run('INSERT INTO sucursales (nombre, meta, en_sucursal) VALUES (?, ?, 0)', s);
    });

    // Inventario inicial
    db.run('INSERT OR IGNORE INTO inventario (id, bodega) VALUES (1, 10500)');

    // Socios de prueba
    const socios = [
      ['000001', 'Juan Pérez García'],
      ['000002', 'María López Hernández'],
      ['000003', 'Pedro Ramírez Sánchez'],
      ['000004', 'Ana Martínez González'],
      ['000005', 'Carlos Rodríguez Torres'],
      ['000123', 'Luis Fernando Castro'],
      ['000456', 'Gabriela Morales Díaz'],
      ['000789', 'Roberto Jiménez Cruz']
    ];

    socios.forEach(s => {
      db.run('INSERT INTO socios (numero_socio, nombre, credencial, entregado) VALUES (?, ?, ?, 0)', 
        [s[0], s[1], s[0]]);
    });

    console.log('✅ Datos de prueba creados');
    console.log('👤 Usuarios de prueba:');
    console.log('   - super_usuario / 123456');
    console.log('   - admin / 123456');
    console.log('   - encargado_matriz / 123456');
    console.log('   - cajero_matriz / 123456');
    console.log('   - cajero_volante / 123456');
  });
});

module.exports = db;