import Image from "next/image";

export type PluginBrand =
  | "google-analytics"
  | "google-drive"
  | "instagram"
  | "manual-upi"
  | "phonepe"
  | "plugin-policy"
  | "search-console"
  | "theme-branding"
  | "whatsapp"
  | "youtube";

const brandAssets: Record<PluginBrand, { label: string; src: string }> = {
  "google-analytics": { label: "Google Analytics", src: "/icons/3d/analytics.png" },
  "google-drive": { label: "Google Drive", src: "/icons/3d/google-drive.png" },
  instagram: { label: "Instagram", src: "/icons/3d/instagram.png" },
  "manual-upi": { label: "Manual UPI", src: "/icons/3d/manual-upi.png" },
  phonepe: { label: "PhonePe", src: "/icons/3d/phonepe.png" },
  "plugin-policy": { label: "Plugin policy", src: "/icons/3d/plugin-policy.png" },
  "search-console": { label: "Search Console", src: "/icons/3d/search-console.png" },
  "theme-branding": { label: "Theme and branding", src: "/icons/3d/theme-branding.png" },
  whatsapp: { label: "WhatsApp", src: "/icons/3d/whatsapp.png" },
  youtube: { label: "YouTube", src: "/icons/3d/youtube.png" },
};

const iconSizes = {
  sm: 34,
  md: 46,
  lg: 58,
};

export function PluginBrandMark({ brand, size = "md" }: { brand: PluginBrand; size?: "sm" | "md" | "lg" }) {
  const className = `plugin-brand-mark ${brand} ${size}`;
  const asset = brandAssets[brand];
  const iconSize = iconSizes[size];

  return (
    <span aria-label={`${asset.label} 3D icon`} className={className} role="img">
      <Image alt="" className="plugin-brand-image" height={iconSize} src={asset.src} width={iconSize} />
    </span>
  );
}
