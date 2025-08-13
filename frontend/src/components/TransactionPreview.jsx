import React, { useState } from 'react';
import { Download, Eye, EyeOff, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';

const TransactionPreview = ({ transactions, onDownloadCSV, bankName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAllColumns, setShowAllColumns] = useState(false);

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.date.includes(searchTerm) ||
                         transaction.amount.toString().includes(searchTerm);
    
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'credit' && transaction.type === 'Credit') ||
                         (filterType === 'debit' && transaction.type === 'Debit');
    
    return matchesSearch && matchesFilter;
  });

  const formatAmount = (amount, type) => {
    const formattedAmount = Math.abs(amount).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR'
    });
    
    return type === 'Debit' ? `-${formattedAmount}` : formattedAmount;
  };

  const getTotalAmount = () => {
    return filteredTransactions.reduce((total, transaction) => {
      return transaction.type === 'Credit' ? total + transaction.amount : total - transaction.amount;
    }, 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <span>Transaction Preview</span>
            <Badge variant="outline" className="ml-2">
              {filteredTransactions.length} of {transactions.length} transactions
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllColumns(!showAllColumns)}
            >
              {showAllColumns ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showAllColumns ? 'Hide Details' : 'Show All'}
            </Button>
            <Button onClick={onDownloadCSV} className="bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="credit">Credit Only</SelectItem>
              <SelectItem value="debit">Debit Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="text-sm">
            <span className="font-medium">Net Amount: </span>
            <span className={`font-semibold ${getTotalAmount() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatAmount(getTotalAmount(), getTotalAmount() >= 0 ? 'Credit' : 'Debit')}
            </span>
          </div>
          {bankName && (
            <Badge variant="secondary">{bankName}</Badge>
          )}
        </div>

        {/* Transaction Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {showAllColumns && (
                    <>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Reference</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction, index) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      {transaction.date}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={transaction.type === 'Credit' ? 'default' : 'destructive'}
                        className={transaction.type === 'Credit' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={transaction.type === 'Credit' ? 'text-green-600' : 'text-red-600'}>
                        {formatAmount(transaction.amount, transaction.type)}
                      </span>
                    </TableCell>
                    {showAllColumns && (
                      <>
                        <TableCell className="text-right">
                          ₹{transaction.balance?.toLocaleString('en-IN') || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {transaction.reference || 'N/A'}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No transactions match your current filters.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionPreview;