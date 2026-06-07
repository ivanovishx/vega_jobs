import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import api from '../api/client';

export default function ApplicationDetail() {
  const { id } = useParams();
  const [app, setApp] = useState<any>(null);

  useEffect(() => {
    // For MVP, we fetch applications list and find it. 
    // In a real app, we'd have a specific GET /applications/:id
    api.get('/applications').then(res => {
      const found = res.data.applications.find((a: any) => a.applicationId === id);
      setApp(found);
    });
  }, [id]);

  if (!app) return <div>Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link to="/applications" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applications
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">{app.jobTitle} at {app.companyName}</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Application details and pipeline status.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
            {app.status}
          </span>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Match Score</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-bold">{app.matchScore || 'N/A'}%</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Next Action</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                {app.nextAction ? (
                  <>
                    <Clock className="h-4 w-4 mr-1 text-yellow-500" />
                    {app.nextAction} (Due: {new Date(app.nextActionDueDate).toLocaleDateString()})
                  </>
                ) : '-'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
