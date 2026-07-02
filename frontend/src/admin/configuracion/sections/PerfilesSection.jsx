// frontend/src/admin/configuracion/sections/PerfilesSection.jsx

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wand2,
} from 'lucide-react';

import InfoCard from '../components/InfoCard';

import {
  createAdminRole,
  deleteAdminRole,
  getAdminRoles,
  getAdminRolesMeta,
  updateAdminRole,
  updateAdminRoleStatus,
} from '../../api/adminRolesApi';

import RolesTable from '../roles/RolesTable';
import RoleFormModal from '../roles/RoleFormModal';
import RoleConfirmModal from '../roles/RoleConfirmModal';
import RolePermissionsModal from '../roles/RolePermissionsModal';

const EMPTY_CONFIRM_MODAL = {
  open: false,
  action: '',
  role: null,
};

const EMPTY_FORM_MODAL = {
  open: false,
  mode: 'create',
  role: null,
};

const THEME = {
  cardBg: 'var(--admin-card-bg, #ffffff)',
  cardText: 'var(--admin-card-text, #111827)',
  mutedText: 'var(--admin-card-muted-text, var(--admin-card-muted, #6b7280))',
  border:
    'var(--admin-card-border, var(--admin-border, rgba(148, 163, 184, 0.22)))',
  softBg: 'var(--admin-soft-bg, rgba(255,255,255,0.55))',
  primaryBg: 'var(--admin-button-bg, var(--admin-primary, #06b6d4))',
  primaryText: 'var(--admin-button-text, #ffffff)',
  lightPanelBg: 'var(--admin-light-panel-bg, rgba(255,255,255,0.08))',
  lightPanelText:
    'var(--admin-light-panel-text, var(--admin-card-text, #111827))',
  lightPanelBorder:
    'var(--admin-light-panel-border, var(--admin-card-border, rgba(148, 163, 184, 0.22)))',
  inputBg: 'var(--admin-input-bg, rgba(255,255,255,0.08))',
  inputText: 'var(--admin-input-text, var(--admin-card-text, #111827))',
  inputBorder:
    'var(--admin-input-border, var(--admin-card-border, rgba(148, 163, 184, 0.22)))',
};

function getRoleId(role) {
  return role?._id || role?.id || '';
}

function getAvailablePermissionsFromMeta(meta) {
  if (Array.isArray(meta?.permissions)) {
    return meta.permissions;
  }

  if (meta?.permissions && typeof meta.permissions === 'object') {
    return Object.keys(meta.permissions);
  }

  return [];
}

