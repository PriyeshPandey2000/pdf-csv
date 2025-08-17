import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  console.log('POST /api/process-statement - Proxying to Python backend');
  
  try {
    // Get the form data from the request
    const formData = await request.formData();
    
    // Forward the request to Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/process-statement`, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let fetch handle it
      }
    });

    const data = await response.json();
    
    return NextResponse.json(data, { 
      status: response.status 
    });

  } catch (error) {
    console.error('Error proxying to Python backend:', error);
    return NextResponse.json(
      { error: `Error connecting to processing service: ${error}` },
      { status: 500 }
    );
  }
}

// Note: Storage is managed in @/utils/storage