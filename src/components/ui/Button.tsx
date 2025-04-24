"use client";

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'warning';
  size?: 'default' | 'small';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'default', 
  className = '', 
  ...props 
}) => {
  // Use const as baseStyle is not reassigned
  const baseStyle = "font-semibold rounded-md transition-colors duration-200 shadow disabled:opacity-50 disabled:cursor-not-allowed";

  // Size styles
  let sizeStyle = "";
  switch (size) {
    case 'small':
      sizeStyle = "px-3 py-1 text-xs";
      break;
    case 'default':
    default:
      sizeStyle = "px-8 py-3 text-lg";
      break;
  }

  // Variant styles - Adjusted for light theme
  let variantStyle = "";
  switch (variant) {
    case 'secondary':
      // Light gray bg, dark text
      variantStyle = "bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-300"; 
      break;
    case 'warning':
       // Yellow bg, dark text for contrast
       variantStyle = "bg-yellow-400 hover:bg-yellow-500 text-yellow-900";
       break;
    case 'primary':
    default:
      // Keep red bg, white text for primary actions
      variantStyle = "bg-red-600 hover:bg-red-700 text-white";
      break;
  }

  return (
    <button
      className={`${baseStyle} ${sizeStyle} ${variantStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button; 