"use client";

import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/Button'; // Assuming you have a general Button component

const COOKIE_CONSENT_KEY = 'areufunny_cookie_consent';

const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const consentGiven = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consentGiven) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleAccept = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    }
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 shadow-lg z-50 flex flex-col sm:flex-row justify-between items-center">
      <p className="text-sm mb-3 sm:mb-0 sm:mr-4">
        Areufunny.com uses cookies and similar tracking technologies to enhance your browsing experience, analyze site traffic, and personalize content.
        {/* Optional: Add a link to your privacy policy */}
        <a href="/privacy" className="underline hover:text-gray-300 ml-1">Learn more</a>
      </p>
      <Button 
        onClick={handleAccept}
        // variant="primary" // Consider if this is necessary or if className is sufficient
        className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 sm:py-2 sm:px-4 rounded-md flex-shrink-0 text-sm sm:text-base"
      >
        Got it!
      </Button>
    </div>
  );
};

export default CookieBanner; 