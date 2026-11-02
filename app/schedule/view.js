'use client';

import { useSearchParams } from 'next/navigation';
import { BODIES } from '../../components/bodies';
import { StaticView } from '../../components/StaticView';

export default function ScheduleView() {
  const sp = useSearchParams();
  return <StaticView html={BODIES.schedule} page="schedule" deps={sp.toString()} />;
}
