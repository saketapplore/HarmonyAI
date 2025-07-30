import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Job } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { MapPin, Clock, Building2, CheckCircle, Calendar } from "lucide-react";

export default function AppliedJobsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [expandedJobIds, setExpandedJobIds] = useState<Set<number>>(new Set());
  const [_, navigate] = useLocation();

  console.log('Current user in AppliedJobsPage:', user);

  // Fetch applied jobs
  const userId = user?.id;

  // Don’t run the query if userId is not a valid number
  const shouldFetch = typeof userId === "number" && !isNaN(userId);
  
  const { data: appliedJobsData, isLoading, error } = useQuery<{ application: any, job: Job }[]>({
    queryKey: shouldFetch ? ["/api/jobs/applied"] : [],
    enabled: shouldFetch,
  });
  
  console.log('Applied jobs query result:', { appliedJobsData, isLoading, error });

  const toggleJobExpanded = (jobId: number) => {
    setExpandedJobIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'applied':
        return 'bg-blue-100 text-blue-800';
      case 'shortlisted':
        return 'bg-yellow-100 text-yellow-800';
      case 'interview':
        return 'bg-purple-100 text-purple-800';
      case 'hired':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Applied Jobs</h1>
            <p className="text-gray-600">Track your job applications and their status</p>
          </div>
          
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const appliedJobs = appliedJobsData || [];

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Applied Jobs</h1>
          <p className="text-gray-600">Track your job applications and their status</p>
        </div>

        {appliedJobs.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No applications yet</h3>
            <p className="text-gray-500 mb-6">You haven't applied to any jobs yet. Start browsing and applying to jobs to see them here.</p>
            <Button
              onClick={() => navigate("/jobs")}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Browse Jobs
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {appliedJobs.map(({ application, job }) => (
              <div key={application.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{job.title}</h3>
                    <div className="flex items-center text-gray-600 mb-2">
                      <Building2 className="h-4 w-4 mr-2" />
                      <span>{job.company}</span>
                    </div>
                    <div className="flex items-center text-gray-600 mb-3">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{job.location}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-2">
                    <Badge className={getStatusColor(application.status)}>
                      {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                    </Badge>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>Applied {formatDate(application.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{job.experienceLevel}</span>
                  </div>
                  <div className="text-gray-700 font-medium">
                    {job.salary}
                  </div>
                </div>

                {job.skills && job.skills.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {job.skills.map((skill: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {expandedJobIds.has(job.id) && (
                  <div className="mt-4">
                    <Separator className="my-3" />
                    <div className="mt-2 text-gray-700">
                      <p>{job.description}</p>
                    </div>
                    
                    {application.note && (
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-900 mb-2">Your Application Note</h4>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                          {application.note}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleJobExpanded(job.id)}
                    className="text-gray-600"
                  >
                    {expandedJobIds.has(job.id) ? "Show less" : "Show more"}
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="text-gray-700"
                    >
                      View Job
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/apply/${job.id}`)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Reapply
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
} 