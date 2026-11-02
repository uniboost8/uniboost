'use client';

import { useSearchParams } from 'next/navigation';
import { BODIES } from '../../components/bodies';
import { StaticView } from '../../components/StaticView';

export default function CoursesView() {
  const sp = useSearchParams();
  return <StaticView html={BODIES.courses} page="courses" deps={sp.toString()} />;
}
