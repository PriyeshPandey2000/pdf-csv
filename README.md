# PDF Bank Statement Processor

A full-stack application that processes PDF bank statements and extracts transactions using reliable Python libraries, with a modern Next.js frontend.

## Architecture

- **Frontend**: Next.js 15 with TypeScript, shadcn/ui components
- **Backend**: Python FastAPI with pdfplumber for accurate PDF processing
- **API Proxy**: Next.js API routes proxy requests to Python backend

## Setup and Installation

### 1. Python Backend Setup

```bash
cd python-backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Or use the provided startup script:
```bash
cd python-backend
./start.sh
```

### 2. Next.js Frontend Setup

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

## Usage

1. **Start the Python backend** (port 8000)
2. **Start the Next.js frontend** (port 3000)
3. **Open your browser** to http://localhost:3000
4. **Upload a PDF bank statement**
5. **View extracted transactions** and download as CSV

## API Endpoints

### Python Backend (port 8000)
- `POST /api/process-statement` - Upload and process PDF
- `GET /api/process-status/{job_id}` - Check processing status
- `GET /api/transactions/{job_id}` - Get extracted transactions
- `GET /api/download-csv/{job_id}` - Download transactions as CSV
- `GET /health` - Health check

### Next.js API Proxy (port 3000)
- `POST /api/process-statement/{job_id}` - Proxies to Python backend
- `GET /api/process-status/{job_id}` - Proxies to Python backend
- `GET /api/transactions/{job_id}` - Proxies to Python backend
- `GET /api/download-csv/{job_id}` - Proxies to Python backend

## Features

- **Accurate PDF Processing**: Uses Python's pdfplumber library for reliable text extraction
- **Multi-Bank Support**: Detects and processes statements from major Indian banks
- **Real-time Progress**: Shows upload and processing progress
- **Transaction Preview**: View extracted transactions before download
- **CSV Export**: Download transactions in CSV format
- **Responsive UI**: Modern interface with drag-and-drop file upload

## Supported Banks

- State Bank of India (SBI)
- HDFC Bank
- ICICI Bank
- Axis Bank
- Punjab National Bank (PNB)
- Kotak Mahindra Bank
- IndusInd Bank
- Yes Bank
- Bank of Baroda
- Canara Bank
- Union Bank of India
- Indian Bank
- Central Bank of India
- IDBI Bank
- IDFC First Bank

## Environment Variables

You can configure the Python backend URL by setting:
```bash
export PYTHON_BACKEND_URL=http://localhost:8000
```

## Development

### Python Backend
The Python backend uses FastAPI and pdfplumber to:
- Extract text and tables from PDF files
- Parse transaction data with intelligent pattern matching
- Handle various date and amount formats
- Detect transaction types (Credit/Debit)
- Remove duplicate transactions

### Next.js Frontend
The frontend provides:
- File upload with validation
- Real-time processing status updates
- Transaction preview with filtering
- CSV download functionality
- Responsive design with Tailwind CSS

## Troubleshooting

1. **Connection refused errors**: Ensure the Python backend is running on port 8000
2. **PDF processing issues**: Check that the PDF is a valid bank statement
3. **Missing transactions**: The pdfplumber library is designed to extract more transactions accurately than Node.js alternatives

## Migration from Node.js Processing

This application originally used Node.js PDF processing but was migrated to use a Python backend for more reliable and accurate transaction extraction. The Next.js frontend remains unchanged and now proxies PDF processing requests to the Python backend.
