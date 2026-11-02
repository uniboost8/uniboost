import { Suspense } from 'react';
import InstructorView from './view';

export const metadata = { title: 'Instructor – Uni Boost' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InstructorView />
    </Suspense>
  );
}
