'use client'

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ProcessingStatus from '@/components/ProcessingStatus';
import TransactionPreview from '@/components/TransactionPreview';
import { FileText, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/types';

// Backend API URL
const API_BASE_URL = 'https://pdf-csv-y9cb.onrender.com';

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
  const [password, setPassword] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error' | 'password_required'>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFileSelect = (file: File, filePassword?: string) => {
    setSelectedFile(file);
    setPassword(filePassword || '');
    setProcessingStatus('idle');
    setExtractedData(null);
    setTransactions([]);
    setJobId(null);
    setProgress(0);
    setErrorMessage('');
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPassword('');
    setProcessingStatus('idle');
    setExtractedData(null);
    setTransactions([]);
    setJobId(null);
    setProgress(0);
    setErrorMessage('');
  };

  const processFile = async () => {
    if (!selectedFile) return;

    try {
      setProcessingStatus('uploading');
      setProgress(10);
      setErrorMessage(''); // Clear any previous error messages

      const formData = new FormData();
      formData.append('file', selectedFile);
      if (password) {
        formData.append('password', password);
      }

      // Upload and start processing
      const uploadResponse = await fetch(`${API_BASE_URL}/api/process-statement`, {
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
      setErrorMessage('Failed to upload or process the file. Please try again.');
    }
  };

  const pollStatus = async (currentJobId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/process-status/${currentJobId}`);
      
      if (!response.ok) {
        throw new Error('Status check failed');
      }

      const statusData = await response.json();
      
      // Update status based on backend response
      if (statusData.status === 'processing') {
        setProcessingStatus('processing');
        setProgress(statusData.progress || 50);
        
        // Continue polling
        setTimeout(() => pollStatus(currentJobId), 2000);
      } else if (statusData.status === 'completed') {
        setProcessingStatus('completed');
        setProgress(100);
        
        // Extract data directly from status response - no separate results endpoint needed
        if (statusData.bank_name) {
          setExtractedData({
            bankName: statusData.bank_name,
            transactionCount: statusData.transaction_count,
            dateRange: statusData.date_range
          });
        }
        
        // Get the actual transactions using the existing endpoint
        try {
          const transactionsResponse = await fetch(`${API_BASE_URL}/api/transactions/${currentJobId}`);
          if (transactionsResponse.ok) {
            const transactionsData = await transactionsResponse.json();
            setTransactions(transactionsData.transactions);
          }
        } catch (error) {
          console.error('Error fetching transactions:', error);
        }
      } else if (statusData.status === 'error') {
        // Check if it's a password-related error
        // Primary check: backend detected password error
        const isPasswordError = statusData.error_type === 'password_required';
        
        // Fallback check: analyze error message for password-related keywords
        const errorMsg = (statusData.error_message || '').toLowerCase();
        const passwordKeywords = [
          'password', 'encrypted', 'decrypt', 'security', 'protected',
          'authentication', 'authorization', 'wrong password', 'invalid password',
          'bad decrypt', 'bad password', 'encryption', 'cipher', 'access denied',
          'permission denied', 'user access', 'owner password', 'pdfencryptederr'
        ];
        const hasPasswordKeywords = passwordKeywords.some(keyword => errorMsg.includes(keyword));
        
        // Additional heuristic: if processing fails immediately with generic error and no password was provided
        const noPasswordProvided = !password || password.trim() === '';
        const isGenericError = errorMsg.includes('error processing pdf') || errorMsg.includes('unable to process');
        const possiblePasswordIssue = noPasswordProvided && isGenericError;
        
        if (isPasswordError || hasPasswordKeywords || possiblePasswordIssue) {
          setProcessingStatus('password_required');
          setErrorMessage(
            statusData.error_message || 
            'This PDF appears to be password protected. Please enter the password and try again.'
          );
        } else {
          setProcessingStatus('error');
          setErrorMessage(statusData.error_message || 'Processing failed. Please try again.');
        }
      } else if (statusData.status === 'uploading') {
        setProcessingStatus('uploading');
        setProgress(statusData.progress || 10);
        
        // Continue polling
        setTimeout(() => pollStatus(currentJobId), 2000);
      } else {
        // Continue polling for other statuses
        setTimeout(() => pollStatus(currentJobId), 2000);
      }
    } catch (error) {
      console.error('Status polling error:', error);
      setProcessingStatus('error');
      setErrorMessage('Unable to check processing status. Please try again.');
    }
  };

  const fetchTransactions = async (currentJobId: string) => {
    try {
      const transactionsResponse = await fetch(`${API_BASE_URL}/api/transactions/${currentJobId}`);
      const transactionsData = await transactionsResponse.json();
      setTransactions(transactionsData.transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleDownloadCSV = async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/download-csv/${jobId}`);
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
    setPassword('');
    setProcessingStatus('idle');
    setExtractedData(null);
    setTransactions([]);
    setJobId(null);
    setProgress(0);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 via-black to-gray-900/20"></div>
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -translate-x-48 -translate-y-48"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl translate-x-48 translate-y-48"></div>
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header with modern hero section */}
        <div className="text-center mb-16 pt-12">
          {/* Top badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-800 bg-gray-900/50 backdrop-blur-sm text-gray-300 text-sm mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            Transform your bank statements instantly
            <ArrowRight className="w-4 h-4" />
          </div>
          
          {/* Main headline */}
          <h1 className="text-5xl md:text-7xl font-light mb-6 bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent leading-tight">
            Convert PDF to CSV
            <br />
            <span className="text-4xl md:text-6xl">without the hassle</span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-md md:text-xl text-gray-400 mb-8 max-w-4xl mx-auto leading-relaxed">
            Transform your Indian bank statements into clean CSV files instantly. 
            <br className="hidden md:block" />
            No coding skills needed. Works with all major banks seamlessly.
          </p>
          
          {/* CTA Buttons */}
          {/* 
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button 
              size="lg"
              className="bg-white text-black hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105"
            >
              <FileText className="w-5 h-5 mr-2" />
              Start for free
            </Button>
            <Button 
              variant="ghost"
              size="lg"
              className="text-white border border-gray-700 hover:bg-gray-800 px-8 py-4 text-lg rounded-full transition-all duration-200"
            >
              <Play className="w-5 h-5 mr-2" />
              Watch Demo
            </Button>
          </div>
          */}
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* File Upload */}
          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onRemoveFile={handleRemoveFile}
            password={password}
            onPasswordChange={setPassword}
            isPasswordRequired={processingStatus === 'password_required'}
            showPasswordError={processingStatus === 'password_required'}
          />

          {/* Process Button */}
          {selectedFile && (processingStatus === 'idle' || processingStatus === 'password_required') && (
            <div className="text-center">
              <Button 
                onClick={processFile}
                size="lg"
                className={`px-8 py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 ${
                  processingStatus === 'password_required'
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                }`}
                disabled={processingStatus === 'password_required' && !password.trim()}
              >
                <FileText className="h-5 w-5 mr-2" />
                {processingStatus === 'password_required' 
                  ? (password.trim() ? 'Retry with Password' : 'Enter Password to Continue')
                  : 'Process Bank Statement'
                }
              </Button>
              
              {processingStatus === 'password_required' && !password.trim() && (
                <p className="text-sm text-orange-400 mt-2">
                  Please enter the PDF password above to continue
                </p>
              )}
            </div>
          )}

          {/* Processing Status */}
          {processingStatus !== 'idle' && (
            <ProcessingStatus
              status={processingStatus}
              progress={progress}
              extractedData={extractedData}
              errorMessage={errorMessage}
            />
          )}

          {/* Transaction Preview */}
          {transactions.length > 0 && processingStatus === 'completed' && (
            <div className="space-y-6">
              <TransactionPreview
                transactions={transactions}
                onDownloadCSV={handleDownloadCSV}
              />
              
              {/* Reset Button */}
              <div className="text-center">
                <Button 
                  variant="outline" 
                  onClick={resetProcess}
                  className="px-6 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-full"
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
                className="px-6 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-full"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-20 text-center text-sm text-gray-500">
          <p>
            Secure • Fast • Reliable | Supporting all major Indian banks
          </p>
        </div>
      </div>
    </div>
  );
}