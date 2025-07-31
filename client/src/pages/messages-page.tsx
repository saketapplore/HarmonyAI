import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { User, Message, InsertMessage } from "@shared/schema";
import { Search, Send, ChevronDown, Paperclip, Image, File, X, MoreVertical, Phone, Video, Info, ArrowLeft, MessageSquare, Smile, Plus, Star, Filter, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function MessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get URL parameters to check if we should open a specific conversation
  const getUrlParams = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('userId');
    }
    return null;
  };

  // Fetch all users (needed to find a specific user by ID)
  const { data: allUsers, isLoading: loadingAllUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user && !!getUrlParams(),
  });

  // Fetch user connections to use as contacts
  const { data: connections, isLoading: loadingConnections } = useQuery<{connection: any, user: User}[]>({
    queryKey: ["/api/connections"],
    enabled: !!user,
  });

  // Fetch messages between current user and selected contact
  const { data: messages, isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/messages/${selectedContact?.id}`],
    enabled: !!user && !!selectedContact,
    refetchInterval: selectedContact ? 5000 : false, // Poll for new messages every 5 seconds when a contact is selected
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: InsertMessage) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate messages query to refresh the conversation
      queryClient.invalidateQueries({ queryKey: [`/api/messages/${selectedContact?.id}`] });
      setMessageText("");
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Failed to send your message",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  // Handle opening specific conversation based on URL parameters
  useEffect(() => {
    const targetUserId = getUrlParams();
    
    if (targetUserId && connections) {
      // First check if the user is in our connections
      const targetConnection = connections.find(conn => conn.user.id === parseInt(targetUserId));
      
      if (targetConnection) {
        // If found in connections, set as selected contact
        setSelectedContact(targetConnection.user);
      } else if (allUsers) {
        // If not in connections but we have user data, find them and set as selected
        const targetUser = allUsers.find(u => u.id === parseInt(targetUserId));
        if (targetUser) {
          setSelectedContact(targetUser);
        }
      }
    }
  }, [connections, allUsers]);

  // Handle file selection
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setFilePreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Show file icon for non-images
      setFilePreview('file');
    }
  };
  
  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Handle sending a message
  const handleSendMessage = () => {
    if (!user || !selectedContact || (!messageText.trim() && !selectedFile)) return;
    
    // For now, we'll just mention the file in the message
    // In a real implementation, you would upload the file to a server
    let content = messageText.trim();
    
    if (selectedFile) {
      // Append file information to the message
      if (content) {
        content += `\n[Attached file: ${selectedFile.name}]`;
      } else {
        content = `[Attached file: ${selectedFile.name}]`;
      }
    }
    
    sendMessageMutation.mutate({
      senderId: user.id,
      receiverId: selectedContact.id,
      content: content
    });
    
    // Clear the file after sending
    clearSelectedFile();
  };

  // Filter contacts based on search term
  const filteredContacts = connections?.filter(conn => 
    conn.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    conn.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conn.user.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format time for messages
  const formatTime = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format last message time
  const formatLastMessageTime = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInHours = (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return dateObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-pink-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
          <div className="absolute top-20 right-20 w-32 h-32 bg-gradient-to-br from-cyan-400/40 to-blue-400/40 rounded-full blur-2xl animate-bounce"></div>
          <div className="absolute bottom-20 left-20 w-24 h-24 bg-gradient-to-br from-purple-400/40 to-pink-400/40 rounded-full blur-2xl animate-bounce delay-700"></div>
        </div>

        <div className="relative z-10 h-[calc(100vh-80px)] flex bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 mx-4 my-4">
          {/* Left Sidebar - Conversations List */}
          <div className="w-96 bg-gradient-to-b from-white/20 to-purple-50/20 backdrop-blur-xl border-r border-white/30">
            {/* Header with premium styling */}
            <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-xl border-b border-white/30">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg ring-2 ring-white/20">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                      Messages
                    </h1>
                    <p className="text-sm text-gray-300">Connect with your network</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-sm hover:bg-white/30 ring-1 ring-white/20">
                  <Plus className="h-5 w-5 text-white" />
                </Button>
              </div>
              
              {/* Search with premium styling */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search conversations..."
                  className="pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm border-white/30 rounded-2xl shadow-lg hover:bg-white/30 focus:bg-white/40 focus:border-purple-400 focus:ring-4 focus:ring-purple-100/20 transition-all duration-300 text-white placeholder-gray-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Conversations List with premium styling */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingConnections ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center space-x-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                      <Skeleton className="h-14 w-14 rounded-2xl bg-white/20" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-2 bg-white/20" />
                        <Skeleton className="h-4 w-24 bg-white/20" />
                      </div>
                      <Skeleton className="h-4 w-12 bg-white/20" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredContacts && filteredContacts.length > 0 ? (
                    filteredContacts.map(conn => (
                      <div 
                        key={conn.connection.id}
                        className={cn(
                          "group flex items-center p-4 cursor-pointer transition-all duration-500 backdrop-blur-sm rounded-2xl border border-white/20 hover:border-purple-400/50",
                          "hover:bg-gradient-to-r hover:from-white/30 hover:to-purple-500/20 hover:shadow-2xl hover:scale-[1.02]",
                          "transform hover:-translate-y-1 ring-1 ring-white/10",
                          selectedContact?.id === conn.user.id && 
                          "bg-gradient-to-r from-purple-500/30 to-blue-500/30 border-purple-400/50 shadow-2xl scale-[1.02] ring-2 ring-purple-400/50"
                        )}
                        onClick={() => setSelectedContact(conn.user)}
                      >
                        <div className="relative">
                          <Avatar className="h-14 w-14 mr-4 ring-4 ring-white/30 shadow-lg">
                            <AvatarImage src={conn.user.profileImageUrl || ""} />
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white font-bold text-lg shadow-lg">
                              {(conn.user.name || conn.user.username)?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {/* Online status indicator */}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-3 border-white rounded-full shadow-lg ring-2 ring-green-300"></div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-semibold text-white truncate text-lg">
                              {conn.user.name || conn.user.username}
                            </h3>
                            <span className="text-xs text-gray-300 bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">12m</span>
                          </div>
                          <p className="text-sm text-gray-300 truncate">
                            {conn.user.title || "Professional"}
                          </p>
                        </div>
                        
                        {/* Unread indicator */}
                        <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full shadow-lg ring-2 ring-white/30"></div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-sm ring-2 ring-white/20">
                        <Search className="h-10 w-10 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">Your Messages</h3>
                      <p className="text-gray-300 text-base leading-relaxed">
                        Connect with professionals to start messaging and build your network.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Chat Window */}
          <div className="flex-1 flex flex-col bg-white border border-gray-200 shadow-lg">
            {!selectedContact ? (
              // Premium welcome screen
              <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-gray-50 to-white">
                {/* Animated background patterns */}
                <div className="absolute inset-0">
                  <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-2xl animate-bounce"></div>
                  <div className="absolute bottom-10 right-10 w-40 h-40 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-2xl animate-bounce delay-1000"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-br from-pink-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                </div>
                
                <div className="text-center px-8 relative z-10">
                  <div className="w-32 h-32 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-3xl flex items-center justify-center mb-8 mx-auto backdrop-blur-xl border border-gray-200 shadow-2xl ring-2 ring-purple-100">
                    <Send className="h-16 w-16 text-purple-600" />
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
                    Welcome to Messages
                  </h2>
                  <p className="text-gray-600 text-lg leading-relaxed max-w-lg mx-auto mb-8">
                    Select a contact from the sidebar to start a conversation or continue an existing one.
                  </p>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full animate-pulse"></div>
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-pulse delay-300"></div>
                    <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full animate-pulse delay-600"></div>
                  </div>
                </div>
              </div>
            ) : (
              // Premium chat view
              <div className="flex flex-col h-full">
                {/* Chat header with premium styling */}
                <div className="p-6 bg-white border-b border-gray-200 shadow-sm">
                  <div className="flex items-center">
                    <Avatar className="h-16 w-16 mr-6 ring-4 ring-purple-100 shadow-xl">
                      <AvatarImage src={selectedContact?.profileImageUrl || ""} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white font-bold text-xl shadow-xl">
                        {(selectedContact?.name || selectedContact?.username || "U")?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 py-2">
                      <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1">
                        {selectedContact?.name || selectedContact?.username || "Contact"}
                      </h3>
                      <p className="text-sm text-gray-600 leading-tight">
                        {selectedContact?.title || "Professional"}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" className="w-12 h-12 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300">
                        <Video className="h-5 w-5 text-gray-600" />
                      </Button>
                      <Button variant="ghost" size="sm" className="w-12 h-12 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300">
                        <Phone className="h-5 w-5 text-gray-600" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Messages area with premium background */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 relative bg-gray-50">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white"></div>
                  
                  {loadingMessages ? (
                    <div className="space-y-4 relative z-10">
                      <div className="flex justify-start">
                        <Skeleton className="h-16 w-64 rounded-3xl bg-white" />
                      </div>
                      <div className="flex justify-end">
                        <Skeleton className="h-12 w-48 rounded-3xl bg-white" />
                      </div>
                      <div className="flex justify-start">
                        <Skeleton className="h-20 w-80 rounded-3xl bg-white" />
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages && messages.length > 0 ? (
                        <div className="space-y-4 relative z-10">
                          {messages.map((message, index) => {
                            const isFromUser = message.senderId === user?.id;
                            const showAvatar = index === 0 || messages[index - 1]?.senderId !== message.senderId;
                            
                            return (
                              <div key={message.id} className={cn("flex", isFromUser ? "justify-end" : "justify-start")}>
                                <div className={cn("flex items-end max-w-2xl", isFromUser ? "flex-row-reverse space-x-reverse space-x-3" : "space-x-3")}>
                                  {/* Avatar for other user */}
                                  {!isFromUser && (
                                    <div className="w-10 flex justify-center">
                                      {showAvatar ? (
                                        <Avatar className="h-10 w-10 ring-2 ring-purple-100 shadow-lg">
                                          <AvatarImage src={selectedContact.profileImageUrl || ""} />
                                          <AvatarFallback className="bg-purple-100 text-purple-600 text-xs">
                                            {(selectedContact.name || selectedContact.username)?.substring(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                      ) : (
                                        <div className="w-10 h-10" />
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className={cn("flex flex-col", isFromUser ? "items-end" : "items-start")}>
                                    <div
                                      className={cn(
                                        "max-w-lg px-6 py-4 rounded-3xl shadow-lg",
                                        isFromUser
                                          ? "text-white rounded-br-md"
                                          : "bg-white text-gray-800 rounded-bl-md border border-gray-200"
                                      )}
                                      style={isFromUser ? {
                                        background: `linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)`,
                                        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)'
                                      } : {}}
                                    >
                                      {/* Render message content with support for file attachments */}
                                      {message.content.includes('[Attached file:') ? (
                                        <>
                                          {message.content.split('\n').map((line, i) => (
                                            <div key={i}>
                                              {line.includes('[Attached file:') ? (
                                                <div className="flex items-center mt-2 p-3 bg-gray-100 rounded-2xl">
                                                  <File className="h-5 w-5 mr-3 text-purple-600" />
                                                  <span className="text-sm font-medium">{line.replace('[Attached file:', '').replace(']', '')}</span>
                                                </div>
                                              ) : (
                                                <p className="text-base leading-relaxed">{line}</p>
                                              )}
                                            </div>
                                          ))}
                                        </>
                                      ) : (
                                        <p className="text-base leading-relaxed whitespace-pre-wrap">
                                          {message.content}
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-500 mt-2 px-3 py-1 bg-white rounded-full shadow-sm">
                                      {formatTime(message.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full relative z-10">
                          <div className="text-center bg-white p-8 rounded-3xl border border-gray-200 shadow-lg">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-2xl flex items-center justify-center mb-4 mx-auto ring-2 ring-purple-100">
                              <MessageSquare className="h-8 w-8 text-purple-600" />
                            </div>
                            <p className="text-gray-600 text-lg font-medium">
                              No messages yet. Say hello to start the conversation! 👋
                            </p>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Premium message input */}
                <div className="p-6 bg-white border-t border-gray-200 shadow-sm">
                  {/* File preview */}
                  {selectedFile && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
                      <div className="flex items-center">
                        {filePreview && filePreview !== 'file' ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden mr-3 ring-2 ring-gray-200">
                            <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-xl flex items-center justify-center mr-3 ring-2 ring-gray-200">
                            <File className="h-6 w-6 text-purple-600" />
                          </div>
                        )}
                        <span className="text-sm font-medium truncate max-w-[200px] text-gray-700">{selectedFile.name}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={clearSelectedFile}
                        className="w-8 h-8 rounded-xl hover:bg-red-50 text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-4">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    
                    {/* Premium attachment button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-12 h-12 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-700 transition-all duration-300 shadow-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    
                    {/* Premium input field */}
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Type your message..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="h-14 px-6 rounded-2xl border-gray-200 bg-white shadow-sm hover:border-purple-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-300 text-gray-900 placeholder-gray-400 text-base"
                      />
                    </div>
                    
                    {/* Premium send button */}
                    <Button
                      onClick={handleSendMessage}
                      disabled={(!messageText.trim() && !selectedFile) || sendMessageMutation.isPending}
                      className="w-14 h-14 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)`,
                        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)'
                      }}
                    >
                      <Send className="h-6 w-6 text-white" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}