import { useState } from 'react';
import { getImageUrl } from '@/lib/api';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, RotateCw, Volume2, VolumeX, Grid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from '@/lib/sounds';

const PreviewCanvas = ({ storybook, settings }) => {
  const [currentSpread, setCurrentSpread] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [soundOn, setSoundOn] = useState(settings.soundEnabled);

  const totalSpreads = storybook.spreads.length;

  const goToPrevious = () => {
    if (currentSpread > 0) {
      setCurrentSpread(currentSpread - 1);
      if (soundOn && settings.soundEnabled) {
        playSound(settings.defaultSound, settings.soundVolume);
      }
    }
  };

  const goToNext = () => {
    if (currentSpread < totalSpreads - 1) {
      setCurrentSpread(currentSpread + 1);
      if (soundOn && settings.soundEnabled) {
        playSound(settings.defaultSound, settings.soundVolume);
      }
    }
  };

  const getEffectClass = () => {
    const effect = settings.defaultViewMode === 'one-page' ? settings.onePageEffect : settings.twoPageEffect;
    
    switch (effect) {
      case 'StoryParallax':
        return 'transform transition-all duration-700 ease-out';
      case 'VelvetCurl':
        return 'transform transition-all duration-600 ease-in-out';
      case 'CinematicGlide':
        return 'transform transition-all duration-800 ease-out';
      case 'LiftTurn':
        return 'transform transition-all duration-700 ease-out';
      case 'LuxeSlideFlip':
        return 'transform transition-all duration-500 ease-out';
      default:
        return 'transform transition-all duration-600 ease-out';
    }
  };

  const getNavLayoutComponent = () => {
    const navStyle = settings.navLayout;
    
    const controls = (
      <>
        <Button
          onClick={goToPrevious}
          disabled={currentSpread === 0}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/20"
          data-testid="preview-prev-button"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <span className="text-white font-sans text-sm px-4" data-testid="preview-page-indicator">
          {currentSpread + 1} / {totalSpreads}
        </span>
        
        <Button
          onClick={goToNext}
          disabled={currentSpread === totalSpreads - 1}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/20"
          data-testid="preview-next-button"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className="mx-2 h-6 w-px bg-white/20" />

        <Button
          onClick={() => setZoom(Math.min(zoom + 0.2, 2))}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/20"
          data-testid="preview-zoom-in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <Button
          onClick={() => setZoom(Math.max(zoom - 0.2, 0.5))}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/20"
          data-testid="preview-zoom-out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>

        <Button
          onClick={() => setSoundOn(!soundOn)}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/20"
          data-testid="preview-sound-toggle"
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      </>
    );

    switch (navStyle) {
      case 'AirBar':
        return (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10">
            {controls}
          </div>
        );
      
      case 'CinemaDock':
        return (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 bg-black/70 backdrop-blur-xl px-8 py-4 border-t border-white/10">
            {controls}
          </div>
        );
      
      case 'HaloTop':
        return (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10">
            {controls}
          </div>
        );
      
      case 'SideRails':
        return (
          <>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-black/60 backdrop-blur-xl p-2 rounded-full border border-white/10">
              <Button
                onClick={goToPrevious}
                disabled={currentSpread === 0}
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-black/60 backdrop-blur-xl p-2 rounded-full border border-white/10">
              <Button
                onClick={goToNext}
                disabled={currentSpread === totalSpreads - 1}
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full">
              <span className="text-white font-sans text-sm">
                {currentSpread + 1} / {totalSpreads}
              </span>
            </div>
          </>
        );
      
      case 'GhostEdges':
      default:
        return (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-auto">
              <Button
                onClick={goToPrevious}
                disabled={currentSpread === 0}
                size="sm"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 ml-4"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-auto">
              <Button
                onClick={goToNext}
                disabled={currentSpread === totalSpreads - 1}
                size="sm"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 mr-4"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full pointer-events-auto">
              <span className="text-white/90 font-sans text-sm">
                {currentSpread + 1} / {totalSpreads}
              </span>
            </div>
          </div>
        );
    }
  };

  const getThemeBackground = () => {
    const theme = settings.themePreset;
    switch (theme) {
      case 'Midnight Navy':
        return '#1C2340';
      case 'Soft Plum':
        return '#5B496E';
      case 'Mist Gray':
        return '#D8DCE6';
      case 'Blush Beige':
        return '#E8DDD8';
      case 'Warm Cream':
      default:
        return '#F7F1E8';
    }
  };

  return (
    <div 
      className="relative w-full max-w-5xl h-full flex items-center justify-center"
      style={{ backgroundColor: getThemeBackground() }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      data-testid="preview-canvas"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSpread}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={getEffectClass()}
          style={{ 
            transform: `scale(${zoom})`,
            borderRadius: settings.roundedCorners ? `${settings.cornerRadius}px` : '0px'
          }}
        >
          <img
            src={getImageUrl(storybook.spreads[currentSpread])}
            alt={`Spread ${currentSpread + 1}`}
            className="max-h-[70vh] w-auto shadow-2xl page-shadow"
            style={{
              borderRadius: settings.roundedCorners ? `${settings.cornerRadius}px` : '0px'
            }}
            data-testid="preview-spread-image"
          />
        </motion.div>
      </AnimatePresence>

      {showControls && getNavLayoutComponent()}
    </div>
  );
};

export default PreviewCanvas;
