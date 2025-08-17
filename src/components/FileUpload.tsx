'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Upload, X, Lock, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File, password?: string) => void;
  selectedFile: File | null;
  onRemoveFile: () => void;
  password?: string;
  onPasswordChange?: (password: string) => void;
  isPasswordRequired?: boolean;
  showPasswordError?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  selectedFile, 
  onRemoveFile, 
  password = '',
  onPasswordChange,
  isPasswordRequired = false,
  showPasswordError = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus password field when password error occurs
  useEffect(() => {
    if (showPasswordError && passwordInputRef.current) {
      passwordInputRef.current.focus();
      passwordInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showPasswordError]);

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
    if (fileInputRef.current) {
      fileInputRef.current.click();
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
          
          {/* Password Field - Enhanced for better UX */}
          <div className={`mt-4 pt-4 border-t border-gray-700 ${
            isPasswordRequired || showPasswordError 
              ? 'ring-2 ring-orange-500/50 rounded-lg p-4 bg-orange-500/5' 
              : ''
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <Lock className={`h-4 w-4 ${
                isPasswordRequired || showPasswordError 
                  ? 'text-orange-400' 
                  : 'text-gray-400'
              }`} />
              <label className={`text-sm font-medium ${
                isPasswordRequired || showPasswordError 
                  ? 'text-orange-300' 
                  : 'text-gray-300'
              }`}>
                {isPasswordRequired || showPasswordError 
                  ? 'PDF Password Required' 
                  : 'Password (optional)'
                }
              </label>
              {(isPasswordRequired || showPasswordError) && (
                <AlertCircle className="h-4 w-4 text-orange-400" />
              )}
            </div>
            
            <Input
              ref={passwordInputRef}
              type="password"
              placeholder={
                isPasswordRequired || showPasswordError 
                  ? "Enter your PDF password to continue" 
                  : "Enter password if PDF is protected"
              }
              value={password}
              onChange={(e) => onPasswordChange?.(e.target.value)}
              className={`transition-all duration-200 ${
                isPasswordRequired || showPasswordError 
                  ? 'border-orange-500 bg-orange-900/20 text-white placeholder:text-orange-300/70 focus:border-orange-400 focus:ring-orange-400' 
                  : 'border-gray-700 bg-gray-800/50 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500'
              }`}
            />
            
            {showPasswordError ? (
              <div className="flex items-center mt-2 text-xs text-orange-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                <p>This PDF is password protected. Please enter the correct password above.</p>
              </div>
            ) : isPasswordRequired ? (
              <p className="text-xs text-orange-300 mt-1">
                Please enter the password to unlock this PDF file
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Leave empty if your PDF is not password protected
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`
        border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer
        ${dragActive 
          ? 'border-blue-400 bg-blue-900/20 backdrop-blur-sm' 
          : 'border-gray-600 bg-gray-900/50 backdrop-blur-sm hover:border-gray-500 hover:bg-gray-900/70'
        }
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleButtonClick}
    >
      <CardContent className="p-12 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className={`
            p-6 rounded-full mx-auto w-fit transition-all duration-300
            ${dragActive 
              ? 'bg-blue-600/20 text-blue-400' 
              : 'bg-gray-800/50 text-gray-400 group-hover:text-gray-300'
            }
          `}>
            <Upload className="h-12 w-12" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">
              Drop your PDF bank statement here
            </h3>
            <p className="text-gray-400">
              or click to browse your files
            </p>
            <p className="text-sm text-gray-500">
              Supports PDF files up to 50MB
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;