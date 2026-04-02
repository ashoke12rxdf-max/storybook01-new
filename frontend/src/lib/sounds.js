// Real page flip sound effects

export const BUILT_IN_SOUNDS = {
  'Sound 1': {
    name: 'Sound 1',
    description: 'Laminated paper flip on wooden table',
    url: 'https://customer-assets.emergentagent.com/job_narrative-canvas-5/artifacts/1ir5s38z_ES_Paper%2C%20Handle%2C%20Sheet%2C%20Laminated%2C%20Turn%20Over%2C%20Flip%20On%20Wooden%20Table%20-%20Epidemic%20Sound.mp3'
  },
  'Sound 2': {
    name: 'Sound 2',
    description: 'Notepad pages flip together',
    url: 'https://customer-assets.emergentagent.com/job_narrative-canvas-5/artifacts/ik6a10be_ES_Notepad%2C%20Several%20Pages%2C%20Flip%20Over%2C%20Together%2001%20-%20Epidemic%20Sound.mp3'
  },
  'Sound 3': {
    name: 'Sound 3',
    description: 'Book page flip',
    url: 'https://customer-assets.emergentagent.com/job_narrative-canvas-5/artifacts/7bo6x1m5_ES_Objects%2C%20Book%2C%20Flip%20Page%20-%20Epidemic%20Sound.mp3'
  }
};

export const playSound = (soundName, volume = 0.7, customSoundUrl = null) => {
  let soundUrl = customSoundUrl;
  
  // If no custom URL provided, try to find built-in sound
  if (!soundUrl) {
    const sound = BUILT_IN_SOUNDS[soundName];
    if (sound && sound.url) {
      soundUrl = sound.url;
    }
  }
  
  if (soundUrl) {
    try {
      const audio = new Audio(soundUrl);
      audio.volume = volume;
      audio.play().catch(err => console.log('Sound play failed:', err));
    } catch (error) {
      console.log('Audio playback error:', error);
    }
  }
};

// Helper to get custom sound URL from storybook settings
export const getCustomSoundUrl = (settings) => {
  if (settings?.perSpreadSoundMap?._customSound?.url) {
    return settings.perSpreadSoundMap._customSound.url;
  }
  return null;
};
