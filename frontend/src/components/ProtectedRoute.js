import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // Admin access is open - no password required
  return children;
};

export default ProtectedRoute;
