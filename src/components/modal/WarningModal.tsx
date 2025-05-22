'use client';

import React from 'react';
import Button from '@/components/ui/Button';

interface WarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message: string;
}

const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  message,
}) => {
  if (!isOpen) {
    return null;
  }

  // Handler for clicking on the backdrop
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If the click target is the backdrop div itself, call onCancel
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-white bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick} // Add click handler to backdrop
    >
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md text-center">
        <h2 className="text-xl font-semibold mb-4 text-yellow-600">Warning!</h2>
        <p className="text-gray-700 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex justify-center space-x-4">
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="warning">
            Fuck it, let's roll
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WarningModal; 