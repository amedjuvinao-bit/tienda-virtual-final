import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { mountStorefrontActionFeedback } from '../lib/storefrontActionFeedback';
import '../storefrontActionFeedback.css';

export default function StorefrontActionFeedback() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    return mountStorefrontActionFeedback();
  }, [pathname]);
  return null;
}
