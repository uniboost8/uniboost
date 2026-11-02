import { StaticView } from '../../components/StaticView';

export const metadata = { title: 'Dashboard – Uni Boost' };

const HTML = '<main><div id="dash"></div></main>';

export default function Page() {
  return <StaticView html={HTML} page="dashboard" />;
}
