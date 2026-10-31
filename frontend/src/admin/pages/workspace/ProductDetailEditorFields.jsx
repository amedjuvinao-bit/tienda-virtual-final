import React from "react";

export const Input = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label}
    </span>
    <input
      aria-label={label}
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    />
  </label>
);

export const Textarea = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label}
    </span>
    <textarea
      className="min-h-[110px] w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    />
  </label>
);

export const Select = ({ label, children, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label}
    </span>
    <select
      aria-label={label}
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    >
      {children}
    </select>
  </label>
);

export const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
    <span className="text-sm text-gray-700">{label}</span>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 accent-pink-600"
    />
  </label>
);

export const ColorInput = ({ label, value, onChange }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label}
    </span>
    <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2.5">
      <input
        type="color"
        value={
          /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim())
            ? value
            : "#ec4899"
        }
        onChange={onChange}
        className="h-10 w-12 cursor-pointer rounded border border-gray-200 bg-white"
      />
      <input
        type="text"
        value={value || ""}
        onChange={onChange}
        className="w-full min-w-0 bg-transparent text-sm text-gray-800 outline-none"
        placeholder="#ec4899"
      />
    </div>
  </label>
);

export const RangeInput = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
}) => (
  <label className="block min-w-0">
    <div className="mb-1 flex items-center justify-between gap-3">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <span className="text-xs font-medium text-pink-700">
        {Number(value || 0).toFixed(2)}
      </span>
    </div>

    <div className="rounded-xl border border-gray-300 bg-white px-3 py-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full accent-pink-600"
      />
    </div>
  </label>
);
