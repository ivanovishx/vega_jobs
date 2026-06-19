import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminUsers, fetchAdminUserProfile, startImpersonation } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

interface AdminApplication {
  applicationId: string;
  companyName: string;
  jobTitle: string;
  status: string;
  category: string | null;
  jobUrl: string | null;
  location: string | null;
  salaryRange: string | null;
  matchScore: number | null;
  dateApplied: string | null;
  dateSaved: string;
  nextAction: string | null;
  nextActionDueDate: string | null;
}

interface AdminUserProfile extends AdminUser {
  candidateProfile: {
    phone: string | null;
    linkedInUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    targetRoles: string[];
    targetCompanies: string[];
    targetLocations: string[];
    workAuthorization: string | null;
    yearsOfExperience: number;
    seniorityLevel: string | null;
    preferredWorkMode: string | null;
    minimumSalary: number | null;
    coreSkills: string[];
  } | null;
  applications: AdminApplication[];
}

const STATUS_BADGE: Record<string, string> = {
  'To Apply': 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-zinc-300',
  Applied: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
  'Recruiter Screen': 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'Hiring Manager Screen': 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'Technical Interview': 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300',
  Onsite: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300',
  Offer: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  Rejected: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300',
  Withdrawn: 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-zinc-400',
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-gray-100 dark:border-white/[0.07] last:border-0">
      <span className="text-gray-500 dark:text-zinc-400">{label}</span>
      <span className="text-gray-900 dark:text-zinc-100 text-right">{value}</span>
    </div>
  );
}

