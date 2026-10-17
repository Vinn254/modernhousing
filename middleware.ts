import { NextResponse, type NextRequest } from 'next/server';

// Banks and payment providers post results back to us, and some of them still
// hold an http:// address in their own configuration. Redirecting those would
// drop the payload, so they pass through until each is confirmed as https on
// the sender's side.
const INBOUND_CALLBACKS = [
  '/api/mpesa/callback',
  '/api/pesaflow/webhook',
  '/api/sbm/ipn',
  '/api/coop/advise',
  '/api/coop/validate',
];

export function middleware(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const { pathname } = request.nextUrl;

  const isCallback = INBOUND_CALLBACKS.some((prefix) => pathname.startsWith(prefix));
  if (forwardedProto !== 'http' || isCallback) return NextResponse.next();

  const httpsUrl = request.nextUrl.clone();
  httpsUrl.protocol = 'https:';
  return NextResponse.redirect(httpsUrl, 308);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
