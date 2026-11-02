import { BODIES } from '../components/bodies';
import { StaticView } from '../components/StaticView';

export default function Page() {
  return <StaticView html={BODIES.home} page="index" />;
}
