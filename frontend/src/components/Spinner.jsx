import React from 'react';

export default function Spinner() {
  return (
    <div className="flex justify-center items-center h-40">
      <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-pink-500 border-solid"></div>
    </div>
  );
}
