import { BODIES } from '../../components/bodies';
import { StaticView } from '../../components/StaticView';

export const metadata = { title: 'My Classes – Uni Boost' };

export default function Page() {
  return <StaticView html={BODIES.myClasses} page="my-classes" />;
}
