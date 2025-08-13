import React, { useState, useCallback } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const FileUpload = ({ onFileSelect, selectedFile, onRemoveFile }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Please select a PDF file only.');
      }
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Please select a PDF file only.');
      }
    }
  }, [onFileSelect]);

  const handleButtonClick = useCallback(() => {
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.click();
    }
  }, []);

  if (selectedFile) {
    return (
      <Card className="border-2 border-dashed border-green-300 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-green-800">{selectedFile.name}</p>
                <p className="text-sm text-green-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveFile}
              className="text-green-600 hover:text-green-800 hover:bg-green-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`border-2 border-dashed transition-colors cursor-pointer ${
        dragActive 
          ? 'border-blue-400 bg-blue-50' 
          : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleButtonClick}
    >
      <CardContent className="p-8 text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">
            Upload Bank Statement PDF
          </h3>
          <p className="text-sm text-gray-500">
            Drag and drop your PDF file here, or click to select
          </p>
          <p className="text-xs text-gray-400">
            Supports all major Indian banks (SBI, HDFC, ICICI, Axis, PNB, etc.)
          </p>
        </div>
        <div className="mt-6">
          <input
            type="file"
            accept=".pdf"
            onChange={handleChange}
            className="hidden"
            id="file-upload"
          />
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              handleButtonClick();
            }}
            type="button"
            className="cursor-pointer"
          >
            Select PDF File
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;