import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../context/StoreContext';
import { ChatRoom, ChatMessage, User } from '../types';
import { Send, Plus, Users, Hash, MessageSquare, Image as ImageIcon, MoreVertical, X, Search, FileText, Reply, Paperclip, Download, ExternalLink, ArrowLeft } from 'lucide-react';
import { useToast } from './Toast';

export default function ChatModule() {
  const store = useAppStore();
  const toast = useToast();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  
  // Reply State
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  
  // Create Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFetchRef = useRef<number>(0);

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  // 1. Poll Rooms
  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000); // Poll rooms every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
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
  };

  // 2. Poll Messages
  useEffect(() => {
    if (!activeRoomId) return;

    // Reset messages when room changes, BUT keep replying empty
    setMessages([]);
    setReplyingTo(null); 
    lastFetchRef.current = 0;
    fetchMessages();
    
    // Mark as Read Immediately
    const markAsRead = async () => {
       try {
         await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/unread`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.authToken}` },
            body: JSON.stringify({ roomId: activeRoomId })
         });
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
      const url = `${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/messages?roomId=${activeRoomId}&after=${lastFetchRef.current}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${store.authToken}` }
      });
      if (res.ok) {
        const newMsgs: ChatMessage[] = await res.json();
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNew = newMsgs.filter(m => !existingIds.has(m.id));
            if (uniqueNew.length === 0) return prev;
            
            const lastMsg = newMsgs[newMsgs.length - 1];
            lastFetchRef.current = Math.max(lastFetchRef.current, lastMsg.createdAt);
            
            return [...prev, ...uniqueNew].sort((a,b) => a.createdAt - b.createdAt);
          });
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!activeRoomId || (!inputText.trim())) return;
    
    try {
      const payload = { 
          roomId: activeRoomId, 
          content: inputText,
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
        setReplyingTo(null); // Clear reply after sending
        fetchMessages();
      }
    } catch (e) {
      toast.error('Failed to send');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoomId) return;
    try {
      const url = await store.uploadFile(file);
      const isImage = file.type.startsWith('image/');
      const content = isImage ? 'Sent an image' : `Sent a file: ${file.name}`;
      
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/messages`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${store.authToken}` 
        },
        body: JSON.stringify({ roomId: activeRoomId, attachmentUrl: url, content })
      });
      fetchMessages();
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed');
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
                <div className={`p-3 rounded-xl flex-shrink-0 ${activeRoomId === room.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                   {room.type === 'GROUP' ? <Hash size={20} /> : <Users size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-baseline mb-1">
                      <h4 className={`text-sm font-bold truncate ${activeRoomId === room.id ? 'text-slate-900' : 'text-slate-700'}`}>{room.name}</h4>
                      {room.lastMessage && <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">{formatTime(Number(room.lastMessage.timestamp))}</span>}
                   </div>
                   {room.lastMessage ? (
                      <p className={`text-xs truncate ${activeRoomId === room.id ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="font-bold">{room.lastMessage.senderName}:</span> {room.lastMessage.content}
                      </p>
                   ) : <p className="text-[10px] text-slate-300 italic">No messages yet</p>}
                </div>
             </button>
           ))}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`
        flex-1 flex-col bg-white h-full relative
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
                  <button onClick={() => setIsAddingMember(true)} className="flex items-center space-x-2 p-2 md:px-4 md:py-2 bg-slate-50 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition">
                     <Users size={16} /> <span className="hidden md:inline">Add People</span>
                  </button>
               </div>
            </div>

            {/* MESSAGES LIST */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 bg-slate-50/30">
               {messages.map((msg, idx) => {
                 const isMe = msg.senderId === store.currentUser?.id;
                 const showHeader = idx === 0 || messages[idx-1].senderId !== msg.senderId || (msg.createdAt - messages[idx-1].createdAt > 300000); 
                 
                 return (
                   <div key={msg.id} className={`group flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
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
                            {/* Reply Action Button */}
                            <button 
                                onClick={() => setReplyingTo(msg)}
                                className={`absolute top-2 ${isMe ? '-left-10' : '-right-10'} p-2 rounded-full bg-slate-200 text-slate-500 opacity-0 group-hover/msg:opacity-100 hover:bg-blue-100 hover:text-blue-600 transition shadow-sm md:flex hidden`}
                                title="Reply"
                            >
                                <Reply size={16} />
                            </button>

                            <div className={`relative px-4 py-3 md:px-5 md:py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm break-words
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
                                
                                <span className={`text-[9px] opacity-70 block text-right mt-1 ${isMe ? 'text-slate-400' : 'text-slate-300'}`}>
                                  {formatTime(msg.createdAt)}
                                </span>
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

               <div className={`flex items-center space-x-2 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100 shadow-sm focus-within:ring-2 ring-blue-100 transition ${replyingTo ? 'rounded-t-none' : ''}`}>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-3 bg-white rounded-full text-slate-400 hover:text-blue-500 shadow-sm transition active:scale-90">
                     <Paperclip size={20} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  
                  <input 
                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 px-2 min-w-0"
                    placeholder={`Message...`}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  
                  <button 
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className="p-2 md:p-3 bg-slate-900 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-slate-900 shadow-lg transition transform active:scale-95 flex-shrink-0"
                  >
                     <Send size={18} />
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
