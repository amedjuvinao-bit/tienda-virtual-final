// frontend/src/admin/users/AdminUsersPage.jsx

import { useEffect, useMemo, useState } from 'react';
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  getAdminUsersMeta,
  updateAdminUser,
  updateAdminUserPassword,
  updateAdminUserStatus,
} from '../api/adminUsersApi';

import UserFormModal from './UserFormModal';
import UserPasswordModal from './UserPasswordModal';
import UserConfirmModal from './UserConfirmModal';
import UsersTable from './UsersTable';

import {
  EMPTY_FORM,
  EMPTY_PASSWORD_FORM,
  buildFormFromUser,
  buildPasswordPayload,
  buildUserPayload,
  getDefaultBranchId,
  validatePasswordForm,
  validateUserForm,
} from './adminUsersHelpers';

const EMPTY_CONFIRM_MODAL = {
  open: false,
  type: '',
  user: null,
  nextStatus: '',
  actionText: '',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState('');
  const [deleteSavingId, setDeleteSavingId] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingUserId, setEditingUserId] = useState('');
  const [passwordUser, setPasswordUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState(EMPTY_CONFIRM_MODAL);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return users;

    return users.filter((user) => {
      const text = [
        user.username,
        user.email,
        user.displayName,
        user.firstName,
        user.lastName,
        user.role,
        user.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [users, search]);

  const confirmModalLoading =
    (confirmModal.type === 'status' && Boolean(statusSavingId)) ||
    (confirmModal.type === 'delete' && Boolean(deleteSavingId));

  const confirmModalTitle =
    confirmModal.type === 'delete'
      ? 'Eliminar usuario'
      : confirmModal.nextStatus === 'active'
        ? 'Activar usuario'
        : 'Desactivar usuario';

  const confirmModalMessage =
    confirmModal.type === 'delete'
      ? `¿Seguro que deseas eliminar el usuario "${confirmModal.user?.username || ''}"?`
      : `¿Seguro que deseas ${confirmModal.actionText} el usuario "${
          confirmModal.user?.username || ''
        }"?`;

  const confirmModalDetail =
    confirmModal.type === 'delete'
      ? 'Esta acción retirará el usuario del listado activo, pero conservará su historial en la base de datos mediante borrado lógico.'
      : confirmModal.nextStatus === 'active'
        ? 'El usuario volverá a tener acceso al panel administrativo según su rol y permisos asignados.'
        : 'El usuario quedará inactivo y no podrá iniciar sesión en el panel administrativo. Su información se conservará en la base de datos.';

  const confirmModalLabel =
    confirmModal.type === 'delete'
      ? 'Eliminar usuario'
      : confirmModal.nextStatus === 'active'
        ? 'Activar usuario'
        : 'Desactivar usuario';

  const confirmModalVariant =
    confirmModal.type === 'delete' || confirmModal.nextStatus === 'inactive'
      ? 'danger'
      : 'warning';

  const loadMeta = async () => {
    try {
      setMetaLoading(true);

      const response = await getAdminUsersMeta();

      const loadedRoles = response?.data?.roles || [];
      const loadedBranches = response?.data?.branches || [];

      setRoles(loadedRoles);
      setBranches(loadedBranches);

      setForm((current) => ({
        ...current,
        role:
          current.role ||
          loadedRoles.find((role) => role.code === 'cashier')?.code ||
          loadedRoles[0]?.code ||
          'cashier',
        branchId: current.branchId || getDefaultBranchId(loadedBranches),
      }));
    } catch (err) {
      console.error('❌ Error cargando meta usuarios:', err);
      setError(err?.userMessage || 'No se pudo cargar la información base.');
    } finally {
      setMetaLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getAdminUsers({
        page: 1,
        limit: 50,
        sort: '-createdAt',
      });

      setUsers(response?.data || []);
    } catch (err) {
      console.error('❌ Error cargando usuarios administrativos:', err);
      setError(err?.userMessage || 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingUserId('');
    setModalError('');
    setSuccessMessage('');

    setForm({
      ...EMPTY_FORM,
      role:
        roles.find((role) => role.code === 'cashier')?.code ||
        roles[0]?.code ||
        'cashier',
      branchId: getDefaultBranchId(branches),
    });

    setShowUserModal(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setEditingUserId(user?._id || '');
    setModalError('');
    setSuccessMessage('');
    setForm(buildFormFromUser(user, branches, roles));
    setShowUserModal(true);
  };

  const openPasswordModal = (user) => {
    setPasswordUser(user || null);
    setPasswordError('');
    setSuccessMessage('');
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setShowPasswordModal(true);
  };

  const closeUserModal = () => {
    if (saving) return;
    setShowUserModal(false);
    setModalError('');
    setEditingUserId('');
  };

  const closePasswordModal = () => {
    if (passwordSaving) return;
    setShowPasswordModal(false);
    setPasswordError('');
    setPasswordUser(null);
    setPasswordForm(EMPTY_PASSWORD_FORM);
  };

  const closeConfirmModal = () => {
    if (confirmModalLoading) return;
    setConfirmModal(EMPTY_CONFIRM_MODAL);
  };

  const handleSubmitUser = async (event) => {
    event.preventDefault();

    const validationError = validateUserForm(form, modalMode);

    if (validationError) {
      setModalError(validationError);
      return;
    }

    try {
      setSaving(true);
      setModalError('');
      setSuccessMessage('');

      if (modalMode === 'edit') {
        if (!editingUserId) {
          setModalError('No se encontró el ID del usuario a editar.');
          return;
        }

        await updateAdminUser(editingUserId, buildUserPayload(form));

        setSuccessMessage('Usuario administrativo actualizado correctamente.');
      } else {
        await createAdminUser({
          ...buildUserPayload(form),
          password: form.password,
        });

        setSuccessMessage('Usuario administrativo creado correctamente.');
      }

      setShowUserModal(false);
      await loadUsers();
    } catch (err) {
      console.error('❌ Error guardando usuario administrativo:', err);
      setModalError(err?.userMessage || 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitPassword = async (event) => {
    event.preventDefault();

    const validationError = validatePasswordForm(passwordForm);

    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    if (!passwordUser?._id) {
      setPasswordError('No se encontró el ID del usuario.');
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError('');
      setSuccessMessage('');

      await updateAdminUserPassword(
        passwordUser._id,
        buildPasswordPayload(passwordForm)
      );

      setShowPasswordModal(false);
      setPasswordUser(null);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setSuccessMessage('Contraseña actualizada correctamente.');

      await loadUsers();
    } catch (err) {
      console.error('❌ Error cambiando contraseña administrativa:', err);
      setPasswordError(err?.userMessage || 'No se pudo cambiar la contraseña.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleToggleUserStatus = async (user) => {
    if (!user?._id) {
      setError('No se encontró el ID del usuario.');
      return;
    }

    const currentStatus = String(user.status || '').toLowerCase();
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const actionText = nextStatus === 'active' ? 'activar' : 'desactivar';

    setConfirmModal({
      open: true,
      type: 'status',
      user,
      nextStatus,
      actionText,
    });
  };

  const handleDeleteUser = async (user) => {
    if (!user?._id) {
      setError('No se encontró el ID del usuario.');
      return;
    }

    if (user.username === 'owner' || user.role === 'owner') {
      setError('Por seguridad, el usuario propietario principal no se puede eliminar desde esta tabla.');
      return;
    }

    setConfirmModal({
      open: true,
      type: 'delete',
      user,
      nextStatus: '',
      actionText: 'eliminar',
    });
  };

  const handleConfirmAction = async () => {
    const user = confirmModal.user;

    if (!user?._id) {
      setError('No se encontró el ID del usuario.');
      setConfirmModal(EMPTY_CONFIRM_MODAL);
      return;
    }

    if (confirmModal.type === 'status') {
      try {
        setStatusSavingId(user._id);
        setError('');
        setSuccessMessage('');

        await updateAdminUserStatus(user._id, {
          status: confirmModal.nextStatus,
          active: confirmModal.nextStatus === 'active',
        });

        setSuccessMessage(
          confirmModal.nextStatus === 'active'
            ? 'Usuario activado correctamente.'
            : 'Usuario desactivado correctamente.'
        );

        setConfirmModal(EMPTY_CONFIRM_MODAL);
        await loadUsers();
      } catch (err) {
        console.error('❌ Error cambiando estado del usuario:', err);
        setError(err?.userMessage || 'No se pudo cambiar el estado del usuario.');
      } finally {
        setStatusSavingId('');
      }

      return;
    }

    if (confirmModal.type === 'delete') {
      try {
        setDeleteSavingId(user._id);
        setError('');
        setSuccessMessage('');

        await deleteAdminUser(user._id);

        setSuccessMessage('Usuario eliminado correctamente.');
        setConfirmModal(EMPTY_CONFIRM_MODAL);
        await loadUsers();
      } catch (err) {
        console.error('❌ Error eliminando usuario administrativo:', err);
        setError(err?.userMessage || 'No se pudo eliminar el usuario.');
      } finally {
        setDeleteSavingId('');
      }
    }
  };

  useEffect(() => {
    loadMeta();
    loadUsers();
  }, []);

  return (
    <div className="space-y-5">
      <section
        className="rounded-[28px] border px-5 py-5 shadow-sm md:px-6"
        style={{
          background: 'var(--admin-glass-bg)',
          borderColor: 'var(--admin-glass-border)',
          boxShadow: 'var(--admin-glass-shadow)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <p
                className="text-xs font-black uppercase tracking-[0.24em]"
                style={{ color: 'var(--admin-card-muted-text)' }}
              >
                Administración
              </p>

              <span
                className="rounded-full border px-3 py-1 text-xs font-bold"
                style={{
                  borderColor: 'var(--admin-primary-soft-border)',
                  background: 'var(--admin-primary-soft-bg)',
                  color: 'var(--admin-primary-soft-text)',
                }}
              >
                {users.length} usuarios registrados
              </span>
            </div>

            <h1
              className="mt-3 text-2xl font-black leading-tight md:text-3xl"
              style={{ color: 'var(--admin-card-text)' }}
            >
              Usuarios administrativos
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm leading-6"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Gestiona accesos internos, roles, sedes, estados de usuario y
              seguridad del panel administrativo.
            </p>
          </div>

          <div
            className="flex w-full flex-col gap-2 rounded-3xl border p-2 sm:w-auto sm:flex-row"
            style={{
              borderColor: 'var(--admin-glass-border)',
              background: 'var(--admin-glass-soft-bg)',
            }}
          >
            <button
              type="button"
              onClick={openCreateModal}
              disabled={metaLoading || branches.length === 0 || roles.length === 0}
              className="rounded-2xl px-4 py-2.5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed"
              style={{
                background: 'var(--admin-button-bg)',
                color: 'var(--admin-button-text)',
                border: '1px solid var(--admin-button-bg)',
                opacity:
                  metaLoading || branches.length === 0 || roles.length === 0
                    ? 0.75
                    : 1,
              }}
            >
              Nuevo usuario
            </button>

            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="rounded-2xl px-4 py-2.5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed"
              style={{
                background: 'var(--admin-light-panel-bg)',
                color: 'var(--admin-light-panel-text)',
                border: '1px solid var(--admin-light-panel-border)',
                boxShadow: 'var(--admin-glass-shadow)',
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </section>

      <section
        className="rounded-[28px] border p-5 shadow-sm"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              className="text-lg font-black"
              style={{ color: 'var(--admin-card-text)' }}
            >
              Listado de usuarios
            </h2>

            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Mostrando {filteredUsers.length} de {users.length} usuarios.
            </p>
          </div>

          <div
            className="flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 lg:max-w-md"
            style={{
              background: 'var(--admin-input-bg)',
              borderColor: 'var(--admin-input-border)',
              color: 'var(--admin-input-text)',
            }}
          >
            <span
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Buscar
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, usuario, correo o rol..."
              className="w-full bg-transparent text-sm outline-none"
              style={{
                color: 'var(--admin-input-text)',
              }}
            />
          </div>
        </div>

        {successMessage && (
          <div
            className="mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold"
            style={{
              borderColor: 'var(--admin-primary-soft-border)',
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-primary-soft-text)',
            }}
          >
            {successMessage}
          </div>
        )}

        {error && (
          <div
            className="mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold"
            style={{
              borderColor: 'var(--admin-danger)',
              background: 'var(--admin-danger-soft-bg)',
              color: 'var(--admin-danger-text)',
            }}
          >
            {error}
          </div>
        )}

        {(loading || metaLoading) && (
          <div
            className="mt-6 rounded-2xl border px-4 py-6 text-center text-sm font-semibold"
            style={{
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-muted-text)',
            }}
          >
            Cargando usuarios administrativos...
          </div>
        )}

        {!loading && !metaLoading && filteredUsers.length === 0 && (
          <div
            className="mt-6 rounded-2xl border px-4 py-6 text-center text-sm font-semibold"
            style={{
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-muted-text)',
            }}
          >
            No hay usuarios para mostrar.
          </div>
        )}

        {!loading && !metaLoading && filteredUsers.length > 0 && (
          <UsersTable
            users={filteredUsers}
            roles={roles}
            branches={branches}
            statusSavingId={statusSavingId}
            deleteSavingId={deleteSavingId}
            onEditUser={openEditModal}
            onChangePassword={openPasswordModal}
            onToggleStatus={handleToggleUserStatus}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </section>

      <UserFormModal
        open={showUserModal}
        mode={modalMode}
        roles={roles}
        branches={branches}
        form={form}
        setForm={setForm}
        saving={saving}
        error={modalError}
        onClose={closeUserModal}
        onSubmit={handleSubmitUser}
      />

      <UserPasswordModal
        open={showPasswordModal}
        user={passwordUser}
        form={passwordForm}
        setForm={setPasswordForm}
        saving={passwordSaving}
        error={passwordError}
        onClose={closePasswordModal}
        onSubmit={handleSubmitPassword}
      />

      <UserConfirmModal
        open={confirmModal.open}
        title={confirmModalTitle}
        message={confirmModalMessage}
        detail={confirmModalDetail}
        confirmLabel={confirmModalLabel}
        cancelLabel="Cancelar"
        variant={confirmModalVariant}
        loading={confirmModalLoading}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}