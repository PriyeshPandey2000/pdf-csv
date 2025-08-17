import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { Transaction } from '@/types';

interface BankPatterns {
  [key: string]: string[];
}

interface ProcessedResult {
  success: boolean;
  transactions: Transaction[];
  bank_name: string;
  transaction_count: number;
  date_range?: {
    start: string;
    end: string;
  };
  error?: string;
}

export class PDFBankStatementProcessor {
  private bankPatterns: BankPatterns = {
    sbi: ['state bank of india', 'sbi', 'state bank'],
    hdfc: ['hdfc bank', 'hdfc', 'housing development finance'],
    icici: ['icici bank', 'icici', 'industrial credit'],
    axis: ['axis bank', 'axis'],
    pnb: ['punjab national bank', 'pnb'],
    kotak: ['kotak mahindra bank', 'kotak'],
    indusind: ['indusind bank', 'indusind'],
    yes: ['yes bank', 'yes'],
    bob: ['bank of baroda', 'baroda'],
    canara: ['canara bank', 'canara'],
    union: ['union bank', 'union'],
    indian: ['indian bank', 'indian'],
    central: ['central bank', 'central'],
    idbi: ['idbi bank', 'idbi'],
    idfc: ['idfc first bank', 'idfc']
  };

  private datePatterns = [
    /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/g,
    /\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}/g,
    /\d{2,4}[-/]\d{1,2}[-/]\d{1,2}/g,
    /\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}/g,
    /\d{1,2}-[A-Za-z]{3}-\d{2,4}/g
  ];

  private amountPatterns = [
    /[\d,]+\.?\d*/g,
    /\d+\.?\d*/g,
    /[\d,]+\.\d{2}/g
  ];

  private detectBank(text: string): string | null {
    const textLower = text.toLowerCase();
    
    for (const [bankCode, patterns] of Object.entries(this.bankPatterns)) {
      for (const pattern of patterns) {
        if (textLower.includes(pattern)) {
          return bankCode;
        }
      }
    }
    return null;
  }

  private getBankDisplayName(bankCode: string | null): string {
    const bankNames: { [key: string]: string } = {
      sbi: 'State Bank of India',
      hdfc: 'HDFC Bank',
      icici: 'ICICI Bank',
      axis: 'Axis Bank',
      pnb: 'Punjab National Bank',
      kotak: 'Kotak Mahindra Bank',
      indusind: 'IndusInd Bank',
      yes: 'Yes Bank',
      bob: 'Bank of Baroda',
      canara: 'Canara Bank',
      union: 'Union Bank of India',
      indian: 'Indian Bank',
      central: 'Central Bank of India',
      idbi: 'IDBI Bank',
      idfc: 'IDFC First Bank'
    };
    
    return bankNames[bankCode || ''] || 'Unknown Bank';
  }

  private isPotentialTransactionLine(line: string): boolean {
    // Look for date patterns
    const dateFound = this.datePatterns.some(pattern => pattern.test(line));
    
    // Look for amount patterns (more flexible)
    const amountFound = /\d+[.,]\d{2}|\d{4,}/.test(line); // Find amounts with decimals or large numbers
    
    // More flexible criteria - just need date OR amount with reasonable length
    const hasDate = dateFound;
    const hasAmount = amountFound;
    const hasLength = line.length > 10; // Reduced minimum length
    
    // Transaction keywords that might indicate a transaction line
    const transactionKeywords = /debit|credit|withdrawal|deposit|transfer|payment|upi|neft|rtgs|imps|cheque|cash|atm/i;
    const hasKeyword = transactionKeywords.test(line);
    
    // Accept line if it has date, OR amount with keywords, OR both date and amount
    return hasLength && (
      (hasDate && hasAmount) ||  // Ideal case
      (hasDate && hasKeyword) || // Date with transaction keyword
      (hasAmount && hasKeyword) || // Amount with transaction keyword
      (hasDate && line.split(/\s+/).length >= 4) // Date with multiple parts
    );
  }

  private parseTransactionLine(line: string): Partial<Transaction> | null {
    try {
      // Try multiple splitting strategies
      let parts = line.split(/\s{2,}/); // Split on multiple spaces
      
      // If that doesn't work well, try single space split for dense layouts
      if (parts.length < 3) {
        parts = line.split(/\s+/).filter(part => part.trim().length > 0);
      }
      
      if (parts.length < 2) {
        return null;
      }
      
      // Try to identify date, description, and amounts
      let datePart: string | null = null;
      const amounts: string[] = [];
      const descriptionParts: string[] = [];
      
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;
        
        // Check if it's a date
        if (this.datePatterns.some(pattern => pattern.test(trimmedPart))) {
          datePart = trimmedPart;
        }
        // Check if it's an amount (more flexible patterns)
        else if (/^[\d,]+\.?\d*$/.test(trimmedPart.replace(',', '')) && 
                 parseFloat(trimmedPart.replace(',', '')) > 0) {
          amounts.push(trimmedPart);
        }
        // Check for amounts with currency symbols
        else if (/^[₹$]?[\d,]+\.?\d*$/.test(trimmedPart.replace(',', ''))) {
          amounts.push(trimmedPart.replace(/[₹$]/, ''));
        }
        // Check for negative amounts in parentheses  
        else if (/^\([\d,]+\.?\d*\)$/.test(trimmedPart)) {
          amounts.push(trimmedPart);
        } else {
          descriptionParts.push(trimmedPart);
        }
      }
      
      // If we found a date, try to extract transaction info
      if (datePart || amounts.length > 0) {
        const description = descriptionParts.join(' ').trim();
        
        // If no explicit date found, try to find it in the description
        if (!datePart && description) {
          const dateMatch = description.match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/);
          if (dateMatch) {
            datePart = dateMatch[0];
            // Remove date from description
            descriptionParts.forEach((part, index) => {
              if (part.includes(dateMatch[0])) {
                descriptionParts[index] = part.replace(dateMatch[0], '').trim();
              }
            });
          }
        }
        
        if (datePart || (amounts.length > 0 && description)) {
          return {
            date: datePart ? this.normalizeDate(datePart) : '',
            description: descriptionParts.join(' ').trim() || 'Transaction',
            amount: amounts.length > 0 ? this.cleanAmount(amounts[0]) : 0,
            balance: amounts.length > 1 ? this.cleanAmount(amounts[amounts.length - 1]) : undefined,
            reference: ''
          };
        }
      }
    } catch (error) {
      console.error('Error parsing transaction line:', error);
    }
    
    return null;
  }

  private cleanAmount(amountStr: string): number {
    if (!amountStr || amountStr === '') {
      return 0.0;
    }
    
    // Remove currency symbols and extra spaces
    let cleanStr = amountStr.replace(/[₹$,\s]/g, '');
    
    // Handle parentheses for negative amounts
    if (cleanStr.startsWith('(') && cleanStr.endsWith(')')) {
      cleanStr = cleanStr.slice(1, -1);
      return -parseFloat(cleanStr) || 0.0;
    }
    
    return parseFloat(cleanStr) || 0.0;
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) {
      return '';
    }
    
    dateStr = dateStr.trim();
    
    // Common date formats to try
    const formats = [
      { pattern: /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/, format: 'DD-MM-YYYY' },
      { pattern: /(\d{1,2})[-/](\d{1,2})[-/](\d{2})/, format: 'DD-MM-YY' },
      { pattern: /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, format: 'YYYY-MM-DD' },
    ];
    
    for (const { pattern, format } of formats) {
      const match = dateStr.match(pattern);
      if (match) {
        if (format === 'DD-MM-YYYY') {
          return `${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}-${match[3]}`;
        } else if (format === 'DD-MM-YY') {
          const year = parseInt(match[3]) < 50 ? `20${match[3]}` : `19${match[3]}`;
          return `${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}-${year}`;
        } else if (format === 'YYYY-MM-DD') {
          return `${match[3].padStart(2, '0')}-${match[2].padStart(2, '0')}-${match[1]}`;
        }
      }
    }
    
    return dateStr; // Return original if can't parse
  }

  private parseTextToTransactions(text: string): Transaction[] {
    const lines = text.split('\n');
    const transactions: Transaction[] = [];
    
    // Also try processing by combining adjacent lines (in case transactions span multiple lines)
    const combinedLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i].trim();
      if (!currentLine) continue;
      
      // Try current line alone
      combinedLines.push(currentLine);
      
      // Try combining with next line if it doesn't look complete
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !this.datePatterns.some(pattern => pattern.test(nextLine))) {
          combinedLines.push(currentLine + ' ' + nextLine);
        }
      }
    }
    
    // Process all lines (original and combined)
    const allLinesToProcess = [...lines.map(l => l.trim()), ...combinedLines];
    
    for (const line of allLinesToProcess) {
      if (!line) continue;
      
      if (this.isPotentialTransactionLine(line)) {
        const parsedTransaction = this.parseTransactionLine(line);
        if (parsedTransaction) {
          // More flexible validation - accept if we have amount or reasonable description
          const hasValidDate = parsedTransaction.date && parsedTransaction.date.length > 0;
          const hasValidDescription = parsedTransaction.description && parsedTransaction.description.length > 2;
          const hasValidAmount = parsedTransaction.amount !== undefined && parsedTransaction.amount !== 0;
          
          if ((hasValidDate && hasValidAmount) || (hasValidDescription && hasValidAmount)) {
            // Smart transaction type detection
            let transactionType: 'Credit' | 'Debit' = 'Debit';
            
            const desc = parsedTransaction.description?.toLowerCase() || '';
            const creditKeywords = /credit|deposit|salary|interest|refund|cashback|transfer.*credit/i;
            const debitKeywords = /debit|withdrawal|payment|purchase|charge|fee|transfer.*debit|atm/i;
            
            if (creditKeywords.test(desc)) {
              transactionType = 'Credit';
            } else if (debitKeywords.test(desc)) {
              transactionType = 'Debit';
            } else {
              // Default based on amount being positive or negative
              transactionType = (parsedTransaction.amount || 0) > 0 ? 'Credit' : 'Debit';
            }
            
            const transaction: Transaction = {
              date: parsedTransaction.date || new Date().toISOString().split('T')[0],
              description: parsedTransaction.description || 'Transaction',
              type: transactionType,
              amount: Math.abs(parsedTransaction.amount || 0),
              balance: parsedTransaction.balance || null,
              reference: parsedTransaction.reference || null
            };
            
            // Avoid duplicates
            const isDuplicate = transactions.some(existing => 
              existing.date === transaction.date &&
              existing.description === transaction.description &&
              existing.amount === transaction.amount
            );
            
            if (!isDuplicate && transaction.amount > 0) {
              transactions.push(transaction);
            }
          }
        }
      }
    }
    
    return transactions;
  }

  public async processPDF(pdfPath: string): Promise<ProcessedResult> {
    try {
      // Use pdf2json to parse PDF
      const pdfParser = new PDFParser();
      
      let fullText = '';
      
      // Create promise to handle PDF parsing
      const pdfText = await new Promise<string>((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', reject);
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          let text = '';
          
          // Extract text from all pages
          if (pdfData && pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textBlock of page.Texts) {
                  if (textBlock.R && textBlock.R.length > 0) {
                    const textContent = textBlock.R[0].T;
                    if (textContent) {
                      // Decode URI component to handle special characters
                      text += decodeURIComponent(textContent) + ' ';
                    }
                  }
                }
              }
              text += '\n';
            }
          }
          
          resolve(text);
        });
        
        pdfParser.loadPDF(pdfPath);
      });
      
      fullText = pdfText;
      
      // Detect bank
      const detectedBank = this.detectBank(fullText);
      
      // Extract transactions from text
      const transactions = this.parseTextToTransactions(fullText);
      
      if (transactions.length === 0) {
        return {
          success: false,
          error: 'No valid transactions found in PDF',
          transactions: [],
          bank_name: this.getBankDisplayName(detectedBank),
          transaction_count: 0
        };
      }
      
      // Sort transactions by date
      transactions.sort((a, b) => {
        const dateA = new Date(a.date.split('-').reverse().join('-'));
        const dateB = new Date(b.date.split('-').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      });
      
      // Calculate date range
      const dates = transactions.map(t => t.date).filter(Boolean);
      let dateRange;
      if (dates.length > 0) {
        dateRange = {
          start: dates[0],
          end: dates[dates.length - 1]
        };
      }
      
      return {
        success: true,
        transactions,
        bank_name: this.getBankDisplayName(detectedBank),
        transaction_count: transactions.length,
        date_range: dateRange
      };
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      return {
        success: false,
        error: `Error processing PDF: ${error}`,
        transactions: [],
        bank_name: 'Unknown Bank',
        transaction_count: 0
      };
    }
  }
}