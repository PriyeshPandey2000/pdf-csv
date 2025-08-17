'use client'

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ProcessingStatus from '@/components/ProcessingStatus';
import TransactionPreview from '@/components/TransactionPreview';
import { FileText, Zap, Shield, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/types';

interface ExtractedData {
  bankName?: string;
  transactionCount?: number;
  dateRange?: {
    start: string;
    end: string;
  };
}

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setProcessingStatus('idle');
    setExtractedData(null);
    setTransactions([]);
    setJobId(null);
    setProgress(0);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setProcessingStatus('idle');
    setExtractedData(null);
    setTransactions([]);
    setJobId(null);
    setProgress(0);
  };

  const processFile = async () => {
    if (!selectedFile) return;

    try {
      setProcessingStatus('uploading');
      setProgress(10);

      const formData = new FormData();
      formData.append('file', selectedFile);

      // Upload and start processing
      const uploadResponse = await fetch('/api/process-statement', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      setJobId(uploadResult.job_id);
      
      // Start polling for status updates
      await pollStatus(uploadResult.job_id);

    } catch (error) {
      console.error('Processing error:', error);
      setProcessingStatus('error');
    }
  };

  const pollStatus = async (currentJobId: string) => {
    const maxRetries = 60;
    let retries = 0;
    
    const poll = async () => {
      try {
        const statusResponse = await fetch(`/api/process-status/${currentJobId}`);
        const statusData = await statusResponse.json();
        
        setProcessingStatus(statusData.status);
        setProgress(statusData.progress);
        
        if (statusData.status === 'completed') {
          setExtractedData({
            bankName: statusData.bank_name,
            transactionCount: statusData.transaction_count,
            dateRange: statusData.date_range
          });
          
          // Fetch the actual transactions
          await fetchTransactions(currentJobId);
        } else if (statusData.status === 'error') {
          setProcessingStatus('error');
        } else if (retries < maxRetries) {
          retries++;
          setTimeout(poll, 2000);
        } else {
          setProcessingStatus('error');
        }
      } catch (error) {
        console.error('Error polling status:', error);
        setProcessingStatus('error');
      }
    };
    
    poll();
  };

  const fetchTransactions = async (currentJobId: string) => {
    try {
      const transactionsResponse = await fetch(`/api/transactions/${currentJobId}`);
      const transactionsData = await transactionsResponse.json();
      setTransactions(transactionsData.transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleDownloadCSV = async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`/api/download-csv/${jobId}`);
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bank_statement_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const resetProcess = () => {
    setSelectedFile(null);
    setProcessingStatus('idle');
    setExtractedData(null);
    setTransactions([]);
    setJobId(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <FileText className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            PDF Bank Statement to CSV Converter
          </h1>
          <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
            Convert your Indian bank statements from PDF to CSV format instantly. 
            Works with all major banks regardless of their column formats.
          </p>
          
          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 mb-12">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="p-2 bg-green-100 rounded-lg w-fit mx-auto mb-3">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Universal Support</h3>
                <p className="text-sm text-gray-600">
                  Works with all Indian banks - SBI, HDFC, ICICI, Axis, PNB and more
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="p-2 bg-purple-100 rounded-lg w-fit mx-auto mb-3">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Format Independent</h3>
                <p className="text-sm text-gray-600">
                  Extracts all transactions regardless of column headings or PDF layout
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="p-2 bg-orange-100 rounded-lg w-fit mx-auto mb-3">
                  <Download className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Instant Download</h3>
                <p className="text-sm text-gray-600">
                  Preview transactions and download clean CSV files immediately
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* File Upload */}
          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onRemoveFile={handleRemoveFile}
          />

          {/* Process Button */}
          {selectedFile && processingStatus === 'idle' && (
            <div className="text-center">
              <Button 
                onClick={processFile}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
              >
                <FileText className="h-5 w-5 mr-2" />
                Process Bank Statement
              </Button>
            </div>
          )}

          {/* Processing Status */}
          {processingStatus !== 'idle' && (
            <ProcessingStatus
              status={processingStatus}
              progress={progress}
              extractedData={extractedData}
            />
          )}

          {/* Transaction Preview */}
          {transactions.length > 0 && processingStatus === 'completed' && (
            <div className="space-y-6">
              <TransactionPreview
                transactions={transactions}
                onDownloadCSV={handleDownloadCSV}
                bankName={extractedData?.bankName}
              />
              
              {/* Reset Button */}
              <div className="text-center">
                <Button 
                  variant="outline" 
                  onClick={resetProcess}
                  className="px-6"
                >
                  Process Another Statement
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {processingStatus === 'error' && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={resetProcess}
                className="px-6"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-gray-500">
          <p>
            Secure • Fast • Reliable | Support for all major Indian banks
          </p>
        </div>
      </div>
    </div>
  );
}