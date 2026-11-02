import { BODIES } from '../../components/bodies';
import { StaticView } from '../../components/StaticView';

export const metadata = { title: 'Recordings – Uni Boost' };

export default function Page() {
  return <StaticView html={BODIES.recordings} page="recordings" />;
}