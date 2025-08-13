// Mock data for different Indian banks to simulate the PDF processing

export const mockTransactions = {
  sbi: {
    bankName: 'State Bank of India',
    transactionCount: 45,
    dateRange: {
      start: '01-Jan-2024',
      end: '31-Jan-2024'
    },
    transactions: [
      {
        date: '01-Jan-2024',
        description: 'UPI-SWIGGY-BANGALORE-9876543210',
        type: 'Debit',
        amount: 450,
        balance: 25680,
        reference: 'UPI/401234567890'
      },
      {
        date: '02-Jan-2024',
        description: 'SALARY CREDIT FROM ABC COMPANY LTD',
        type: 'Credit',
        amount: 45000,
        balance: 70680,
        reference: 'NEFT/N001234567'
      },
      {
        date: '03-Jan-2024',
        description: 'ATM WDL HDFC BANK ATM MUMBAI',
        type: 'Debit',
        amount: 2000,
        balance: 68680,
        reference: 'ATM/402345678901'
      },
      {
        date: '05-Jan-2024',
        description: 'UPI-AMAZON PAY-MUMBAI-8765432109',
        type: 'Debit',
        amount: 1299,
        balance: 67381,
        reference: 'UPI/403456789012'
      },
      {
        date: '07-Jan-2024',
        description: 'IMPS-JOHN DOE-RENT PAYMENT',
        type: 'Debit',
        amount: 15000,
        balance: 52381,
        reference: 'IMPS/P004567890123'
      },
      {
        date: '10-Jan-2024',
        description: 'INTEREST CREDITED',
        type: 'Credit',
        amount: 125,
        balance: 52506,
        reference: 'INT/I005678901234'
      },
      {
        date: '12-Jan-2024',
        description: 'UPI-PETROL PUMP-DELHI-7654321098',
        type: 'Debit',
        amount: 3500,
        balance: 49006,
        reference: 'UPI/406789012345'
      },
      {
        date: '15-Jan-2024',
        description: 'NEFT FROM MOTHER-SUPPORT',
        type: 'Credit',
        amount: 10000,
        balance: 59006,
        reference: 'NEFT/N007890123456'
      }
    ]
  },
  hdfc: {
    bankName: 'HDFC Bank',
    transactionCount: 38,
    dateRange: {
      start: '01-Dec-2023',
      end: '31-Dec-2023'
    },
    transactions: [
      {
        date: '01-Dec-2023',
        description: 'POS 400001XXXXXX1234 RELIANCE FRESH',
        type: 'Debit',
        amount: 2850,
        balance: 42150,
        reference: 'POS/408901234567'
      },
      {
        date: '02-Dec-2023',
        description: 'ACH CR-DIVIDEND CREDIT RELIANCE IND',
        type: 'Credit',
        amount: 5600,
        balance: 47750,
        reference: 'ACH/A009012345678'
      },
      {
        date: '04-Dec-2023',
        description: 'BILL PAY-TATA POWER MUMBAI',
        type: 'Debit',
        amount: 1850,
        balance: 45900,
        reference: 'BILL/B010123456789'
      },
      {
        date: '06-Dec-2023',
        description: 'UPI-GOOGLE PAY-GROCERIES-9012345678',
        type: 'Debit',
        amount: 750,
        balance: 45150,
        reference: 'UPI/411234567890'
      },
      {
        date: '08-Dec-2023',
        description: 'NEFT-FREELANCE PROJECT PAYMENT',
        type: 'Credit',
        amount: 25000,
        balance: 70150,
        reference: 'NEFT/N012345678901'
      },
      {
        date: '10-Dec-2023',
        description: 'ATM-CASH WITHDRAWAL HDFC ATM',
        type: 'Debit',
        amount: 5000,
        balance: 65150,
        reference: 'ATM/413456789012'
      },
      {
        date: '12-Dec-2023',
        description: 'UPI-ZOMATO-FOOD DELIVERY-8901234567',
        type: 'Debit',
        amount: 420,
        balance: 64730,
        reference: 'UPI/414567890123'
      }
    ]
  },
  icici: {
    bankName: 'ICICI Bank',
    transactionCount: 52,
    dateRange: {
      start: '01-Nov-2023',
      end: '30-Nov-2023'
    },
    transactions: [
      {
        date: '01-Nov-2023',
        description: 'IMPS IN-SALARY TRANSFER XYZ CORP',
        type: 'Credit',
        amount: 55000,
        balance: 78500,
        reference: 'IMPS/I015678901234'
      },
      {
        date: '02-Nov-2023',
        description: 'DEBIT CARD PUR-BIGBASKET.COM',
        type: 'Debit',
        amount: 1250,
        balance: 77250,
        reference: 'DC/416789012345'
      },
      {
        date: '03-Nov-2023',
        description: 'UPI OUT-PHONEPE-ELECTRICITY BILL',
        type: 'Debit',
        amount: 2100,
        balance: 75150,
        reference: 'UPI/417890123456'
      },
      {
        date: '05-Nov-2023',
        description: 'RTGS IN-INVESTMENT RETURN MUTUAL FUND',
        type: 'Credit',
        amount: 15750,
        balance: 90900,
        reference: 'RTGS/R018901234567'
      },
      {
        date: '07-Nov-2023',
        description: 'EMI AUTO DEBIT-HOME LOAN',
        type: 'Debit',
        amount: 18500,
        balance: 72400,
        reference: 'EMI/E019012345678'
      },
      {
        date: '10-Nov-2023',
        description: 'POS TXN-DMart HYPERMARKET',
        type: 'Debit',
        amount: 3850,
        balance: 68550,
        reference: 'POS/420123456789'
      }
    ]
  }
};

export const simulateProcessing = (bankType = 'sbi') => {
  return new Promise((resolve) => {
    const data = mockTransactions[bankType] || mockTransactions.sbi;
    
    // Simulate processing delay
    setTimeout(() => {
      resolve(data);
    }, 3000);
  });
};

export const generateCSV = (transactions, bankName) => {
  const headers = ['Date', 'Description', 'Type', 'Amount', 'Balance', 'Reference'];
  const csvContent = [
    headers.join(','),
    ...transactions.map(transaction => [
      transaction.date,
      `"${transaction.description}"`,
      transaction.type,
      transaction.amount,
      transaction.balance || '',
      transaction.reference || ''
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${bankName || 'Bank'}_Statement_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};