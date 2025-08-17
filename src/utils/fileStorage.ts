import * as fs from 'fs';
import * as path from 'path';
import { ProcessingJob, ProcessingResult } from '@/types';

const STORAGE_DIR = path.join(process.cwd(), 'temp', 'storage');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export class FileStorage {
  private static getJobFilePath(jobId: string): string {
    return path.join(STORAGE_DIR, `job_${jobId}.json`);
  }

  private static getResultFilePath(jobId: string): string {
    return path.join(STORAGE_DIR, `result_${jobId}.json`);
  }

  static saveJob(job: ProcessingJob): void {
    try {
      const filePath = this.getJobFilePath(job.id);
      fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
    } catch (error) {
      console.error('Error saving job:', error);
    }
  }

  static getJob(jobId: string): ProcessingJob | null {
    try {
      const filePath = this.getJobFilePath(jobId);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data) as ProcessingJob;
      }
      return null;
    } catch (error) {
      console.error('Error getting job:', error);
      return null;
    }
  }

  static saveResult(result: ProcessingResult): void {
    try {
      const filePath = this.getResultFilePath(result.job_id);
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error saving result:', error);
    }
  }

  static getResult(jobId: string): ProcessingResult | null {
    try {
      const filePath = this.getResultFilePath(jobId);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data) as ProcessingResult;
      }
      return null;
    } catch (error) {
      console.error('Error getting result:', error);
      return null;
    }
  }

  static updateJob(jobId: string, updates: Partial<ProcessingJob>): void {
    try {
      const existingJob = this.getJob(jobId);
      if (existingJob) {
        const updatedJob = { ...existingJob, ...updates };
        this.saveJob(updatedJob);
      }
    } catch (error) {
      console.error('Error updating job:', error);
    }
  }
}