import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';

export default function useReviewPrivacy(enabled, productKey) {
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [authorizedVersion, setAuthorizedVersion] = useState('');
  const retry = useCallback(() => {
    setAuthorizedVersion('');
    setPolicy(null);
    setAttempt(value => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    setPolicy(null);
    setAuthorizedVersion('');
    setError('');
    if (!enabled) return () => { active = false; };
    api.get('/api/products/review-privacy')
      .then(({ data }) => {
        if (!active) return;
        if (typeof data?.policy?.version !== 'string' || !data.policy.version ||
          typeof data.policy.text !== 'string' || !data.policy.text ||
          !data.policy.seller || typeof data.policy.seller !== 'object') throw new Error('Invalid review privacy information');
        setPolicy({ ...data.policy, ready: data.policy.ready === true });
      })
      .catch(() => { if (active) setError('No pudimos cargar la información de privacidad para reseñas.'); });
    return () => { active = false; };
  }, [enabled, productKey, attempt]);
  const consentKey = enabled && policy?.ready ? `${productKey}:${policy.version}` : '';
  return {
    policy, error, retry,
    authorized: Boolean(consentKey && authorizedVersion === consentKey),
    setAuthorized: value => setAuthorizedVersion(value ? consentKey : ''),
  };
}
