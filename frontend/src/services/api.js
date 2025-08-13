import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

class BankStatementAPI {
  async uploadAndProcess(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${API}/process-statement`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }
  
  async getProcessingStatus(jobId) {
    const response = await axios.get(`${API}/process-status/${jobId}`);
    return response.data;
  }
  
  async getTransactions(jobId) {
    const response = await axios.get(`${API}/transactions/${jobId}`);
    return response.data;
  }
  
  async downloadCSV(jobId) {
    const response = await axios.get(`${API}/download-csv/${jobId}`, {
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Extract filename from response headers
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'bank_statement.csv';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename=(.+)/);
      if (filenameMatch) {
        filename = filenameMatch[1].replace(/"/g, '');
      }
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return { success: true, filename };
  }
  
  // Polling helper for status updates
  async pollStatus(jobId, onStatusUpdate, maxRetries = 60, interval = 2000) {
    let retries = 0;
    
    const poll = async () => {
      try {
        const status = await this.getProcessingStatus(jobId);
        onStatusUpdate(status);
        
        if (status.status === 'completed' || status.status === 'error') {
          return status;
        }
        
        if (retries < maxRetries) {
          retries++;
          setTimeout(poll, interval);
        } else {
          throw new Error('Processing timeout');
        }
      } catch (error) {
        console.error('Error polling status:', error);
        onStatusUpdate({
          status: 'error',
          error_message: 'Failed to get processing status'
        });
      }
    };
    
    return poll();
  }
}

export default new BankStatementAPI();