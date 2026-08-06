import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '@/lib/AuthContext';
import VerificationBlockingModal from '../profile/VerificationBlockingModal';

export default function AppLayout() {
  const { user } = useAuth();
  const [modalDismissed, setModalDismissed] = useState(false);

  // Admins, renters, and tenants do not require blocking verification modal checks
  const needsVerification = user && 
    user.role !== 'admin' && 
    user.role !== 'renter' && 
    user.role !== 'tenant' && 
    !modalDismissed;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {needsVerification && (
        <VerificationBlockingModal
          user={user}
          onComplete={() => setModalDismissed(true)}
        />
      )}
    </div>
  );
}