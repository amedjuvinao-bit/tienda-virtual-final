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
const OrderModel = tryRequire('./models/Order');
const requireAdminMiddleware = tryRequire('./middleware/requireAdmin');
const requirePermissionMiddleware = tryRequire('./middleware/requirePermission');

// ✅ SERVICIO DE RESERVAS DE INVENTARIO
const inventoryReservationService = tryRequire('./services/inventoryReservationService');

// ✅ RUTAS ADMIN
const adminAuthRoutes = tryRequire('./routes/adminAuth');
const adminUsersRoutes = tryRequire('./routes/adminUsers');
const adminRolesRoutes = tryRequire('./routes/adminRoles');
const adminBranchesRoutes = tryRequire('./routes/adminBranches');
const adminInventoryRoutes = tryRequire('./routes/adminInventory');
const adminDashboardRoutes = tryRequire('./routes/adminDashboard');
const adminDashboardSalesRoutes = tryRequire('./routes/adminDashboardSales');
const adminDashboardGoalRoutes = tryRequire('./routes/adminDashboardGoal');
const adminMailSettingsRoutes = tryRequire('./routes/adminMailSettings');

// ⬇️ Site Settings (Apariencia & Menús)
const siteSettingsRoutes = tryRequire('./routes/siteSettings');

// ✅ NUEVA RUTA (PAGES)
const pageRoutes = tryRequire('./routes/pages');

if (productRoutes) app.use('/api/products', productRoutes);
if (cartRoutes) app.use('/api/cart', cartRoutes);
if (favoriteRoutes) app.use('/api/favorites', favoriteRoutes);

if (OrderModel && requireAdminMiddleware && requirePermissionMiddleware) {
  app.patch(
    '/api/orders/:id/status',
    requireAdminMiddleware,
    requirePermissionMiddleware('orders:update'),
    async (req, res, next) => {
      const rawStatus = String(req.body?.status || '').trim().toLowerCase();
      const deliveredAliases = ['delivered', 'entregado', 'entregada'];

      if (!deliveredAliases.includes(rawStatus)) {
        return next();
      }

      try {
        const before = await OrderModel.findById(req.params.id).select('status').lean();

        if (!before) return res.status(404).json({ error: 'Orden no encontrada' });

        const updatedOrder = await OrderModel.findByIdAndUpdate(
          req.params.id,
          { $set: { status: 'delivered' } },
          { new: true }
        ).lean();

        const OrderEventModel = mongoose.models.OrderEvent;

        if (OrderEventModel) {
          await OrderEventModel.create({
            orderId: updatedOrder._id,
            type: 'status_changed',
            message: `Estado: ${before.status || '—'} -> delivered`,
            meta: {
              from: before.status || null,
              to: 'delivered',
              ip: req.ip,
              by: req.headers['x-admin-user'] || null,
            },
          });
        }

        return res.json({ ok: true, order: updatedOrder });
      } catch (error) {
        console.error('PATCH /orders/:id/status delivered', error);
        return res.status(500).json({ error: 'No se pudo actualizar el estado a entregada' });
      }
    }
  );
}

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

// ✅ CONEXIÓN DE INVENTARIO POR SEDES
if (adminInventoryRoutes) app.use('/api/admin/inventory', adminInventoryRoutes);

// ✅ CONEXIÓN DEL DASHBOARD ADMINISTRATIVO
if (adminDashboardRoutes) app.use('/api/admin/dashboard', adminDashboardRoutes);

// ✅ CONEXIÓN DEL GRÁFICO DE VENTAS DEL DASHBOARD
if (adminDashboardSalesRoutes) app.use('/api/admin/dashboard-sales', adminDashboardSalesRoutes);

// ✅ CONEXIÓN DE METAS DEL DASHBOARD ADMINISTRATIVO
if (adminDashboardGoalRoutes) app.use('/api/admin/dashboard-goal', adminDashboardGoalRoutes);

// ✅ CONEXIÓN DE CONFIGURACIÓN DE CORREO ADMINISTRATIVO
if (adminMailSettingsRoutes) {
  app.use('/api/admin/mail-settings', adminMailSettingsRoutes);
}

