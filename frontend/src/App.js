import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import '@/App.css';
import AdminLogin from '@/pages/AdminLogin';
import AdminPanel from '@/pages/AdminPanel';
import PreviewStudio from '@/pages/PreviewStudio';
import CustomerViewer from '@/pages/CustomerViewer';
import DiagnosticPage from '@/pages/DiagnosticPage';
import PersonalizationSuccess from '@/pages/PersonalizationSuccess';
import PersonalizationForm from '@/pages/PersonalizationForm';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="/admin/studio/:storybookId" element={
            <ProtectedRoute>
              <PreviewStudio />
            </ProtectedRoute>
          } />
          <Route path="/view/:slug" element={<CustomerViewer />} />
          <Route path="/debug" element={<DiagnosticPage />} />
          
          {/* Personalization Routes */}
          <Route path="/personalization/success" element={<PersonalizationSuccess />} />
          <Route path="/personalize/:token" element={<PersonalizationForm />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
