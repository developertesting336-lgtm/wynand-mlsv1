import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  const navigate = useNavigate();
  const { user, isAuthenticated, login } = useAuth();

  const handleListProperty = (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      login();
      return;
    }

    if (user?.role === 'renter' || user?.role === 'tenant') {
      navigate('/dashboard');
      return;
    }

    navigate('/submit-property');
  };
  return (
    <footer className="bg-foreground text-background/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg text-white">PV Verified Rentals</span>
            </div>
            <p className="text-sm text-background/60 leading-relaxed">
              No scams. No outdated listings. Just verified rentals in Puerto Vallarta.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <div className="space-y-2 text-sm">
              <Link to="/listings" className="block hover:text-primary transition-colors">Browse Rentals</Link>
              <button type="button" onClick={handleListProperty} className="block hover:text-primary transition-colors text-left">List Your Property</button>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Neighborhoods</h4>
            <div className="space-y-2 text-sm">
              <Link to="/listings?neighborhood=romantica" className="block text-background/60 hover:text-primary transition-colors">Zona Romántica</Link>
              <Link to="/listings?neighborhood=marina_vallarta" className="block text-background/60 hover:text-primary transition-colors">Marina Vallarta</Link>
              <Link to="/listings?neighborhood=nuevo_vallarta" className="block text-background/60 hover:text-primary transition-colors">Nuevo Vallarta</Link>
              <Link to="/listings?neighborhood=centro" className="block text-background/60 hover:text-primary transition-colors">Centro</Link>
              <Link to="/listings?neighborhood=conchas_chinas" className="block text-background/60 hover:text-primary transition-colors">Conchas Chinas</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-background/10 mt-8 pt-8 text-center text-sm text-background/40">
          © {new Date().getFullYear()} PV Verified Rentals. All rights reserved.
        </div>
      </div>
    </footer>
  );
}