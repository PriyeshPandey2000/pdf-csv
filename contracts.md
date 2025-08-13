# PDF Bank Statement to CSV Converter - API Contracts

## API Endpoints

### 1. Upload and Process PDF
**POST** `/api/process-statement`
- **Input**: Multipart form data with PDF file
- **Output**: Processing job ID and initial status
- **Response**: 
```json
{
  "job_id": "uuid-string",
  "status": "processing",
  "message": "PDF uploaded successfully, processing started"
}
```

### 2. Check Processing Status
**GET** `/api/process-status/{job_id}`
- **Input**: Job ID from upload response
- **Output**: Current processing status and progress
- **Response**:
```json
{
  "job_id": "uuid-string",
  "status": "completed|processing|error",
  "progress": 100,
  "bank_name": "State Bank of India",
  "transaction_count": 45,
  "date_range": {
    "start": "01-Jan-2024",
    "end": "31-Jan-2024"
  },
  "message": "Processing complete"
}
```

### 3. Get Extracted Transactions
**GET** `/api/transactions/{job_id}`
- **Input**: Job ID
- **Output**: Array of extracted transactions
- **Response**:
```json
{
  "transactions": [
    {
      "date": "01-Jan-2024",
      "description": "UPI-SWIGGY-BANGALORE",
      "type": "Debit",
      "amount": 450.00,
      "balance": 25680.00,
      "reference": "UPI/401234567890"
    }
  ],
  "bank_name": "State Bank of India",
  "total_transactions": 45
}
```

### 4. Download CSV
**GET** `/api/download-csv/{job_id}`
- **Input**: Job ID
- **Output**: CSV file download
- **Response**: CSV file with headers: Date,Description,Type,Amount,Balance,Reference

## Backend Implementation Strategy

### PDF Processing Pipeline:
1. **File Upload & Validation**: Validate PDF format and size
2. **PDF Text Extraction**: Use pdfplumber to extract all text and tables
3. **Table Detection**: Identify transaction tables using pattern matching
4. **Data Parsing**: Extract transaction data regardless of column headers
5. **Bank Detection**: Identify bank from PDF content/format
6. **Data Cleaning**: Standardize dates, amounts, and transaction types
7. **CSV Generation**: Create standardized CSV output

### Intelligent Parsing Logic:
- **Date Detection**: Multiple date formats (DD-MM-YYYY, DD/MM/YYYY, etc.)
- **Amount Parsing**: Handle different currency formats and debit/credit indicators
- **Transaction Type**: Auto-detect based on amount signs, keywords, or separate columns
- **Description Cleaning**: Remove extra spaces and standardize format
- **Balance Extraction**: Parse running balance if available

## Frontend Integration Changes

### Replace Mock Data:
1. **File Upload**: Send actual PDF to `/api/process-statement`
2. **Status Polling**: Use `/api/process-status/{job_id}` instead of setTimeout
3. **Transaction Display**: Fetch from `/api/transactions/{job_id}`
4. **CSV Download**: Use `/api/download-csv/{job_id}` endpoint

### State Management Updates:
- Store `job_id` from upload response
- Implement polling mechanism for status updates
- Handle real error responses from backend
- Update progress based on actual processing stages

## Libraries Required:
- **pdfplumber**: Advanced PDF text and table extraction
- **pandas**: Data manipulation and CSV generation
- **python-multipart**: File upload handling
- **asyncio**: Async processing support
- **uuid**: Job ID generation