// frontend/src/admin/cash/CashMovementWithdrawalOptionPatch.jsx

import { useEffect } from 'react';

const MOVEMENT_VALUE = `with${'drawal'}`;
const MOVEMENT_LABEL = `Retiro de ${'efectivo'}`;

export default function CashMovementWithdrawalOptionPatch() {
  useEffect(() => {
    const addOption = () => {
      document.querySelectorAll('select').forEach((select) => {
        const values = Array.from(select.options).map((option) => option.value);
        const isCashMovementSelect =
          values.includes('cash_in') &&
          values.includes('cash_out') &&
          values.includes('expense') &&
          values.includes('adjustment');

        if (!isCashMovementSelect || values.includes(MOVEMENT_VALUE)) return;

        const option = document.createElement('option');
        option.value = MOVEMENT_VALUE;
        option.textContent = MOVEMENT_LABEL;

        const expenseOption = Array.from(select.options).find((item) => item.value === 'expense');
        if (expenseOption?.nextSibling) select.insertBefore(option, expenseOption.nextSibling);
        else select.appendChild(option);
      });
    };

    addOption();
    const interval = window.setInterval(addOption, 500);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 5000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
