import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    console.log('GET /api/process-status/[jobId] - Proxying to Python backend');
    const { jobId } = await context.params;
    console.log('Job ID:', jobId);
    
    // Forward the request to Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/process-status/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    return NextResponse.json(data, { 
      status: response.status 
    });

  } catch (error) {
    console.error('Error proxying to Python backend:', error);
    return NextResponse.json(
      { error: 'Error connecting to processing service' },
      { status: 500 }
    );
  }
}