import { useEffect, useState } from 'react';
import { fetchDashboardSummary } from '../api/client';
import { Activity, Briefcase, Calendar, CheckCircle, XCircle } from 'lucide-react';

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const profileId = "mock-user-id"; // Will replace with real auth later

  useEffect(() => {
    fetchDashboardSummary(profileId).then(setSummary).catch(console.error);
  }, []);

  if (!summary) return <div className="animate-pulse flex space-x-4">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
        Pipeline Overview
      </h2>
      
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Applications" value={summary.activeApplications} icon={Briefcase} color="bg-blue-500" />
        <StatCard title="Interviews" value={summary.interviews} icon={Calendar} color="bg-yellow-500" />
        <StatCard title="Offers" value={summary.offers} icon={CheckCircle} color="bg-green-500" />
        <StatCard title="Rejections" value={summary.rejections} icon={XCircle} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-indigo-500" />
              Pipeline Health
            </h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Your pipeline is currently <span className="font-bold text-indigo-600 uppercase">{summary.pipelineHealth}</span>.
              </p>
              <ul className="mt-4 space-y-2">
                {summary.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">
                    💡 {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Match Analytics</h3>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">Average Match Score</span>
              <span className="text-2xl font-bold text-gray-900">{summary.averageMatchScore}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${summary.averageMatchScore}%` }}></div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-gray-500">Need Follow-up</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {summary.applicationsNeedingFollowUp} apps
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-md ${color}`}>
              <Icon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-2xl font-semibold text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
