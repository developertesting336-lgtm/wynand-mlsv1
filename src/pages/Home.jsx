import React from 'react';
import HeroSection from '../components/home/HeroSection';
import TrustBanner from '../components/home/TrustBanner';
import FeaturedListings from '../components/home/FeaturedListings';
import CTASection from '../components/home/CTASection';

export default function Home() {
  return (
    <div>
      <HeroSection />
      <TrustBanner />
      <FeaturedListings />
      <CTASection />
    </div>
  );
}