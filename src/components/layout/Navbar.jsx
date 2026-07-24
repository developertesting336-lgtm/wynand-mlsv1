import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, ShieldCheck, Search, PlusCircle, LayoutDashboard, DollarSign, Users, Heart, UserCircle, KeyRound, Handshake, Building2, UserCog, Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { registerPushNotifications, checkPushSubscription, unsubscribePushNotifications } from '@/utils/pushNotification';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, login, logout } = useAuth();
  const [verification, setVerification] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const role = user?.role || 'renter';

  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState('checking'); // 'checking', 'subscribed', 'unsubscribed', 'denied', 'unsupported'
  const [showPrompt, setShowPrompt] = useState(false);
  const [notifLimit, setNotifLimit] = useState(10);
  const [hasMoreNotifs, setHasMoreNotifs] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    // Check push subscription status
    checkPushSubscription(user.id).then(status => setPushStatus(status));

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(notifLimit + 1);
      if (!error && data) {
        if (data.length > notifLimit) {
          setNotifications(data.slice(0, notifLimit));
          setHasMoreNotifs(true);
        } else {
          setNotifications(data);
          setHasMoreNotifs(false);
        }
      }
    };

    fetchNotifications();

    // load verification record to pick profile_photo if present
    supabase.from('verifications').select('profile_photo').eq('user_id', user.id).maybeSingle().then(res => {
      if (!res.error) setVerification(res.data || null);
    }).catch(() => {});

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new, ...prev].slice(0, notifLimit));
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new : n)
            );
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, notifLimit]);

  // Refresh verification photo when other parts of the app notify about updates
  useEffect(() => {
    const handler = () => {
      if (!user?.id) return;
      supabase.from('verifications').select('profile_photo').eq('user_id', user.id).maybeSingle().then(res => {
        if (!res.error) setVerification(res.data || null);
      }).catch(() => {});
    };
    window.addEventListener('app:user-updated', handler);
    return () => window.removeEventListener('app:user-updated', handler);
  }, [user]);

  useEffect(() => {
    if (user && user.role !== 'admin' && pushStatus === 'unsubscribed') {
      const dismissedAt = localStorage.getItem('push_prompt_dismissed_at');
      const oneHour = 60 * 60 * 1000;
      if (!dismissedAt || Date.now() - parseInt(dismissedAt, 10) > oneHour) {
        const timer = setTimeout(() => setShowPrompt(true), 3000);
        return () => clearTimeout(timer);
      }
    } else {
      setShowPrompt(false);
    }
  }, [user, pushStatus]);

  const handleDismissPrompt = () => {
    localStorage.setItem('push_prompt_dismissed_at', Date.now().toString());
    setShowPrompt(false);
  };

  const handleEnableFromPrompt = async () => {
    setShowPrompt(false);
    const res = await registerPushNotifications(user.id);
    if (res.success) {
      setPushStatus('subscribed');
      setShowPrompt(false);
    } else if (res.error === 'permission_denied') {
      setPushStatus('denied');
      setShowPrompt(false);
      alert('Notification permission was denied. Please allow notifications in your browser settings.');
    } else {
      alert('Could not enable push notifications: ' + res.error);
    }
  };

  const handleTogglePush = async () => {
    if (pushStatus === 'subscribed') {
      const res = await unsubscribePushNotifications(user.id);
      if (res.success) setPushStatus('unsubscribed');
    } else {
      const res = await registerPushNotifications(user.id);
      if (res.success) {
        setPushStatus('subscribed');
      } else if (res.error === 'permission_denied') {
        setPushStatus('denied');
        alert('Notification permission was denied. Please allow notifications in your browser settings.');
      } else {
        alert('Could not enable push notifications: ' + res.error);
      }
    }
  };


  const handleMarkAsRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) {
      console.error("Failed to mark notification as read:", error);
      toast.error(`Failed to update notification: ${error.message}`);
    } else {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (error) {
      console.error("Failed to mark all as read:", error);
      toast.error(`Failed to update notifications: ${error.message}`);
    } else {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
    }
  };


  const handleLogout = async () => {
    localStorage.removeItem('push_prompt_dismissed_at');
    try {
      await logout();
      navigate('/');
    } catch (e) {
      // fallback redirect
      try { window.location.href = '/'; } catch (_) {}
    }
  };


  const navLinks = [
    { to: '/pricing', icon: DollarSign, label: 'Pricing', roles: ['renter'], requiresAuth: false },
    { to: '/listings', icon: Search, label: 'Browse', roles: ['renter', 'agent', 'owner', 'admin'], requiresAuth: false },
    { to: '/agents', icon: Users, label: 'Agents', roles: ['renter', 'owner', 'admin'], requiresAuth: false },
    { to: '/admin', icon: UserCog, label: 'Admin Panel', roles: ['admin'], requiresAuth: true },
    { to: '/refer', icon: Handshake, label: 'Refer & Earn', roles: ['renter', 'agent', 'owner'], requiresAuth: false },
    { to: '/dashboard', icon: UserCircle, label: 'My Dashboard', roles: ['renter'], requiresAuth: true },
    { to: '/owner-dashboard', icon: Building2, label: 'Owner Dashboard', roles: ['owner'], requiresAuth: true },
    { to: '/agent-dashboard', icon: LayoutDashboard, label: 'Agent Dashboard', roles: ['agent'], requiresAuth: true },
    { to: '/agent-billing', icon: LayoutDashboard, label: 'Billing', roles: [], requiresAuth: true },
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
          <div className="flex items-center justify-between h-[100px]">
            <Link to="/" className="flex items-center shrink-0">
              <img src="/logo.png" alt="PV Verified Logo" className="h-[80px] w-auto object-contain" />
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
                  {/* Notification Dropdown */}
                  {role !== 'admin' && (
                    <div className="relative" ref={notifRef}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative h-9 w-9 rounded-full"
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                      >
                        <Bell className="h-5 w-5 text-muted-foreground" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-5 rounded-full bg-red-500 px-1.5 flex items-center justify-center text-[10px] font-semibold text-white">
                            <span className="animate-ping absolute inset-0 rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative z-10">{unreadCount}</span>
                          </span>
                        )}
                      </Button>

                      {isNotifOpen && (
                        <>
                          <div className="absolute right-0 mt-2 w-80 bg-white border border-border shadow-xl rounded-xl z-50 py-2 max-h-[350px] overflow-y-auto">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 pb-2">
                              <span className="font-semibold text-sm">Notifications</span>
                              {unreadCount > 0 && (
                                <button
                                  onClick={handleMarkAllAsRead}
                                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium animate-fade-in"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                                </button>
                              )}
                            </div>

                            <div className="divide-y divide-border/50">
                              {notifications.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  No notifications yet
                                </div>
                              ) : (
                                notifications.map((n) => (
                                  <div
                                    key={n.id}
                                    className={`p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 relative ${!n.is_read ? 'bg-primary/5' : ''}`}
                                    onClick={() => handleMarkAsRead(n.id)}
                                  >
                                    {!n.is_read && (
                                      <span className="absolute top-4 right-3 h-2 w-2 rounded-full bg-primary" />
                                    )}
                                    <div className="font-semibold text-xs text-foreground pr-4">{n.title}</div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5 pr-4 leading-normal">{n.message}</div>
                                    <div className="text-[9px] text-muted-foreground/60 mt-1">
                                      {new Date(n.created_at).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {hasMoreNotifs && (
                              <div className="p-2 border-t text-center bg-slate-50/50">
                                <button
                                  onClick={() => setNotifLimit(prev => prev + 10)}
                                  className="text-xs text-primary hover:underline font-semibold w-full py-1.5"
                                >
                                  Load More
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{role}</span>
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setIsProfileMenuOpen(prev => !prev)}
                      className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center"
                      aria-label="Open profile menu"
                    >
                      <Avatar className="w-8 h-8">
                        {(verification?.profile_photo || user.photo_url) ? (
                          <AvatarImage src={verification?.profile_photo || user.photo_url} alt="Profile" />
                        ) : (
                          <AvatarFallback>{user?.full_name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                        )}
                      </Avatar>
                    </button>

                    {isProfileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-44 bg-white border border-border rounded-xl shadow-xl z-50 py-2">
                        <Link
                          to={role === 'admin' ? '/admin' : '/profile'}
                          className="block text-sm px-4 py-2 hover:bg-muted"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          Profile
                        </Link>
                        <button
                          onClick={() => { setIsProfileMenuOpen(false); handleLogout(); }}
                          className="w-full text-left text-sm px-4 py-2 hover:bg-muted"
                        >
                          Log out
                        </button>
                      </div>
                    )}
                  </div>
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
        <div className="md:hidden fixed inset-0 top-[100px] z-40 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
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
                  <div className="flex flex-col gap-2 px-4 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setIsProfileMenuOpen(prev => !prev)}
                            className="rounded-full overflow-hidden flex items-center justify-center"
                            aria-label="Open profile menu"
                          >
                            <Avatar className="w-10 h-10">
                              {(verification?.profile_photo || user.photo_url) ? (
                                <AvatarImage src={verification?.profile_photo || user.photo_url} alt="Profile" />
                              ) : (
                                <AvatarFallback>{user?.full_name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                              )}
                            </Avatar>
                          </button>
                          <div>
                            <span className="text-sm font-medium">{user.full_name ? user.full_name.split(' ')[0] : ''}</span>
                            <span className="text-xs text-muted-foreground block">{role}</span>
                          </div>
                        </div>

                        {isProfileMenuOpen && (
                          <div className="mt-3 border-t pt-3">
                            <div className="flex flex-col gap-2 px-4 py-2">
                              <Link to={role === 'admin' ? '/admin' : '/profile'} className="text-sm text-foreground hover:text-primary transition-colors">
                                Profile
                              </Link>
                              <Button variant="outline" size="sm" onClick={handleLogout}>Log out</Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={handleLogout}>Log out</Button>
                    </div>

                    {/* Mobile Notifications Area */}
                    {role !== 'admin' && (
                      <div className="mt-3 border-t pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notifications ({unreadCount})</span>
                          {unreadCount > 0 && (
                            <button onClick={handleMarkAllAsRead} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                            </button>
                          )}
                        </div>

                        <div className="max-h-48 overflow-y-auto divide-y divide-border/50 border rounded-lg bg-muted/20">
                          {notifications.length === 0 ? (
                            <div className="p-3 text-center text-xs text-muted-foreground">
                              No notifications yet
                            </div>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n.id}
                                className={`p-3 text-left relative transition-colors cursor-pointer hover:bg-muted/50 ${!n.is_read ? 'bg-primary/5' : ''}`}
                                onClick={() => handleMarkAsRead(n.id)}
                              >
                                {!n.is_read && (
                                  <span className="absolute top-4 right-3 h-2 w-2 rounded-full bg-primary" />
                                )}
                                <div className="font-semibold text-xs text-foreground pr-4">{n.title}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 pr-4 leading-normal">{n.message}</div>
                                <div className="text-[9px] text-muted-foreground/60 mt-1">
                                  {new Date(n.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            ))
                          )}

                          {hasMoreNotifs && (
                            <div className="p-2 border-t text-center bg-slate-50/50">
                              <button
                                onClick={() => setNotifLimit(prev => prev + 10)}
                                className="text-xs text-primary hover:underline font-semibold w-full py-1"
                              >
                                Load More
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button className="w-full h-12 text-base" onClick={login}>Sign In</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showPrompt && role !== 'admin' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] sm:w-full bg-white border border-border shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top duration-300">
          <div className="flex gap-3">
            <div className="p-2 bg-primary/10 rounded-xl h-fit">
              <Bell className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-foreground">Enable Push Notifications</h4>
              <p className="text-xs text-muted-foreground mt-1">Get updates on your subscription expiry and account activities in real time.</p>
              <div className="flex items-center gap-2 mt-3 justify-end">
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={handleDismissPrompt}>
                  Maybe Later
                </Button>
                <Button size="sm" className="text-xs font-semibold h-8" onClick={handleEnableFromPrompt}>
                  Enable
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}