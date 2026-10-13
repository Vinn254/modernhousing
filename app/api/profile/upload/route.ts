import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { message: 'Tenant profile photos are managed by the landlord.' },
    { status: 403 }
  );
}