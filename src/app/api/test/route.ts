import { NextResponse } from 'next/server';

export async function GET() {
  console.log('GET /api/test - Request received');
  return NextResponse.json({ message: 'API is working', timestamp: new Date().toISOString() });
}

export async function POST() {
  console.log('POST /api/test - Request received');
  return NextResponse.json({ message: 'POST API is working', timestamp: new Date().toISOString() });
}