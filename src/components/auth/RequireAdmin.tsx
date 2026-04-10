import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RequireAdminProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const { isAdmin, isRoleLoading } = useAuth();
  
  // Wait until roles are known
  if (isRoleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // Not admin - redirect to dashboard
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}
