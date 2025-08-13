from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Dict, Any
import uuid
from datetime import datetime
import tempfile
import pandas as pd
from io import StringIO, BytesIO

from models import ProcessingJob, Transaction, ProcessStatusResponse, ProcessStartResponse, ProcessingResult
from pdf_processor import PDFBankStatementProcessor

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Global storage for processing jobs (in production, use Redis or database)
processing_jobs: Dict[str, ProcessingJob] = {}
processing_results: Dict[str, ProcessingResult] = {}

# PDF processor instance
pdf_processor = PDFBankStatementProcessor()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def process_pdf_background(job_id: str, temp_file_path: str):
    """Background task to process PDF file"""
    try:
        # Update job status
        job = processing_jobs[job_id]
        job.status = "processing"
        job.progress = 20
        job.updated_at = datetime.utcnow()
        
        # Process the PDF
        logger.info(f"Starting PDF processing for job {job_id}")
        result = pdf_processor.process_pdf(temp_file_path)
        
        if result['success']:
            # Convert to our model format
            transactions = [
                Transaction(**transaction) for transaction in result['transactions']
            ]
            
            processing_result = ProcessingResult(
                job_id=job_id,
                transactions=transactions,
                bank_name=result['bank_name'],
                total_transactions=len(transactions),
                date_range=result.get('date_range')
            )
            
            # Store result
            processing_results[job_id] = processing_result
            
            # Update job
            job.status = "completed"
            job.progress = 100
            job.bank_name = result['bank_name']
            job.transaction_count = len(transactions)
            job.date_range = result.get('date_range')
            job.updated_at = datetime.utcnow()
            
            logger.info(f"Successfully processed {len(transactions)} transactions for job {job_id}")
            
        else:
            # Processing failed
            job.status = "error"
            job.error_message = result.get('error', 'Unknown error occurred')
            job.updated_at = datetime.utcnow()
            logger.error(f"PDF processing failed for job {job_id}: {job.error_message}")
            
    except Exception as e:
        logger.error(f"Error in background processing for job {job_id}: {str(e)}")
        job = processing_jobs[job_id]
        job.status = "error"
        job.error_message = f"Processing error: {str(e)}"
        job.updated_at = datetime.utcnow()
    
    finally:
        # Clean up temporary file
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        except Exception as e:
            logger.error(f"Error cleaning up temp file: {str(e)}")

@api_router.post("/process-statement", response_model=ProcessStartResponse)
async def process_statement(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Upload and start processing PDF bank statement"""
    
    # Validate file
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if file.size and file.size > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File size too large. Maximum 50MB allowed")
    
    try:
        # Create job
        job_id = str(uuid.uuid4())
        job = ProcessingJob(
            id=job_id,
            file_name=file.filename,
            file_size=file.size or 0,
            status="uploading",
            progress=10
        )
        processing_jobs[job_id] = job
        
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Start background processing
        background_tasks.add_task(process_pdf_background, job_id, temp_file_path)
        
        logger.info(f"Started processing job {job_id} for file {file.filename}")
        
        return ProcessStartResponse(
            job_id=job_id,
            status="processing",
            message="PDF uploaded successfully, processing started"
        )
        
    except Exception as e:
        logger.error(f"Error starting PDF processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.get("/process-status/{job_id}", response_model=ProcessStatusResponse)
async def get_process_status(job_id: str):
    """Get processing status for a job"""
    
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = processing_jobs[job_id]
    
    message = "Processing in progress"
    if job.status == "completed":
        message = "Processing completed successfully"
    elif job.status == "error":
        message = "Processing failed"
    elif job.status == "uploading":
        message = "File uploaded, starting processing"
    
    return ProcessStatusResponse(
        job_id=job_id,
        status=job.status,
        progress=job.progress,
        bank_name=job.bank_name,
        transaction_count=job.transaction_count,
        date_range=job.date_range,
        message=message,
        error_message=job.error_message
    )

@api_router.get("/transactions/{job_id}")
async def get_transactions(job_id: str):
    """Get extracted transactions for a completed job"""
    
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = processing_jobs[job_id]
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    if job_id not in processing_results:
        raise HTTPException(status_code=404, detail="Results not found")
    
    result = processing_results[job_id]
    
    return {
        "transactions": [transaction.dict() for transaction in result.transactions],
        "bank_name": result.bank_name,
        "total_transactions": result.total_transactions,
        "date_range": result.date_range
    }

@api_router.get("/download-csv/{job_id}")
async def download_csv(job_id: str):
    """Download transactions as CSV file"""
    
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = processing_jobs[job_id]
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    if job_id not in processing_results:
        raise HTTPException(status_code=404, detail="Results not found")
    
    result = processing_results[job_id]
    
    # Create CSV content
    df_data = []
    for transaction in result.transactions:
        df_data.append({
            'Date': transaction.date,
            'Description': transaction.description,
            'Type': transaction.type,
            'Amount': transaction.amount,
            'Balance': transaction.balance or '',
            'Reference': transaction.reference or ''
        })
    
    df = pd.DataFrame(df_data)
    
    # Convert to CSV
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_content = csv_buffer.getvalue()
    
    # Create filename
    bank_name = result.bank_name.replace(' ', '_') if result.bank_name else 'Bank'
    filename = f"{bank_name}_Statement_{datetime.now().strftime('%Y%m%d')}.csv"
    
    # Return as streaming response
    return StreamingResponse(
        BytesIO(csv_content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/")
async def root():
    return {"message": "PDF Bank Statement to CSV Converter API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "PDF Bank Statement Processor"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()