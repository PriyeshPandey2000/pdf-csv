'use client'

import React, { useState, useCallback } from 'react';
import { Upload, FileText, X, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';

interface FileUploadProps {
  onFileSelect: (file: File, password?: string) => void;
  selectedFile: File | null;
  onRemoveFile: () => void;
  password?: string;
  onPasswordChange?: (password: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  selectedFile, 
  onRemoveFile, 
  password = '', 
  onPasswordChange 
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file, password);
      } else {
        alert('Please select a PDF file only.');
      }
    }
  }, [onFileSelect, password]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file, password);
      } else {
        alert('Please select a PDF file only.');
      }
    }
  }, [onFileSelect, password]);

  const handleButtonClick = useCallback(() => {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }, []);

  if (selectedFile) {
    return (
      <Card className="border-2 border-dashed border-green-500/30 bg-gray-900/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-green-400" />
              <div>
                <p className="font-medium text-white">{selectedFile.name}</p>
                <p className="text-sm text-gray-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveFile}
              className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Optional Password Field */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <Lock className="h-4 w-4 text-gray-400" />
              <label className="text-sm font-medium text-gray-300">
                Password (optional)
              </label>
            </div>
            <Input
              type="password"
              placeholder="Enter password if PDF is protected"
              value={password}
              onChange={(e) => onPasswordChange?.(e.target.value)}
              className="border-gray-700 bg-gray-800/50 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty if your PDF is not password protected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`border-2 border-dashed transition-all duration-200 cursor-pointer backdrop-blur-sm ${
        dragActive 
          ? 'border-blue-400/60 bg-blue-500/10' 
          : 'border-gray-600/40 hover:border-gray-500/60 bg-gray-900/30'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleButtonClick}
    >
      <CardContent className="p-12 text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-6" />
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-white">
            Upload Bank Statement PDF
          </h3>
          <p className="text-gray-400">
            Drag and drop your PDF file here, or click to select
          </p>
          <p className="text-sm text-gray-500">
            Supports all major Indian banks (SBI, HDFC, ICICI, Axis, PNB, etc.)
          </p>
        </div>
        <div className="mt-8">
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
            className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 px-8 py-3 rounded-full transition-all duration-200 hover:scale-105"
          >
            <FileText className="w-4 h-4 mr-2" />
            Select PDF File
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;