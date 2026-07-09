// backend/index.js
console.log('Iniciando backend/index.js');

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

function tryRequire(relPath) {
  try {
    const mod = require(relPath);
    console.log(`Ruta cargada: ${relPath}`);
    return mod;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.warn(`Ruta NO encontrada, se omite: ${relPath}`);
      return null;
    }

    console.error(`Error al cargar ${relPath}:`, e.message);
    return null;
  }
}

app.use(cors());
app.use(express.json());

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
app.use(adminAccessGate);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const productRoutes = tryRequire('./routes/productRoutes');
const cartRoutes = tryRequire('./routes/cartRoutes');
const favoriteRoutes = tryRequire('./routes/favoriteRoutes');
const orderRoutes = tryRequire('./routes/orders');
const payuRoutes = tryRequire('./routes/payuProductionWebhook');
const paymentRoutes = tryRequire('./routes/payments');
const dianProviderTestRoutes = tryRequire('./routes/dianProviderTest');
const uploadRoutes = tryRequire('./routes/uploadRoutes');
const geoRoutes = tryRequire('./routes/geo');
const OrderModel = tryRequire('./models/Order');
const requireAdminMiddleware = tryRequire('./middleware/requireAdmin');
const requirePermissionMiddleware = tryRequire('./middleware/requirePermission');
const inventoryReservationService = tryRequire('./services/inventoryReservationService');
const adminAuthRoutes = tryRequire('./routes/adminAuth');
const adminUsersRoutes = tryRequire('./routes/adminUsers');
const adminRolesRoutes = tryRequire('./routes/adminRoles');
const adminBranchProtectionRoutes = tryRequire('./routes/adminBranchProtection');
const adminBranchesRoutes = tryRequire('./routes/adminBranches');
const adminInventoryRoutes = tryRequire('./routes/adminInventory');
const adminPosRoutes = tryRequire('./routes/adminPos');
const adminPosReceiptRoutes = tryRequire('./routes/adminPosReceipt');
const adminCashSessionsRoutes = tryRequire('./routes/adminCashSessions');
const adminCustomersRoutes = tryRequire('./routes/adminCustomers');
const adminCustomerFollowUpsRoutes = tryRequire('./routes/adminCustomerFollowUps');
const adminDashboardRoutes = tryRequire('./routes/adminDashboard');
const adminDashboardSalesRoutes = tryRequire('./routes/adminDashboardSales');
const adminDashboardGoalRoutes = tryRequire('./routes/adminDashboardGoal');
const adminMailSettingsRoutes = tryRequire('./routes/adminMailSettings');
const siteSettingsRoutes = tryRequire('./routes/siteSettings');
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
            message: `Estado: ${before.status || '-'} -> delivered`,
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
if (payuRoutes) app.use('/api/payments', payuRoutes);
if (paymentRoutes) app.use('/api/payments', paymentRoutes);
if (dianProviderTestRoutes) app.use('/api/dian-provider', dianProviderTestRoutes);
if (geoRoutes) app.use('/api/geo', geoRoutes);
if (uploadRoutes) app.use('/api/uploads', uploadRoutes);
if (adminAuthRoutes) app.use('/api/admin/auth', loginLimiter, adminAuthRoutes);
if (adminUsersRoutes) app.use('/api/admin/users', adminUsersRoutes);
if (adminRolesRoutes) app.use('/api/admin/roles', adminRolesRoutes);
if (adminBranchProtectionRoutes) app.use('/api/admin/branches', adminBranchProtectionRoutes);
if (adminBranchesRoutes) app.use('/api/admin/branches', adminBranchesRoutes);
if (adminInventoryRoutes) app.use('/api/admin/inventory', adminInventoryRoutes);
if (adminPosRoutes) app.use('/api/admin/pos', adminPosRoutes);
if (adminPosReceiptRoutes) app.use('/api/admin/pos', adminPosReceiptRoutes);
if (adminCashSessionsRoutes) app.use('/api/admin/cash-sessions', adminCashSessionsRoutes);
if (adminCustomersRoutes) app.use('/api/admin/customers', adminCustomersRoutes);
if (adminCustomerFollowUpsRoutes) app.use('/api/admin/customer-follow-ups', adminCustomerFollowUpsRoutes);
if (adminDashboardRoutes) app.use('/api/admin/dashboard', adminDashboardRoutes);
if (adminDashboardSalesRoutes) app.use('/api/admin/dashboard-sales', adminDashboardSalesRoutes);
if (adminDashboardGoalRoutes) app.use('/api/admin/dashboard-goal', adminDashboardGoalRoutes);
if (adminMailSettingsRoutes) app.use('/api/admin/mail-settings', adminMailSettingsRoutes);
if (siteSettingsRoutes) app.use('/api/site-settings', siteSettingsRoutes);
if (pageRoutes) app.use('/api/pages', pageRoutes);

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
    console.log('Job de expiracion de reservas desactivado por configuracion.');
    return;
  }

  const expireInventoryReservations = inventoryReservationService?.expireInventoryReservations;

  if (typeof expireInventoryReservations !== 'function') {
    console.warn('No se inicio el job de expiracion: expireInventoryReservations no esta disponible.');
    return;
  }

  if (inventoryReservationExpirationTimer) {
    console.log('Job de expiracion de reservas ya estaba iniciado.');
    return;
  }

  const runExpiration = async () => {
    if (inventoryReservationExpirationRunning) return;

    if (mongoose.connection.readyState !== 1) {
      console.warn('Job de reservas omitido: MongoDB no esta conectado.');
      return;
    }

    inventoryReservationExpirationRunning = true;

    try {
      const result = await expireInventoryReservations({
        limit: INVENTORY_RESERVATION_EXPIRATION_LIMIT,
      });

      const expiredCount = Number(result?.count || 0);

      if (expiredCount > 0) {
        console.log(`Reservas vencidas liberadas automaticamente: ${expiredCount}`);
      }
    } catch (error) {
      console.error('Error expirando reservas de inventario:', error.message);
    } finally {
      inventoryReservationExpirationRunning = false;
    }
  };

  setTimeout(runExpiration, 5_000);

  inventoryReservationExpirationTimer = setInterval(
    runExpiration,
    INVENTORY_RESERVATION_EXPIRATION_INTERVAL_MS
  );

  if (typeof inventoryReservationExpirationTimer.unref === 'function') {
    inventoryReservationExpirationTimer.unref();
  }

  console.log(
    `Job de expiracion de reservas iniciado cada ${Math.round(
      INVENTORY_RESERVATION_EXPIRATION_INTERVAL_MS / 1000
    )} segundos. Limite por corrida: ${INVENTORY_RESERVATION_EXPIRATION_LIMIT}`
  );
}

app.get('/', (_req, res) => {
  res.send('Servidor backend funcionando correctamente.');
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Conectado a MongoDB Atlas');
    startInventoryReservationExpirationJob();
  })
  .catch((error) => {
    console.error('Error al conectar MongoDB:', error.message);
    console.warn('Continuando sin conexion a MongoDB (solo para desarrollo).');
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  });