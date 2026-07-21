import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, User, MessageSquare, ShieldAlert, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function InquiryReplies({ inquiry, currentUserId, currentUserName, currentUserRole, onBack }) {
  const [replies, setReplies] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvedInquiryId, setResolvedInquiryId] = useState(null);
  const [isSynthetic, setIsSynthetic] = useState(false);
  const [agentChatTarget, setAgentChatTarget] = useState('tenant'); // 'tenant' or 'owner'
  const [ownerInfo, setOwnerInfo] = useState(null);
  const chatEndRef = useRef(null);
  
  // Refs to track current values in real-time subscription (avoid stale closures)
  const currentUserRoleRef = useRef(currentUserRole);
  const agentChatTargetRef = useRef(agentChatTarget);
  
  // Update refs when values change
  useEffect(() => {
    currentUserRoleRef.current = currentUserRole;
  }, [currentUserRole]);
  
  useEffect(() => {
    agentChatTargetRef.current = agentChatTarget;
  }, [agentChatTarget]);

  useEffect(() => {
    if (!inquiry?.listing_owner_id) {
      setOwnerInfo(null);
      return;
    }
    const fetchOwner = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', inquiry.listing_owner_id)
          .single();
        if (!error && data) {
          setOwnerInfo(data);
        }
      } catch (err) {
        console.error('Error fetching owner info:', err);
      }
    };
    fetchOwner();
  }, [inquiry?.listing_owner_id]);

  const conversationInfo = useMemo(() => {
    if (!inquiry) return null;
    const agentId = inquiry.agent_id;
    const agentEmail = inquiry.agent_email;
    let mySide = null;
    let otherSide = null;
    let canChat = false;

    if (currentUserRole === 'renter') {
      mySide = { type: 'renter', email: inquiry.email };
      otherSide = { type: 'agent', id: agentId, email: agentEmail };
      canChat = !!agentId || !!agentEmail;
    } else if (currentUserRole === 'owner') {
      // Owner communicates with agent only
      mySide = { type: 'owner', id: currentUserId };
      otherSide = { type: 'agent', id: agentId, email: agentEmail };
      canChat = !!agentId || !!agentEmail;
    } else if (currentUserRole === 'agent') {
      mySide = { type: 'agent', id: currentUserId, email: currentUserName };
      otherSide = [
        inquiry.email ? { type: 'renter', email: inquiry.email, name: inquiry.name } : null,
        inquiry.listing_owner_id ? { type: 'owner', id: inquiry.listing_owner_id } : null,
      ].filter(Boolean);
      canChat = true;
    }

    return { mySide, otherSide, canChat };
  }, [inquiry, currentUserRole]);

  useEffect(() => {
    if (!inquiry?.id) {
      setLoading(false);
      return;
    }

    // Use the inquiry ID directly - never create new records
    setResolvedInquiryId(inquiry.id);
    setIsSynthetic(false);
    loadReplies(inquiry.id);

    // Set up real-time subscription
    let realtimeConnected = false;
    const channel = supabase
      .channel(`inquiry-replies-${inquiry.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inquiry_replies',
          filter: `inquiry_id=eq.${inquiry.id}`,
        },
        (payload) => {
          console.log('[Real-time] New reply received:', payload.new);
          const newReply = payload.new;
          
          // Check if this reply should be visible to current user
          const shouldShow = checkIfReplyVisible(newReply);
          
          if (shouldShow) {
            setReplies(prev => {
              // Avoid duplicates
              if (prev.some(r => r.id === newReply.id)) {
                return prev;
              }
              return [...prev, newReply];
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Real-time] Subscription status for inquiry ${inquiry.id}:`, status);
        if (status === 'SUBSCRIBED') realtimeConnected = true;
      });

    // Polling fallback for when real-time is unavailable (every 8s)
    const pollInterval = setInterval(() => {
      if (realtimeConnected) return; // skip poll if real-time is working
      loadReplies(inquiry.id);
    }, 8000);

    // Cleanup subscription + polling on unmount
    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [inquiry?.id]);

  const checkIfReplyVisible = (reply, roleOverride, chatTargetOverride) => {
    const role = roleOverride || currentUserRoleRef.current;
    const chatTarget = chatTargetOverride || agentChatTargetRef.current;
    
    if (role === 'agent') {
      if (chatTarget === 'tenant') {
        return (
          reply.sender_role === 'renter' ||
          (reply.sender_role === 'agent' && reply.recipient_type === 'tenant') ||
          reply.recipient_type === 'both'
        );
      } else {
        return (
          reply.sender_role === 'owner' ||
          (reply.sender_role === 'agent' && reply.recipient_type === 'owner')
        );
      }
    }
    
    // For renter and owner
    if (reply.sender_id === currentUserId) return true;
    if (reply.sender_role === 'agent') {
      if (role === 'renter' && (reply.recipient_type === 'tenant' || reply.recipient_type === 'both')) return true;
      if (role === 'owner' && reply.recipient_type === 'owner') return true;
    }
    return false;
  };

  const loadReplies = async (inquiryId) => {
    if (!inquiryId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('inquiry_replies')
        .select('*')
        .eq('inquiry_id', inquiryId)
        .order('created_date', { ascending: true });

      if (error) throw error;
      setReplies(data || []);
    } catch (err) {
      console.error('[InquiryReplies] Load error:', err);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleSend = async () => {
    if (!message.trim() || !resolvedInquiryId || !conversationInfo?.canChat) return;
    setSending(true);
    const replyMessage = message.trim();

    try {
      const newReplyId = crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      
      let recipientType = 'both';
      if (currentUserRole === 'renter') {
        recipientType = 'agent';
      } else if (currentUserRole === 'owner') {
        recipientType = 'agent';
      } else if (currentUserRole === 'agent') {
        recipientType = agentChatTarget;
      }
      
      const replyPayload = {
        id: newReplyId,
        inquiry_id: resolvedInquiryId,
        sender_id: currentUserId || 'unknown',
        sender_name: currentUserName || 'Unknown',
        sender_role: currentUserRole || 'renter',
        recipient_type: recipientType,
        message: replyMessage,
        created_date: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('inquiry_replies')
        .insert(replyPayload);

      if (error) {
        console.error('[InquiryReplies] Insert error:', error);
        toast.error('Failed to send reply');
        setSending(false);
        return;
      }

      setReplies(prev => [...prev, replyPayload]);
      setMessage('');
    } catch (err) {
      console.error('[InquiryReplies] Error:', err);
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getVisibleReplies = () => {
    if (!replies.length) return [];
    // Use live state values (not refs) so filtering is correct during render
    return replies.filter(reply => checkIfReplyVisible(reply, currentUserRole, agentChatTarget));
  };

  const visibleReplies = getVisibleReplies();
  const canChat = conversationInfo?.canChat || false;

  // Determine what to show in the header based on user role
  const headerInfo = useMemo(() => {
    const agentLabel = inquiry.agent_name || inquiry.agent_email || inquiry.agent_id || 'Agent';
    
    if (currentUserRole === 'owner') {
      // Owner sees agent info, not tenant info
      return {
        name: agentLabel,
        subtitle: inquiry.listing_title ? `Inquiry for ${inquiry.listing_title}` : 'Property Inquiry',
        hideMessage: true, // Don't show the tenant's message
      };
    } else if (currentUserRole === 'renter') {
      // Renter sees agent info
      return {
        name: agentLabel,
        subtitle: inquiry.listing_title ? `Inquiry for ${inquiry.listing_title}` : 'Property Inquiry',
        hideMessage: true,
      };
    }
    
    if (agentChatTarget === 'owner') {
      const ownerLabel = ownerInfo ? (ownerInfo.full_name || ownerInfo.email) : 'Property Owner';
      return {
        name: ownerLabel,
        subtitle: inquiry.listing_title ? `Owner for: ${inquiry.listing_title}` : 'Property Owner',
        hideMessage: true,
      };
    }
    // Agent sees renter info
    return {
      name: inquiry.name,
      subtitle: `${format(new Date(inquiry.created_date), 'MMM d, yyyy h:mm a')}${inquiry.budget ? ` · Budget: $${inquiry.budget}/mo` : ''}`,
      hideMessage: false,
    };
  }, [inquiry, currentUserRole, agentChatTarget, ownerInfo]);

  // No synthetic state handling - just show the chat

  return (
    <div className="flex flex-col h-full">
      <div className="bg-muted/30 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-1 -ml-2 mr-1 rounded-full hover:bg-muted shrink-0 text-muted-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{headerInfo.name}</p>
            <p className="text-xs text-muted-foreground">{headerInfo.subtitle}</p>
          </div>
        </div>
        {!headerInfo.hideMessage && inquiry.message && (
          <div className="mt-2 ml-10 p-3 bg-white rounded-lg border text-sm text-muted-foreground">
            {inquiry.message}
          </div>
        )}
        {!canChat && (
          <div className="mt-2 ml-10 flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-amber-800">
              {currentUserRole === 'renter' && !inquiry.agent_email
                ? 'No agent assigned to this listing yet.'
                : currentUserRole === 'owner' && !inquiry.agent_email
                ? 'No agent assigned to this listing yet.'
                : 'You do not have permission to participate in this conversation.'}
            </p>
          </div>
        )}
      </div>

      {currentUserRole === 'agent' && (
        <div className="flex border-b bg-muted/10">
          <button
            onClick={() => setAgentChatTarget('tenant')}
            className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 transition-all ${
              agentChatTarget === 'tenant'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5'
            }`}
          >
            Chat with Renter ({inquiry.name || 'Tenant'})
          </button>
          <button
            onClick={() => setAgentChatTarget('owner')}
            className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 transition-all ${
              agentChatTarget === 'owner'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5'
            }`}
          >
            Chat with Owner ({ownerInfo ? (ownerInfo.full_name || ownerInfo.email) : 'Owner'})
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin mx-auto" />
          </div>
        ) : visibleReplies.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {canChat ? 'No messages yet. Start the conversation!' : 'Waiting for agent to join...'}
            </p>
          </div>
        ) : (
          visibleReplies.map((reply, idx) => {
            const isMe = reply.sender_id === currentUserId;
            return (
              <div key={reply.id || idx} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className={`max-w-[75%] ${isMe ? 'order-1' : ''}`}>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                    isMe 
                      ? 'bg-primary text-primary-foreground rounded-br-md' 
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}>
                    <p className="font-medium text-xs mb-0.5 opacity-80">
                      {isMe ? 'You' : reply.sender_name}
                      {reply.sender_role !== 'renter' && !isMe && (
                        <span className="ml-1 opacity-60">({reply.sender_role})</span>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{reply.message}</p>
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-0.5 ${isMe ? 'text-right' : 'text-left'}`}>
                    {format(new Date(reply.created_date), 'MMM d, h:mm a')}
                  </p>
                </div>
                {isMe && (
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="border-t p-4 bg-white">
        {canChat ? (
          <div className="flex gap-2 items-end">
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="flex-1 text-sm resize-none"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="shrink-0 h-[58px] w-[58px] rounded-xl"
            >
              <Send className={`w-4 h-4 ${sending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ) : (
          <div className="text-center py-3 text-sm text-muted-foreground bg-muted/30 rounded-lg">
            {currentUserRole === 'renter' && !inquiry.agent_email
              ? 'You can only communicate through an agent.'
              : currentUserRole === 'owner' && !inquiry.agent_email
              ? 'You can only communicate through an agent.'
              : 'You do not have permission to reply in this conversation.'}
          </div>
        )}
      </div>
    </div>
  );
}