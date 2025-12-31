import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../context/StoreContext';
import { ChatRoom, ChatMessage } from '../types';
import { Send, Plus, Users, Hash, MessageSquare, MoreVertical, X, Search, FileText, Reply, Paperclip, Download, ExternalLink, ArrowLeft, Trash2, Pencil, Pin, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

export default function ChatModule() {
  const store = useAppStore();
  const toast = useToast();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  
  // Reply State
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  
  // Create Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  // Mention State
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const mentionCandidates = mentionSearch !== null 
    ? store.users.filter(u => 
        (activeRoom?.memberIds?.includes(u.id)) && 
        (u.name.toLowerCase().includes(mentionSearch.toLowerCase()) || 
         u.username.toLowerCase().includes(mentionSearch.toLowerCase()))
      )
    : [];

  // Edit State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFetchRef = useRef<number>(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [draftAttachment, setDraftAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeRoomMenuId, setActiveRoomMenuId] = useState<string | null>(null); // For sidebar menus
  
  // Pin State
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
       el.scrollIntoView({ behavior: 'smooth', block: 'center' });
       setHighlightedMessageId(msgId);
       setTimeout(() => setHighlightedMessageId(null), 2000); // Remove highlight after 2s
    } else {
       toast.error('Message is not in current view (try scrolling up)');
    }
  };

  // Close menus on click outside
  useEffect(() => {
     const closeMenus = () => { setActiveMenuId(null); setActiveRoomMenuId(null); };
     window.addEventListener('click', closeMenus);
     return () => window.removeEventListener('click', closeMenus);
  }, []);

  const fetchPinnedMessage = useCallback(async () => {
     try {
       const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/messages/pin?roomId=${activeRoomId}`, {
         headers: { 'Authorization': `Bearer ${store.authToken}` }
       });
       if(res.ok) {
         const data = await res.json();
         setPinnedMessage(data.pinnedMessage);
       }
     } catch(e) {}
  }, [activeRoomId, store.authToken]);

  // Poll Pinned Message
  useEffect(() => {
    if(!activeRoomId) return;
    
    // Initial fetch
    fetchPinnedMessage();

    // Ideally, pinned message updates should come via websocket or polled
    // Let's add it to the message poller logic or separate poller
    const interval = setInterval(fetchPinnedMessage, 10000); 
    return () => clearInterval(interval);
  }, [activeRoomId, fetchPinnedMessage]);

  const handleTogglePinMessage = async (msg: ChatMessage) => {
     try {
       const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/messages/pin`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.authToken}` },
         body: JSON.stringify({ messageId: msg.id })
       });
       if(res.ok) { 
          toast.success('Pin updated');
          fetchPinnedMessage(); // Refresh header
          // Ideally update local message state too if we show icon on message
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isPinned: !m.isPinned } : m));
       } else {
          toast.error('Failed to pin (Access Denied?)');
       }
     } catch(e) { toast.error('Error pinning'); }
  };

  const handleTogglePinRoom = async (roomId: string, e: React.MouseEvent) => {
     e.stopPropagation();
     try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/rooms/pin`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.authToken}` },
           body: JSON.stringify({ roomId })
        });
        if(res.ok) {
           toast.success('Channel pinned');
           // Optimistic update
           setRooms(prev => prev.map(r => r.id === roomId ? { ...r, isPinned: !r.isPinned } : r).sort((a,b) => (Number(b.isPinned)-Number(a.isPinned))));
           fetchRooms(); // Sync
        }
     } catch(e) { toast.error('Error toggling pin'); }
  };



  const fetchRooms = useCallback(async () => {
    try {
      if (!store.authToken) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/rooms`, {
        headers: { 'Authorization': `Bearer ${store.authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [store.authToken]);

  // 1. Poll Rooms
  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000); // Poll rooms every 10s
    return () => clearInterval(interval);
  }, [fetchRooms]);

  // 2. Poll Messages
  useEffect(() => {
    if (!activeRoomId) return;

    // Reset messages when room changes, BUT keep replying empty
    setMessages([]);
    setReplyingTo(null); 
    lastFetchRef.current = 0;
    setHasMoreHistory(true); // Reset history tracker
    fetchMessages();
    
    const markAsRead = async () => {
       try {
         await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/unread`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.authToken}` },
            body: JSON.stringify({ roomId: activeRoomId })
         });
         // Clear unread count locally for immediate feedback
         setRooms(prev => prev.map(r => r.id === activeRoomId ? { ...r, unreadCount: 0 } : r));
       } catch(e) {}
    };
    markAsRead();

    const interval = setInterval(() => {
        fetchMessages();
        // Also keep marking read as long as we stay in room? 
        // Not strictly necessary unless we want to clear badge while chatting live.
        // Let's keep it simple: mark read on entry and maybe on send/receive is implicit via UI focus. 
        // For now, mark on entry & every fetch is safest for "live" unread clearing.
        markAsRead(); 
    }, 3000); 
    
    return () => clearInterval(interval);
  }, [activeRoomId]);

  const fetchMessages = async () => {
    if (!activeRoomId || !store.authToken) return;
    try {
      // Use polling timestamp (after) to get only NEW messages
      const url = `${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/messages?roomId=${activeRoomId}&after=${lastFetchRef.current}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${store.authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const newMsgs: ChatMessage[] = Array.isArray(data) ? data : (data.messages || []);
        
        // Update Realtime Read Status
        if (!Array.isArray(data) && data.readStatus) {
           setRooms(prev => prev.map(r => r.id === activeRoomId ? { ...r, readStatus: data.readStatus } : r));
        }

        if (newMsgs.length > 0) {
          // Check scroll position before state update
          const container = messagesContainerRef.current;
          const isNearBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight < 150) : true;
          const isInitialLoad = lastFetchRef.current === 0;

          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNew = newMsgs.filter(m => !existingIds.has(m.id));
            if (uniqueNew.length === 0) return prev;
            
            // Update timestamp marker
            const lastMsg = newMsgs[newMsgs.length - 1];
            lastFetchRef.current = Math.max(lastFetchRef.current, lastMsg.createdAt);
            
            return [...prev, ...uniqueNew].sort((a,b) => a.createdAt - b.createdAt);
          });
          
          if (isInitialLoad || isNearBottom) setTimeout(scrollToBottom, 100);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadHistory = async () => {
    if (!activeRoomId || isLoadingHistory || !hasMoreHistory || messages.length === 0) return;
    setIsLoadingHistory(true);
    
    try {
       const oldestMsg = messages[0];
       const url = `${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/messages?roomId=${activeRoomId}&before=${oldestMsg.createdAt}`;
       const res = await fetch(url, { headers: { 'Authorization': `Bearer ${store.authToken}` } });
       
       if (res.ok) {
          const data = await res.json();
          // Compatible with new API format
          const historyMsgs: ChatMessage[] = Array.isArray(data) ? data : (data.messages || []);
          
          if (historyMsgs.length > 0) {
             const container = messagesContainerRef.current;
             const oldScrollHeight = container ? container.scrollHeight : 0;
             const oldScrollTop = container ? container.scrollTop : 0;

             setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const uniqueHistory = historyMsgs.filter(m => !existingIds.has(m.id));
                // Sort combined: History + Prev
                return [...uniqueHistory, ...prev].sort((a,b) => a.createdAt - b.createdAt);
             });

             // Restore scroll position after render
             requestAnimationFrame(() => {
                if (container) {
                   container.scrollTop = container.scrollHeight - oldScrollHeight + oldScrollTop;
                }
             });
          } else {
             setHasMoreHistory(false);
          }
       }
    } catch(e) { console.error(e); }
    setIsLoadingHistory(false);
  };
  
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
     if (e.currentTarget.scrollTop === 0) {
        loadHistory();
     }
  };


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (isSending) return;
    if (!activeRoomId || ( (!inputText.trim()) && !draftAttachment )) return;
    setIsSending(true);
    
    try {
      let attachmentUrl = '';
      let content = inputText;

      // 1. Upload Attachment if exists
      if (draftAttachment) {
         try {
            attachmentUrl = await store.uploadFile(draftAttachment);
            if (!inputText.trim()) {
               // Auto caption if empty
               const ext = draftAttachment.name.split('.').pop()?.toUpperCase() || 'FILE';
               content = draftAttachment.type.startsWith('image/') ? 'Sent an image' : `Sent a ${ext} file`;
            }
         } catch(e) {
            toast.error('Failed to upload attachment');
            setIsSending(false);
            return;
         }
      }

      const payload = { 
          roomId: activeRoomId, 
          content: content,
          attachmentUrl: attachmentUrl || undefined,
          replyToId: replyingTo?.id
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/messages`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${store.authToken}` 
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setInputText('');
        setReplyingTo(null);
        setDraftAttachment(null); // Clear draft
        fetchMessages();
      }
    } catch (e) {
      toast.error('Failed to send');
    }
    setIsSending(false);
  };

  const handleUpdateMessage = async () => {
     if (!editingMessageId || !inputText.trim()) return;
     try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/messages`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.authToken}` },
           body: JSON.stringify({ messageId: editingMessageId, content: inputText })
        });
        if (res.ok) {
           toast.success('Message updated');
           
           // Manually update local state for realtime feel
           setMessages(prev => prev.map(m => 
              m.id === editingMessageId ? { ...m, content: inputText } : m
           ));

           setEditingMessageId(null);
           setInputText('');
        }
     } catch(e) { toast.error('Failed to update'); }
  };

  const startEditing = (msg: ChatMessage) => {
     setEditingMessageId(msg.id);
     setInputText(msg.content);
     setReplyingTo(null);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setInputText('');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
             setDraftAttachment(blob);
             // Don't prevent default, user might want to paste text too? 
             // Ideally prevent default if it's ONLY an image.
             // But let's allow text paste. But if image is found, we grab it.
          }
        }
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoomId) return;
    setDraftAttachment(file);
    
    // Reset input so same file can be selected again if cancelled
    e.target.value = '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    // Mention Detection
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1) {
       // Check if the cursor is near the @ (simple heuristic: if @ is within last 20 chars)
       // A robust editor like SlateJS is better, but this is simple text input.
       // We assume the user is typing a name after the last @
       const query = val.slice(lastAt + 1);
       if (query.length < 20 && !query.includes(' ')) { // Simple restriction: no spaces for now to avoid false positives? 
          // Actually names have spaces. Let's allow spaces but limit length
          setMentionSearch(query);
          return;
       } 
       // If query has spaces, maybe we still support it if it matches a name?
       // For now, strict 'no space' or 'space allowed'? 
       // Let's allow spaces if it matches a user prefix. 
       if (query.length < 20) {
           setMentionSearch(query);
           return;
       }
    }
    setMentionSearch(null);
  };

  const insertMention = (username: string) => {
      if (mentionSearch === null) return;
      const lastAt = inputText.lastIndexOf('@');
      const newValue = inputText.slice(0, lastAt) + `@${username} ` + inputText.slice(lastAt + mentionSearch.length + 1);
      setInputText(newValue);
      setMentionSearch(null);
  };

  const handleDeleteRoom = async () => {
    if (!activeRoomId || activeRoomId === 'general') return;
    if (!confirm('Are you sure you want to delete this channel? ALL messages will be lost for EVERYONE.')) return;
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/rooms?id=${activeRoomId}`, {
         method: 'DELETE',
         headers: { 'Authorization': `Bearer ${store.authToken}` }
      });
      if (res.ok) {
         toast.success('Channel deleted');
         setActiveRoomId(null);
         fetchRooms();
      } else {
         toast.error('Failed to delete');
      }
    } catch(e) {
      toast.error('Error deleting channel');
    }
  };

  const renderContentWithMentions = (text: string) => {
    const regex = /(@\w+)/g;
    return text.split(regex).map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="text-blue-500 font-bold bg-blue-50 px-1 rounded cursor-pointer hover:underline">{part}</span>;
      }
      return part;
    });
  };

  const handleCreateRoom = async () => { 
    if (!newRoomName) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.authToken}` },
        body: JSON.stringify({ name: newRoomName, type: 'GROUP', memberIds: [store.currentUser?.id, ...selectedMembers] })
      });
      if (res.ok) {
        toast.success('Channel created!');
        setIsCreatingRoom(false); setNewRoomName(''); setSelectedMembers([]); fetchRooms();
      }
    } catch (e) { toast.error('Failed to create room'); }
  };

  const handleAddMember = async () => { 
    if (!activeRoomId || selectedMembers.length === 0) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/rooms/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.authToken}` },
        body: JSON.stringify({ roomId: activeRoomId, userIds: selectedMembers })
      });
      if (res.ok) {
        toast.success('Members added!'); setIsAddingMember(false); setSelectedMembers([]);
      }
    } catch (e) { toast.error('Failed to add members'); }
  };
  
  const toggleMemberSelection = (uid: string) => {
    if (selectedMembers.includes(uid)) setSelectedMembers(s => s.filter(id => id !== uid));
    else setSelectedMembers(s => [...s, uid]);
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-[80vh] md:h-[calc(100vh-140px)] bg-white rounded-[1rem] md:rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden font-sans relative">
      
      {/* SIDEBAR */}
      <div className={`
        w-full md:w-80 bg-slate-50 border-r border-slate-100 flex-col
        ${activeRoomId ? 'hidden md:flex' : 'flex'} 
      `}>
         <div className="p-4 md:p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Channels</h2>
            <button onClick={() => setIsCreatingRoom(true)} className="p-3 bg-slate-200 rounded-full hover:bg-slate-300 transition active:scale-95">
              <Plus size={18} className="text-slate-700"/>
            </button>
          </div>
          <div className="relative">
             <Search size={14} className="absolute left-3 top-3 text-slate-400" />
             <input className="w-full bg-white pl-9 pr-4 py-3 rounded-xl text-xs font-bold border-none shadow-sm focus:ring-2 focus:ring-blue-100" placeholder="Search..." />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 space-y-2">
           {rooms.map(room => (
             <button 
               key={room.id}
               onClick={() => setActiveRoomId(room.id)}
               className={`w-full text-left p-4 rounded-2xl transition-all duration-200 group flex items-start space-x-3 
                 ${activeRoomId === room.id ? 'bg-white shadow-lg shadow-blue-100 ring-1 ring-slate-100' : 'hover:bg-white/60 active:bg-white'}
               `}
             >
                <div className={`p-3 rounded-xl flex-shrink-0 relative ${activeRoomId === room.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                   {room.type === 'GROUP' ? <Hash size={20} /> : <Users size={20} />}
                   {(room.unreadCount || 0) > 0 && activeRoomId !== room.id && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-white animate-pulse">
                         {(room.unreadCount || 0) > 9 ? '9+' : room.unreadCount}
                      </div>
                   )}
                </div>
                  <div className="flex-1 min-w-0 pr-6 relative">
                     <div className="flex justify-between items-baseline mb-1">
                        <div className="flex items-center space-x-1 min-w-0">
                           <h4 className={`text-sm font-bold truncate ${activeRoomId === room.id ? 'text-slate-900' : 'text-slate-700'}`}>{room.name}</h4>
                           {room.isPinned && <Pin size={10} className="fill-amber-500 text-amber-500 flex-shrink-0" />}
                        </div>
                        {room.lastMessage && <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">{formatTime(Number(room.lastMessage.timestamp))}</span>}
                     </div>
                     
                     {room.lastMessage ? (
                        <p className={`text-xs truncate ${activeRoomId === room.id ? 'text-slate-500' : 'text-slate-400'}`}>
                          <span className="font-bold">{room.lastMessage.senderName}:</span> {room.lastMessage.content}
                        </p>
                     ) : <p className="text-[10px] text-slate-300 italic">No messages yet</p>}

                     {/* Room Actions Menu Button - Absolute Positioned */}
                     <div className={`absolute -right-2 top-0 ${activeRoomId === room.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button 
                            onClick={(e) => {
                               e.stopPropagation();
                               setActiveRoomMenuId(activeRoomMenuId === room.id ? null : room.id);
                            }}
                            className="p-1 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600"
                        >
                           <MoreVertical size={16} />
                        </button>
                        
                        {activeRoomMenuId === room.id && (
                           <div className="absolute right-0 top-6 w-32 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in zoom-in-95 duration-100 origin-top-right">
                              <button 
                                onClick={(e) => handleTogglePinRoom(room.id, e)}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center space-x-2"
                              >
                                 <Pin size={12} /> <span>{room.isPinned ? 'Unpin' : 'Pin'}</span>
                              </button>
                              {room.id !== 'general' && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteRoom(); }} 
                                    className="w-full text-left px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center space-x-2"
                                  >
                                     <Trash2 size={12} /> <span>Delete</span>
                                  </button>
                              )}
                           </div>
                        )}
                     </div>
                  </div>
             </button>
           ))}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`
        flex-1 flex-col bg-white h-full relative min-w-0
        ${!activeRoomId ? 'hidden md:flex' : 'flex'}
      `}>
        {activeRoom ? (
          <>
            {/* HEADER */}
            <div className="h-16 md:h-20 border-b border-slate-50 px-4 md:px-8 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-30 shadow-sm md:shadow-none">
               <div className="flex items-center space-x-3 md:space-x-4 overflow-hidden">
                  {/* Back Button for Mobile */}
                  <button 
                    onClick={() => setActiveRoomId(null)}
                    className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-full"
                  >
                    <ArrowLeft size={24} />
                  </button>

                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex-shrink-0 flex items-center justify-center">
                     <Hash size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-black text-slate-800 truncate">{activeRoom.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{activeRoom.memberIds?.length || 0} MEMBERS</p>
                  </div>
               </div>
               <div className="flex items-center space-x-2 flex-shrink-0">
                  {activeRoomId !== 'general' && (
                    <button onClick={handleDeleteRoom} className="p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition" title="Delete Channel">
                        <Trash2 size={20} />
                    </button>
                  )}
                  <button onClick={() => setIsAddingMember(true)} className="flex items-center space-x-2 p-2 md:px-4 md:py-2 bg-slate-50 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition">
                     <Users size={16} /> <span className="hidden md:inline">Add People</span>
                  </button>
               </div>
            </div>
            
            {/* PINNED MESSAGE BANNER - Safe Overflow */}
            {pinnedMessage && (
               <div 
                  onClick={() => scrollToMessage(pinnedMessage.id)}
                  className="bg-amber-50 border-b border-amber-100 px-4 py-2 z-20 shrink-0 w-full max-w-full cursor-pointer hover:bg-amber-100 transition active:scale-[0.99]"
               >
                  <div className="flex items-center space-x-3 overflow-hidden w-full">
                     <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <Pin size={16} className="fill-amber-600" />
                     </div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-wide">Pinned Message</p>
                        <p className="text-xs font-medium text-slate-700 truncate w-full">{pinnedMessage.content || 'Attachment'}</p>
                     </div>
                  </div>
               </div>
            )}

            {/* MESSAGES LIST */}
            <div 
               ref={messagesContainerRef} 
               onScroll={onScroll}
               className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 bg-slate-50/30"
            >
               {isLoadingHistory && (
                  <div className="flex justify-center py-2">
                     <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">Loading History...</span>
                  </div>
               )}
               {messages.map((msg, idx) => {
                 const isMe = msg.senderId === store.currentUser?.id;
                 const showHeader = idx === 0 || messages[idx-1].senderId !== msg.senderId || (msg.createdAt - messages[idx-1].createdAt > 300000); 
                 
                 return (
                   <div 
                     key={msg.id} 
                     id={`msg-${msg.id}`}
                     className={`group flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300 p-1 rounded-xl transition-all ${highlightedMessageId === msg.id ? 'bg-amber-100 ring-2 ring-amber-400 shadow-lg' : ''}`}
                   >
                      <div className={`max-w-[85%] md:max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                         {showHeader && !isMe && (
                           <div className="mb-1 ml-1 flex items-baseline space-x-2">
                             <span 
                               className="text-xs font-black text-slate-700 cursor-pointer hover:text-blue-600"
                               onClick={() => setInputText(prev => `${prev}@${msg.senderName?.replace(/\s/g,'')} `)}
                             >
                               {msg.senderName}
                             </span>
                             <span className="text-[10px] text-slate-400 capitalize">{msg.senderRole?.toLowerCase()}</span>
                           </div>
                         )}
                         
                         {/* Reply Bubble */}
                         <div className="relative group/msg max-w-full">
                            {/* Message Actions Menu (Three Dots) */ }
                            <div className={`absolute top-2 ${isMe ? '-left-8' : '-right-8'} opacity-0 group-hover/msg:opacity-100 transition-opacity z-10 md:block hidden`}>
                                <button className="p-1.5 rounded-full bg-slate-100/50 hover:bg-white text-slate-400 hover:text-blue-600 border border-slate-200 shadow-sm transition" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === msg.id ? null : msg.id); }}>
                                    <MoreVertical size={14} />
                                </button>
                                {activeMenuId === msg.id && (
                                    <div className={`absolute top-7 ${isMe ? 'right-0' : 'left-0'} w-32 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 origin-top z-[60]`} onClick={e=>e.stopPropagation()}>
                                        <button onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50"><Reply size={14}/><span>Reply</span></button>
                                        {isMe && !msg.attachmentUrl && <button onClick={() => { startEditing(msg); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50"><Pencil size={14}/><span>Edit</span></button>}
                                        <button onClick={() => { handleTogglePinMessage(msg); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Pin size={14}/><span>{msg.isPinned ? 'Unpin' : 'Pin'}</span></button>
                                    </div>
                                )}
                            </div>
                            

                            

                            


                            <div className={`relative px-4 py-3 md:px-5 md:py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm break-words whitespace-pre-wrap
                                ${isMe 
                                  ? 'bg-slate-900 text-white rounded-br-none' 
                                  : 'bg-white text-slate-600 rounded-bl-none border border-slate-100'
                                }`}
                            >
                                {/* Quoted Reply Content */}
                                {msg.replyToMessage && (
                                   <div className={`mb-2 pl-3 border-l-2 ${isMe ? 'border-slate-600 bg-slate-800/50' : 'border-blue-400 bg-blue-50'} p-2 rounded text-xs opacity-80 select-none`}>
                                      <p className={`font-bold ${isMe ? 'text-slate-300' : 'text-blue-600'}`}>{msg.replyToMessage.senderName}</p>
                                      <p className="truncate line-clamp-1">{msg.replyToMessage.content}</p>
                                   </div>
                                )}

                                {msg.attachmentUrl && (
                                   <div className="mb-3">
                                      {/* File Type Detection logic */}
                                      {(() => {
                                         const url = msg.attachmentUrl || '';
                                         const ext = url.split('.').pop()?.toLowerCase();
                                         const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '') || url.includes('image'); 
                                         
                                         if (isImage) {
                                            return (
                                              <div className="relative group/img cursor-pointer" onClick={() => window.open(url, '_blank')}>
                                                <img src={url} className="w-full max-w-[200px] md:max-w-xs max-h-60 object-cover rounded-xl border border-slate-200" alt="Attachment" />
                                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition rounded-xl flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                                   <ExternalLink className="text-white drop-shadow-md" size={24}/>
                                                </div>
                                              </div>
                                            );
                                         }
                                         
                                         let fileName = 'Attachment';
                                         try {
                                            const path = new URL(url).pathname;
                                            fileName = path.split('/').pop() || 'File';
                                         } catch(e) {}

                                         return (
                                            <div className="flex items-center space-x-3 bg-white/50 p-2 md:p-3 rounded-xl border border-slate-200/50 hover:bg-white transition cursor-pointer group/file" onClick={() => window.open(url, '_blank')}>
                                               <div className="p-2 bg-slate-200 rounded-lg text-slate-500">
                                                  <FileText size={20} />
                                               </div>
                                               <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{fileName}</p>
                                                  <p className="text-[9px] text-slate-400 font-bold uppercase">{ext?.toUpperCase() || 'FILE'}</p>
                                               </div>
                                               <div className="p-2 text-slate-400 group-hover/file:text-blue-600 transition">
                                                  <Download size={16} />
                                               </div>
                                            </div>
                                         );
                                      })()}
                                   </div>
                                )}
                                
                                {renderContentWithMentions(msg.content)}
                                 
                                 <div className="flex items-center justify-end space-x-1 mt-1 opacity-70">
                                     {msg.isPinned && <Pin size={10} className="fill-amber-500 text-amber-500 mr-1" />}
                                     <span className={`text-[9px] ${isMe ? 'text-slate-400' : 'text-slate-300'}`}>
                                       {formatTime(msg.createdAt)} {msg.edited && '(edited)'}
                                     </span>
                                     
                                     {/* Seen By Logic - Only for my latest message */}
                                     {isMe && idx === messages.length - 1 && activeRoom?.readStatus && (
                                       <div className="flex -space-x-1 ml-1">
                                          {Object.entries(activeRoom.readStatus)
                                             .filter(([uid, ts]) => uid !== store.currentUser?.id && ts >= msg.createdAt)
                                             .map(([uid]) => {
                                                const user = store.users.find(u => u.id === uid);
                                                if (!user) return null;
                                                return (
                                                   <div key={uid} className="w-3 h-3 rounded-full border border-white bg-slate-300" title={`Seen by ${user.name}`}>
                                                      {user.avatarUrl ? (
                                                         <img src={user.avatarUrl} className="w-full h-full rounded-full object-cover" />
                                                      ) : (
                                                         <div className="w-full h-full bg-green-500 rounded-full" />
                                                      )}
                                                   </div>
                                                );
                                             })
                                          }
                                       </div>
                                     )}
                                 </div>
                             </div>
                          </div>
                       </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
             </div>

            {/* INPUT AREA */}
            <div className="p-3 md:p-6 bg-white border-t border-slate-50 z-20 relative shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
               {/* Replying Status Bar */}
               {replyingTo && (
                  <div className="absolute -top-12 left-2 right-2 md:left-6 md:right-6 h-12 bg-slate-50 border border-slate-200 border-b-0 rounded-t-xl flex items-center justify-between px-4 animate-in slide-in-from-bottom-2 fade-in duration-200 shadow-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                          <Reply size={14} className="text-blue-500 shrink-0" />
                          <div className="flex flex-col">
                              <span className="text-[10px] font-black text-blue-500 uppercase">Replying to {replyingTo.senderName}</span>
                              <span className="text-xs text-slate-500 truncate max-w-[200px] line-clamp-1">{replyingTo.content}</span>
                          </div>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-rose-100 hover:text-rose-500 rounded-full transition">
                          <X size={16} />
                      </button>
                  </div>
               )}

               {editingMessageId && (
                  <div className="absolute -top-12 left-2 right-2 md:left-6 md:right-6 h-12 bg-amber-50 border border-amber-200 border-b-0 rounded-t-xl flex items-center justify-between px-4 animate-in slide-in-from-bottom-2 fade-in duration-200 shadow-sm">
                      <div className="flex items-center gap-2">
                          <Pencil size={14} className="text-amber-600 shrink-0" />
                          <span className="text-xs font-bold text-amber-700">Editing Message</span>
                      </div>
                      <button onClick={cancelEditing} className="p-2 hover:bg-amber-100 rounded-full transition">
                          <X size={16} className="text-amber-700"/>
                      </button>
                  </div>
               )}

               {/* Draft Attachment Preview */}
               {draftAttachment && (
                  <div className="absolute -top-16 left-2 right-2 md:left-6 md:right-6 h-16 bg-slate-100 border border-slate-200 border-b-0 rounded-t-xl flex items-center justify-between px-4 animate-in slide-in-from-bottom-2 fade-in duration-200 shadow-xl z-20">
                      <div className="flex items-center gap-3">
                          {draftAttachment.type.startsWith('image/') ? (
                             <img src={URL.createObjectURL(draftAttachment)} className="w-10 h-10 object-cover rounded-lg border border-slate-300" />
                          ) : (
                             <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                                <FileText size={20} />
                             </div>
                          )}
                          <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px] md:max-w-xs">{draftAttachment.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{(draftAttachment.size / 1024).toFixed(1)} KB</span>
                          </div>
                      </div>
                      <button onClick={() => setDraftAttachment(null)} className="p-2 hover:bg-rose-100 rounded-full transition text-slate-400 hover:text-rose-500">
                          <X size={16} />
                      </button>
                  </div>
               )}

               <div className={`flex items-end space-x-2 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100 shadow-sm focus-within:ring-2 ring-blue-100 transition ${(replyingTo || editingMessageId || draftAttachment) ? 'rounded-t-none' : ''}`}>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-3 bg-white rounded-full text-slate-400 hover:text-blue-500 shadow-sm transition active:scale-90 flex-shrink-0 mb-1">
                     <Paperclip size={20} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  
                  {/* Mention Popup */}
                  {mentionSearch !== null && mentionCandidates.length > 0 && (
                      <div className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-64 max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 z-50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 sticky top-0 bg-white pb-2 border-b border-slate-50">Mention User</p>
                          {mentionCandidates.map(u => (
                              <div 
                                  key={u.id}
                                  onClick={() => insertMention(u.name.replace(/\s/g,''))} 
                                  className="flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 cursor-pointer transition"
                              >
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                                    {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full rounded-full object-cover" /> : u.name.substring(0,2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-700 truncate">{u.name}</p>
                                      <p className="text-[10px] text-slate-400 truncate">@{u.username}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}

                  <textarea 
                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 px-2 min-w-0 resize-none py-3 custom-scrollbar"
                    // placeholder={`Message...`} // Placeholder logic if needed
                    placeholder={editingMessageId ? "Edit your message..." : "Message..."}
                    value={inputText}
                    onChange={handleInputChange}
                    style={{ height: '44px', maxHeight: '120px' }}
                    rows={1}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (editingMessageId) handleUpdateMessage();
                            else handleSendMessage();
                        }
                    }}
                    onPaste={handlePaste}
                  />
                  
                  <button 
                    onClick={editingMessageId ? handleUpdateMessage : handleSendMessage}
                    disabled={isSending || (!inputText.trim() && !draftAttachment)}
                    className={`p-2 md:p-3 text-white rounded-full shadow-lg transition transform active:scale-95 flex-shrink-0 mb-1 flex items-center justify-center ${
                        editingMessageId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-blue-600' 
                    } disabled:opacity-50 disabled:hover:bg-slate-900 disabled:cursor-not-allowed`}
                  >
                     {isSending ? <Loader2 size={18} className="animate-spin" /> : (editingMessageId ? <Pencil size={18} /> : <Send size={18} />)}
                  </button>
               </div>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-slate-300">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <MessageSquare size={40} />
             </div>
             <p className="text-sm font-black uppercase tracking-widest">Select a channel to chat</p>
          </div>
        )}
      </div>

      {/* MODALS */}
      {isCreatingRoom && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-md p-6 md:p-8 shadow-2xl animate-in zoom-in duration-200">
               <h3 className="text-xl font-black text-slate-800 mb-6">New Channel</h3>
               <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Channel Name</label>
                    <input 
                      value={newRoomName}
                      onChange={e => setNewRoomName(e.target.value)}
                      className="w-full mt-2 p-4 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="e.g. #marketing"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Initial Members</label>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2 border border-slate-100 rounded-xl p-2">
                       {store.users.map(u => (
                          <div key={u.id} onClick={() => toggleMemberSelection(u.id)} className={`flex items-center p-2 rounded-lg cursor-pointer ${selectedMembers.includes(u.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                             <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 ${selectedMembers.includes(u.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                {selectedMembers.includes(u.id) && <div className="w-2 h-2 bg-white rounded-full"/>}
                             </div>
                             <span className="text-xs font-bold text-slate-700">{u.name}</span>
                          </div>
                       ))}
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                     <button onClick={() => setIsCreatingRoom(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Cancel</button>
                     <button onClick={handleCreateRoom} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 transition">Create</button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {isAddingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-[2rem] w-full max-w-md p-6 md:p-8 shadow-2xl animate-in zoom-in duration-200">
               <h3 className="text-xl font-black text-slate-800 mb-6">Add People</h3>
               <div className="space-y-4">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 border border-slate-100 rounded-xl p-2">
                     {store.users
                       .filter(u => !(activeRoom?.memberIds || []).includes(u.id))
                       .map(u => (
                        <div key={u.id} onClick={() => toggleMemberSelection(u.id)} className={`flex items-center p-2 rounded-lg cursor-pointer ${selectedMembers.includes(u.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                           <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 ${selectedMembers.includes(u.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                              {selectedMembers.includes(u.id) && <div className="w-2 h-2 bg-white rounded-full"/>}
                           </div>
                           <span className="text-xs font-bold text-slate-700">{u.name}</span>
                        </div>
                     ))}
                    {store.users.filter(u => !(activeRoom?.memberIds || []).includes(u.id)).length === 0 && (
                       <p className="text-center text-xs text-slate-400 py-4">All users are already in this channel.</p>
                    )}
                  </div>
                  <div className="flex gap-4 pt-4">
                     <button onClick={() => { setIsAddingMember(false); setSelectedMembers([]); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Cancel</button>
                     <button onClick={handleAddMember} disabled={selectedMembers.length === 0} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 transition disabled:opacity-50">Add Selected</button>
                  </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}
