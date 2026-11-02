import { Suspense } from 'react';
import ScheduleView from './view';

export const metadata = { title: 'Class Schedule – Uni Boost' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ScheduleView />
    </Suspense>
  );
}
