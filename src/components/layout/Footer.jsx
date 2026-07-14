import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export default function Footer() {
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
              <Link to="/submit-property" className="block hover:text-primary transition-colors">List Your Property</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Neighborhoods</h4>
            <div className="space-y-2 text-sm text-background/60">
              <p>Zona Romántica</p>
              <p>Marina Vallarta</p>
              <p>Nuevo Vallarta</p>
              <p>Centro</p>
              <p>Conchas Chinas</p>
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