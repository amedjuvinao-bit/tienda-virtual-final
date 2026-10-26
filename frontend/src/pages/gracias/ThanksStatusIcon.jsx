import {
  Check,
  Clock3,
  CircleHelp,
  PackageCheck,
  X,
  LoaderCircle,
} from "lucide-react";
export default function ThanksStatusIcon({ meta, status, loading, accent }) {
  const Icon = loading
    ? LoaderCircle
    : meta.neutral
      ? PackageCheck
      : meta.showSuccessCheck
        ? Check
        : status === "pending"
          ? Clock3
          : ["rejected", "expired", "error"].includes(status)
            ? X
            : CircleHelp;
  return (
    <div
      className={`gp-check-wrap${loading ? " gp-check-wrap--loading" : ""}`}
      style={{ color: meta.neutral ? accent : meta.badgeText }}
      aria-hidden="true"
    >
      <Icon size={32} strokeWidth={1.4} />
    </div>
  );
}
