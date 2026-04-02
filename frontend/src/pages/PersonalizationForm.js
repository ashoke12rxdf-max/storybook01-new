import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Loader2, CheckCircle, AlertCircle, Upload, X, Image as ImageIcon,
  Lock, Send, BookOpen, Eye, EyeOff, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Polling constants for post-submit status check
const STATUS_POLL_INTERVAL_MS = 2000;
const STATUS_MAX_POLLS = 60; // 2 minutes max

function PersonalizationForm() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [uploadingField, setUploadingField] = useState(null);
  
  // Post-submit polling state
  const [isPollingStatus, setIsPollingStatus] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [finalViewUrl, setFinalViewUrl] = useState(null);
  
  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch(`${API_URL}/api/personalization/session/${token}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Session not found. Please check your link.');
          } else if (response.status === 410) {
            setError('This session has expired. Please contact support.');
          } else {
            setError('Failed to load session. Please try again.');
          }
          return;
        }
        
        const data = await response.json();
        setSession(data);
        
        // Check if already completed
        if (data.status === 'completed' && data.customer_view_url) {
          setGenerationComplete(true);
          setFinalViewUrl(data.customer_view_url);
        }
        
        // Pre-fill form if data exists (for viewing submitted data)
        if (data.personalization_data && Object.keys(data.personalization_data).length > 0) {
          setFormData(data.personalization_data);
        }
        
      } catch (err) {
        console.error('Error loading session:', err);
        setError('Network error. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };
    
    loadSession();
  }, [token]);
  
  // Poll for generation status after submission
  const pollStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/personalization/session/${token}/status`);
      if (!response.ok) return false;
      
      const data = await response.json();
      
      if (data.status === 'completed' && data.customer_view_url) {
        setGenerationComplete(true);
        setFinalViewUrl(data.customer_view_url);
        setSession(prev => ({ ...prev, status: 'completed', customer_view_url: data.customer_view_url }));
        return true; // Stop polling
      }
      
      if (data.status === 'failed') {
        toast.error(data.error_message || 'Storybook generation failed. Please contact support.');
        setSession(prev => ({ ...prev, status: 'failed' }));
        return true; // Stop polling
      }
      
      return false; // Continue polling
    } catch {
      return false;
    }
  }, [token]);
  
  // Start polling after successful submission
  useEffect(() => {
    if (!isPollingStatus) return;
    
    let pollCount = 0;
    let timer = null;
    let stopped = false;
    
    const runPoll = async () => {
      if (stopped) return;
      pollCount++;
      
      const done = await pollStatus();
      if (done || stopped) {
        setIsPollingStatus(false);
        return;
      }
      
      if (pollCount >= STATUS_MAX_POLLS) {
        setIsPollingStatus(false);
        toast.info('Your storybook is still being generated. Check your email for the final link.');
        return;
      }
      
      timer = setTimeout(runPoll, STATUS_POLL_INTERVAL_MS);
    };
    
    runPoll();
    
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [isPollingStatus, pollStatus]);
  
  // Handle text input changes
  const handleInputChange = (fieldKey, value) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
    // Clear error when user types
    if (formErrors[fieldKey]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };
  
  // Handle image upload
  const handleImageUpload = async (fieldKey, file) => {
    if (!file) return;
    
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      toast.error('Please upload a JPG or PNG image');
      return;
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or less');
      return;
    }
    
    setUploadingField(fieldKey);
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('field_key', fieldKey);
      
      const response = await fetch(
        `${API_URL}/api/personalization/session/${token}/upload-image`,
        {
          method: 'POST',
          body: formDataUpload
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }
      
      const result = await response.json();
      
      // Store image data in form
      setFormData(prev => ({
        ...prev,
        [fieldKey]: {
          url: result.url,
          filename: result.filename,
          display_name: file.name
        }
      }));
      
      toast.success('Image uploaded successfully!');
      
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload image');
    } finally {
      setUploadingField(null);
    }
  };
  
  // Remove uploaded image
  const handleRemoveImage = (fieldKey) => {
    setFormData(prev => {
      const newData = { ...prev };
      delete newData[fieldKey];
      return newData;
    });
  };
  
  // Validate form
  const validateForm = () => {
    const errors = {};
    const fieldDefs = session?.field_definitions || [];
    
    fieldDefs.forEach(field => {
      const value = formData[field.field_key];
      
      // Skip validation for optional system fields (like view_password)
      if (field.is_system_field && !field.required) {
        return;
      }
      
      if (field.required) {
        if (field.type === 'image') {
          if (!value || !value.url) {
            errors[field.field_key] = `${field.label} is required`;
          }
        } else if (!value || (typeof value === 'string' && !value.trim())) {
          errors[field.field_key] = `${field.label} is required`;
        }
      }
      
      if (value && field.max_length && typeof value === 'string') {
        if (value.length > field.max_length) {
          errors[field.field_key] = `${field.label} must be ${field.max_length} characters or less`;
        }
      }
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    
    // Confirm submission (one-time only)
    const confirmed = window.confirm(
      'Are you sure you want to submit? You can only submit once and cannot make changes afterward.'
    );
    
    if (!confirmed) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${API_URL}/api/personalization/session/${token}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personalization_data: formData })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        
        if (response.status === 409) {
          toast.error('This form has already been submitted');
          // Reload to show locked state
          window.location.reload();
          return;
        }
        
        if (error.detail?.validation_errors) {
          const validationErrors = {};
          error.detail.validation_errors.forEach(err => {
            // Try to extract field name from error message
            const fieldDef = session.field_definitions.find(f => 
              err.toLowerCase().includes(f.label.toLowerCase())
            );
            if (fieldDef) {
              validationErrors[fieldDef.field_key] = err;
            }
          });
          setFormErrors(validationErrors);
          toast.error('Please fix the validation errors');
          return;
        }
        
        throw new Error(error.detail?.error || error.detail || 'Submission failed');
      }
      
      toast.success('Personalization submitted! Your storybook is being generated.');
      
      // Update session state to show generating
      setSession(prev => ({
        ...prev,
        status: 'submitted',
        form_locked: true
      }));
      
      // Start polling for completion
      setIsPollingStatus(true);
      
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your personalization form...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }
  
  const isLocked = session?.form_locked || session?.status === 'submitted' || session?.status === 'completed' || session?.status === 'processing';
  const fieldDefinitions = session?.field_definitions || [];
  
  // Check if there are no fields configured
  const hasNoFields = fieldDefinitions.length === 0 || 
    fieldDefinitions.every(f => f.is_system_field);
  
  // Separate user fields and system fields
  const userFields = fieldDefinitions.filter(f => !f.is_system_field);
  const systemFields = fieldDefinitions.filter(f => f.is_system_field);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            <BookOpen className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {session?.product_title || 'Your Storybook'}
          </h1>
          <p className="text-gray-500">
            Order Reference: <span className="font-mono">{session?.order_reference}</span>
          </p>
        </div>
        
        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* No Fields Error State */}
          {hasNoFields && !isLocked && (
            <div className="bg-yellow-50 border-b border-yellow-100 px-6 py-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-800 mb-1">
                    No personalization fields configured
                  </h3>
                  <p className="text-yellow-700 text-sm">
                    This storybook template doesn't have any personalization fields set up yet. 
                    Please contact support or check back later.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Instructions Banner */}
          {!isLocked && !hasNoFields && (
            <div className="bg-purple-50 border-b border-purple-100 px-6 py-4">
              <p className="text-purple-800 text-sm">
                <strong>Fill in the details below</strong> to personalize your storybook. 
                <span className="text-purple-600"> You can only submit once</span>, so please make sure everything is correct.
              </p>
            </div>
          )}
          
          {/* Generation Complete Banner */}
          {generationComplete && finalViewUrl && (
            <div className="bg-green-50 border-b border-green-100 px-6 py-6">
              <div className="flex items-center gap-2 text-green-800 mb-3">
                <CheckCircle className="w-6 h-6" />
                <span className="font-semibold text-lg">Your storybook is ready!</span>
              </div>
              <a 
                href={finalViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
                data-testid="view-storybook-link"
              >
                <ExternalLink className="w-5 h-5" />
                View Your Storybook
              </a>
              <p className="text-green-700 text-sm mt-3">
                A link has also been sent to your email.
              </p>
            </div>
          )}
          
          {/* Generating State */}
          {isPollingStatus && !generationComplete && (
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <div>
                  <span className="font-semibold text-blue-800">Generating your storybook...</span>
                  <p className="text-blue-600 text-sm mt-1">
                    This usually takes less than a minute. Please don't close this page.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Locked Banner (submitted but not generation complete yet) */}
          {isLocked && !generationComplete && !isPollingStatus && (
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-4">
              <div className="flex items-center gap-2 text-amber-800">
                <Lock className="w-5 h-5" />
                <span className="font-medium">
                  {session?.status === 'processing' 
                    ? 'Your storybook is being generated...' 
                    : session?.status === 'failed'
                    ? 'Generation failed. Please contact support.'
                    : 'Form submitted. Processing your storybook...'}
                </span>
              </div>
              {session?.customer_view_url && (
                <a 
                  href={session.customer_view_url}
                  className="inline-flex items-center gap-2 mt-3 text-amber-700 hover:text-amber-800 font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  View Your Storybook
                </a>
              )}
            </div>
          )}
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* User-defined fields */}
            {userFields.map(field => (
              <FieldInput
                key={field.field_key}
                field={field}
                value={formData[field.field_key]}
                error={formErrors[field.field_key]}
                disabled={isLocked}
                uploading={uploadingField === field.field_key}
                onChange={(value) => handleInputChange(field.field_key, value)}
                onUpload={(file) => handleImageUpload(field.field_key, file)}
                onRemoveImage={() => handleRemoveImage(field.field_key)}
                token={token}
              />
            ))}
            
            {/* System fields (like password) - shown in a separate section */}
            {systemFields.length > 0 && !isLocked && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Optional Settings</h3>
                {systemFields.map(field => (
                  <FieldInput
                    key={field.field_key}
                    field={field}
                    value={formData[field.field_key]}
                    error={formErrors[field.field_key]}
                    disabled={isLocked}
                    uploading={uploadingField === field.field_key}
                    onChange={(value) => handleInputChange(field.field_key, value)}
                    onUpload={(file) => handleImageUpload(field.field_key, file)}
                    onRemoveImage={() => handleRemoveImage(field.field_key)}
                    token={token}
                  />
                ))}
              </div>
            )}
            
            {/* Submit Button */}
            {!isLocked && !hasNoFields && (
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="submit-personalization-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit & Generate My Storybook
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-gray-400 mt-3">
                  By submitting, you confirm all details are correct. This cannot be undone.
                </p>
              </div>
            )}
          </form>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Made with love by <span className="text-purple-600 font-medium">Storybook Vault</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// Field Input Component
function FieldInput({ 
  field, value, error, disabled, uploading, 
  onChange, onUpload, onRemoveImage, token 
}) {
  const fileInputRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const baseInputClass = `w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
    error ? 'border-red-300 bg-red-50' : 'border-gray-200'
  } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`;
  
  // Password input (for system view_password field)
  if (field.type === 'password') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={field.placeholder}
            maxLength={field.max_length}
            className={`${baseInputClass} pr-12`}
            data-testid={`field-${field.field_key}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {field.help_text && !error && (
          <p className="text-xs text-gray-400 mt-1">{field.help_text}</p>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
  
  // Text input
  if (field.type === 'text') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          maxLength={field.max_length}
          className={baseInputClass}
          data-testid={`field-${field.field_key}`}
        />
        {field.help_text && !error && (
          <p className="text-xs text-gray-400 mt-1">{field.help_text}</p>
        )}
        {field.max_length && (
          <p className="text-xs text-gray-400 mt-1 text-right">
            {(value || '').length} / {field.max_length}
          </p>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
  
  // Textarea
  if (field.type === 'textarea') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          maxLength={field.max_length}
          rows={4}
          className={`${baseInputClass} resize-none`}
          data-testid={`field-${field.field_key}`}
        />
        {field.help_text && !error && (
          <p className="text-xs text-gray-400 mt-1">{field.help_text}</p>
        )}
        {field.max_length && (
          <p className="text-xs text-gray-400 mt-1 text-right">
            {(value || '').length} / {field.max_length}
          </p>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
  
  // Date input
  if (field.type === 'date') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseInputClass}
          data-testid={`field-${field.field_key}`}
        />
        {field.help_text && !error && (
          <p className="text-xs text-gray-400 mt-1">{field.help_text}</p>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
  
  // Select dropdown
  if (field.type === 'select') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseInputClass}
          data-testid={`field-${field.field_key}`}
        >
          <option value="">Select an option...</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {field.help_text && !error && (
          <p className="text-xs text-gray-400 mt-1">{field.help_text}</p>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
  
  // Image upload
  if (field.type === 'image') {
    const imageUrl = value?.url ? `${API_URL}${value.url}` : null;
    
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {!imageUrl && !disabled && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              error ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
            }`}
          >
            {uploading ? (
              <Loader2 className="w-10 h-10 text-purple-600 mx-auto mb-2 animate-spin" />
            ) : (
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            )}
            <p className="text-sm text-gray-600">
              {uploading ? 'Uploading...' : 'Click to upload image'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG or PNG, max 5MB
            </p>
          </div>
        )}
        
        {imageUrl && (
          <div className="relative inline-block">
            <img
              src={imageUrl}
              alt="Preview"
              className="max-w-xs h-auto rounded-lg border border-gray-200"
            />
            {!disabled && (
              <button
                type="button"
                onClick={onRemoveImage}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {value?.display_name && (
              <p className="text-xs text-gray-500 mt-1">{value.display_name}</p>
            )}
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          onChange={(e) => onUpload(e.target.files?.[0])}
          className="hidden"
          disabled={disabled || uploading}
          data-testid={`field-${field.field_key}`}
        />
        
        {field.help_text && !error && (
          <p className="text-xs text-gray-400 mt-2">{field.help_text}</p>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
  
  // Unknown field type
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-sm text-yellow-800">
        Unknown field type: {field.type}
      </p>
    </div>
  );
}

export default PersonalizationForm;
