import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function PersonalizationSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Preparing your personalization form...');
  const [pollCount, setPollCount] = useState(0);
  const [viewUrl, setViewUrl] = useState(null);
  
  const checkoutId = searchParams.get('checkout_id');
  
  const maxPolls = 15; // 30 seconds (2s intervals)
  
  useEffect(() => {
    if (!checkoutId) {
      setStatus('error');
      setMessage('Missing checkout ID. Please check your email for the personalization link.');
      return;
    }
    
    let intervalId = null;
    let localPollCount = 0;
    let isRedirecting = false;
    
    const checkSession = async () => {
      if (isRedirecting) return true;
      
      try {
        const response = await fetch(
          `${API_URL}/api/personalization/by-checkout?checkout_id=${checkoutId}`
        );
        const data = await response.json();
        
        if (data.status === 'ready') {
          // Session is ready - redirect to form
          isRedirecting = true;
          setStatus('success');
          setMessage('Redirecting to your personalization form...');
          setTimeout(() => {
            navigate(data.redirect_url);
          }, 1000);
          return true;
          
        } else if (data.status === 'submitted' || data.status === 'completed') {
          // Already submitted
          setStatus('completed');
          setMessage('Your storybook has already been personalized!');
          setViewUrl(data.customer_view_url);
          return true;
          
        } else if (data.status === 'not_found') {
          // Keep polling
          localPollCount++;
          setPollCount(localPollCount);
          
          if (localPollCount >= maxPolls) {
            setStatus('timeout');
            setMessage('Taking longer than expected. Please check your email for the personalization link.');
            return true;
          }
          return false;
          
        } else {
          // Still processing
          localPollCount++;
          setPollCount(localPollCount);
          return false;
        }
      } catch (error) {
        console.error('Error checking session:', error);
        localPollCount++;
        setPollCount(localPollCount);
        
        if (localPollCount >= maxPolls) {
          setStatus('timeout');
          setMessage('Taking longer than expected. Please check your email for the personalization link.');
          return true;
        }
        return false;
      }
    };
    
    // Initial check
    checkSession().then(done => {
      if (!done) {
        // Start polling
        intervalId = setInterval(async () => {
          const isDone = await checkSession();
          if (isDone && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }, 2000);
      }
    });
    
    // Cleanup on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [checkoutId, navigate]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        {/* Logo/Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-purple-600">Storybook Vault</h1>
          <p className="text-gray-500 mt-1">Personalized Stories</p>
        </div>
        
        {/* Status Icon */}
        <div className="mb-6">
          {status === 'loading' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          )}
          {status === 'completed' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          )}
          {(status === 'error' || status === 'timeout') && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full">
              {status === 'timeout' ? (
                <Clock className="w-8 h-8 text-amber-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-amber-600" />
              )}
            </div>
          )}
        </div>
        
        {/* Status Message */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {status === 'loading' && 'Payment Successful!'}
          {status === 'success' && 'Ready!'}
          {status === 'completed' && 'Already Personalized'}
          {status === 'timeout' && 'Still Processing'}
          {status === 'error' && 'Something Went Wrong'}
        </h2>
        
        <p className="text-gray-600 mb-6">{message}</p>
        
        {/* Progress indicator for polling */}
        {status === 'loading' && (
          <div className="mb-6">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-600 transition-all duration-500"
                style={{ width: `${Math.min((pollCount / maxPolls) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Please wait while we prepare your form...
            </p>
          </div>
        )}
        
        {/* View button for completed storybooks */}
        {status === 'completed' && viewUrl && (
          <a
            href={viewUrl}
            className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            View Your Storybook
          </a>
        )}
        
        {/* Help text for timeout/error */}
        {(status === 'timeout' || status === 'error') && (
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-600">
              <strong>What to do:</strong>
            </p>
            <ul className="text-sm text-gray-500 mt-2 space-y-1">
              <li>• Check your email for the personalization link</li>
              <li>• The link might take a few minutes to arrive</li>
              <li>• Contact support if you don't receive it within 10 minutes</li>
            </ul>
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Thank you for your purchase! Your personalized storybook is almost ready.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PersonalizationSuccess;
