// This declaration merges with the built-in Window interface
declare global {
  interface Window {
    // Declare webkitAudioContext as an optional property
    // It should be constructable (callable with 'new') like AudioContext
    webkitAudioContext?: { new(contextOptions?: AudioContextOptions): AudioContext };
  }
}

// Adding 'export {}' to make this file a module script,
// which is often needed for global declarations to be picked up correctly.
export {}; 