function TagList({ label, items, max = 4 }: { label: string; items: string[] | undefined; max?: number }) {
  if (!items || items.length === 0) return null;
  const visible = items.slice(0, max);
  const extra = items.length - visible.length;
  return (
    <div className="py-1.5 border-b border-gray-100 dark:border-white/[0.07] last:border-0">
      <span className="text-sm text-gray-500 dark:text-zinc-400 block mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((item) => (
          <span key={item} className="text-xs bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
            {item}
          </span>
        ))}
        {extra > 0 && (
          <span className="text-xs bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-zinc-400 px-2 py-0.5 rounded-full">+{extra} más</span>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex-1 bg-gray-50 dark:bg-white/[0.04] rounded-lg px-3 py-2 text-center">
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function Admin() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [showAllApps, setShowAllApps] = useState(false);

  const loadUsers = async (q: string | undefined, p: number) => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers({ search: q, page: p, limit: PAGE_SIZE });
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(appliedSearch || undefined, page);
  }, [appliedSearch, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleViewProfile = async (userId: string) => {
    setLoadingProfile(true);
    setShowAllApps(false);
    try {
      const profile = await fetchAdminUserProfile(userId);
      setSelectedUser(profile);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleImpersonate = async (userId: string) => {
    setImpersonatingId(userId);
    try {
      await startImpersonation(userId);
      await refreshUser();
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-6">Administración de usuarios</h1>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo..."
          className="flex-1 border border-gray-300 dark:border-white/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          Buscar
        </button>
      </form>

      <div className="bg-white dark:bg-[#16161a] rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.04] text-left text-gray-500 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Usuario</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Creado</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.07]">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-zinc-500">Cargando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-zinc-500">Sin resultados</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">{u.name || '—'}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-zinc-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-zinc-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => handleViewProfile(u.id)} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium">
                      Ver perfil
                    </button>
                    <button
                      onClick={() => handleImpersonate(u.id)}
                      disabled={impersonatingId === u.id}
                      className="text-amber-600 dark:text-amber-400 hover:underline text-xs font-medium disabled:opacity-50"
                    >
                      {impersonatingId === u.id ? 'Entrando...' : 'Impersonar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500 dark:text-zinc-400">
          <span>
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-gray-300 dark:border-white/15 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/[0.05]"
            >
              Anterior
            </button>
            <span>Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-gray-300 dark:border-white/15 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/[0.05]"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {(selectedUser || loadingProfile) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div
            className="bg-white dark:bg-[#16161a] rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingProfile ? (
              <div className="p-8 text-center text-gray-400 dark:text-zinc-500">Cargando perfil...</div>
            ) : selectedUser && (() => {
              const apps = selectedUser.applications;
              const interviews = apps.filter((a) =>
                ['Recruiter Screen', 'Hiring Manager Screen', 'Technical Interview', 'Onsite'].includes(a.status)
              ).length;
              const offers = apps.filter((a) => a.status === 'Offer').length;
              const visibleApps = showAllApps ? apps : apps.slice(0, 5);

              return (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      {selectedUser.picture ? (
                        <img src={selectedUser.picture} alt="" className="w-12 h-12 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-semibold">
                          {(selectedUser.name || selectedUser.email)[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">{selectedUser.name || selectedUser.email}</h2>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${selectedUser.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-zinc-400'}`}>
                            {selectedUser.role}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl leading-none">
                      &times;
                    </button>
                  </div>

                  <div className="flex gap-3 mb-6">
                    <StatCard label="Aplicaciones" value={apps.length} accent="text-gray-900 dark:text-zinc-100" />
                    <StatCard label="Entrevistas" value={interviews} accent="text-amber-600 dark:text-amber-400" />
                    <StatCard label="Ofertas" value={offers} accent="text-emerald-600 dark:text-emerald-400" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mb-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase text-gray-400 dark:text-zinc-500 mb-1">Cuenta</h3>
                      <InfoRow label="Registrado" value={new Date(selectedUser.createdAt).toLocaleDateString()} />
                      <InfoRow label="Teléfono" value={selectedUser.candidateProfile?.phone} />
                      <InfoRow
                        label="LinkedIn"
                        value={selectedUser.candidateProfile?.linkedInUrl ? (
                          <a href={selectedUser.candidateProfile.linkedInUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Ver perfil</a>
                        ) : null}
                      />
                      <InfoRow
                        label="GitHub"
                        value={selectedUser.candidateProfile?.githubUrl ? (
                          <a href={selectedUser.candidateProfile.githubUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Ver perfil</a>
                        ) : null}
                      />
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold uppercase text-gray-400 dark:text-zinc-500 mb-1">Búsqueda laboral</h3>
                      <InfoRow label="Experiencia" value={selectedUser.candidateProfile?.yearsOfExperience != null ? `${selectedUser.candidateProfile.yearsOfExperience} años` : null} />
                      <InfoRow label="Seniority" value={selectedUser.candidateProfile?.seniorityLevel} />
                      <InfoRow label="Modalidad" value={selectedUser.candidateProfile?.preferredWorkMode} />
                      <InfoRow label="Salario mínimo" value={selectedUser.candidateProfile?.minimumSalary ? `$${selectedUser.candidateProfile.minimumSalary.toLocaleString()}` : null} />
                      <InfoRow label="Autorización" value={selectedUser.candidateProfile?.workAuthorization} />
                    </div>
                  </div>

                  <div className="mb-6">
                    <TagList label="Roles objetivo" items={selectedUser.candidateProfile?.targetRoles} />
                    <TagList label="Skills principales" items={selectedUser.candidateProfile?.coreSkills} max={6} />
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase text-gray-400 dark:text-zinc-500">
                      Aplicaciones ({apps.length})
                    </h3>
                    {apps.length > 5 && (
                      <button onClick={() => setShowAllApps((v) => !v)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                        {showAllApps ? 'Ver menos' : `Ver todas (${apps.length})`}
                      </button>
                    )}
                  </div>
                  {apps.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-500 py-4">Sin aplicaciones registradas.</p>
                  ) : (
                    <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-white/[0.04] text-left text-gray-500 dark:text-zinc-400">
                          <tr>
                            <th className="px-3 py-2 font-medium">Empresa</th>
                            <th className="px-3 py-2 font-medium">Puesto</th>
                            <th className="px-3 py-2 font-medium">Estado</th>
                            <th className="px-3 py-2 font-medium">Match</th>
                            <th className="px-3 py-2 font-medium">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/[0.07]">
                          {visibleApps.map((app) => (
                            <tr key={app.applicationId}>
                              <td className="px-3 py-2 max-w-[140px] truncate">{app.companyName}</td>
                              <td className="px-3 py-2 max-w-[160px] truncate">
                                {app.jobUrl ? (
                                  <a href={app.jobUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                    {app.jobTitle}
                                  </a>
                                ) : app.jobTitle}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[app.status] || 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-zinc-400'}`}>
                                  {app.status}
                                </span>
                              </td>
                              <td className="px-3 py-2">{app.matchScore != null ? `${app.matchScore}%` : '—'}</td>
                              <td className="px-3 py-2 text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                                {new Date(app.dateApplied || app.dateSaved).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
