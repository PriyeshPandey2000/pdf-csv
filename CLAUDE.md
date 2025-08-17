# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 15** PDF Bank Statement to CSV Converter application that processes Indian bank statement PDFs and converts them to standardized CSV format. The application uses intelligent parsing to work with all major Indian banks regardless of their PDF format or column structure.

## Architecture

### Next.js Full-Stack Application
- **src/app/**: Next.js 15 App Router structure with TypeScript
- **src/app/api/**: API routes handling PDF processing, status, transactions, and CSV downloads
- **src/components/**: React components with shadcn/ui and TypeScript
- **src/utils/**: Shared utilities including PDF processor and storage management
- **src/types/**: TypeScript type definitions for the entire application

### Key Features
- Universal bank support through intelligent column detection
- Handles multiple date formats and amount patterns
- Real-time processing status with background tasks
- Transaction preview with CSV download
- Responsive UI with TypeScript and Tailwind CSS
- Server-side API routes for PDF processing

## Development Commands

```bash
npm run dev         # Development server at localhost:3000
npm run build       # Production build
npm start           # Production server
npm run lint        # ESLint checking
```

## API Routes (Next.js API Routes)

All API endpoints are at `/api/`:

- `POST /api/process-statement` - Upload PDF and start processing
- `GET /api/process-status/[jobId]` - Get processing status for job
- `GET /api/transactions/[jobId]` - Get extracted transactions for job
- `GET /api/download-csv/[jobId]` - Download CSV file for job

## Core Processing Logic

The PDF processor (`src/utils/pdfProcessor.ts`) uses:

1. **PDF Parsing**: Uses `pdfjs-dist` to extract text content from PDF pages
2. **Bank Detection**: Pattern matching against known Indian bank names
3. **Transaction Extraction**: Line-by-line parsing with regex patterns for dates and amounts  
4. **Data Standardization**: Normalizes dates (DD-MM-YYYY), amounts, and transaction types
5. **Intelligent Parsing**: Handles various PDF layouts and formats

## File Structure

```
src/
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── process-statement/  # PDF upload and processing
│   │   ├── process-status/     # Job status checking
│   │   ├── transactions/       # Transaction data retrieval
│   │   └── download-csv/       # CSV file download
│   ├── globals.css            # Global styles with Tailwind
│   ├── layout.tsx             # Root layout component
│   └── page.tsx               # Main application page
├── components/                 # React components
│   ├── ui/                    # shadcn/ui components (Button, Card, etc.)
│   ├── FileUpload.tsx         # File upload component
│   ├── ProcessingStatus.tsx   # Processing status display
│   └── TransactionPreview.tsx # Transaction table and preview
├── types/
│   └── index.ts              # TypeScript type definitions
└── utils/
    ├── pdfProcessor.ts       # PDF processing logic
    └── storage.ts           # In-memory job storage
```

## Key Components

### PDF Processor (`src/utils/pdfProcessor.ts`)
- Processes PDF files using pdfjs-dist library
- Detects Indian banks (SBI, HDFC, ICICI, Axis, PNB, etc.)
- Parses transaction lines with date/amount pattern matching
- Returns standardized transaction data

### Storage (`src/utils/storage.ts`)
- In-memory Maps for job status and results
- In production, should be replaced with Redis or database

### API Routes
- Handle file uploads with FormData
- Background processing with job status tracking  
- TypeScript interfaces for all API responses

## Dependencies

### Core
- **Next.js 15**: React framework with App Router
- **TypeScript**: Static type checking
- **Tailwind CSS 3.4**: Utility-first CSS framework

### PDF Processing
- **pdfjs-dist**: Mozilla's PDF parsing library
- **uuid**: Job ID generation

### UI Components
- **@radix-ui/react-\***: Headless UI components
- **lucide-react**: Icon library
- **class-variance-authority**: Component variant management

## Configuration

### Next.js Config (`next.config.js`)
- Server actions enabled with 50MB body size limit

### Tailwind Config (`tailwind.config.js`)
- shadcn/ui theme variables and component styles
- Animation support with tailwindcss-animate

## Running the Application

1. `npm install` - Install dependencies
2. `npm run dev` - Start development server at http://localhost:3000
3. Upload a PDF bank statement file
4. View processing status and download CSV

The application handles the complete workflow from PDF upload to CSV download in a single Next.js application.