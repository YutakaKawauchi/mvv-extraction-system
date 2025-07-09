import type { CompanyFormData } from '../types';

export const validateUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateCompanyForm = (data: CompanyFormData): string[] => {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('企業名は必須です');
  }

  if (!data.website || data.website.trim().length === 0) {
    errors.push('ウェブサイトは必須です');
  } else if (!validateUrl(data.website)) {
    errors.push('有効なURLを入力してください');
  }

  // Category is now optional and auto-generated from industry classification
  // No validation needed for category field

  return errors;
};

export const validateCSVHeaders = (headers: string[]): boolean => {
  const requiredHeaders = ['name', 'website', 'category'];
  return requiredHeaders.every(header => 
    headers.some(h => h.toLowerCase() === header)
  );
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};