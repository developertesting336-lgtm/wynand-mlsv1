import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, ShieldCheck, Search, PlusCircle, LayoutDashboard, DollarSign, Users, Heart, UserCircle, KeyRound, Handshake, Building2, UserCog } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, login, logout } = useAuth();
  const location = useLocation();

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  const role = user?.role || 'renter';

  const navLinks = [
    { to: '/pricing', icon: DollarSign, label: 'Pricing', roles: ['renter', 'owner'], requiresAuth: false },
    { to: '/listings', icon: Search, label: 'Browse', roles: ['renter', 'agent', 'owner', 'admin'], requiresAuth: false },
    { to: '/agents', icon: Users, label: 'Agents', roles: ['renter', 'agent', 'owner', 'admin'], requiresAuth: false },
    { to: '/admin', icon: UserCog, label: 'Admin Panel', roles: ['admin'], requiresAuth: true },
    { to: '/refer', icon: Handshake, label: 'Refer & Earn', roles: ['renter', 'agent', 'owner'], requiresAuth: false },
    { to: '/dashboard', icon: UserCircle, label: 'My Dashboard', roles: ['renter'], requiresAuth: true },
    { to: '/owner-dashboard', icon: Building2, label: 'Owner Dashboard', roles: ['owner'], requiresAuth: true },
    { to: '/agent-dashboard', icon: LayoutDashboard, label: 'Agent Dashboard', roles: ['agent'], requiresAuth: true },
    { to: '/agent-billing', icon: LayoutDashboard, label: 'Billing', roles: ['agent'], requiresAuth: true },
    { to: '/favorites', icon: Heart, label: 'Favorites', roles: [], requiresAuth: true },
    { to: '/submit-property', icon: PlusCircle, label: 'List Property', roles: ['agent', 'owner'], requiresAuth: true },
  ];

  const visibleLinks = navLinks.filter(link => {
    // If user is not authenticated, only show public links
    if (!user && link.requiresAuth) {
      return false;
    }
    // If user is authenticated, check if their role has access
    return link.roles.includes(role);
  });

  const isActive = (to) => location.pathname === to;

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <ShieldCheck className="w-7 h-7 text-primary" />
              <span className="font-bold text-base tracking-tight">PV Verified</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {visibleLinks.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-2 ${isActive(to) ? 'text-primary bg-primary/5' : ''}`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </Button>
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{role}</span>
                  <Link to={role === 'admin' ? '/admin' : '/profile'} className="text-sm text-foreground hover:text-primary transition-colors max-w-[140px] truncate">
                    {user.full_name ? user.full_name.split(' ')[0] : user.email}
                  </Link>
                  <Button variant="outline" size="sm" onClick={logout}>Log out</Button>
                </div>
              ) : (
                <Button size="sm" onClick={login}>Sign In</Button>
              )}
            </div>

            <button
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {isOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="bg-white border-b shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {visibleLinks.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to}>
                  <button className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${isActive(to) ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}>
                    <Icon className="w-5 h-5" /> {label}
                  </button>
                </Link>
              ))}
              <div className="pt-2 pb-1 border-t mt-2">
               {user ? (
                  <div className="flex items-center justify-between px-4 py-2">
                    <div>
                      <Link to={role === 'admin' ? '/admin' : '/profile'} className="text-sm text-foreground hover:text-primary transition-colors truncate max-w-[200px] block">
                        {user.full_name ? user.full_name.split(' ')[0] : user.email}
                      </Link>
                      <span className="text-xs text-muted-foreground">{role}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={logout}>Log out</Button>
                  </div>
                ) : (
                  <Button className="w-full h-12 text-base" onClick={login}>Sign In</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}