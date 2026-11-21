import { Navigate } from 'react-router-dom';
// Compatibility for bookmarks from the previous release.
export default function ConsumerSection() { return <Navigate to="/admin/configuracion/empresa?tema=privacidad" replace />; }
