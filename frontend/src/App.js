import React, { useState } from 'react';
import './App.css';
import { Toaster } from './components/ui/toaster';
import { useToast } from './hooks/use-toast';
import FileUpload from './components/FileUpload';
import ProcessingStatus from './components/ProcessingStatus';
import TransactionPreview from './components/TransactionPreview';
import { simulateProcessing, generateCSV } from './utils/mockData';
import { FileText, Zap, Shield, Download } from 'lucide-react';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const { toast } = useToast();

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setProcessingStatus('idle');
    setExtractedData(null);
    setProgress(0);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setProcessingStatus('idle');
    setExtractedData(null);
    setProgress(0);
  };

  const processFile = async () => {
    if (!selectedFile) return;

    // Simulate different processing stages
    setProcessingStatus('uploading');
    setProgress(20);

    setTimeout(() => {
      setProcessingStatus('processing');
      setProgress(50);
    }, 1000);

    setTimeout(() => {
      setProcessingStatus('extracting');
      setProgress(80);
    }, 2000);

    try {
      // Simulate bank detection based on filename or random selection
      const bankTypes = ['sbi', 'hdfc', 'icici'];
      const detectedBank = bankTypes[Math.floor(Math.random() * bankTypes.length)];
      
      const data = await simulateProcessing(detectedBank);
      
      setExtractedData(data);
      setProcessingStatus('completed');
      setProgress(100);
      
      toast({
        title: "Processing Complete!",
        description: `Successfully extracted ${data.transactionCount} transactions from ${data.bankName}`,
      });
    } catch (error) {
      setProcessingStatus('error');
      toast({
        title: "Processing Failed",
        description: "Unable to process the PDF file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadCSV = () => {
    if (extractedData?.transactions) {
      generateCSV(extractedData.transactions, extractedData.bankName);
      toast({
        title: "CSV Downloaded",
        description: "Your transaction data has been saved as CSV file",
      });
    }
  };

  const resetProcess = () => {
    setSelectedFile(null);
    setProcessingStatus('idle');
    setExtractedData(null);
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
          {extractedData && processingStatus === 'completed' && (
            <div className="space-y-6">
              <TransactionPreview
                transactions={extractedData.transactions}
                onDownloadCSV={handleDownloadCSV}
                bankName={extractedData.bankName}
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
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-gray-500">
          <p>
            Secure • Fast • Reliable | Support for all major Indian banks
          </p>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
}

export default App;