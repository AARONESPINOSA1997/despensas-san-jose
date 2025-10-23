// generar-socios.js - Genera 10,500 socios falsos
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'despensas.db');
const db = new sqlite3.Database(dbPath);

// Nombres y apellidos mexicanos comunes
const nombres = [
  'Juan', 'José', 'María', 'Luis', 'Ana', 'Carlos', 'Pedro', 'Rosa', 'Miguel', 'Guadalupe',
  'Francisco', 'Juana', 'Antonio', 'Jesús', 'Margarita', 'Alejandro', 'Martha', 'Roberto', 'Isabel', 'Manuel',
  'Teresa', 'Ricardo', 'Patricia', 'Fernando', 'Laura', 'Jorge', 'Carmen', 'Sergio', 'Gabriela', 'Raúl',
  'Verónica', 'Arturo', 'Silvia', 'Eduardo', 'Andrea', 'Gerardo', 'Diana', 'Mario', 'Sandra', 'Alberto',
  'Mónica', 'Enrique', 'Claudia', 'Rafael', 'Liliana', 'David', 'Adriana', 'Héctor', 'Daniela', 'Oscar',
  'Leticia', 'Armando', 'Beatriz', 'Felipe', 'Norma', 'Ramón', 'Maricela', 'Guillermo', 'Rocío', 'Jaime',
  'Esther', 'Alfredo', 'Cecilia', 'Víctor', 'Alma', 'Julio', 'Susana', 'Martín', 'Irma', 'Rubén',
  'Gloria', 'Agustín', 'Yolanda', 'Salvador', 'Luz', 'Rodrigo', 'Dolores', 'Ernesto', 'Alicia', 'Pablo'
];

const apellidosPaternos = [
  'García', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Torres',
  'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes', 'Gutiérrez', 'Ortiz', 'Chávez',
  'Ruiz', 'Jiménez', 'Mendoza', 'Castro', 'Vargas', 'Romero', 'Herrera', 'Medina', 'Aguilar', 'Castillo',
  'Vázquez', 'Moreno', 'Ramos', 'Guerrero', 'Álvarez', 'Mendez', 'Salazar', 'Contreras', 'Campos', 'Rojas',
  'Navarro', 'Sandoval', 'Maldonado', 'Mejía', 'Delgado', 'Ríos', 'Estrada', 'Ibarra', 'Cervantes', 'Luna'
];

const apellidosMaternos = [
  'Silva', 'Domínguez', 'Vega', 'Santos', 'León', 'Velázquez', 'Cortés', 'Núñez', 'Fuentes', 'Carrillo',
  'Peña', 'Cabrera', 'Valdez', 'Soto', 'Pacheco', 'Lara', 'Miranda', 'Figueroa', 'Espinoza', 'Rubio',
  'Acosta', 'Parra', 'Guzmán', 'Ávila', 'Zavala', 'Cárdenas', 'Bustamante', 'Ochoa', 'Barrera', 'Padilla',
  'Solís', 'Villa', 'Coronado', 'Téllez', 'Trujillo', 'Villanueva', 'Camacho', 'Escobar', 'Galván', 'Mora',
  'Montoya', 'Arias', 'Ochoa', 'Suárez', 'Valencia', 'Duarte', 'Salinas', 'Becerra', 'Quintero', 'Ponce'
];

function generarNombre() {
  const nombre = nombres[Math.floor(Math.random() * nombres.length)];
  const apellidoP = apellidosPaternos[Math.floor(Math.random() * apellidosPaternos.length)];
  const apellidoM = apellidosMaternos[Math.floor(Math.random() * apellidosMaternos.length)];
  return `${nombre} ${apellidoP} ${apellidoM}`;
}

function generarNumeroSocio(num) {
  return num.toString().padStart(6, '0');
}

async function generarSocios() {
  console.log('🚀 Iniciando generación de 10,500 socios...');
  console.log('⏳ Esto puede tardar 1-2 minutos...\n');

  // Primero, eliminar socios existentes
  await new Promise((resolve) => {
    db.run('DELETE FROM socios', (err) => {
      if (err) console.error('Error limpiando socios:', err);
      console.log('🗑️  Socios anteriores eliminados');
      resolve();
    });
  });

  // Preparar statement para inserción masiva
  const stmt = db.prepare('INSERT INTO socios (numero_socio, nombre, credencial, entregado) VALUES (?, ?, ?, 0)');

  let insertados = 0;
  const totalSocios = 10500;
  const batchSize = 500;

  // Iniciar transacción para mayor velocidad
  db.run('BEGIN TRANSACTION');

  for (let i = 1; i <= totalSocios; i++) {
    const numeroSocio = generarNumeroSocio(i);
    const nombreCompleto = generarNombre();
    const credencial = numeroSocio;

    stmt.run(numeroSocio, nombreCompleto, credencial, (err) => {
      if (err) {
        console.error(`Error insertando socio ${numeroSocio}:`, err);
      }
    });

    insertados++;

    // Mostrar progreso cada 500 socios
    if (insertados % batchSize === 0) {
      const porcentaje = ((insertados / totalSocios) * 100).toFixed(1);
      console.log(`📊 Progreso: ${insertados}/${totalSocios} (${porcentaje}%)`);
    }
  }

  stmt.finalize(() => {
    db.run('COMMIT', () => {
      console.log('\n✅ ¡Generación completada!');
      console.log(`📋 Total de socios creados: ${insertados}`);
      console.log('🔢 Números: 000001 a 010500');
      console.log('\n💡 Ejemplos de búsqueda:');
      console.log('   - Por número: 000001, 005000, 010500');
      console.log('   - Por nombre: García, López, Juan, María\n');
      
      // Verificar con consulta
      db.get('SELECT COUNT(*) as total FROM socios', (err, row) => {
        if (row) {
          console.log(`✔️  Verificación: ${row.total} socios en la base de datos\n`);
        }
        db.close(() => {
          console.log('✅ Proceso completado. Ya puedes usar la app.\n');
          process.exit(0);
        });
      });
    });
  });
}

// Ejecutar
generarSocios().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});