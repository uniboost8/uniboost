import { BODIES } from '../../components/bodies';
import { StaticView } from '../../components/StaticView';

export const metadata = { title: 'Instructors – Uni Boost' };

export default function Page() {
  return <StaticView html={BODIES.instructors} page="instructors" />;
}
