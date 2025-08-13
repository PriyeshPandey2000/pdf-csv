from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class ProcessingJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = Field(default="processing")  # processing, completed, error
    progress: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    file_name: str
    file_size: int
    bank_name: Optional[str] = None
    transaction_count: Optional[int] = None
    date_range: Optional[Dict[str, str]] = None
    error_message: Optional[str] = None

class Transaction(BaseModel):
    date: str
    description: str
    type: str  # Credit or Debit
    amount: float
    balance: Optional[float] = None
    reference: Optional[str] = None

class ProcessingResult(BaseModel):
    job_id: str
    transactions: List[Transaction]
    bank_name: str
    total_transactions: int
    date_range: Optional[Dict[str, str]] = None

class ProcessStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    bank_name: Optional[str] = None
    transaction_count: Optional[int] = None
    date_range: Optional[Dict[str, str]] = None
    message: str
    error_message: Optional[str] = None

class ProcessStartResponse(BaseModel):
    job_id: str
    status: str
    message: str