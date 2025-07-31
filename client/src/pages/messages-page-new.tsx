import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { User, Message, InsertMessage } from "@shared/schema";
import { Search, Send, ArrowLeft, Paperclip, Circle, MoreVertical, Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function MessagesPageNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fetch all users (job seekers) from the database
  const { data: allUsers, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
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

  // Fetch recent conversations from backend
  const { data: conversationsData, isLoading: loadingConversations } = useQuery<{
    otherUser: User;
    lastMessage: Message;
    unreadCount: number;
  }[]>({
    queryKey: ["/api/conversations"],
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // State to track recent conversations
  const [recentConversations, setRecentConversations] = useState<{
    userId: number;
    lastMessageTime: Date;
    lastMessage: string;
    unreadCount: number;
  }[]>([]);

  // Initialize recent conversations from backend data
  useEffect(() => {
    if (conversationsData) {
      const formattedConversations = conversationsData.map(conv => ({
        userId: conv.otherUser.id,
        lastMessageTime: new Date(conv.lastMessage.createdAt),
        lastMessage: conv.lastMessage.content,
        unreadCount: conv.unreadCount
      }));
      setRecentConversations(formattedConversations);
    }
  }, [conversationsData]);

  // Mark messages as read when a contact is selected
  useEffect(() => {
    if (selectedContact && user) {
      markMessagesAsReadMutation.mutate(selectedContact.id);
    }
  }, [selectedContact?.id, user?.id]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: InsertMessage) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return await res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate messages query to refresh the conversation
      queryClient.invalidateQueries({ queryKey: [`/api/messages/${selectedContact?.id}`] });
      
      // Invalidate conversations query to refresh the chat list
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      
      // Update recent conversations with the new message for immediate UI update
      const now = new Date();
      setRecentConversations(prev => {
        const existing = prev.find(conv => conv.userId === variables.receiverId);
        if (existing) {
          // Update existing conversation
          return prev.map(conv => 
            conv.userId === variables.receiverId 
              ? { ...conv, lastMessageTime: now, lastMessage: variables.content, unreadCount: 0 }
              : conv
          );
        } else {
          // Add new conversation
          return [{ 
            userId: variables.receiverId, 
            lastMessageTime: now, 
            lastMessage: variables.content, 
            unreadCount: 0 
          }, ...prev];
        }
      });
      
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

  // Mark messages as read mutation
  const markMessagesAsReadMutation = useMutation({
    mutationFn: async (otherUserId: number) => {
      const res = await apiRequest("POST", "/api/messages/mark-as-read", { otherUserId });
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate conversations query to refresh unread counts
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error) => {
      console.error("Failed to mark messages as read:", error);
    },
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle typing indicator
  const handleTyping = () => {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    setIsTyping(true);
    
    const timeout = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
    
    setTypingTimeout(timeout);
  };

  // Handle sending a message
  const handleSendMessage = () => {
    if (!user || !selectedContact || !messageText.trim()) return;
    
    sendMessageMutation.mutate({
      senderId: user.id,
      receiverId: selectedContact.id,
      content: messageText.trim()
    });
  };

  // Filter and sort users based on recent conversations
  const getSortedUsers = () => {
    if (!allUsers) return [];
    
    // Create a map of users with their conversation data
    const userMap = new Map();
    
    // Add users with conversations first
    recentConversations.forEach(conv => {
      const user = allUsers.find(u => u.id === conv.userId);
      if (user) {
        userMap.set(conv.userId, {
          ...user,
          lastMessageTime: conv.lastMessageTime,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount
        });
      }
    });
    
    // Add users without conversations
    allUsers.forEach(user => {
      if (!userMap.has(user.id)) {
        userMap.set(user.id, {
          ...user,
          lastMessageTime: new Date(0),
          lastMessage: "",
          unreadCount: 0
        });
      }
    });
    
    // Convert to array and sort by last message time (most recent first)
    return Array.from(userMap.values()).sort((a, b) => {
      const timeA = new Date(a.lastMessageTime).getTime();
      const timeB = new Date(b.lastMessageTime).getTime();
      return timeB - timeA; // Most recent first
    });
  };

  // Filter users based on search term
  const filteredUsers = getSortedUsers().filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.title?.toLowerCase().includes(searchTerm.toLowerCase())
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
    const diffInMinutes = (now.getTime() - dateObj.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 1) {
      return 'now';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h`;
    } else {
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-120px)] flex bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Left sidebar - Contact list (always visible) */}
        <div 
          className="w-80 border-r border-gray-200 flex flex-col relative shadow-lg bg-white"
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-800 mb-4">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search job seekers..."
                className="pl-10 bg-white border-gray-200 shadow-sm hover:border-purple-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all duration-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Contacts list */}
          <div className="flex-1 overflow-y-auto">
            {loadingUsers || loadingConversations ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center space-x-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-3 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map(user => (
                    <div 
                      key={user.id}
                      className={cn(
                        "flex items-center p-4 cursor-pointer transition-all duration-300 border-l-4 border-transparent hover:border-l-purple-500 hover:bg-gray-50",
                        selectedContact?.id === user.id && "bg-purple-50 border-l-purple-500"
                      )}
                      onClick={() => setSelectedContact(user)}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 mr-3">
                          <AvatarImage src={user.profileImageUrl || ""} />
                          <AvatarFallback className="bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600 font-medium shadow-sm">
                            {(user.name || user.username)?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online status indicator */}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full shadow-sm"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {user.name || user.username}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {user.lastMessageTime && user.lastMessageTime !== new Date(0) 
                              ? formatLastMessageTime(user.lastMessageTime)
                              : "Active now"
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500 truncate flex-1">
                            {user.lastMessage || user.title || "Job Seeker"}
                          </p>
                          {user.unreadCount > 0 && (
                            <div className="ml-2 bg-purple-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {user.unreadCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                    <div className="bg-purple-100 p-4 rounded-full mb-4">
                      <Search className="h-8 w-8 text-purple-600" />
                    </div>
                    <h3 className="font-medium text-gray-900 mb-2">Job Seekers</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {searchTerm ? "No job seekers found matching your search." : "Connect with job seekers to start messaging."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Chat area */}
        <div className="flex-1 flex flex-col bg-white">
          {!selectedContact ? (
                         // Welcome message when no contact selected
             <div 
               className="flex-1 flex items-center justify-center relative"
               style={{
                 background: `linear-gradient(135deg, #f8fafc 0%, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%, #f8fafc 100%)`,
                 backgroundImage: `
                   radial-gradient(circle at 15% 85%, rgba(139, 92, 246, 0.1) 0%, transparent 45%),
                   radial-gradient(circle at 85% 15%, rgba(59, 130, 246, 0.1) 0%, transparent 45%),
                   radial-gradient(circle at 45% 45%, rgba(16, 185, 129, 0.07) 0%, transparent 45%),
                   radial-gradient(circle at 75% 75%, rgba(236, 72, 153, 0.08) 0%, transparent 40%),
                   radial-gradient(circle at 25% 25%, rgba(245, 158, 11, 0.06) 0%, transparent 40%),
                   radial-gradient(circle at 90% 60%, rgba(99, 102, 241, 0.07) 0%, transparent 35%),
                   radial-gradient(circle at 10% 40%, rgba(34, 197, 94, 0.06) 0%, transparent 35%),
                   radial-gradient(circle at 60% 10%, rgba(239, 68, 68, 0.05) 0%, transparent 30%),
                   radial-gradient(circle at 40% 90%, rgba(168, 85, 247, 0.06) 0%, transparent 30%)
                 `,
                 position: 'relative'
               }}
             >
               {/* Floating bubble decorations for welcome screen */}
               <div className="absolute inset-0 pointer-events-none overflow-hidden">
                 <div className="absolute top-20 left-20 w-24 h-24 bg-gradient-to-br from-purple-300/40 to-pink-300/40 rounded-full blur-md animate-pulse"></div>
                 <div className="absolute top-40 right-32 w-20 h-20 bg-gradient-to-br from-blue-300/40 to-cyan-300/40 rounded-full blur-md animate-pulse" style={{animationDelay: '1.2s'}}></div>
                 <div className="absolute bottom-32 left-32 w-28 h-28 bg-gradient-to-br from-green-300/40 to-emerald-300/40 rounded-full blur-md animate-pulse" style={{animationDelay: '2.5s'}}></div>
                 <div className="absolute bottom-60 right-20 w-16 h-16 bg-gradient-to-br from-yellow-300/40 to-orange-300/40 rounded-full blur-md animate-pulse" style={{animationDelay: '0.8s'}}></div>
                 <div className="absolute top-1/2 left-1/3 w-12 h-12 bg-gradient-to-br from-indigo-300/40 to-purple-300/40 rounded-full blur-md animate-pulse" style={{animationDelay: '1.8s'}}></div>
                 <div className="absolute top-1/4 right-1/4 w-10 h-10 bg-gradient-to-br from-teal-300/40 to-blue-300/40 rounded-full blur-md animate-pulse" style={{animationDelay: '1s'}}></div>
               </div>
              <div className="text-center px-6">
                <div className="bg-purple-100 p-6 rounded-full mb-6 mx-auto w-20 h-20 flex items-center justify-center">
                  <Send className="h-10 w-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Welcome to Messages</h3>
                <p className="text-gray-600 text-base leading-relaxed max-w-md mx-auto mb-6">
                  Select a job seeker from the sidebar to start a conversation or continue an existing one.
                </p>
                
                {/* Real-time features showcase */}
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <div 
                    className="p-4 rounded-xl transition-all duration-300 hover:scale-105"
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full mb-2 mx-auto">
                      <Circle className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-xs text-gray-600 text-center">Real-time messaging</p>
                  </div>
                  <div 
                    className="p-4 rounded-xl transition-all duration-300 hover:scale-105"
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full mb-2 mx-auto">
                      <Search className="h-4 w-4 text-purple-600" />
                    </div>
                    <p className="text-xs text-gray-600 text-center">Instant search</p>
                  </div>
                  <div 
                    className="p-4 rounded-xl transition-all duration-300 hover:scale-105"
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mb-2 mx-auto">
                      <Phone className="h-4 w-4 text-blue-600" />
                    </div>
                    <p className="text-xs text-gray-600 text-center">Professional networking</p>
                  </div>
                  <div 
                    className="p-4 rounded-xl transition-all duration-300 hover:scale-105"
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full mb-2 mx-auto">
                      <Paperclip className="h-4 w-4 text-orange-600" />
                    </div>
                    <p className="text-xs text-gray-600 text-center">File sharing</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Chat view
            <div className="flex flex-col h-full">
              {/* Chat header */}
              <div 
                className="p-4 flex items-center shadow-sm min-h-[80px] bg-white border-b border-gray-200"
              >
                <div className="flex items-center flex-1">
                  <Avatar className="h-12 w-12 mr-4 ring-2 ring-purple-200">
                    <AvatarImage src={selectedContact?.profileImageUrl || ""} />
                    <AvatarFallback className="bg-purple-100 text-purple-600 font-medium">
                      {(selectedContact?.name || selectedContact?.username || "U")?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 py-2">
                    <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1">
                      {selectedContact?.name || selectedContact?.username || "Contact"}
                    </h3>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-600 leading-tight mr-2">
                        {selectedContact?.title || "Job Seeker"}
                      </p>
                      <div className="flex items-center text-green-600 text-xs">
                        <Circle className="h-3 w-3 mr-1" />
                        online
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages area with enhanced background */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-3 relative"
                style={{
                  background: `linear-gradient(135deg, #f8fafc 0%, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%, #f8fafc 100%)`,
                  backgroundImage: `
                    radial-gradient(circle at 15% 85%, rgba(139, 92, 246, 0.08) 0%, transparent 40%),
                    radial-gradient(circle at 85% 15%, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
                    radial-gradient(circle at 45% 45%, rgba(16, 185, 129, 0.05) 0%, transparent 40%),
                    radial-gradient(circle at 75% 75%, rgba(236, 72, 153, 0.06) 0%, transparent 35%),
                    radial-gradient(circle at 25% 25%, rgba(245, 158, 11, 0.04) 0%, transparent 35%),
                    radial-gradient(circle at 90% 60%, rgba(99, 102, 241, 0.05) 0%, transparent 30%),
                    radial-gradient(circle at 10% 40%, rgba(34, 197, 94, 0.04) 0%, transparent 30%),
                    radial-gradient(circle at 60% 10%, rgba(239, 68, 68, 0.03) 0%, transparent 25%),
                    radial-gradient(circle at 40% 90%, rgba(168, 85, 247, 0.04) 0%, transparent 25%)
                  `,
                  position: 'relative'
                }}
              >
                {/* Floating bubble decorations */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute top-10 left-10 w-16 h-16 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-sm animate-pulse"></div>
                  <div className="absolute top-32 right-20 w-12 h-12 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-sm animate-pulse" style={{animationDelay: '1s'}}></div>
                  <div className="absolute bottom-20 left-20 w-20 h-20 bg-gradient-to-br from-green-200/30 to-emerald-200/30 rounded-full blur-sm animate-pulse" style={{animationDelay: '2s'}}></div>
                  <div className="absolute bottom-40 right-10 w-14 h-14 bg-gradient-to-br from-yellow-200/30 to-orange-200/30 rounded-full blur-sm animate-pulse" style={{animationDelay: '0.5s'}}></div>
                  <div className="absolute top-1/2 left-1/4 w-10 h-10 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full blur-sm animate-pulse" style={{animationDelay: '1.5s'}}></div>
                  <div className="absolute top-1/3 right-1/3 w-8 h-8 bg-gradient-to-br from-teal-200/30 to-blue-200/30 rounded-full blur-sm animate-pulse" style={{animationDelay: '0.8s'}}></div>
                </div>
                {loadingMessages ? (
                  <div className="space-y-3">
                    <div className="flex justify-start">
                      <Skeleton className="h-12 w-48 rounded-2xl" />
                    </div>
                    <div className="flex justify-end">
                      <Skeleton className="h-12 w-32 rounded-2xl" />
                    </div>
                    <div className="flex justify-start">
                      <Skeleton className="h-16 w-56 rounded-2xl" />
                    </div>
                  </div>
                ) : (
                  <>
                    {messages && messages.length > 0 ? (
                      <>
                        {messages.map((message, index) => {
                          const isFromUser = message.senderId === user?.id;
                          const showAvatar = index === 0 || messages[index - 1]?.senderId !== message.senderId;
                          
                          return (
                            <div key={message.id} className={cn("flex mb-4", isFromUser ? "justify-end" : "justify-start")}>
                              <div className={cn("flex items-end", isFromUser ? "flex-row-reverse space-x-reverse space-x-2" : "space-x-2")}>
                                {/* Avatar for other user */}
                                {!isFromUser && (
                                  <div className="w-8 flex justify-center">
                                    {showAvatar ? (
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={selectedContact.profileImageUrl || ""} />
                                        <AvatarFallback className="bg-purple-100 text-purple-600 text-xs">
                                          {(selectedContact.name || selectedContact.username)?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    ) : (
                                      <div className="w-8 h-8" />
                                    )}
                                  </div>
                                )}
                                
                                <div className={cn("flex flex-col", isFromUser ? "items-end" : "items-start")}>
                                                                                                        <div
                                     className={cn(
                                       "max-w-xs lg:max-w-md px-4 py-3 rounded-2xl relative",
                                       isFromUser
                                         ? "text-white rounded-br-md"
                                         : "text-gray-800 rounded-bl-md"
                                     )}
                                     style={isFromUser ? {
                                       background: `linear-gradient(135deg, #8a3ffc 0%, #9333ea 100%)`,
                                       boxShadow: '0 12px 32px rgba(138, 63, 252, 0.35), 0 6px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                       border: '1px solid rgba(138, 63, 252, 0.3)',
                                       position: 'relative'
                                     } : {
                                       background: 'rgba(255, 255, 255, 0.95)',
                                       backdropFilter: 'blur(12px)',
                                       boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                                       border: '1px solid rgba(255, 255, 255, 0.9)',
                                       position: 'relative'
                                     }}
                                   >
                                     {/* Subtle inner glow for sent messages */}
                                     {isFromUser && (
                                       <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-30"></div>
                                     )}
                                     {/* Subtle inner glow for received messages */}
                                     {!isFromUser && (
                                       <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/40 to-transparent opacity-20"></div>
                                     )}
                                     <div className="relative z-10">
                                       <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                         {message.content}
                                       </p>
                                     </div>
                                   </div>
                                  <span className="text-xs text-gray-500 mt-1 px-2">
                                    {formatTime(message.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                          <p className="text-gray-600 text-sm">
                            No messages yet. Say hello to start the conversation!
                          </p>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message input */}
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-purple-600 hover:bg-purple-50 p-2 rounded-full transition-colors"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Type your message..."
                      value={messageText}
                      onChange={(e) => {
                        setMessageText(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="rounded-full border-gray-200 bg-white px-4 py-3 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all duration-200"
                    />
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                    className="rounded-full h-11 w-11 p-0 shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, #8a3ffc 0%, #9333ea 100%)`,
                      boxShadow: '0 4px 12px rgba(138, 63, 252, 0.3)'
                    }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}