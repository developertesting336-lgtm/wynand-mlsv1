import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowRight, Key } from 'lucide-react';

export default function CTASection() {
  return (
    <section className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/20 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Key className="w-4 h-4" /> Off-Market Access
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Get Access to Off-Market Rentals
            </h2>
            <p className="text-background/60 mt-4 text-lg leading-relaxed">
              Many of our best properties never make it to the public listings. Sign up to get exclusive access to verified off-market rentals in Puerto Vallarta.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link to="/submit-property">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  List Your Property <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/listings">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto border-background/20 text-white hover:bg-background/10">
                  Browse All Rentals
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[
              { icon: ShieldCheck, label: 'Verified Listings', desc: 'Every property confirmed within 48 hours' },
              { icon: Key, label: 'Trusted Agents', desc: 'Vetted professionals you can count on' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-background/5 rounded-2xl p-6 border border-background/10">
                <Icon className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-semibold text-white">{label}</h3>
                <p className="text-sm text-background/50 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}