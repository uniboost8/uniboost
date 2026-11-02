'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { BODIES } from '../../../components/bodies';
import { StaticView } from '../../../components/StaticView';

export default function InstructorView() {
  const params = useParams();
  const sp = useSearchParams();
  return <StaticView html={BODIES.instructor} page="instructor" deps={(params.id || '') + '?' + sp.toString()} />;
}
