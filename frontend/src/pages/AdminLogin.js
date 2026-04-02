import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

const AdminLogin = () => {
  const navigate = useNavigate();

  // Auto-redirect to admin dashboard - no password required
  useEffect(() => {
    navigate('/admin/dashboard', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-magical-ink">
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1759731224815-87d2706c076c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwzfHxjb3p5JTIwbWFnaWNhbCUyMGxpYnJhcnklMjByZWFkaW5nJTIwbm9vayUyMHdhcm0lMjBsaWdodGluZ3xlbnwwfHx8fDE3NzM3NDkzMTJ8MA&ixlib=rb-4.1.0&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-floating p-10 border border-magical-moon/20">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-magical-ink rounded-full mb-4">
              <BookOpen className="w-8 h-8 text-magical-cream" />
            </div>
            <h1 className="text-4xl font-serif text-magical-ink mb-2" data-testid="login-heading">
              Storybook Vault
            </h1>
            <p className="text-magical-plum font-sans text-sm mb-6">
              Redirecting to Admin...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-magical-ink mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