function getRoleSearchText(role) {
  return [
    role?.name,
    role?.code,
    role?.description,
    role?.scope,
    role?.status,
    role?.isSystem ? 'sistema' : 'personalizado',
    role?.isDefault ? 'predeterminado' : '',
    ...(Array.isArray(role?.permissions) ? role.permissions : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function CompactMetricCard({ icon: Icon, label, value }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3 shadow-sm"
      style={{
        background: 'rgba(255, 255, 255, 0.96)',
        borderColor: 'rgba(6, 182, 212, 0.32)',
        color: '#0f172a',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.18em]"
            style={{
              color: '#475569',
            }}
          >
            {label}
          </p>

          <p
            className="mt-1 text-2xl font-black leading-none"
            style={{
              color: '#0f172a',
            }}
          >
            {value}
          </p>
        </div>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'rgba(6, 182, 212, 0.14)',
            color: '#0891b2',
            border: '1px solid rgba(6, 182, 212, 0.25)',
          }}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
export default function PerfilesSection() {
  const [roles, setRoles] = useState([]);
  const [meta, setMeta] = useState(null);

  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [search, setSearch] = useState('');
  const [selectedPermissionsRole, setSelectedPermissionsRole] = useState(null);
  const [formModal, setFormModal] = useState(EMPTY_FORM_MODAL);
  const [confirmModal, setConfirmModal] = useState(EMPTY_CONFIRM_MODAL);

  const availablePermissions = useMemo(() => {
    return getAvailablePermissionsFromMeta(meta);
  }, [meta]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return roles;

    return roles.filter((role) => getRoleSearchText(role).includes(q));
  }, [roles, search]);

  const totalPermissions = availablePermissions.length;
  const customRolesCount = roles.filter((role) => !role.isSystem).length;

  const loadMeta = async () => {
    try {
      setMetaLoading(true);

      const response = await getAdminRolesMeta();

      setMeta(response?.data || null);
    } catch (err) {
      console.error('❌ Error cargando meta de perfiles:', err);

      setError(
        err?.userMessage ||
          'No se pudo cargar la información base de perfiles.'
      );
    } finally {
      setMetaLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getAdminRoles({
        page: 1,
        limit: 100,
        sort: 'level',
      });

      setRoles(response?.data || []);
    } catch (err) {
      console.error('❌ Error cargando perfiles:', err);

      setError(err?.userMessage || 'No se pudieron cargar los perfiles.');
    } finally {
      setLoading(false);
    }
  };

  const reloadAll = async () => {
    await Promise.all([loadMeta(), loadRoles()]);
  };

  const openCreateModal = () => {
    setFormError('');
    setSuccessMessage('');

    setFormModal({
      open: true,
      mode: 'create',
      role: null,
    });
  };

  const openEditModal = (role) => {
    setFormError('');
    setSuccessMessage('');

    setFormModal({
      open: true,
      mode: 'edit',
      role,
    });
  };

  const closeFormModal = () => {
    if (saving) return;

    setFormModal(EMPTY_FORM_MODAL);
    setFormError('');
  };

  const openPermissionsModal = (role) => {
    setSelectedPermissionsRole(role);
  };

  const closePermissionsModal = () => {
    setSelectedPermissionsRole(null);
  };

  const openToggleStatusModal = (role) => {
    const isActive = role?.active !== false && role?.status !== 'inactive';

    setConfirmError('');
    setSuccessMessage('');

    setConfirmModal({
      open: true,
      action: isActive ? 'deactivate' : 'activate',
      role,
    });
  };

  const openDeleteModal = (role) => {
    setConfirmError('');
    setSuccessMessage('');

    setConfirmModal({
      open: true,
      action: 'delete',
      role,
    });
  };

  const closeConfirmModal = () => {
    if (confirmLoading) return;

    setConfirmModal(EMPTY_CONFIRM_MODAL);
    setConfirmError('');
  };

  const handleSubmitRole = async (payload) => {
    try {
      setSaving(true);
      setFormError('');
      setError('');
      setSuccessMessage('');

      if (formModal.mode === 'edit') {
        const roleId = getRoleId(formModal.role);

        if (!roleId) {
          setFormError('No se encontró el ID del perfil a editar.');
          return;
        }

        await updateAdminRole(roleId, payload);

        setSuccessMessage('Perfil administrativo actualizado correctamente.');
      } else {
        await createAdminRole(payload);

        setSuccessMessage('Perfil administrativo creado correctamente.');
      }

      setFormModal(EMPTY_FORM_MODAL);

      await loadRoles();
    } catch (err) {
      console.error('❌ Error guardando perfil:', err);

      setFormError(
        err?.userMessage || 'No se pudo guardar el perfil administrativo.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAction = async () => {
    const { action, role } = confirmModal;
    const roleId = getRoleId(role);

    if (!roleId) {
      setConfirmError('No se encontró el ID del perfil.');
      return;
    }

    try {
      setConfirmLoading(true);
      setConfirmError('');
      setError('');
      setSuccessMessage('');

      if (action === 'delete') {
        await deleteAdminRole(roleId);

        setSuccessMessage('Perfil administrativo eliminado correctamente.');
      }

      if (action === 'deactivate') {
        await updateAdminRoleStatus(roleId, {
          status: 'inactive',
          active: false,
        });

        setSuccessMessage('Perfil administrativo desactivado correctamente.');
      }

      if (action === 'activate') {
        await updateAdminRoleStatus(roleId, {
          status: 'active',
          active: true,
        });

        setSuccessMessage('Perfil administrativo activado correctamente.');
      }

      setConfirmModal(EMPTY_CONFIRM_MODAL);

      await loadRoles();
    } catch (err) {
      console.error('❌ Error ejecutando acción sobre perfil:', err);

      setConfirmError(
        err?.userMessage || 'No se pudo completar la acción sobre el perfil.'
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, []);

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Roles y permisos"
        description="Gestiona los perfiles administrativos, sus permisos, alcance, nivel jerárquico y estado dentro del panel."
      >
        <div className="grid gap-4">
          <section
            className="relative overflow-hidden rounded-[1.7rem] border p-4 shadow-sm"
            style={{
              background: THEME.cardBg,
              borderColor: THEME.border,
              color: THEME.cardText,
            }}
          >
            <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    background: 'rgba(6, 182, 212, 0.12)',
                    color: 'var(--admin-primary, #06b6d4)',
                  }}
                >
                  <ShieldCheck size={22} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                      style={{
                        background: THEME.lightPanelBg,
                        borderColor: THEME.lightPanelBorder,
                        color: THEME.lightPanelText,
                      }}
                    >
                      <Sparkles size={12} />
                      Administración
                    </span>

                    <span
                      className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{
                        background: 'rgba(212, 175, 55, 0.12)',
                        borderColor: 'rgba(212, 175, 55, 0.28)',
                        color: THEME.cardText,
                      }}
                    >
                      Control de accesos
                    </span>
                  </div>

                  <h2 className="mt-3 text-xl font-black leading-tight sm:text-2xl">
                    Perfiles administrativos
                  </h2>

                  <p
                    className="mt-2 max-w-2xl text-sm font-semibold leading-6"
                    style={{
                      color: THEME.mutedText,
                    }}
                  >
                    Crea perfiles, define permisos por módulo y controla el
                    alcance de cada usuario dentro del panel.
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={metaLoading || totalPermissions === 0}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black shadow-md transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: THEME.primaryBg,
                    color: THEME.primaryText,
                    border: `1px solid ${THEME.primaryBg}`,
                  }}
                >
                  <Plus size={17} />
                  Crear perfil
                </button>

                <button
                  type="button"
                  onClick={reloadAll}
                  disabled={loading || metaLoading}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: THEME.lightPanelBg,
                    color: THEME.lightPanelText,
                    borderColor: THEME.lightPanelBorder,
                  }}
                >
                  <RefreshCw
                    size={16}
                    className={loading || metaLoading ? 'animate-spin' : ''}
                  />
                  {loading || metaLoading ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </div>

            <div className="relative mt-4 grid gap-3 md:grid-cols-3">
              <CompactMetricCard
                icon={UsersRound}
                label="Perfiles cargados"
                value={filteredRoles.length}
              />

              <CompactMetricCard
                icon={ShieldCheck}
                label="Permisos disponibles"
                value={totalPermissions}
              />

              <CompactMetricCard
                icon={Wand2}
                label="Personalizados"
                value={customRolesCount}
              />
            </div>
          </section>

          {successMessage ? (
            <div
              className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold"
              style={{
                background: 'rgba(22, 163, 74, 0.08)',
                borderColor: 'rgba(22, 163, 74, 0.22)',
                color: '#15803d',
              }}
            >
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          {error ? (
            <div
              className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                color: '#b91c1c',
              }}
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <section
            className="rounded-[1.7rem] border p-4 shadow-sm"
            style={{
              background: THEME.cardBg,
              borderColor: THEME.border,
              color: THEME.cardText,
            }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-black">Listado de perfiles</h3>

                <p
                  className="mt-1 text-sm font-semibold"
                  style={{
                    color: THEME.mutedText,
                  }}
                >
                  Consulta permisos, edita perfiles o controla su estado.
                </p>
              </div>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar perfil, permiso, código o estado..."
                className="w-full rounded-2xl border px-4 py-2.5 text-sm font-bold outline-none transition focus:ring-2 lg:max-w-md"
                style={{
                  background: THEME.inputBg,
                  borderColor: THEME.inputBorder,
                  color: THEME.inputText,
                  '--tw-ring-color': 'rgba(6, 182, 212, 0.22)',
                }}
              />
            </div>

            <div className="mt-4">
              <RolesTable
                roles={filteredRoles}
                loading={loading || metaLoading}
                currentAdminRole="owner"
                onViewPermissions={openPermissionsModal}
                onEdit={openEditModal}
                onToggleStatus={openToggleStatusModal}
                onDelete={openDeleteModal}
              />
            </div>
          </section>
        </div>
      </InfoCard>

      <RoleFormModal
        open={formModal.open}
        mode={formModal.mode}
        role={formModal.role}
        availablePermissions={availablePermissions}
        loading={saving}
        error={formError}
        onClose={closeFormModal}
        onSubmit={handleSubmitRole}
      />

      <RoleConfirmModal
        open={confirmModal.open}
        action={confirmModal.action}
        role={confirmModal.role}
        loading={confirmLoading}
        error={confirmError}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
      />

      <RolePermissionsModal
        open={Boolean(selectedPermissionsRole)}
        role={selectedPermissionsRole}
        onClose={closePermissionsModal}
      />
    </div>
  );
}