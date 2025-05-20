import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, role }) => {
  const { isLoggedIn, user } = useSelector((state) => state.auth);

  if (!isLoggedIn) return <Navigate to="/crm/login" />;
  if (role && ![role].flat().includes(user?.role)) return <Navigate to="/crm" />;

  return children;
};

export default ProtectedRoute;
