'use client'

import React from 'react';
import { CheckCircle, Clock, AlertCircle, FileText, Table, Download, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

interface ExtractedData {
  bankName?: string;
  transactionCount?: number;
  dateRange?: {
    start: string;
    end: string;
  };
}

interface ProcessingStatusProps {
  status: 'uploading' | 'processing' | 'extracting' | 'completed' | 'error' | 'password_required' | 'idle';
  progress: number;
  extractedData?: ExtractedData | null;
  errorMessage?: string;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ status, progress, extractedData, errorMessage }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'uploading':
        return {
          icon: Clock,
          title: 'Uploading PDF...',
          description: 'Please wait while we upload your file',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'processing':
        return {
          icon: FileText,
          title: 'Processing Bank Statement',
          description: 'Analyzing PDF structure and extracting transaction tables',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'extracting':
        return {
          icon: Table,
          title: 'Extracting Transactions',
          description: 'Identifying and parsing transaction data from tables',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        };
      case 'completed':
        return {
          icon: CheckCircle,
          title: 'Processing Complete',
          description: 'Successfully extracted all transactions',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'password_required':
        return {
          icon: Lock,
          title: 'Password Required',
          description: 'This PDF is password protected. Please enter the password and try again.',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        };
      case 'error':
        return {
          icon: AlertCircle,
          title: 'Processing Failed',
          description: 'Unable to process the PDF file',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: Clock,
          title: 'Ready to Process',
          description: 'Upload a PDF file to begin',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Card className={`${config.borderColor} ${config.bgColor}`}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-3">
          <Icon className={`h-6 w-6 ${config.color}`} />
          <span className={config.color}>{config.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{config.description}</p>
        
        {(status === 'uploading' || status === 'processing' || status === 'extracting') && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 text-center">{progress}% complete</p>
          </div>
        )}

        {status === 'completed' && extractedData && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Transactions Found:</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {extractedData.transactionCount} transactions
              </Badge>
            </div>
            {extractedData.dateRange && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Date Range:</span>
                <span className="text-sm text-gray-600">
                  {extractedData.dateRange.start} to {extractedData.dateRange.end}
                </span>
              </div>
            )}
          </div>
        )}

        {status === 'password_required' && (
          <div className="mt-3 p-3 bg-orange-100 rounded-md">
            <p className="text-sm text-orange-800">
              {errorMessage || 'This PDF is password protected. Please enter the password in the file upload section above and try processing again.'}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 p-3 bg-red-100 rounded-md">
            <p className="text-sm text-red-800">
              {errorMessage || 'Please ensure the PDF is a valid bank statement and try again.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcessingStatus;