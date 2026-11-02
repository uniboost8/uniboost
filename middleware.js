import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== '/instructor.html') return NextResponse.next();
  const id = searchParams.get('id');
  const url = request.nextUrl.clone();
  url.pathname = id ? '/instructors/' + encodeURIComponent(id) : '/instructors';
  const slot = searchParams.get('slot');
  url.search = slot ? '?slot=' + encodeURIComponent(slot) : '';
  return NextResponse.redirect(url);
}

export const config = { matcher: '/instructor.html' };
