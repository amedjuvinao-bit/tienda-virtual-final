import BannerPanel from "./banner/BannerPanel.jsx";
import SectionsPanel from "./sections/SectionsPanel.jsx";

export const appearanceTabs = [
  {
    key: "banner",
    label: "Banner",
    render: () => <BannerPanel />,
  },
  {
    key: "sections",
    label: "Secciones",
    render: () => <SectionsPanel />,
  },
];