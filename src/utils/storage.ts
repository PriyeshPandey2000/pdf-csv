import { ProcessingJob, ProcessingResult } from '@/types';

// In-memory storage (in production, use Redis or database)
export const processingJobs = new Map<string, ProcessingJob>();
export const processingResults = new Map<string, ProcessingResult>();