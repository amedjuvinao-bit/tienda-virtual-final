import { useState } from "react";
import { ImageOff } from "lucide-react";
export default function MemoryImage({
  moment,
  className = "",
  loading = "lazy",
  illustrative = false,
}) {
  const [failed, setFailed] = useState("");
  if (failed === moment.image)
    return (
      <span
        className={`memory-image-failed ${className}`}
        role="img"
        aria-label={moment.imageAlt || moment.title}
      >
        <ImageOff aria-hidden="true" />
      </span>
    );
  if (illustrative && moment.previewCrop) {
    const { col, row } = moment.previewCrop;
    return (
      <svg
        className={className}
        viewBox={`${col * 512} ${row * 512} 512 512`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={moment.imageAlt || moment.title}
      >
        <image href={moment.image} width="1536" height="1024" />
      </svg>
    );
  }
  return (
    <img
      className={className}
      src={moment.image}
      alt={moment.imageAlt || moment.title}
      loading={loading}
      style={{
        objectPosition: `${moment.focalX ?? 50}% ${moment.focalY ?? 50}%`,
      }}
      onError={() => setFailed(moment.image)}
    />
  );
}
