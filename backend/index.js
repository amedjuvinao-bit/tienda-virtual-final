// backend/index.js
console.log('▶️ Iniciando backend/index.js');

require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
  quiet: true,
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const adminAccessGate = require('./middleware/adminAccessGate');

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------------------------------------------
 * Helper: require condicional (evita caídas)
 * ------------------------------------------- */
function tryRequire(relPath) {
  try {
    // Resuelve relativo a este archivo
    const mod = require(relPath);
    console.log(`➡️  Ruta cargada: ${relPath}`);
    return mod;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.warn(`⚠️  Ruta NO encontrada, se omite: ${relPath}`);
      return null;
    }
    // Otros errores reales sí deben verse
    console.error(`❌ Error al cargar ${relPath}:`, e.message);
    return null;
  }
}

/* ---------------------------------------------
 * Middlewares
 * ------------------------------------------- */
app.use(cors());
app.use(express.json());

/* ---------------------------------------------
 * Seguridad: Rate Limit
 * ------------------------------------------- */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
  },
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Demasiados intentos de login. Intenta más tarde.',
  },
});

app.use(globalLimiter);

/* ---------------------------------------------
 * Seguridad administrativa global
 * -------------------------------------------
 * Este middleware consulta el mapa global de rutas admin.
 * Si la ruta está registrada:
 * - valida token admin
 * - valida permiso requerido
 * - registra auditoría si aplica
 *
 * Si la ruta no está registrada, deja continuar normal.
 */
app.use(adminAccessGate);

/* ---------------------------------------------
 * Archivos estáticos (/uploads)
 * ------------------------------------------- */
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

/* ---------------------------------------------
 * Rutas API (se montan solo si existen)
 * ------------------------------------------- */
const productRoutes = tryRequire('./routes/productRoutes');
const cartRoutes = tryRequire('./routes/cartRoutes');
const favoriteRoutes = tryRequire('./routes/favoriteRoutes'); // opcional
const orderRoutes = tryRequire('./routes/orders');
const paymentRoutes = tryRequire('./routes/payments'); // ✅ nueva ruta de pagos
const dianProviderTestRoutes = tryRequire('./routes/dianProviderTest'); // ✅ prueba de proveedor DIAN
const uploadRoutes = tryRequire('./routes/uploadRoutes'); // opcional
const geoRoutes = tryRequire('./routes/geo'); // opcional

// ✅ RUTAS ADMIN
const adminAuthRoutes = tryRequire('./routes/adminAuth');
const adminUsersRoutes = tryRequire('./routes/adminUsers');
const adminRolesRoutes = tryRequire('./routes/adminRoles');
const adminBranchesRoutes = tryRequire('./routes/adminBranches');
const adminMailSettingsRoutes = tryRequire('./routes/adminMailSettings');

// ⬇️ Site Settings (Apariencia & Menús)
const siteSettingsRoutes = tryRequire('./routes/siteSettings');

// ✅ NUEVA RUTA (PAGES)
const pageRoutes = tryRequire('./routes/pages');

if (productRoutes) app.use('/api/products', productRoutes);
if (cartRoutes) app.use('/api/cart', cartRoutes);
if (favoriteRoutes) app.use('/api/favorites', favoriteRoutes);
if (orderRoutes) app.use('/api/orders', orderRoutes);
if (paymentRoutes) app.use('/api/payments', paymentRoutes); // ✅ conexión de payments
if (dianProviderTestRoutes) app.use('/api/dian-provider', dianProviderTestRoutes); // ✅ conexión prueba provider
if (geoRoutes) app.use('/api/geo', geoRoutes);
if (uploadRoutes) app.use('/api/uploads', uploadRoutes);

// ✅ CONEXIÓN DE AUTENTICACIÓN ADMIN CON RATE LIMIT ESPECIAL
if (adminAuthRoutes) app.use('/api/admin/auth', loginLimiter, adminAuthRoutes);

// ✅ CONEXIÓN DE USUARIOS ADMINISTRATIVOS
if (adminUsersRoutes) app.use('/api/admin/users', adminUsersRoutes);

// ✅ CONEXIÓN DE ROLES ADMINISTRATIVOS
if (adminRolesRoutes) app.use('/api/admin/roles', adminRolesRoutes);

// ✅ CONEXIÓN DE SEDES ADMINISTRATIVAS
if (adminBranchesRoutes) app.use('/api/admin/branches', adminBranchesRoutes);

// ✅ CONEXIÓN DE CONFIGURACIÓN DE CORREO ADMINISTRATIVO
if (adminMailSettingsRoutes) {
  app.use('/api/admin/mail-settings', adminMailSettingsRoutes);
}

if (siteSettingsRoutes) app.use('/api/site-settings', siteSettingsRoutes);

// ✅ CONEXIÓN DE PAGES
if (pageRoutes) app.use('/api/pages', pageRoutes);

/* ---------------------------------------------
 * Ruta de salud
 * ------------------------------------------- */
app.get('/', (_req, res) => {
  res.send('🟢 Servidor backend funcionando correctamente.');
});

/* ---------------------------------------------
 * Conexión a MongoDB y arranque
 * ------------------------------------------- */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas');
  })
  .catch((error) => {
    console.error('❌ Error al conectar a MongoDB:', error.message);
    // ⬇️ YA NO HACEMOS process.exit(1)
    console.warn('⚠️ Continuando sin conexión a MongoDB (solo para desarrollo).');
  })
  .finally(() => {
    // Siempre levantamos el servidor aunque Mongo falle
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  });