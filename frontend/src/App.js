import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import AdminLogin from './components/AdminLogin';
import Register from './components/Register';
import Navbar from './components/Navbar';
import AdminDashboard from './components/AdminDashboardNew';
import RecoverWalletPage from './components/RecoverWalletPage';
import ChangePasswordPage from './components/ChangePasswordPage';
import RequireAuth from './auth/RequireAuth';
import RequireAdmin from './auth/RequireAdmin';
import { useAuth } from './auth/useAuth';
import WithdrawPage from './components/WithdrawPage';
import TransactionHistoryPage from './components/TransactionHistoryPage';
import DepositPage from './components/DepositPage';
import SupportPage from './components/SupportPage';

// Routes that have their own built-in navigation — hide the global Navbar there
const ROUTES_WITH_OWN_NAV = [
  '/dashboard',
  '/admin',
  '/transactions',
  '/settings/withdraw',
  '/recover-wallet',
  '/change-password',
  '/deposit',
  '/support',
];

function AppContent() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const hideNavbar = ROUTES_WITH_OWN_NAV.some(r => location.pathname === r || location.pathname.startsWith(r + '/'));

  return (
    <div className="app-container">
      {isAuthenticated && !hideNavbar && <Navbar user={user} onLogout={logout} />}
      <Routes>
          <Route 
            path="/login" 
            element={!isAuthenticated ? <Login /> : (user?.isAdmin ? <Navigate to="/admin" /> : <Navigate to="/dashboard" />)} 
          />
          <Route 
            path="/admin-login" 
            element={!isAuthenticated ? <AdminLogin /> : <Navigate to="/admin" />} 
          />
          <Route 
            path="/register" 
            element={<Navigate to="/login" />} 
          />
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated && user?.isAdmin
                ? <Navigate to="/admin" replace />
                : <RequireAuth><Dashboard /></RequireAuth>
            } 
          />
          <Route
            path="/change-password"
            element={
              <RequireAuth>
                <ChangePasswordPage />
              </RequireAuth>
            }
          />
          <Route
            path="/recover-wallet"
            element={
              <RequireAuth>
                <RecoverWalletPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings/withdraw"
            element={
              <RequireAuth>
                <WithdrawPage />
              </RequireAuth>
            }
          />
          <Route
            path="/transactions"
            element={
              <RequireAuth>
                <TransactionHistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/deposit"
            element={
              <RequireAuth>
                <DepositPage />
              </RequireAuth>
            }
          />
          <Route
            path="/support"
            element={
              <RequireAuth>
                <SupportPage />
              </RequireAuth>
            }
          />
          <Route 
            path="/admin" 
            element={
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            } 
          />
          <Route 
            path="/" 
            element={<Navigate to={!isAuthenticated ? "/login" : user?.isAdmin ? "/admin" : "/dashboard"} />} 
          />
        </Routes>
      </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
