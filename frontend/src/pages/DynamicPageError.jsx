import ServicePageFrame, {
  ServiceButton,
  ServiceHeading,
} from "../components/service-pages/ServicePageFrame";
import { buildInformationConfig } from "../components/information-page/informationPageConfig";
export default function DynamicPageError({ theme, error, retry }) {
  const config = buildInformationConfig({
    eyebrowText: "",
    titleText: "No pudimos abrir esta página",
    subtitleText: error,
    sections: [],
  });
  return (
    <ServicePageFrame config={config} theme={theme}>
      <div role="alert">
        <ServiceHeading config={config}>
          <ServiceButton config={config} onClick={retry}>
            Reintentar
          </ServiceButton>
        </ServiceHeading>
      </div>
    </ServicePageFrame>
  );
}
