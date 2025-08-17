export interface Transaction {
  date: string
  chq_no?: string
  description: string
  debit?: number | null
  credit?: number | null
  balance?: number | null
  init_br?: string
  
  // Computed properties for backward compatibility
  type?: 'Credit' | 'Debit'
  amount?: number
  reference?: string | null
}

export interface ProcessingJob {
  id: string
  status: 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  file_name: string
  file_size: number
  bank_name?: string | null
  transaction_count?: number | null
  date_range?: {
    start: string
    end: string
  } | null
  error_message?: string | null
  created_at: string
  updated_at: string
}

export interface ProcessingResult {
  job_id: string
  transactions: Transaction[]
  bank_name: string
  total_transactions: number
  date_range?: {
    start: string
    end: string
  } | null
}

export interface ProcessStatusResponse {
  job_id: string
  status: string
  progress: number
  bank_name?: string | null
  transaction_count?: number | null
  date_range?: {
    start: string
    end: string
  } | null
  message: string
  error_message?: string | null
}

export interface ProcessStartResponse {
  job_id: string
  status: string
  message: string
}