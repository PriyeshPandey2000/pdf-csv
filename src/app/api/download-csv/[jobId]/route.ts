import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    console.log('GET /api/download-csv/[jobId] - Proxying to Python backend');
    const { jobId } = await context.params;
    console.log('Job ID:', jobId);

    // Forward the request to Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/download-csv/${jobId}`, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { 
        status: response.status 
      });
    }

    // Get the CSV content and headers from Python backend
    const csvContent = await response.text();
    const contentDisposition = response.headers.get('content-disposition');

    // Return CSV as response with the same headers
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': contentDisposition || 'attachment; filename="statement.csv"',
      },
    });

  } catch (error) {
    console.error('Error proxying CSV download to Python backend:', error);
    return NextResponse.json(
      { error: 'Error connecting to processing service' },
      { status: 500 }
    );
  }
}