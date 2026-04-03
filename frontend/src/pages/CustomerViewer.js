import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api, getImageUrl } from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Lock, Maximize2, Minimize2, Hash, X, RotateCcw, MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { playSound, getCustomSoundUrl } from '@/lib/sounds';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Generate a unique session ID for review duplicate prevention
const getReviewerSessionId = () => {
  let sessionId = sessionStorage.getItem('reviewer_session_id');
  if (!sessionId) {
    sessionId = 'rs_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem('reviewer_session_id', sessionId);
  }
  return sessionId;
};

const CustomerViewer = () => {
  const { slug } = useParams();
  const [storybook, setStorybook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGoTo, setShowGoTo] = useState(false);
  const [goToValue, setGoToValue] = useState('');
  const [shakeGoTo, setShakeGoTo] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  
  // Simplified state - only what's needed
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLandscapeMode, setIsLandscapeMode] = useState(false);
  const [showRotateHint, setShowRotateHint] = useState(false);
  const rotateHintShownRef = useRef(false);
  
  const viewerRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const touchStartRef = useRef(null);
  const imageCache = useRef(new Map());
  const loadingImages = useRef(new Set());
  const goToRef = useRef(null);
  const reviewModalRef = useRef(null);

  const loadStorybook = useCallback(async () => {
    try {
      const data = await api.getStorybookBySlug(slug);
      setStorybook(data);
      
      if (data.passwordProtected) {
        setRequiresPassword(true);
      } else {
        setAuthenticated(true);
      }

      if (data.settings?.soundEnabled !== undefined) {
        setSoundOn(data.settings.soundEnabled);
      }
      
      // Check if review already submitted for this session
      try {
        const sessionId = getReviewerSessionId();
        const checkRes = await fetch(`${API_URL}/api/reviews/check/${data.id}/${sessionId}`);
        const checkData = await checkRes.json();
        if (checkData.submitted) {
          setReviewSubmitted(true);
        }
      } catch (e) {
        // Ignore review check errors
      }
    } catch (error) {
      toast.error('Storybook not found');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Load storybook and handle resize
  useEffect(() => {
    loadStorybook();
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [loadStorybook]);

  // Auto-hide controls after 14 seconds
  useEffect(() => {
    if (authenticated && storybook) {
      resetHideControlsTimer();
    }
    
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [authenticated, storybook]);

  // Fullscreen change listener - handles both button clicks and system exits (swipe down, back button)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      // If user exited fullscreen (by any method), clean up landscape mode
      if (!isNowFullscreen) {
        const isMobileDevice = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobileDevice && screen.orientation?.unlock) {
          try {
            screen.orientation.unlock();
          } catch (e) {
            // Silently ignore unlock errors
          }
        }
        setIsLandscapeMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Cleanup on unmount - unlock orientation and exit fullscreen
  useEffect(() => {
    return () => {
      try {
        if (screen.orientation?.unlock) screen.orientation.unlock();
        if (document.fullscreenElement) document.exitFullscreen();
      } catch (e) {
        // Silently ignore cleanup errors
      }
    };
  }, []);

  // Close GoTo popup on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showGoTo && goToRef.current && !goToRef.current.contains(e.target)) {
        setShowGoTo(false);
        setGoToValue('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showGoTo]);

  // Close Review modal on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showReviewModal && reviewModalRef.current && !reviewModalRef.current.contains(e.target)) {
        setShowReviewModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showReviewModal]);

  // Submit review handler
  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    
    if (reviewSubmitted) {
      toast.error('You have already submitted a review');
      return;
    }
    
    setSubmittingReview(true);
    
    try {
      const response = await fetch(`${API_URL}/api/reviews/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storybook_id: storybook.id,
          storybook_slug: slug,
          star_rating: reviewRating,
          review_text: reviewText,
          reviewer_session_id: getReviewerSessionId()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to submit review');
      }
      
      setReviewSubmitted(true);
      toast.success('Thank you for your feedback!');
      
      // Close modal after a short delay
      setTimeout(() => {
        setShowReviewModal(false);
      }, 1500);
      
    } catch (error) {
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Smart image preloading
  useEffect(() => {
    if (!storybook || !authenticated) return;

    const preloadImage = (index) => {
      if (index < 0 || index >= storybook.spreads.length) return;
      if (imageCache.current.has(index)) return;
      if (loadingImages.current.has(index)) return;

      loadingImages.current.add(index);
      
      const img = new Image();
      const url = getImageUrl(storybook.spreads[index]);
      
      img.onload = () => {
        imageCache.current.set(index, img);
        loadingImages.current.delete(index);
      };
      
      img.onerror = () => {
        loadingImages.current.delete(index);
      };
      
      img.src = url;
    };

    if (!imageCache.current.has(currentSpread)) {
      preloadImage(currentSpread);
    }
    preloadImage(currentSpread + 1);
    preloadImage(currentSpread + 2);
    preloadImage(currentSpread - 1);
  }, [currentSpread, storybook, authenticated]);

  const resetHideControlsTimer = () => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    
    setShowControls(true);
    
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 14000);
  };

  const handleUserActivity = () => {
    resetHideControlsTimer();
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      toast.error('Please enter password');
      return;
    }

    setVerifying(true);
    try {
      const result = await api.verifyPassword(storybook.id, password);
      if (result.valid) {
        setAuthenticated(true);
        setRequiresPassword(false);
        toast.success('Access granted!');
      } else {
        toast.error('Invalid password');
      }
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // Helper to play sound with custom sound support
  const playSoundEffect = () => {
    if (!soundOn || !storybook.settings?.soundEnabled) return;
    
    const customSoundUrl = getCustomSoundUrl(storybook.settings);
    const soundName = storybook.settings?.defaultSound || 'Sound 2';
    const volume = storybook.settings?.soundVolume || 0.7;
    
    setTimeout(() => {
      playSound(soundName, volume, customSoundUrl);
    }, 50);
  };

  const goToPrevious = () => {
    if (currentSpread > 0) {
      setImageLoaded(false);
      setCurrentSpread(currentSpread - 1);
      playSoundEffect();
      resetHideControlsTimer();
    }
  };

  const goToNext = () => {
    if (currentSpread < storybook.spreads.length - 1) {
      setImageLoaded(false);
      setCurrentSpread(currentSpread + 1);
      playSoundEffect();
      resetHideControlsTimer();
    }
  };

  const handleGoToPage = () => {
    const pageNum = parseInt(goToValue);
    const totalSpreads = storybook.spreads.length;

    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalSpreads) {
      setShakeGoTo(true);
      setTimeout(() => setShakeGoTo(false), 500);
      return;
    }

    setImageLoaded(false);
    setCurrentSpread(pageNum - 1);
    playSoundEffect();

    setShowGoTo(false);
    setGoToValue('');
    resetHideControlsTimer();
  };

  // Clean fullscreen handler with orientation lock for mobile
  const handleFullscreen = async () => {
    if (!viewerRef.current) return;
    
    const isMobileDevice = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        // Enter fullscreen
        if (viewerRef.current.requestFullscreen) {
          await viewerRef.current.requestFullscreen();
        } else if (viewerRef.current.webkitRequestFullscreen) {
          await viewerRef.current.webkitRequestFullscreen();
        }
        
        // On mobile: switch to landscape nav mode and try orientation lock
        if (isMobileDevice) {
          // Always switch to landscape nav when entering fullscreen on mobile
          setIsLandscapeMode(true);
          
          // Try to lock orientation (works on Android, fails silently on iOS)
          if (screen.orientation?.lock) {
            try {
              await screen.orientation.lock('landscape');
            } catch (orientationErr) {
              // iOS Safari: orientation lock not supported - show rotate hint
              if (isIOS && !rotateHintShownRef.current) {
                rotateHintShownRef.current = true;
                setShowRotateHint(true);
                setTimeout(() => setShowRotateHint(false), 3000);
              }
              console.log('Orientation lock not supported on this device');
            }
          }
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        
        // On mobile: unlock orientation and switch back to portrait nav
        if (isMobileDevice) {
          if (screen.orientation?.unlock) {
            try {
              screen.orientation.unlock();
            } catch (e) {
              // Silently ignore
            }
          }
          setIsLandscapeMode(false);
        }
      }
    } catch (error) {
      console.log('Fullscreen error:', error.message);
    }
    resetHideControlsTimer();
  };

  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
    resetHideControlsTimer();
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    touchStartRef.current = null;
  };

  const handleTapZone = (direction) => {
    if (direction === 'left') {
      goToPrevious();
    } else {
      goToNext();
    }
  };

  // Helper function for toolbar styling
  const getToolbarStyles = () => {
    const toolbarStyle = storybook?.settings?.toolbarStyle || 'Glass';
    
    let bg, textColor;
    switch (toolbarStyle) {
      case 'Solid Dark':
        bg = 'bg-black/90';
        textColor = 'text-white';
        break;
      case 'Soft Light':
        bg = 'bg-white/90';
        textColor = 'text-magical-ink';
        break;
      case 'Invisible Minimal':
        bg = 'bg-black/30';
        textColor = 'text-white';
        break;
      case 'Glass':
      default:
        bg = 'bg-black/70 backdrop-blur-xl';
        textColor = 'text-white';
    }
    
    return { bg, textColor };
  };

  // Mobile Portrait Bottom Nav - horizontal bar at bottom (above Emergent badge)
  const getMobilePortraitNav = () => {
    const totalSpreads = storybook.spreads.length;
    const { bg, textColor } = getToolbarStyles();
    const dividerColor = textColor === 'text-magical-ink' ? 'bg-magical-ink/20' : 'bg-white/20';

    return (
      <div className={`fixed bottom-14 left-4 right-4 z-20 ${bg} flex items-center justify-center gap-3 px-4 py-2.5 rounded-full border border-white/10 shadow-2xl`}>
        <Button
          onClick={goToPrevious}
          disabled={currentSpread === 0}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full disabled:opacity-30`}
          data-testid="prev-btn-mobile"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {storybook.settings?.showPageNumbers && (
          <span className={`${textColor} font-sans text-xs px-1`}>
            {currentSpread + 1}/{totalSpreads}
          </span>
        )}

        <Button
          onClick={goToNext}
          disabled={currentSpread === totalSpreads - 1}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full disabled:opacity-30`}
          data-testid="next-btn-mobile"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className={`w-px h-5 ${dividerColor}`} />

        <Button
          onClick={() => { setShowGoTo(!showGoTo); resetHideControlsTimer(); }}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full`}
          data-testid="goto-btn-mobile"
        >
          <Hash className="w-4 h-4" />
        </Button>

        <Button
          onClick={() => { setShowReviewModal(true); resetHideControlsTimer(); }}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full ${reviewSubmitted ? 'text-amber-400' : ''}`}
          data-testid="review-btn-mobile"
          title="Leave a Review"
        >
          <MessageSquare className="w-4 h-4" />
        </Button>

        <Button
          onClick={handleFullscreen}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full`}
        >
          <Maximize2 className="w-4 h-4" />
        </Button>

        {storybook.settings?.soundEnabled && (
          <Button
            onClick={() => setSoundOn(!soundOn)}
            size="sm"
            variant="ghost"
            className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full`}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        )}
      </div>
    );
  };

  // Mobile Landscape Left Nav - vertical bar on left side (fullscreen mode)
  const getMobileLandscapeNav = () => {
    const totalSpreads = storybook.spreads.length;
    const { bg, textColor } = getToolbarStyles();
    const dividerColor = textColor === 'text-magical-ink' ? 'bg-magical-ink/20' : 'bg-white/20';

    return (
      <div className={`fixed left-3 top-1/2 -translate-y-1/2 z-20 ${bg} rounded-full py-3 px-1 flex flex-col items-center gap-1 shadow-2xl border border-white/10`}>
        <Button
          onClick={goToPrevious}
          disabled={currentSpread === 0}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 disabled:opacity-30 rounded-full`}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        {storybook.settings?.showPageNumbers && (
          <span className={`${textColor} font-sans text-[10px] px-1 text-center leading-tight my-1`}>
            {currentSpread + 1}/{totalSpreads}
          </span>
        )}
        
        <Button
          onClick={goToNext}
          disabled={currentSpread === totalSpreads - 1}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 disabled:opacity-30 rounded-full`}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className={`w-6 h-px my-1 ${dividerColor}`} />

        <Button
          onClick={() => { setShowGoTo(!showGoTo); resetHideControlsTimer(); }}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full`}
        >
          <Hash className="w-5 h-5" />
        </Button>

        <Button
          onClick={() => { setShowReviewModal(true); resetHideControlsTimer(); }}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full ${reviewSubmitted ? 'text-amber-400' : ''}`}
          title="Leave a Review"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>

        <Button
          onClick={handleFullscreen}
          size="sm"
          variant="ghost"
          className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full ${isFullscreen ? 'bg-white/20' : ''}`}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>

        {storybook.settings?.soundEnabled && (
          <Button
            onClick={() => setSoundOn(!soundOn)}
            size="sm"
            variant="ghost"
            className={`${textColor} hover:bg-white/20 h-11 w-11 p-0 rounded-full`}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        )}

        <div className={`w-6 h-px my-1 ${dividerColor}`} />
      </div>
    );
  };

  // Desktop navigation - Fixed: Use Left/Right arrows, added GoTo button to all styles
  const getDesktopNavigation = () => {
    const navStyle = storybook.settings?.navLayout || 'AirBar';
    const totalSpreads = storybook.spreads.length;
    const { bg, textColor } = getToolbarStyles();

    switch (navStyle) {
      case 'CinemaDock':
        return (
          <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 ${bg} px-8 py-4 border-t border-white/10`}>
            <Button onClick={goToPrevious} disabled={currentSpread === 0} size="sm" variant="ghost" className={`${textColor} hover:bg-white/20 h-10 w-10 p-0`}>
              <ChevronLeft className="w-6 h-6" />
            </Button>
            {storybook.settings?.showPageNumbers && <span className={`${textColor} font-sans text-sm px-4`}>{currentSpread + 1}/{totalSpreads}</span>}
            <Button onClick={goToNext} disabled={currentSpread === totalSpreads - 1} size="sm" variant="ghost" className={`${textColor} hover:bg-white/20 h-10 w-10 p-0`}>
              <ChevronRight className="w-6 h-6" />
            </Button>
            <div className="mx-2 h-6 w-px bg-white/20" />
            <Button
              onClick={() => { setShowGoTo(!showGoTo); resetHideControlsTimer(); }}
              size="sm"
              variant="ghost"
              className={`${textColor} hover:bg-white/20 h-10 w-10 p-0`}
            >
              <Hash className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => { setShowReviewModal(true); resetHideControlsTimer(); }}
              size="sm"
              variant="ghost"
              className={`${textColor} hover:bg-white/20 h-10 w-10 p-0 ${reviewSubmitted ? 'text-amber-400' : ''}`}
              title="Leave a Review"
              data-testid="review-btn-desktop"
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
            <Button onClick={handleFullscreen} size="sm" variant="ghost" className={`${textColor} hover:bg-white/20 h-10 w-10 p-0`}>
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </Button>
            {storybook.settings?.soundEnabled && (
              <Button onClick={() => setSoundOn(!soundOn)} size="sm" variant="ghost" className={`${textColor} hover:bg-white/20 h-10 w-10 p-0`}>
                {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
            )}
          </div>
        );

      case 'GhostEdges':
        return (
          <>
            {/* Left arrow - positioned on left edge */}
            <Button onClick={goToPrevious} disabled={currentSpread === 0} size="sm" variant="ghost" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white hover:bg-white/10 h-12 w-12 p-0">
              <ChevronLeft className="w-8 h-8" />
            </Button>
            {/* Right arrow - positioned on right edge */}
            <Button onClick={goToNext} disabled={currentSpread === totalSpreads - 1} size="sm" variant="ghost" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white hover:bg-white/10 h-12 w-12 p-0">
              <ChevronRight className="w-8 h-8" />
            </Button>
            {/* Bottom center bar with page counter, GoTo, Review, fullscreen, and sound */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-3">
              {storybook.settings?.showPageNumbers && (
                <span className="text-white/90 font-sans text-xs">{currentSpread + 1}/{totalSpreads}</span>
              )}
              <Button
                onClick={() => { setShowGoTo(!showGoTo); resetHideControlsTimer(); }}
                size="sm"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
              >
                <Hash className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => { setShowReviewModal(true); resetHideControlsTimer(); }}
                size="sm"
                variant="ghost"
                className={`text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0 ${reviewSubmitted ? 'text-amber-400' : ''}`}
                title="Leave a Review"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
              <Button onClick={handleFullscreen} size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0">
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              {storybook.settings?.soundEnabled && (
                <Button onClick={() => setSoundOn(!soundOn)} size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0">
                  {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </>
        );

      default:
        // AirBar (default)
        return (
          <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 ${bg} px-4 py-3 rounded-full border border-white/10 shadow-2xl`}>
            <Button onClick={goToPrevious} disabled={currentSpread === 0} size="sm" variant="ghost" className={`${textColor} hover:bg-white/20 h-9 w-9 p-0`}>
              <ChevronLeft className="w-6 h-6" />
            </Button>
            {storybook.settings?.showPageNumbers && <span className={`${textColor} font-sans text-sm px-4`}>{currentSpread + 1}/{totalSpreads}</span>}
            <Button onClick={goToNext} disabled={currentSpread === totalSpreads - 1} size="sm" variant="ghost" className={`${textColor} hover:bg-white/20 h-9 w-9 p-0`}>
              <ChevronRight className="w-6 h-6" />
            </Button>
            <div className="mx-2 h-6 w-px bg-white/20" />
            <Button
              onClick={() => { setShowGoTo(!showGoTo); resetHideControlsTimer(); }}
              size="sm"
              variant="ghost"
              className={`${textColor} hover:bg-white/20 h-9 w-9 p-0`}
            >
              <Hash className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => { setShowReviewModal(true); resetHideControlsTimer(); }}
              size="sm"
              variant="ghost"
              className={`${textColor} hover:bg-white/20 h-9 w-9 p-0 ${reviewSubmitted ? 'text-amber-400' : ''}`}
              title="Leave a Review"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
            <Button onClick={handleFullscreen} size="sm" variant="ghost" className={`${textColor} hover:bg-white/20 h-9 w-9 p-0`}>
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </Button>
            {storybook.settings?.soundEnabled && (
              <Button onClick={() => setSoundOn(!soundOn)} size="sm" variant="ghost" className={`${textColor} hover:bg-white/20 h-9 w-9 p-0`}>
                {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
            )}
          </div>
        );
    }
  };

  // Determine GoTo popup positioning based on mode
  const getGoToPopupClass = () => {
    if (isMobile && isLandscapeMode) {
      // Landscape mode: position to the right of left nav
      return "fixed left-16 top-1/2 -translate-y-1/2 z-30";
    } else {
      // Portrait mode (or desktop): position above bottom nav
      return "fixed bottom-28 left-1/2 -translate-x-1/2 z-30";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-magical-ink flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-magical-gold border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-magical-cream font-serif text-lg">Loading your story...</p>
        </div>
      </div>
    );
  }

  if (!storybook) {
    return (
      <div className="min-h-screen bg-magical-ink flex items-center justify-center">
        <div className="text-center">
          <p className="text-magical-cream font-serif text-xl">Storybook not found</p>
        </div>
      </div>
    );
  }

  if (requiresPassword && !authenticated) {
    // Get storybook title with fallback
    const displayTitle = storybook.title?.trim() || 'Your Storybook';
    
    return (
      <div className="min-h-screen bg-magical-ink flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-floating p-6 sm:p-10 border border-magical-moon/20">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-magical-ink rounded-full mb-4">
                <Lock className="w-8 h-8 text-magical-gold" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif text-magical-ink mb-3">
                {displayTitle}
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-sans font-medium text-magical-ink mb-2">
                  This storybook is password protected
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                  placeholder="Enter password"
                  className="bg-white/50 border-magical-ink/10 focus:border-magical-rose rounded-lg"
                />
              </div>

              <Button
                onClick={handlePasswordSubmit}
                disabled={verifying || !password}
                className="w-full bg-magical-ink text-magical-cream hover:bg-magical-plum transition-all shadow-lg px-6 py-5 sm:px-8 sm:py-6 rounded-full font-serif"
              >
                {verifying ? 'Verifying...' : 'Enter Storybook'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Theme background colors based on presets
  const getThemeBackground = () => {
    const theme = storybook.settings?.themePreset || 'Warm Cream';
    const themeColors = {
      'Warm Cream': '#F5F0E6',
      'Pure White': '#FFFFFF',
      'Soft Gray': '#F3F4F6',
      'Night Mode': '#1F2937',
      'Sepia': '#F4ECD8',
      'Midnight Navy': '#1C2340'
    };
    return themeColors[theme] || '#F7F1E8';
  };
  
  const themeBackground = getThemeBackground();
  const isDarkTheme = ['Night Mode', 'Midnight Navy'].includes(storybook.settings?.themePreset);
  
  // Track if image is ready (either from cache or just loaded)
  const isImageReady = imageCache.current.has(currentSpread) || imageLoaded;

  // Image sizing - give more room for bottom nav in mobile portrait
  const imageMaxHeight = isMobile && !isLandscapeMode ? '75vh' : '88vh';

  // Reset imageLoaded when spread changes
  const handleImageLoad = () => {
    imageCache.current.set(currentSpread, true);
    setImageLoaded(true);
  };

  return (
    <div 
      ref={viewerRef}
      className="min-h-screen relative flex flex-col"
      style={{ backgroundColor: themeBackground }}
      onMouseMove={handleUserActivity}
      onTouchMove={handleUserActivity}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* iOS Rotate Hint Toast */}
      <AnimatePresence>
        {showRotateHint && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium">Rotate phone for best experience</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-8 relative overflow-hidden">
        {/* Tap zones */}
        <div className="absolute left-0 top-0 bottom-0 w-[20%] z-10 cursor-pointer" onClick={() => handleTapZone('left')} />
        <div className="absolute right-0 top-0 bottom-0 w-[20%] z-10 cursor-pointer" onClick={() => handleTapZone('right')} />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSpread}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-0"
          >
            {!isImageReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-magical-plum/5 via-magical-rose/5 to-magical-plum/5 rounded-xl z-10 min-w-[300px] min-h-[200px]">
                <div className="w-8 h-8 border-4 border-magical-gold border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            <img
              src={getImageUrl(storybook.spreads[currentSpread])}
              alt={`Spread ${currentSpread + 1}`}
              loading="eager"
              onLoad={handleImageLoad}
              className={`shadow-2xl page-shadow transition-opacity duration-200 object-contain ${isImageReady ? 'opacity-100' : 'opacity-0'}`}
              style={{
                borderRadius: storybook.settings?.roundedCorners ? `${storybook.settings.cornerRadius}px` : '0px',
                maxWidth: '95vw',
                maxHeight: imageMaxHeight,
                width: 'auto',
                height: 'auto'
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation - Mobile (portrait/landscape) or Desktop */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isMobile 
                ? (isLandscapeMode 
                    ? getMobileLandscapeNav()   // Landscape fullscreen: left side vertical nav
                    : getMobilePortraitNav()    // Portrait default: bottom horizontal nav
                  )
                : (isLandscapeMode 
                    ? getMobileLandscapeNav()   // Mobile device in fullscreen but viewport > 768
                    : getDesktopNavigation()    // Desktop: existing nav unchanged
                  )
              }
            </motion.div>
          )}
        </AnimatePresence>

        {/* Go To Page popup */}
        <AnimatePresence>
          {showGoTo && (
            <motion.div
              ref={goToRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={`${getGoToPopupClass()} bg-white rounded-xl shadow-2xl p-3 ${shakeGoTo ? 'animate-shake' : ''}`}
            >
              <style>{`
                @keyframes shake {
                  0%, 100% { transform: translateX(0); }
                  25% { transform: translateX(-5px); }
                  75% { transform: translateX(5px); }
                }
                .animate-shake {
                  animation: shake 0.3s ease-in-out;
                }
              `}</style>
              
              <button
                onClick={() => {
                  setShowGoTo(false);
                  setGoToValue('');
                }}
                className="absolute -top-2 -right-2 bg-magical-ink text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-magical-plum"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-2">
                <label className="text-xs font-sans font-medium text-magical-ink block">
                  Go to page
                </label>
                <Input
                  type="number"
                  min="1"
                  max={storybook.spreads.length}
                  value={goToValue}
                  onChange={(e) => setGoToValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGoToPage()}
                  className="w-16 text-center border rounded-lg text-sm"
                  placeholder="1"
                  autoFocus
                />
                <Button
                  onClick={handleGoToPage}
                  className="w-full bg-magical-ink text-white rounded-lg px-3 py-1 text-sm hover:bg-magical-plum"
                >
                  Go
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Review Modal */}
        <AnimatePresence>
          {showReviewModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            >
              <motion.div
                ref={reviewModalRef}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
                data-testid="review-modal"
              >
                {/* Close button */}
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                  data-testid="review-close-btn"
                >
                  <X className="w-5 h-5" />
                </button>

                {reviewSubmitted ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Star className="w-8 h-8 text-green-600 fill-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Thank you for your feedback!
                    </h3>
                    <p className="text-gray-500">
                      Your review has been submitted successfully.
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      Leave a Review
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Tell us about your experience with this storybook
                    </p>

                    {/* Star Rating */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Rating <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            onMouseEnter={() => setReviewHoverRating(star)}
                            onMouseLeave={() => setReviewHoverRating(0)}
                            className="focus:outline-none transition-transform hover:scale-110 p-1"
                            style={{ minWidth: '44px', minHeight: '44px' }}
                            data-testid={`star-${star}`}
                          >
                            <Star
                              className={`w-8 h-8 transition-colors ${
                                star <= (reviewHoverRating || reviewRating)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      {reviewRating > 0 && (
                        <p className="text-sm text-amber-600 mt-2">
                          {reviewRating === 1 && 'Poor'}
                          {reviewRating === 2 && 'Fair'}
                          {reviewRating === 3 && 'Good'}
                          {reviewRating === 4 && 'Very Good'}
                          {reviewRating === 5 && 'Excellent!'}
                        </p>
                      )}
                    </div>

                    {/* Review Text */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Review
                      </label>
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Share your experience with this storybook..."
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900"
                        data-testid="review-text-input"
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      onClick={handleSubmitReview}
                      disabled={reviewRating === 0 || submittingReview}
                      className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      data-testid="review-submit-btn"
                    >
                      {submittingReview ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Submitting...
                        </span>
                      ) : (
                        'Submit Review'
                      )}
                    </Button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CustomerViewer;
