"use client";

import React, { useRef, MutableRefObject } from 'react';

// Define types needed within this component
type ActiveTab = 'Top' | 'Worst' | 'New';
type SliderStyle = { left: number; width: number };

interface FeedTabsProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  sliderStyle: SliderStyle;
  tabsContainerRef: MutableRefObject<HTMLDivElement | null>;
  tabsRef: MutableRefObject<(HTMLButtonElement | null)[]>;
}

const FeedTabs: React.FC<FeedTabsProps> = ({
  activeTab,
  setActiveTab,
  sliderStyle,
  tabsContainerRef,
  tabsRef,
}) => {
  // Define tab labels and their display text
  const tabData: { key: ActiveTab; displayText: string }[] = [
    { key: 'Top', displayText: "Top Pops Today" },
    { key: 'Worst', displayText: "Bad Bombs Today" },
    { key: 'New', displayText: "New" },
  ];

  return (
    <div ref={tabsContainerRef} className="relative flex justify-around mb-6 w-full"> 
      {tabData.map((tabInfo, index) => (
        <button
          ref={(el) => {
            if (tabsRef.current) {
              tabsRef.current[index] = el;
            }
          }}
          key={tabInfo.key}
          onClick={() => setActiveTab(tabInfo.key)}
          className={`flex-1 px-1 py-2 text-center text-sm font-semibold text-black transition-transform duration-150 hover:scale-110 
            ${activeTab === tabInfo.key ? 'font-bold' : ''}
          `}
        >
          {tabInfo.displayText}
        </button>
      ))}
      {/* Sliding Underline Element */}
      <div 
        className="absolute bottom-0 h-0.5 bg-red-500 transition-all duration-300 ease-in-out"
        style={{ left: `${sliderStyle.left}px`, width: `${sliderStyle.width}px` }}
      />
    </div>
  );
};

export default FeedTabs; 