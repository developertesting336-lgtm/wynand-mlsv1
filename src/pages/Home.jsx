import React, { useEffect } from 'react';
import HeroSection from '../components/home/HeroSection';
import TrustBanner from '../components/home/TrustBanner';
import FeaturedListings from '../components/home/FeaturedListings';
import CTASection from '../components/home/CTASection';

export default function Home() {
  useEffect(() => {
    // Set document meta titles and descriptions
    document.title = 'PV Verified Rentals | Trusted Long-Term Rentals in Puerto Vallarta';
    
    // Add meta description dynamically
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', 'Explore secure, verified long-term apartment and villa rentals in Puerto Vallarta. Protect your deposit with our verified rental platform.');

    // Add JSON-LD schema markup
    const schemaId = 'seo-home-schema';
    let scriptTag = document.getElementById(schemaId);
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = schemaId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "RealEstateAgent",
      "name": "PV Verified Rentals",
      "url": "https://pvverified.com",
      "logo": "https://pvverified.com/logo.png",
      "description": "Trusted long-term rentals in Puerto Vallarta, Jalisco. Clean verified landlord listings.",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Puerto Vallarta",
        "addressRegion": "Jalisco",
        "addressCountry": "MX"
      }
    });

    return () => {
      // Clean up script tag on unmount
      const existing = document.getElementById(schemaId);
      if (existing) existing.remove();
    };
  }, []);

  return (
    <div>
      <HeroSection />
      <TrustBanner />
      <FeaturedListings />
      <CTASection />
    </div>
  );
}