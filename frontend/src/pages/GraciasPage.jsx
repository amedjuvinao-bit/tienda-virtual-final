import GraciasPageView from './gracias/GraciasPageView';
import { useGraciasPageController } from './gracias/useGraciasPageController';

export default function GraciasPage() {
  return <GraciasPageView {...useGraciasPageController()} />;
}
