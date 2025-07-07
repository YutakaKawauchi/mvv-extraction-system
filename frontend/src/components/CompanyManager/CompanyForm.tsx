import React, { useState, useEffect } from 'react';
import type { Company, CompanyFormData } from '../../types';
import { Button, Modal } from '../common';
import { validateCompanyForm, sanitizeInput } from '../../utils/validators';
import { CONSTANTS } from '../../utils/constants';

interface CompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: CompanyFormData) => void;
  company?: Company;
  loading?: boolean;
}

export const CompanyForm: React.FC<CompanyFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  company,
  loading = false
}) => {
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    website: '',
    category: '',
    notes: ''
  });
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        website: company.website,
        category: company.category,
        notes: company.notes || ''
      });
    } else {
      setFormData({
        name: '',
        website: '',
        category: '',
        notes: ''
      });
    }
    setErrors([]);
  }, [company, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Sanitize inputs
    const sanitizedData: CompanyFormData = {
      name: sanitizeInput(formData.name),
      website: sanitizeInput(formData.website),
      category: sanitizeInput(formData.category),
      notes: formData.notes ? sanitizeInput(formData.notes) : undefined
    };

    // Validate
    const validationErrors = validateCompanyForm(sanitizedData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onSubmit(sanitizedData);
  };

  const handleInputChange = (field: keyof CompanyFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={company ? '企業情報を編集' : '新しい企業を追加'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <ul className="text-sm text-red-700 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Company Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            企業名 *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="株式会社〇〇"
            required
          />
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
            ウェブサイト *
          </label>
          <input
            id="website"
            type="url"
            value={formData.website}
            onChange={(e) => handleInputChange('website', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://example.com"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            カテゴリー *
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">カテゴリーを選択</option>
            {CONSTANTS.COMPANY_CATEGORIES.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            備考
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="企業に関する追加情報..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
          >
            {company ? '更新' : '追加'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};