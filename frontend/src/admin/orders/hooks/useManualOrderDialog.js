import { useState } from 'react';

export default function useManualOrderDialog() {
  const [open, setOpen] = useState(false);
  return {
    open,
    show: () => setOpen(true),
    close: () => setOpen(false),
  };
}
