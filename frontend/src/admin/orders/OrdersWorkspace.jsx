import "./ordersAdmin.css";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAdminUserRole } from "../security/adminPermissions";
export default function OrdersWorkspace({ children, claims = false }) {
  const auth = useAuth();
  const role = getAdminUserRole(auth?.adminUser || auth?.currentAdminUser);
  const beforeNavigation = (event) => {
    if (
      document.documentElement.dataset.pageDraftDirty === "true" &&
      !window.confirm("Tienes una respuesta sin guardar. ¿Quieres descartarla?")
    )
      event.preventDefault();
  };
  return (
    <div>
      <nav className="orders-workspace-nav" aria-label="Secciones de Órdenes">
        <Link
          to="/admin/ordenes"
          onClick={beforeNavigation}
          aria-current={!claims ? "page" : undefined}
        >
          Compras y entregas
        </Link>
        {["owner", "admin"].includes(role) && (
          <Link
            to="/admin/ordenes/reclamos"
            aria-current={claims ? "page" : undefined}
          >
            Peticiones y reclamos
          </Link>
        )}
      </nav>
      {children}
    </div>
  );
}
