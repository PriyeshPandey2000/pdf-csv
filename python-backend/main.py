from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pdfplumber
import uuid
import json
import os
import tempfile
from datetime import datetime
from typing import List, Dict, Any, Optional
import io
import csv
from pathlib import Path

app = FastAPI(title="PDF Statement Processor", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for jobs and results
jobs_storage: Dict[str, Dict] = {}
results_storage: Dict[str, Dict] = {}

# Create temp directory for uploaded files
TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

class PDFBankStatementProcessor:
    def __init__(self):
        self.bank_patterns = {
            'sbi': ['state bank of india', 'sbi', 'state bank'],
            'hdfc': ['hdfc bank', 'hdfc', 'housing development finance'],
            'icici': ['icici bank', 'icici', 'industrial credit'],
            'axis': ['axis bank', 'axis'],
            'pnb': ['punjab national bank', 'pnb'],
            'kotak': ['kotak mahindra bank', 'kotak'],
            'indusind': ['indusind bank', 'indusind'],
            'yes': ['yes bank', 'yes'],
            'bob': ['bank of baroda', 'baroda'],
            'canara': ['canara bank', 'canara'],
            'union': ['union bank', 'union'],
            'indian': ['indian bank', 'indian'],
            'central': ['central bank', 'central'],
            'idbi': ['idbi bank', 'idbi'],
            'idfc': ['idfc first bank', 'idfc']
        }
        
        self.bank_display_names = {
            'sbi': 'State Bank of India',
            'hdfc': 'HDFC Bank',
            'icici': 'ICICI Bank',
            'axis': 'Axis Bank',
            'pnb': 'Punjab National Bank',
            'kotak': 'Kotak Mahindra Bank',
            'indusind': 'IndusInd Bank',
            'yes': 'Yes Bank',
            'bob': 'Bank of Baroda',
            'canara': 'Canara Bank',
            'union': 'Union Bank of India',
            'indian': 'Indian Bank',
            'central': 'Central Bank of India',
            'idbi': 'IDBI Bank',
            'idfc': 'IDFC First Bank'
        }

    def detect_bank(self, text: str) -> Optional[str]:
        """Detect bank from PDF text"""
        text_lower = text.lower()
        
        for bank_code, patterns in self.bank_patterns.items():
            for pattern in patterns:
                if pattern in text_lower:
                    return bank_code
        return None

    def get_bank_display_name(self, bank_code: Optional[str]) -> str:
        """Get display name for bank"""
        return self.bank_display_names.get(bank_code or '', 'Unknown Bank')

    def process_pdf(self, pdf_path: str, password: Optional[str] = None) -> Dict[str, Any]:
        """Process PDF and extract transactions using pdfplumber"""
        try:
            transactions = []
            full_text = ""
            
            with pdfplumber.open(pdf_path, password=password) as pdf:
                # Extract text from all pages
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        full_text += page_text + "\n"
                
                # Process each page for transactions using universal approach
                for page in pdf.pages:
                    page_transactions = []
                    
                    # Try to extract tables first
                    tables = page.extract_tables()
                    
                    if tables:
                        for table in tables:
                            # Process the entire table as a unit to identify column structure
                            table_transactions = self._parse_table_universal(table)
                            page_transactions.extend(table_transactions)
                    
                    # Also try text extraction as fallback
                    page_text = page.extract_text()
                    if page_text:
                        text_transactions = self._extract_from_text_universal(page_text)
                        page_transactions.extend(text_transactions)
                    
                    transactions.extend(page_transactions)
            
            # Remove duplicates
            transactions = self._remove_duplicates(transactions)
            
            # Detect bank
            detected_bank = self.detect_bank(full_text)
            
            if not transactions:
                return {
                    'success': False,
                    'error': 'No valid transactions found in PDF',
                    'transactions': [],
                    'bank_name': self.get_bank_display_name(detected_bank),
                    'transaction_count': 0
                }
            
            # Sort transactions by date
            transactions.sort(key=lambda x: self._parse_date_for_sort(x.get('date', '')))
            
            # Calculate date range
            dates = [t['date'] for t in transactions if t.get('date')]
            date_range = None
            if dates:
                date_range = {
                    'start': dates[0],
                    'end': dates[-1]
                }
            
            return {
                'success': True,
                'transactions': transactions,
                'bank_name': self.get_bank_display_name(detected_bank),
                'transaction_count': len(transactions),
                'date_range': date_range
            }
            
        except Exception as e:
            error_msg = str(e).lower()
            if 'password' in error_msg or 'encrypted' in error_msg or 'decrypt' in error_msg:
                return {
                    'success': False,
                    'error': 'PDF is password protected. Please provide the password.',
                    'error_type': 'password_required',
                    'transactions': [],
                    'bank_name': 'Unknown Bank',
                    'transaction_count': 0
                }
            return {
                'success': False,
                'error': f'Error processing PDF: {str(e)}',
                'transactions': [],
                'bank_name': 'Unknown Bank',
                'transaction_count': 0
            }

    def _is_summary_row(self, description: str) -> bool:
        """Check if a row is a summary/total row that should be excluded"""
        if not description:
            return False
            
        description_lower = description.lower().strip()
        
        # Summary row patterns to exclude
        summary_patterns = [
            'transaction total',
            'opening balance', 
            'closing balance',
            'total debit',
            'total credit',
            'net amount',
            'balance b/f',
            'balance c/f',
            'brought forward',
            'carried forward',
            'subtotal',
            'grand total',
            'summary',
            'total amount'
        ]
        
        # Charge/Fee related patterns to exclude
        charge_patterns = [
            'charge type',
            'charges(rs)',
            'total(rs)',
            'rtgs fee',
            'cash transaction fee',
            'service charge',
            'processing fee',
            'annual fee',
            'maintenance fee',
            'sms charges',
            'atm charges',
            'debit card charges',
            'cheque book charges',
            'recover date',
            'period',
            'sr. no',
            'sr.no',
            'chargeable amount',
            'net chargeable',
            'charges indicate'
        ]
        
        # Check summary patterns
        for pattern in summary_patterns:
            if pattern in description_lower:
                return True
        
        # Check charge/fee patterns        
        for pattern in charge_patterns:
            if pattern in description_lower:
                return True
                
        # Check for rows that are just numbers or very short descriptions
        if len(description.strip()) <= 2:
            return True
            
        # Check for rows that look like just sequential numbers (1, 2, 3, etc.)
        if description.strip().isdigit() and len(description.strip()) <= 3:
            return True
            
        # Check for rows that are just periods/months (like "05-2025")
        if description.strip().count('-') == 1 and len(description.strip()) <= 8:
            parts = description.strip().split('-')
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                return True
                
        return False

    def _is_charge_table_header(self, row: List[str]) -> bool:
        """Check if this row is a header for a charges/fees table that should be skipped"""
        if not row or len(row) < 3:
            return False
            
        # Join all cells to check for header patterns
        row_text = ' '.join([cell.strip().lower() if cell else '' for cell in row])
        
        # Charge table header patterns
        charge_header_patterns = [
            'sr. no',
            'sr.no', 
            'period',
            'recover date',
            'charge type',
            'charges(rs)',
            'total(rs)',
            'service charges',
            'fees summary',
            'transaction charges'
        ]
        
        # If this row contains multiple charge-related headers, it's likely a charge table
        header_count = 0
        for pattern in charge_header_patterns:
            if pattern in row_text:
                header_count += 1
                
        return header_count >= 2  # If 2+ charge headers found, it's a charge table

    def _is_transaction_table_header(self, row: List[str]) -> bool:
        """Check if this row is a header for the main transaction table"""
        if not row or len(row) < 3:
            return False
            
        # Join all cells to check for header patterns
        row_text = ' '.join([cell.strip().lower() if cell else '' for cell in row])
        
        # Transaction table header patterns
        transaction_header_patterns = [
            'tran date',
            'transaction date',
            'particulars',
            'debit',
            'credit', 
            'balance',
            'init.br',
            'chq no',
            'check no',
            'reference',
            'description'
        ]
        
        # If this row contains multiple transaction headers, it's likely a transaction table header
        header_count = 0
        for pattern in transaction_header_patterns:
            if pattern in row_text:
                header_count += 1
                
        return header_count >= 3  # If 3+ transaction headers found, it's a transaction table header

    def _is_invalid_row(self, row: List[str]) -> bool:
        """Check if this entire row should be excluded based on any column content"""
        if not row:
            return True
            
        # Clean the row
        cleaned_row = [cell.strip() if cell else '' for cell in row]
        
        # Join all non-empty cells to check patterns
        all_text = ' '.join([cell for cell in cleaned_row if cell]).lower()
        
        # Check for charge table patterns across all columns
        charge_patterns = [
            'charge type', 'charges(rs)', 'total(rs)', 'rtgs fee', 'cash transaction fee',
            'service charge', 'processing fee', 'recover date', 'sr. no', 'sr.no',
            'period', 'chargeable amount', 'net chargeable'
        ]
        
        for pattern in charge_patterns:
            if pattern in all_text:
                return True
        
        # Check for obvious header patterns that should be excluded
        if 'date' in all_text and 'transaction' in all_text and 'details' in all_text:
            return True
        if 'tran date' in all_text and 'particulars' in all_text:
            return True
        
        # Don't exclude rows that start with dates - these are likely valid transactions
        if len(cleaned_row) >= 1:
            first_col = cleaned_row[0].strip()
            # If first column looks like a date, it's probably a valid transaction
            if self._is_date(first_col) or self._looks_like_date(first_col):
                return False
        
        # Check if first column is just a sequential number (1, 2, 3, etc.) 
        # and second column is a date - this indicates a charge table row
        if len(cleaned_row) >= 2:
            first_col = cleaned_row[0].strip()
            second_col = cleaned_row[1].strip() if len(cleaned_row) > 1 else ''
            
            # If first column is just a number 1-99 and second is a date, likely a charge row
            if (first_col.isdigit() and 1 <= int(first_col) <= 99 and 
                self._is_date(second_col)):
                return True
                
            # If first column is a period format like "05-2025"
            if (first_col.count('-') == 1 and len(first_col) <= 8):
                parts = first_col.split('-')
                if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                    return True
        
        return False

    def _parse_table_row(self, row: List[str]) -> Optional[Dict[str, Any]]:
        """Parse a table row to extract transaction data"""
        try:
            if not row or len(row) < 3:
                return None
                
            # Skip charge table headers entirely
            if self._is_charge_table_header(row):
                return None
                
            # Skip transaction table headers entirely  
            if self._is_transaction_table_header(row):
                return None
                
            # Skip invalid rows (including sequential number rows)
            if self._is_invalid_row(row):
                return None
            
            # Clean row data
            cleaned_row = [cell.strip() if cell else '' for cell in row]
            
            # Expected column structure based on your correct example:
            # 0: Tran Date, 1: Chq No, 2: Particulars, 3: Debit, 4: Credit, 5: Balance, 6: Init.Br
            
            # Initialize all fields
            tran_date = ''
            chq_no = ''
            particulars = ''
            debit_amount = None
            credit_amount = None
            balance = None
            init_br = ''
            
            # Try to identify columns by content type first, then by position
            for i, cell in enumerate(cleaned_row):
                if not cell:
                    continue
                
                # Check if it's a date (and we don't have one yet)
                if not tran_date and (self._is_date(cell) or self._looks_like_date(cell)):
                    tran_date = cell
                # Check if it's an amount
                elif self._is_amount(cell):
                    amount_val = self._clean_amount(cell)
                    # Determine if it's debit, credit, or balance based on position and content
                    if amount_val > 0:
                        # For HDFC format: DATE | DETAILS | REF | DEBIT | CREDIT | BALANCE
                        if i == 3:  # Column 3 is typically debit
                            debit_amount = amount_val
                        elif i == 4:  # Column 4 is typically credit
                            credit_amount = amount_val
                        elif i == 5:  # Column 5 is typically balance
                            balance = amount_val
                        elif balance is None:  # First amount found could be balance
                            balance = amount_val
                        elif debit_amount is None:  # Second amount could be debit
                            debit_amount = amount_val
                        elif credit_amount is None:  # Third amount could be credit
                            credit_amount = amount_val
                # Check if it contains amount with signs like "-301.00" or "+135.00"
                elif (cell.startswith('-') or cell.startswith('+')) and self._is_amount(cell[1:]):
                    amount_val = self._clean_amount(cell[1:])
                    if cell.startswith('-'):
                        debit_amount = amount_val
                    else:
                        credit_amount = amount_val
                # Check if it's a reference number (mix of letters and numbers)
                elif not chq_no and (cell.startswith('UPI-') or cell.isdigit() or 
                                   (len(cell) >= 5 and any(c.isdigit() for c in cell))):
                    chq_no = cell
                # Everything else goes to particulars
                else:
                    if particulars:
                        particulars += ' ' + cell
                    else:
                        particulars = cell
            
            # Filter out summary rows before validation
            if self._is_summary_row(particulars):
                return None
            
            # Validation: must have at least date or particulars and some amount
            if not tran_date and not particulars:
                return None
            if debit_amount is None and credit_amount is None:
                return None
            
            # Normalize date
            if tran_date:
                tran_date = self._normalize_date(tran_date)
            
            # Ensure amounts are positive (no negative signs)
            if debit_amount is not None:
                debit_amount = abs(debit_amount)
            if credit_amount is not None:
                credit_amount = abs(credit_amount)
            if balance is not None:
                balance = abs(balance)
            
            return {
                'date': tran_date,
                'chq_no': chq_no,
                'description': particulars or 'Transaction',
                'debit': debit_amount,
                'credit': credit_amount,
                'balance': balance,
                'init_br': init_br
            }
            
        except Exception as e:
            print(f"Error parsing table row: {e}")
            return None

    def _extract_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Extract transactions from plain text"""
        transactions = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 10:
                continue
            
            # Look for lines that might contain transaction data
            if self._looks_like_transaction_line(line):
                transaction = self._parse_text_line(line)
                if transaction:
                    transactions.append(transaction)
        
        return transactions

    def _looks_like_transaction_line(self, line: str) -> bool:
        """Check if a line looks like it contains transaction data"""
        # Must have a date pattern
        has_date = self._contains_date(line)
        # Must have an amount pattern
        has_amount = self._contains_amount(line)
        # Should have reasonable length
        has_length = len(line) > 15
        
        return has_date and has_amount and has_length

    def _parse_text_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a text line to extract transaction data"""
        try:
            # Split the line into parts
            parts = line.split()
            
            tran_date = ''
            chq_no = ''
            particulars_parts = []
            debit_amount = None
            credit_amount = None
            balance = None
            init_br = ''
            
            for part in parts:
                if self._is_date(part):
                    tran_date = part
                elif part.isdigit() and len(part) >= 3:
                    if not chq_no and len(part) <= 8:
                        chq_no = part
                    elif not init_br:
                        init_br = part
                elif self._is_amount(part):
                    amount_val = self._clean_amount(part)
                    # For text parsing, we'll need to guess debit vs credit based on keywords
                    # or just put it as debit by default
                    if debit_amount is None:
                        debit_amount = abs(amount_val)
                    elif balance is None:
                        balance = abs(amount_val)
                else:
                    particulars_parts.append(part)
            
            particulars = ' '.join(particulars_parts).strip()
            
            # Filter out summary rows before validation
            if self._is_summary_row(particulars):
                return None
            
            if not tran_date and not particulars_parts:
                return None
            if debit_amount is None and credit_amount is None:
                return None
            
            # Try to determine if it should be credit based on keywords
            if particulars and debit_amount is not None:
                particulars_lower = particulars.lower()
                credit_keywords = ['credit', 'deposit', 'salary', 'interest', 'refund', 'cashback', 'neft.*credit']
                
                for keyword in credit_keywords:
                    if keyword in particulars_lower:
                        credit_amount = debit_amount
                        debit_amount = None
                        break
            
            return {
                'date': self._normalize_date(tran_date) if tran_date else '',
                'chq_no': chq_no,
                'description': particulars or 'Transaction',
                'debit': debit_amount,
                'credit': credit_amount,
                'balance': balance,
                'init_br': init_br
            }
            
        except Exception as e:
            print(f"Error parsing text line: {e}")
            return None

    def _is_date(self, text: str) -> bool:
        """Check if text looks like a date"""
        import re
        date_patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
            r'\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}',
            r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}',
            r'\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}',
            r'\d{1,2}-[A-Za-z]{3}-\d{2,4}'
        ]
        return any(re.match(pattern, text.strip()) for pattern in date_patterns)

    def _looks_like_date(self, text: str) -> bool:
        """Check if text looks like a date with more flexible patterns"""
        import re
        text = text.strip()
        # Check for patterns like "01 Jun, 2025" or "07 Jun, 2025"
        flexible_patterns = [
            r'\d{1,2}\s+[A-Za-z]{3},?\s+\d{4}',
            r'[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}',
            r'\d{1,2}\s*[A-Za-z]{3}\s*,?\s*\d{4}'
        ]
        return any(re.search(pattern, text) for pattern in flexible_patterns)

    def _contains_date(self, text: str) -> bool:
        """Check if text contains a date"""
        import re
        date_patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
            r'\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}',
            r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}',
            r'\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}',
            r'\d{1,2}-[A-Za-z]{3}-\d{2,4}'
        ]
        return any(re.search(pattern, text) for pattern in date_patterns)

    def _is_amount(self, text: str) -> bool:
        """Check if text looks like an amount"""
        import re
        text = text.strip()
        
        # Handle amounts with +/- signs
        if text.startswith(('+', '-')):
            text = text[1:]
        
        # Remove common currency symbols and commas
        cleaned = re.sub(r'[₹$,\s]', '', text)
        
        # Check for amount patterns
        amount_patterns = [
            r'^\d+\.?\d*$',  # Simple number
            r'^\(\d+\.?\d*\)$',  # Negative in parentheses
            r'^\d{1,3}(,\d{3})*\.?\d*$',  # With comma separators
            r'^\d+\.\d{2}$',  # Decimal amounts like 301.00
            r'^\d{1,3}(,\d{3})*\.\d{2}$'  # Large amounts with commas like 69,201.94
        ]
        
        return any(re.match(pattern, cleaned) for pattern in amount_patterns)

    def _contains_amount(self, text: str) -> bool:
        """Check if text contains an amount"""
        import re
        return bool(re.search(r'\d+[.,]\d{2}|\d{4,}', text))

    def _clean_amount(self, amount_str: str) -> float:
        """Clean and convert amount string to float"""
        if not amount_str:
            return 0.0
        
        # Remove currency symbols, spaces, and commas
        import re
        original = amount_str.strip()
        
        # Handle + signs at the beginning
        if original.startswith('+'):
            original = original[1:]
        
        cleaned = re.sub(r'[₹$,\s]', '', original)
        
        # Handle parentheses for negative amounts (but we'll make them positive)
        is_negative = False
        if cleaned.startswith('(') and cleaned.endswith(')'):
            cleaned = cleaned[1:-1]
            is_negative = True
        
        # Handle negative signs
        if cleaned.startswith('-'):
            cleaned = cleaned[1:]
            is_negative = True
        
        try:
            amount = float(cleaned)
            # Always return positive amounts for debit/credit columns
            return abs(amount)
        except ValueError:
            return 0.0

    def _normalize_date(self, date_str: str) -> str:
        """Normalize date string to DD-MM-YYYY format"""
        if not date_str:
            return ''
        
        import re
        date_str = date_str.strip()
        
        # Month name to number mapping
        month_map = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        }
        
        # Try different date formats
        formats = [
            (r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', 'DD-MM-YYYY'),
            (r'(\d{1,2})[-/](\d{1,2})[-/](\d{2})', 'DD-MM-YY'),
            (r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', 'YYYY-MM-DD'),
            # Handle "01 Jun, 2025" format
            (r'(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})', 'DD-MMM-YYYY'),
        ]
        
        for pattern, format_type in formats:
            match = re.match(pattern, date_str)
            if match:
                if format_type == 'DD-MM-YYYY':
                    return f"{match.group(1).zfill(2)}-{match.group(2).zfill(2)}-{match.group(3)}"
                elif format_type == 'DD-MM-YY':
                    year = int(match.group(3))
                    year = 2000 + year if year < 50 else 1900 + year
                    return f"{match.group(1).zfill(2)}-{match.group(2).zfill(2)}-{year}"
                elif format_type == 'YYYY-MM-DD':
                    return f"{match.group(3).zfill(2)}-{match.group(2).zfill(2)}-{match.group(1)}"
                elif format_type == 'DD-MMM-YYYY':
                    day = match.group(1).zfill(2)
                    month_name = match.group(2).lower()
                    year = match.group(3)
                    month_num = month_map.get(month_name, '01')
                    return f"{day}-{month_num}-{year}"
        
        return date_str

    def _determine_transaction_type(self, description: str) -> str:
        """Determine if transaction is Credit or Debit based on description"""
        desc_lower = description.lower()
        
        credit_keywords = ['credit', 'deposit', 'salary', 'interest', 'refund', 'cashback', 'transfer.*credit']
        debit_keywords = ['debit', 'withdrawal', 'payment', 'purchase', 'charge', 'fee', 'transfer.*debit', 'atm']
        
        for keyword in credit_keywords:
            if keyword in desc_lower:
                return 'Credit'
        
        for keyword in debit_keywords:
            if keyword in desc_lower:
                return 'Debit'
        
        return 'Debit'  # Default to debit

    def _parse_date_for_sort(self, date_str: str) -> datetime:
        """Parse date string for sorting"""
        try:
            if not date_str:
                return datetime.min
            
            # Assuming DD-MM-YYYY format after normalization
            parts = date_str.split('-')
            if len(parts) == 3:
                day, month, year = parts
                return datetime(int(year), int(month), int(day))
        except:
            pass
        
        return datetime.min

    def _remove_duplicates(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate transactions"""
        seen = set()
        unique_transactions = []
        
        for transaction in transactions:
            # Create a key based on date, description, debit, credit, and balance
            key = (
                transaction.get('date', ''),
                transaction.get('description', ''),
                transaction.get('debit', 0),
                transaction.get('credit', 0),
                transaction.get('balance', 0)
            )
            
            if key not in seen:
                seen.add(key)
                unique_transactions.append(transaction)
        
        return unique_transactions

    def _parse_table_universal(self, table: List[List[str]]) -> List[Dict[str, Any]]:
        """Universal table parsing that identifies column structure automatically"""
        if not table or len(table) < 2:
            return []
        
        transactions = []
        header_row_idx = -1
        column_mapping = {}
        
        # Step 1: Find the header row and identify columns
        for i, row in enumerate(table):
            if not row:
                continue
            
            # Clean the row
            cleaned_row = [cell.strip().lower() if cell else '' for cell in row]
            row_text = ' '.join(cleaned_row)
            
            # Check if this looks like a header row
            date_indicators = ['date', 'tran date', 'transaction date', 'txn date']
            amount_indicators = ['debit', 'credit', 'balance', 'amount', 'withdrawal', 'deposit']
            desc_indicators = ['particulars', 'description', 'details', 'transaction details', 'narration']
            
            date_found = any(indicator in row_text for indicator in date_indicators)
            amount_found = any(indicator in row_text for indicator in amount_indicators)
            desc_found = any(indicator in row_text for indicator in desc_indicators)
            
            if date_found and (amount_found or desc_found):
                header_row_idx = i
                # Map columns based on header content
                for j, cell in enumerate(cleaned_row):
                    if any(indicator in cell for indicator in date_indicators):
                        column_mapping['date'] = j
                    elif 'debit' in cell or 'withdrawal' in cell:
                        column_mapping['debit'] = j
                    elif 'credit' in cell or 'deposit' in cell:
                        column_mapping['credit'] = j
                    elif 'balance' in cell:
                        column_mapping['balance'] = j
                    elif any(indicator in cell for indicator in desc_indicators):
                        column_mapping['description'] = j
                    elif 'reference' in cell or 'ref' in cell or 'chq' in cell or 'cheque' in cell:
                        column_mapping['reference'] = j
                break
        
        # Step 2: If no clear header found, try to infer columns from data patterns
        if header_row_idx == -1:
            column_mapping = self._infer_columns_from_data(table)
        
        # Step 3: Process data rows
        start_row = max(0, header_row_idx + 1) if header_row_idx >= 0 else 0
        
        for i in range(start_row, len(table)):
            row = table[i]
            if not row or len(row) < 3:
                continue
            
            transaction = self._extract_transaction_from_row(row, column_mapping)
            if transaction:
                transactions.append(transaction)
        
        return transactions

    def _infer_columns_from_data(self, table: List[List[str]]) -> Dict[str, int]:
        """Infer column positions by analyzing data patterns"""
        column_mapping = {}
        
        if not table:
            return column_mapping
        
        # Analyze first few data rows to identify patterns
        sample_rows = table[:10]
        
        for row in sample_rows:
            if not row or len(row) < 3:
                continue
            
            for i, cell in enumerate(row):
                if not cell or not cell.strip():
                    continue
                
                cell = cell.strip()
                
                # Look for date column
                if 'date' not in column_mapping and (self._is_date(cell) or self._looks_like_date(cell)):
                    column_mapping['date'] = i
                
                # Look for amount columns
                elif self._is_amount(cell):
                    # Try to determine if it's debit, credit, or balance based on position
                    if i == 3 and 'debit' not in column_mapping:
                        column_mapping['debit'] = i
                    elif i == 4 and 'credit' not in column_mapping:
                        column_mapping['credit'] = i
                    elif i == 5 and 'balance' not in column_mapping:
                        column_mapping['balance'] = i
                    elif 'balance' not in column_mapping:
                        column_mapping['balance'] = i
                
                # Look for reference/check number column
                elif ('reference' not in column_mapping and 
                      (cell.startswith('UPI-') or cell.isdigit() or 
                       (len(cell) >= 5 and any(c.isdigit() for c in cell)))):
                    column_mapping['reference'] = i
        
        # Description is usually the longest text column that's not date or reference
        for row in sample_rows:
            if not row:
                continue
            for i, cell in enumerate(row):
                if (cell and len(cell.strip()) > 10 and 
                    i not in column_mapping.values() and
                    not self._is_date(cell) and not self._is_amount(cell) and
                    'description' not in column_mapping):
                    column_mapping['description'] = i
                    break
        
        return column_mapping

    def _extract_transaction_from_row(self, row: List[str], column_mapping: Dict[str, int]) -> Optional[Dict[str, Any]]:
        """Extract transaction data from a row using column mapping"""
        if not row:
            return None
        
        # Initialize transaction data
        transaction_data = {
            'date': '',
            'chq_no': '',
            'description': '',
            'debit': None,
            'credit': None,
            'balance': None,
            'init_br': ''
        }
        
        # Extract data based on column mapping
        for field, col_idx in column_mapping.items():
            if col_idx < len(row) and row[col_idx]:
                cell_value = row[col_idx].strip()
                
                if field == 'date':
                    transaction_data['date'] = self._normalize_date(cell_value)
                elif field == 'description':
                    transaction_data['description'] = cell_value
                elif field == 'reference':
                    transaction_data['chq_no'] = cell_value
                elif field in ['debit', 'credit', 'balance']:
                    if self._is_amount(cell_value):
                        amount = self._clean_amount(cell_value)
                        transaction_data[field] = amount
        
        # If no column mapping worked, try the old method as fallback
        if not any([transaction_data['date'], transaction_data['description']]):
            return self._parse_table_row(row)
        
        # Validate transaction
        if not transaction_data['description'] and not transaction_data['date']:
            return None
        
        # Filter out summary rows
        if self._is_summary_row(transaction_data['description']):
            return None
        
        # Must have at least one amount
        if (transaction_data['debit'] is None and 
            transaction_data['credit'] is None and 
            transaction_data['balance'] is None):
            return None
        
        return transaction_data

    def _extract_from_text_universal(self, text: str) -> List[Dict[str, Any]]:
        """Universal text extraction that looks for transaction patterns"""
        transactions = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if len(line) < 15:  # Skip very short lines
                continue
            
            # Look for lines that contain both date and amount patterns
            if self._contains_date(line) and self._contains_amount(line):
                transaction = self._parse_transaction_line_universal(line)
                if transaction:
                    transactions.append(transaction)
        
        return transactions

    def _parse_transaction_line_universal(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a single line for transaction data using universal patterns"""
        import re
        
        # Split line into potential components
        parts = re.split(r'\s{2,}|\t', line)  # Split on multiple spaces or tabs
        
        transaction_data = {
            'date': '',
            'chq_no': '',
            'description': '',
            'debit': None,
            'credit': None,
            'balance': None,
            'init_br': ''
        }
        
        description_parts = []
        
        for part in parts:
            part = part.strip()
            if not part:
                continue
            
            # Check if it's a date
            if not transaction_data['date'] and (self._is_date(part) or self._looks_like_date(part)):
                transaction_data['date'] = self._normalize_date(part)
            # Check if it's an amount
            elif self._is_amount(part):
                amount = self._clean_amount(part)
                # Try to determine type based on context or position
                if part.startswith('-') and transaction_data['debit'] is None:
                    transaction_data['debit'] = amount
                elif part.startswith('+') and transaction_data['credit'] is None:
                    transaction_data['credit'] = amount
                elif transaction_data['balance'] is None:
                    transaction_data['balance'] = amount
                elif transaction_data['debit'] is None:
                    transaction_data['debit'] = amount
            # Check if it's a reference
            elif (not transaction_data['chq_no'] and 
                  (part.startswith('UPI-') or part.isdigit() or 
                   (len(part) >= 5 and any(c.isdigit() for c in part)))):
                transaction_data['chq_no'] = part
            # Everything else is description
            else:
                description_parts.append(part)
        
        # Combine description parts
        transaction_data['description'] = ' '.join(description_parts)
        
        # Validate and filter
        if not transaction_data['description'] and not transaction_data['date']:
            return None
        
        if self._is_summary_row(transaction_data['description']):
            return None
        
        if (transaction_data['debit'] is None and 
            transaction_data['credit'] is None and 
            transaction_data['balance'] is None):
            return None
        
        return transaction_data

# Initialize processor
processor = PDFBankStatementProcessor()

@app.post("/api/process-statement")
async def process_statement(file: UploadFile = File(...), password: Optional[str] = Form(None)):
    """Process uploaded PDF statement"""
    
    # Validate file
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if file.size > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File size too large. Maximum 50MB allowed")
    
    # Create job
    job_id = str(uuid.uuid4())
    job = {
        'id': job_id,
        'status': 'uploading',
        'progress': 10,
        'file_name': file.filename,
        'file_size': file.size,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }
    
    jobs_storage[job_id] = job
    
    try:
        # Save uploaded file
        temp_file_path = TEMP_DIR / f"{job_id}.pdf"
        
        with open(temp_file_path, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        # Update job status
        jobs_storage[job_id].update({
            'status': 'processing',
            'progress': 20,
            'updated_at': datetime.now().isoformat()
        })
        
        # Process PDF
        result = processor.process_pdf(str(temp_file_path), password)
        
        if result['success']:
            # Store result
            processing_result = {
                'job_id': job_id,
                'transactions': result['transactions'],
                'bank_name': result['bank_name'],
                'total_transactions': result['transaction_count'],
                'date_range': result.get('date_range')
            }
            
            results_storage[job_id] = processing_result
            
            # Update job as completed
            jobs_storage[job_id].update({
                'status': 'completed',
                'progress': 100,
                'bank_name': result['bank_name'],
                'transaction_count': result['transaction_count'],
                'date_range': result.get('date_range'),
                'updated_at': datetime.now().isoformat()
            })
        else:
            # Processing failed
            error_type = result.get('error_type', 'processing_error')
            jobs_storage[job_id].update({
                'status': 'error',
                'error_message': result.get('error', 'Unknown error occurred'),
                'error_type': error_type,
                'updated_at': datetime.now().isoformat()
            })
        
        # Clean up temp file
        try:
            temp_file_path.unlink()
        except:
            pass
        
        return {
            'job_id': job_id,
            'status': 'processing',
            'message': 'PDF uploaded successfully, processing started'
        }
        
    except Exception as e:
        # Update job with error
        jobs_storage[job_id].update({
            'status': 'error',
            'error_message': f'Processing error: {str(e)}',
            'updated_at': datetime.now().isoformat()
        })
        
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/api/process-status/{job_id}")
async def get_process_status(job_id: str):
    """Get processing status for a job"""
    
    job = jobs_storage.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    message = 'Processing in progress'
    if job['status'] == 'completed':
        message = 'Processing completed successfully'
    elif job['status'] == 'error':
        message = 'Processing failed'
    elif job['status'] == 'uploading':
        message = 'File uploaded, starting processing'
    
    return {
        'job_id': job_id,
        'status': job['status'],
        'progress': job.get('progress', 0),
        'bank_name': job.get('bank_name'),
        'transaction_count': job.get('transaction_count'),
        'date_range': job.get('date_range'),
        'message': message,
        'error_message': job.get('error_message'),
        'error_type': job.get('error_type')
    }

@app.get("/api/transactions/{job_id}")
async def get_transactions(job_id: str):
    """Get transactions for a completed job"""
    
    job = jobs_storage.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    result = results_storage.get(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Results not found")
    
    return {
        'transactions': result['transactions'],
        'bank_name': result['bank_name'],
        'total_transactions': result['total_transactions'],
        'date_range': result.get('date_range')
    }

@app.get("/api/download-csv/{job_id}")
async def download_csv(job_id: str):
    """Download transactions as CSV"""
    
    job = jobs_storage.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    result = results_storage.get(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Results not found")
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write headers
    headers = ['Tran Date', 'Chq No', 'Particulars', 'Debit', 'Credit', 'Balance', 'Init.Br']
    writer.writerow(headers)
    
    # Write transactions
    for transaction in result['transactions']:
        writer.writerow([
            transaction.get('date', ''),
            transaction.get('chq_no', ''),
            transaction.get('description', ''),
            transaction.get('debit', ''),
            transaction.get('credit', ''),
            transaction.get('balance', ''),
            transaction.get('init_br', '')
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    # Create filename
    bank_name = result['bank_name'].replace(' ', '_')
    date = datetime.now().strftime('%Y-%m-%d')
    filename = f"{bank_name}_Statement_{date}.csv"
    
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8')),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "PDF Statement Processor is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)