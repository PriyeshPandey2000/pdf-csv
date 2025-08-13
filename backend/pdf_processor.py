import pdfplumber
import pandas as pd
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import logging
from io import StringIO
import numpy as np

logger = logging.getLogger(__name__)

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
        
        self.date_patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
            r'\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}',
            r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}',
            r'\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}',
            r'\d{1,2}-[A-Za-z]{3}-\d{2,4}'
        ]
        
        self.amount_patterns = [
            r'[\d,]+\.?\d*',
            r'\d+\.?\d*',
            r'[\d,]+\.\d{2}'
        ]

    def detect_bank(self, text: str) -> Optional[str]:
        """Detect bank from PDF text content"""
        text_lower = text.lower()
        
        for bank_code, patterns in self.bank_patterns.items():
            for pattern in patterns:
                if pattern in text_lower:
                    return bank_code
        return None

    def extract_tables_from_pdf(self, pdf_path: str) -> List[pd.DataFrame]:
        """Extract all potential transaction tables from PDF"""
        tables = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    logger.info(f"Processing page {page_num + 1}")
                    
                    # Try to extract tables using pdfplumber
                    page_tables = page.extract_tables()
                    
                    for table in page_tables:
                        if table and len(table) > 1:  # Must have header + at least one row
                            df = pd.DataFrame(table[1:], columns=table[0])
                            # Clean empty columns and rows
                            df = df.dropna(how='all', axis=0).dropna(how='all', axis=1)
                            if not df.empty and len(df) > 0:
                                tables.append(df)
                    
                    # If no tables found, try text extraction and parsing
                    if not page_tables:
                        text = page.extract_text()
                        if text:
                            parsed_table = self.parse_text_to_table(text)
                            if parsed_table is not None:
                                tables.append(parsed_table)
                                
        except Exception as e:
            logger.error(f"Error extracting tables: {str(e)}")
            
        return tables

    def parse_text_to_table(self, text: str) -> Optional[pd.DataFrame]:
        """Parse structured text into table format"""
        lines = text.split('\n')
        potential_rows = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Look for lines that might contain transaction data
            if self.is_potential_transaction_line(line):
                parsed_row = self.parse_transaction_line(line)
                if parsed_row:
                    potential_rows.append(parsed_row)
        
        if potential_rows and len(potential_rows) > 0:
            df = pd.DataFrame(potential_rows)
            return df
        
        return None

    def is_potential_transaction_line(self, line: str) -> bool:
        """Check if line contains potential transaction data"""
        # Look for date patterns
        date_found = any(re.search(pattern, line) for pattern in self.date_patterns)
        
        # Look for amount patterns
        amount_found = any(re.search(pattern, line) for pattern in self.amount_patterns)
        
        # Check for minimum length and contains both date and amount
        return len(line) > 20 and date_found and amount_found

    def parse_transaction_line(self, line: str) -> Optional[Dict[str, str]]:
        """Parse a single transaction line into structured data"""
        try:
            parts = re.split(r'\s{2,}', line.strip())  # Split on multiple spaces
            
            if len(parts) < 3:
                return None
            
            # Try to identify date, description, and amounts
            date_part = None
            amounts = []
            description_parts = []
            
            for part in parts:
                part = part.strip()
                if not part:
                    continue
                    
                # Check if it's a date
                if any(re.match(pattern, part) for pattern in self.date_patterns):
                    date_part = part
                # Check if it's an amount
                elif re.match(r'[\d,]+\.?\d*$', part.replace(',', '')):
                    amounts.append(part)
                else:
                    description_parts.append(part)
            
            if date_part and amounts:
                return {
                    'date': date_part,
                    'description': ' '.join(description_parts),
                    'amount_1': amounts[0] if len(amounts) > 0 else '',
                    'amount_2': amounts[1] if len(amounts) > 1 else '',
                    'amount_3': amounts[2] if len(amounts) > 2 else ''
                }
                
        except Exception as e:
            logger.error(f"Error parsing transaction line: {str(e)}")
        
        return None

    def identify_transaction_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        """Identify which columns contain transaction data"""
        column_mapping = {}
        
        # Common column name patterns
        date_patterns = ['date', 'txn date', 'transaction date', 'value date', 'posting date']
        desc_patterns = ['description', 'particulars', 'details', 'narration', 'transaction details']
        debit_patterns = ['debit', 'withdrawal', 'dr', 'paid', 'debits']
        credit_patterns = ['credit', 'deposit', 'cr', 'received', 'credits']
        balance_patterns = ['balance', 'closing balance', 'running balance', 'available balance']
        
        for col in df.columns:
            if col is None:
                continue
                
            col_lower = str(col).lower().strip()
            
            # Match date column
            if any(pattern in col_lower for pattern in date_patterns) and 'date' not in column_mapping:
                column_mapping['date'] = col
            
            # Match description column
            elif any(pattern in col_lower for pattern in desc_patterns) and 'description' not in column_mapping:
                column_mapping['description'] = col
            
            # Match debit column
            elif any(pattern in col_lower for pattern in debit_patterns) and 'debit' not in column_mapping:
                column_mapping['debit'] = col
            
            # Match credit column
            elif any(pattern in col_lower for pattern in credit_patterns) and 'credit' not in column_mapping:
                column_mapping['credit'] = col
            
            # Match balance column
            elif any(pattern in col_lower for pattern in balance_patterns) and 'balance' not in column_mapping:
                column_mapping['balance'] = col
        
        return column_mapping

    def clean_amount(self, amount_str: str) -> float:
        """Clean and convert amount string to float"""
        if pd.isna(amount_str) or amount_str == '' or amount_str is None:
            return 0.0
        
        # Remove currency symbols and extra spaces
        amount_str = str(amount_str).strip()
        amount_str = re.sub(r'[₹$,\s]', '', amount_str)
        
        # Handle parentheses for negative amounts
        if amount_str.startswith('(') and amount_str.endswith(')'):
            amount_str = amount_str[1:-1]
            return -float(amount_str) if amount_str else 0.0
        
        try:
            return float(amount_str) if amount_str else 0.0
        except ValueError:
            return 0.0

    def normalize_date(self, date_str: str) -> str:
        """Normalize date to DD-MM-YYYY format"""
        if pd.isna(date_str) or not date_str:
            return ''
        
        date_str = str(date_str).strip()
        
        # Common date formats to try
        formats = [
            '%d-%m-%Y', '%d/%m/%Y', '%d.%m.%Y',
            '%d-%m-%y', '%d/%m/%y', '%d.%m.%y',
            '%d-%b-%Y', '%d-%b-%y',
            '%d %b %Y', '%d %b %y',
            '%Y-%m-%d', '%Y/%m/%d'
        ]
        
        for fmt in formats:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                return parsed_date.strftime('%d-%m-%Y')
            except ValueError:
                continue
        
        return date_str  # Return original if can't parse

    def process_transactions(self, tables: List[pd.DataFrame]) -> List[Dict[str, Any]]:
        """Process extracted tables into standardized transaction format"""
        all_transactions = []
        
        for table_idx, df in enumerate(tables):
            logger.info(f"Processing table {table_idx + 1} with {len(df)} rows")
            
            if df.empty:
                continue
            
            # Identify column mappings
            column_mapping = self.identify_transaction_columns(df)
            logger.info(f"Column mapping: {column_mapping}")
            
            # If we couldn't map essential columns, try alternate approach
            if not column_mapping.get('date') or not column_mapping.get('description'):
                # Try to process using positional logic
                transactions = self.process_table_positional(df)
                all_transactions.extend(transactions)
                continue
            
            # Process mapped columns
            for idx, row in df.iterrows():
                try:
                    transaction = self.extract_transaction_from_row(row, column_mapping)
                    if transaction:
                        all_transactions.append(transaction)
                except Exception as e:
                    logger.error(f"Error processing row {idx}: {str(e)}")
                    continue
        
        return all_transactions

    def process_table_positional(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Process table using positional logic when column mapping fails"""
        transactions = []
        
        for idx, row in df.iterrows():
            try:
                row_values = [str(val).strip() if val is not None else '' for val in row.values]
                
                # Skip empty rows
                if all(val == '' for val in row_values):
                    continue
                
                # Try to find date in first few columns
                date_col = None
                for i, val in enumerate(row_values[:3]):
                    if any(re.search(pattern, val) for pattern in self.date_patterns):
                        date_col = i
                        break
                
                if date_col is None:
                    continue
                
                # Extract transaction data
                date_val = self.normalize_date(row_values[date_col])
                
                # Find description (usually next non-amount column after date)
                description = ''
                amounts = []
                
                for i, val in enumerate(row_values):
                    if i == date_col:
                        continue
                    
                    # Check if it looks like an amount
                    if re.match(r'[\d,]+\.?\d*$', val.replace(',', '')) and val != '':
                        amounts.append(self.clean_amount(val))
                    elif val != '' and description == '':
                        description = val
                
                if date_val and description and amounts:
                    # Determine transaction type and amount
                    if len(amounts) == 1:
                        transaction_type = 'Debit' if amounts[0] > 0 else 'Credit'
                        amount = abs(amounts[0])
                    elif len(amounts) >= 2:
                        # Usually debit, credit, balance format
                        debit_amt = amounts[0] if amounts[0] > 0 else 0
                        credit_amt = amounts[1] if len(amounts) > 1 and amounts[1] > 0 else 0
                        
                        if debit_amt > 0:
                            transaction_type = 'Debit'
                            amount = debit_amt
                        elif credit_amt > 0:
                            transaction_type = 'Credit'
                            amount = credit_amt
                        else:
                            continue
                    else:
                        continue
                    
                    transaction = {
                        'date': date_val,
                        'description': description,
                        'type': transaction_type,
                        'amount': amount,
                        'balance': amounts[-1] if len(amounts) > 2 else None,
                        'reference': ''
                    }
                    
                    transactions.append(transaction)
                    
            except Exception as e:
                logger.error(f"Error in positional processing row {idx}: {str(e)}")
                continue
        
        return transactions

    def extract_transaction_from_row(self, row: pd.Series, column_mapping: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Extract transaction data from a table row"""
        try:
            date_val = self.normalize_date(row.get(column_mapping.get('date', ''), ''))
            description = str(row.get(column_mapping.get('description', ''), '')).strip()
            
            if not date_val or not description:
                return None
            
            # Handle debit/credit columns
            debit_amount = self.clean_amount(row.get(column_mapping.get('debit', ''), 0))
            credit_amount = self.clean_amount(row.get(column_mapping.get('credit', ''), 0))
            balance = self.clean_amount(row.get(column_mapping.get('balance', ''), 0))
            
            # Determine transaction type and amount
            if debit_amount > 0:
                transaction_type = 'Debit'
                amount = debit_amount
            elif credit_amount > 0:
                transaction_type = 'Credit'
                amount = credit_amount
            else:
                # Try to find amount in other columns
                for col_name, value in row.items():
                    if col_name not in column_mapping.values():
                        cleaned_amount = self.clean_amount(value)
                        if cleaned_amount > 0:
                            transaction_type = 'Debit'  # Default assumption
                            amount = cleaned_amount
                            break
                else:
                    return None
            
            return {
                'date': date_val,
                'description': description,
                'type': transaction_type,
                'amount': amount,
                'balance': balance if balance > 0 else None,
                'reference': ''
            }
            
        except Exception as e:
            logger.error(f"Error extracting transaction: {str(e)}")
            return None

    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """Main method to process PDF and extract transactions"""
        try:
            # Extract text for bank detection
            with pdfplumber.open(pdf_path) as pdf:
                full_text = ''
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        full_text += page_text + '\n'
            
            # Detect bank
            detected_bank = self.detect_bank(full_text)
            
            # Extract tables
            tables = self.extract_tables_from_pdf(pdf_path)
            
            if not tables:
                return {
                    'success': False,
                    'error': 'No transaction tables found in PDF',
                    'transactions': [],
                    'bank_name': detected_bank
                }
            
            # Process transactions
            transactions = self.process_transactions(tables)
            
            if not transactions:
                return {
                    'success': False,
                    'error': 'No valid transactions found',
                    'transactions': [],
                    'bank_name': detected_bank
                }
            
            # Sort transactions by date
            transactions.sort(key=lambda x: datetime.strptime(x['date'], '%d-%m-%Y') if x['date'] else datetime.min)
            
            # Calculate date range
            dates = [t['date'] for t in transactions if t['date']]
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
            logger.error(f"Error processing PDF: {str(e)}")
            return {
                'success': False,
                'error': f'Error processing PDF: {str(e)}',
                'transactions': [],
                'bank_name': None
            }

    def get_bank_display_name(self, bank_code: Optional[str]) -> str:
        """Get display name for bank code"""
        bank_names = {
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
        
        return bank_names.get(bank_code, 'Unknown Bank') if bank_code else 'Unknown Bank'