if (siteSettingsRoutes) app.use('/api/site-settings', siteSettingsRoutes);

// ✅ CONEXIÓN DE PAGES
if (pageRoutes) app.use('/api/pages', pageRoutes);

/* ---------------------------------------------
 * Job automático: expiración de reservas
 * -------------------------------------------
 * Este proceso:
 * - busca reservas pending vencidas
 * - libera stock reservado
 * - marca la reserva como expired
 * - NO descuenta stock físico
 *
 * Variables opcionales .env:
 * INVENTORY_RESERVATION_EXPIRATION_ENABLED=true
 * INVENTORY_RESERVATION_EXPIRATION_INTERVAL_MS=60000
 * INVENTORY_RESERVATION_EXPIRATION_LIMIT=50
 * ------------------------------------------- */
const INVENTORY_RESERVATION_EXPIRATION_ENABLED =
  String(process.env.INVENTORY_RESERVATION_EXPIRATION_ENABLED || 'true')
    .trim()
    .toLowerCase() !== 'false';

const INVENTORY_RESERVATION_EXPIRATION_INTERVAL_MS = Math.max(
  30_000,
  Number(process.env.INVENTORY_RESERVATION_EXPIRATION_INTERVAL_MS || 60_000)
);

const INVENTORY_RESERVATION_EXPIRATION_LIMIT = Math.max(
  1,
  Number(process.env.INVENTORY_RESERVATION_EXPIRATION_LIMIT || 50)
);

let inventoryReservationExpirationTimer = null;
let inventoryReservationExpirationRunning = false;

function startInventoryReservationExpirationJob() {
  if (!INVENTORY_RESERVATION_EXPIRATION_ENABLED) {
    console.log('ℹ️ Job de expiración de reservas desactivado por configuración.');
    return;
  }

  const expireInventoryReservations =
    inventoryReservationService?.expireInventoryReservations;

  if (typeof expireInventoryReservations !== 'function') {
    console.warn(
      '⚠️ No se inició el job de expiración: expireInventoryReservations no está disponible.'
    );
    return;
  }

  if (inventoryReservationExpirationTimer) {
    console.log('ℹ️ Job de expiración de reservas ya estaba iniciado.');
    return;
  }

  const runExpiration = async () => {
    if (inventoryReservationExpirationRunning) return;

    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ Job de reservas omitido: MongoDB no está conectado.');
      return;
    }

    inventoryReservationExpirationRunning = true;

    try {
      const result = await expireInventoryReservations({
        limit: INVENTORY_RESERVATION_EXPIRATION_LIMIT,
      });

      const expiredCount = Number(result?.count || 0);

      if (expiredCount > 0) {
        console.log(`⏱️ Reservas vencidas liberadas automáticamente: ${expiredCount}`);
      }
    } catch (error) {
      console.error('❌ Error expirando reservas de inventario:', error.message);
    } finally {
      inventoryReservationExpirationRunning = false;
    }
  };

  // Primera ejecución corta después de conectar.
  setTimeout(runExpiration, 5_000);

  inventoryReservationExpirationTimer = setInterval(
    runExpiration,
    INVENTORY_RESERVATION_EXPIRATION_INTERVAL_MS
  );

  if (typeof inventoryReservationExpirationTimer.unref === 'function') {
    inventoryReservationExpirationTimer.unref();
  }

  console.log(
    `✅ Job de expiración de reservas iniciado cada ${Math.round(
      INVENTORY_RESERVATION_EXPIRATION_INTERVAL_MS / 1000
    )} segundos. Límite por corrida: ${INVENTORY_RESERVATION_EXPIRATION_LIMIT}`
  );
}

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

    // ✅ Se inicia solo después de conectar correctamente a MongoDB.
    startInventoryReservationExpirationJob();
  })
  .catch((error) => {
    console.error('❌ Error al conectar MongoDB:', error.message);
    // ⬇️ YA NO HACEMOS process.exit(1)
    console.warn('⚠️ Continuando sin conexión a MongoDB (solo para desarrollo).');
  })
  .finally(() => {
    // Siempre levantamos el servidor aunque Mongo falle
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  });
