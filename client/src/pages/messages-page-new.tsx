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
import { Search, Send, ArrowLeft, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function MessagesPageNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fetch user connections to use as contacts
  const { data: connections, isLoading: loadingConnections } = useQuery<{connection: any, user: User}[]>({
    queryKey: ["/api/connections"],
    enabled: !!user,
  });

  // Fetch messages between current user and selected contact
  const { data: messages, isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/messages/${selectedContact?.id}`],
    enabled: !!user && !!selectedContact,
    refetchInterval: selectedContact ? 5000 : false,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: InsertMessage) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return await res.json();
    },
    onSuccess: () => {
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

  // Handle sending a message
  const handleSendMessage = () => {
    if (!user || !selectedContact || !messageText.trim()) return;
    
    sendMessageMutation.mutate({
      senderId: user.id,
      receiverId: selectedContact.id,
      content: messageText.trim()
    });
  };

  // Filter contacts based on search term
  const filteredContacts = connections?.filter(conn => 
    conn.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    conn.user.username.toLowerCase().includes(searchTerm.toLowerCase())
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
                placeholder="Search contacts..."
                className="pl-10 bg-white border-gray-200 shadow-sm hover:border-purple-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all duration-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Contacts list */}
          <div className="flex-1 overflow-y-auto">
            {loadingConnections ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
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
                {filteredContacts && filteredContacts.length > 0 ? (
                  filteredContacts.map(conn => (
                    <div 
                      key={conn.connection.id}
                      className={cn(
                        "flex items-center p-4 cursor-pointer transition-all duration-300 border-l-4 border-transparent hover:border-l-purple-500 hover:bg-gray-50",
                        selectedContact?.id === conn.user.id && "bg-purple-50 border-l-purple-500"
                      )}
                      onClick={() => setSelectedContact(conn.user)}
                    >
                      <Avatar className="h-12 w-12 mr-3">
                        <AvatarImage src={conn.user.profileImageUrl || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600 font-medium shadow-sm">
                          {(conn.user.name || conn.user.username)?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {conn.user.name || conn.user.username}
                          </h3>
                          <span className="text-xs text-gray-500">12m</span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {conn.user.title || "Professional"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                    <div className="bg-purple-100 p-4 rounded-full mb-4">
                      <Search className="h-8 w-8 text-purple-600" />
                    </div>
                    <h3 className="font-medium text-gray-900 mb-2">Your Messages</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Connect with professionals to start messaging.
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
              className="flex-1 flex items-center justify-center relative bg-gray-50"
            >
              <div className="text-center px-6">
                <div className="bg-purple-100 p-6 rounded-full mb-6 mx-auto w-20 h-20 flex items-center justify-center">
                  <Send className="h-10 w-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Welcome to Messages</h3>
                <p className="text-gray-600 text-base leading-relaxed max-w-md mx-auto">
                  Select a contact from the sidebar to start a conversation or continue an existing one.
                </p>
              </div>
            </div>
          ) : (
            // Chat view
            <div className="flex flex-col h-full">
              {/* Chat header */}
              <div 
                className="p-4 flex items-center shadow-sm min-h-[80px] bg-white border-b border-gray-200"
              >
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
                  <p className="text-sm text-gray-600 leading-tight">
                    {selectedContact?.title || "Professional"}
                  </p>
                </div>
              </div>

              {/* Messages area with enhanced background */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-3 relative bg-gray-50"
              >
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
                      messages.map((message, index) => {
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
                                    "max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-md",
                                    isFromUser
                                      ? "text-white rounded-br-md"
                                      : "bg-white text-gray-800 rounded-bl-md border border-gray-200"
                                  )}
                                  style={isFromUser ? {
                                    background: `linear-gradient(135deg, #8a3ffc 0%, #9333ea 100%)`,
                                    boxShadow: '0 4px 12px rgba(138, 63, 252, 0.25)'
                                  } : {}}
                                >
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {message.content}
                                  </p>
                                </div>
                                <span className="text-xs text-gray-500 mt-1 px-2">
                                  {formatTime(message.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
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
                      onChange={(e) => setMessageText(e.target.value)}
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
                    className="rounded-full h-11 w-11 p-0 shadow-lg transition-all duration-200 hover:shadow-xl"
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