"use client";

import axios from "axios";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getApiUrl } from "@/lib/api";
import {
  CheckCircle, LogOut, Plus, User, Mail, ClipboardList,
  Loader2, Menu, X, Heart,
  Edit2, Trash2, StickyNote, Save, XCircle, AtSign, Users
} from "lucide-react";

type AppUser = {
  name: string;
  email: string;
  avatar: string | null;
};

type Task = {
  id: number;
  title: string;
  description: string;
  assigned_to: string;
  created_by: string;
  notes?: string;
  status: string;
};

type DbUser = {
  id: string;
  name: string;
  email: string;
};

type AssignMode = "member" | "email";
type AuthMode = "signin" | "signup";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400";

const labelCls = "block text-sm font-semibold text-slate-600 mb-2";

const btnPrimary =
  "bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-3 text-base font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed";

const btnSecondary =
  "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-5 py-3 text-base font-medium transition-all";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

function sessionToUser(session: { user: { email?: string; user_metadata?: Record<string, string> } }): AppUser {
  const meta = session.user.user_metadata ?? {};
  return {
    name: meta.full_name || session.user.email?.split("@")[0] || "User",
    email: session.user.email ?? "",
    avatar: meta.avatar_url ?? null,
  };
}

export default function Home() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ title: "", description: "", assigned_to: "" });
  const [editAssignMode, setEditAssignMode] = useState<AssignMode>("member");
  const [notes, setNotes] = useState("");
  const [formData, setFormData] = useState({ title: "", description: "", assigned_to: "" });
  const [createAssignMode, setCreateAssignMode] = useState<AssignMode>("member");
  const [backendOnline, setBackendOnline] = useState(true);
  const syncingUserRef = useRef(false);

  const apiUrl = getApiUrl();

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/tasks/users`, { timeout: 10000 });
      setUsers(Array.isArray(response.data) ? response.data : []);
      setBackendOnline(true);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setBackendOnline(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/tasks`, { timeout: 10000 });
      setTasks(Array.isArray(response.data) ? response.data : []);
      setBackendOnline(true);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      setBackendOnline(false);
    }
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const syncUserWithBackend = useCallback(async (loggedUser: AppUser) => {
    if (syncingUserRef.current) return;
    syncingUserRef.current = true;

    setUser(loggedUser);

    try {
      await axios.post(`${getApiUrl()}/auth/save-user`, loggedUser, { timeout: 10000 });
      setBackendOnline(true);
      await Promise.all([fetchUsers(), fetchTasks()]);
    } catch (error) {
      console.error("Backend sync failed:", error);
      setBackendOnline(false);
      showToast("Logged in, but backend is unreachable. Start the Flask server on port 5000.", "error");
    } finally {
      syncingUserRef.current = false;
    }
  }, [fetchUsers, fetchTasks, showToast]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await syncUserWithBackend(sessionToUser(session));
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setTasks([]);
        setUsers([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [syncUserWithBackend]);

  const loginWithGoogle = async () => {

    setGoogleLoading(true);
  
    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
  
        options: {
          redirectTo:
            "https://task-manager-q6yc6l0ys-nihal-k-projects11.vercel.app",
        },
      });
  
    if (error) {
  
      showToast(
        error.message,
        "error"
      );
  
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;

    if (!email || !password) {
      showToast("Email and password are required", "error");
      return;
    }
    if (!isValidEmail(email)) {
      showToast("Enter a valid email address", "error");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    if (authMode === "signup") {
      const name = authForm.name.trim();
      if (!name) {
        showToast("Name is required for sign up", "error");
        return;
      }
      if (password !== authForm.confirmPassword) {
        showToast("Passwords do not match", "error");
        return;
      }
    }

    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: authForm.name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          showToast("Account created! Check your email to confirm, then sign in.");
          setAuthMode("signin");
          return;
        }
        showToast("Welcome! Account created successfully.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast("Welcome back!");
      }
      setAuthForm({ name: "", email: "", password: "", confirmPassword: "" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      showToast(message, "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTasks([]);
    setUsers([]);
    showToast("Logged out");
  };

  const validateAssignee = (email: string) => {
    if (!email.trim()) {
      showToast("Select a team member or enter an email", "error");
      return false;
    }
    if (!isValidEmail(email)) {
      showToast("Enter a valid assignee email address", "error");
      return false;
    }
    if (email.trim().toLowerCase() === user?.email?.toLowerCase()) {
      showToast("Cannot assign a task to yourself", "error");
      return false;
    }
    return true;
  };

  const createTask = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      showToast("Title and description are required", "error");
      return;
    }
    if (!validateAssignee(formData.assigned_to)) return;

    setCreating(true);
    try {
      const res = await axios.post(`${apiUrl}/tasks/create`, {
        ...formData,
        assigned_to: formData.assigned_to.trim().toLowerCase(),
        created_by: user?.email,
        notes: "",
      });
      setFormData({ title: "", description: "", assigned_to: "" });
      setCreateAssignMode("member");
      await fetchTasks();
      if (res.data.email_sent) {
        showToast(`Task created! Email sent to ${res.data.email_to}`);
      } else {
        showToast("Task created, but email notification failed", "error");
      }
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.error || "Failed to create task"
        : "Failed to create task";
      showToast(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const updateTask = async () => {
    if (!editFormData.title.trim() || !editFormData.description.trim()) {
      showToast("Title and description are required", "error");
      return;
    }
    if (!selectedTask) return;
    if (!validateAssignee(editFormData.assigned_to)) return;

    try {
      await axios.put(
        `${apiUrl}/tasks/update/${selectedTask.id}`,
        { ...editFormData, assigned_to: editFormData.assigned_to.trim().toLowerCase() },
        { headers: { "X-User-Email": user?.email ?? "" } }
      );
      await fetchTasks();
      setEditModalOpen(false);
      setSelectedTask((prev) => (prev ? { ...prev, ...editFormData } : null));
      showToast("Task updated!");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        showToast("You don't have permission to edit this task", "error");
      } else {
        const msg = axios.isAxiosError(error)
          ? error.response?.data?.error || "Failed to update"
          : "Failed to update";
        showToast(msg, "error");
      }
    }
  };

  const deleteTask = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    setDeletingId(id);
    try {
      await axios.delete(`${apiUrl}/tasks/delete/${id}`, {
        headers: { "X-User-Email": user?.email ?? "" },
      });
      await fetchTasks();
      if (selectedTask?.id === id) {
        setTaskModalOpen(false);
        setSelectedTask(null);
      }
      showToast("Task deleted!");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        showToast("You don't have permission to delete this task", "error");
      } else {
        showToast("Failed to delete", "error");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const updateNotes = async () => {
    if (!selectedTask) return;
    try {
      await axios.patch(
        `${apiUrl}/tasks/notes/${selectedTask.id}`,
        { notes },
        { headers: { "X-User-Email": user?.email ?? "" } }
      );
      await fetchTasks();
      setSelectedTask((prev) => (prev ? { ...prev, notes } : null));
      setNotesModalOpen(false);
      showToast("Notes saved!");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        showToast("You don't have permission to edit notes", "error");
      } else {
        showToast("Failed to save notes", "error");
      }
    }
  };

  const completeTask = async (id: number) => {
    setCompletingId(id);
    try {
      const res = await axios.patch(
        `${apiUrl}/tasks/complete/${id}`,
        {},
        { headers: { "X-User-Email": user?.email ?? "" } }
      );
      await fetchTasks();
      if (res.data.email_sent) {
        showToast(`Task completed! Email sent to ${res.data.email_to}`);
      } else {
        showToast("Task completed, but email notification failed", "error");
      }
    } catch {
      showToast("Failed to complete", "error");
    } finally {
      setCompletingId(null);
    }
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setEditFormData({
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
    });
    const isRegistered = users.some((u) => u.email === task.assigned_to);
    setEditAssignMode(isRegistered ? "member" : "email");
    setEditModalOpen(true);
  };

  const canEditDelete = useCallback(
    (task: Task) => task.created_by === user?.email && task.status !== "completed",
    [user?.email]
  );

  const canCompleteTask = useCallback(
    (task: Task) => task.assigned_to === user?.email && task.status !== "completed",
    [user?.email]
  );

  const getFilteredTasks = useCallback(() => {
    switch (filter) {
      case "my": return tasks.filter((t) => t.assigned_to === user?.email);
      case "completed": return tasks.filter((t) => t.status === "completed");
      case "pending": return tasks.filter((t) => t.status === "pending");
      default: return tasks;
    }
  }, [filter, tasks, user?.email]);

  const filteredTasks = getFilteredTasks();
  const myTasks = tasks.filter((t) => t.assigned_to === user?.email);
  const myPendingTasks = myTasks.filter((t) => t.status === "pending").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const otherUsers = users.filter((u) => u.email !== user?.email);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 flex items-center justify-center p-4">
        {toast && <Toast toast={toast} />}

        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-5 shadow-lg">
              <ClipboardList className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2"> Task Manager</h1>
            <p className="text-slate-500 text-lg">Organize tasks and notify your team by email</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
              {(["signin", "signup"] as AuthMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAuthMode(mode)}
                  className={`flex-1 py-2.5 rounded-lg text-base font-semibold transition-all ${
                    authMode === mode
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {mode === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className={labelCls} htmlFor="auth-name">Full name</label>
                  <input
                    id="auth-name"
                    type="text"
                    placeholder="Your name"
                    className={inputCls}
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className={labelCls} htmlFor="auth-email">Email address</label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  className={inputCls}
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  placeholder={authMode === "signup" ? "At least 6 characters" : "Your password"}
                  className={inputCls}
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>

              {authMode === "signup" && (
                <div>
                  <label className={labelCls} htmlFor="auth-confirm">Confirm password</label>
                  <input
                    id="auth-confirm"
                    type="password"
                    placeholder="Re-enter password"
                    className={inputCls}
                    value={authForm.confirmPassword}
                    onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                  />
                </div>
              )}

              <button
                onClick={handleEmailAuth}
                disabled={authLoading}
                className={`w-full ${btnPrimary} flex items-center justify-center gap-2`}
              >
                {authLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
                {authMode === "signup" ? "Create account" : "Sign in with email"}
              </button>
            </div>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-sm text-slate-400 font-medium">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              onClick={loginWithGoogle}
              disabled={googleLoading}
              className={`w-full ${btnSecondary} flex items-center justify-center gap-2`}
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <p className="text-sm text-slate-400 text-center mt-6 leading-relaxed">
              {authMode === "signup"
                ? "By signing up you agree to use a valid email. Confirmation may be required."
                : "Use the email and password you registered with."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {toast && <Toast toast={toast} />}

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 block leading-tight">Task Manager</span>
              <span className="text-xs text-slate-400 hidden sm:block"></span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-xl">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
              <div className="text-left">
                <p className="text-base font-semibold text-slate-800 leading-tight">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-base font-medium px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-600" />
              </div>
            )}
            <div>
              <p className="text-base font-semibold text-slate-800">{user.name}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>
          <button onClick={logout} className={`w-full ${btnSecondary} flex items-center justify-center gap-2`}>
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {!backendOnline && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-base">
            API is unreachable ({apiUrl}). Check your server env vars on Vercel or run{" "}
            <code className="font-mono text-sm">npm run dev</code> locally.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Tasks" value={tasks.length} />
          <StatCard title="My Tasks" value={myTasks.length} />
          <StatCard title="Pending" value={myPendingTasks} />
          <StatCard title="Completed" value={completedTasks} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-slate-600" />
            Create New Task
          </h2>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} htmlFor="task-title">Task title</label>
              <input
                id="task-title"
                type="text"
                placeholder="What needs to be done?"
                className={inputCls}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <AssigneeField
              label="Assign to"
              mode={createAssignMode}
              onModeChange={setCreateAssignMode}
              value={formData.assigned_to}
              onChange={(assigned_to) => setFormData({ ...formData, assigned_to })}
              users={otherUsers}
              inputCls={inputCls}
              labelCls={labelCls}
            />
          </div>

          <div className="mt-5">
            <label className={labelCls} htmlFor="task-desc">Description</label>
            <textarea
              id="task-desc"
              placeholder="Add details about this task..."
              className={inputCls}
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <button
            onClick={createTask}
            disabled={creating}
            className={`mt-6 ${btnPrimary} flex items-center gap-2`}
          >
            {creating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Create Task
              </>
            )}
          </button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { id: "all", label: "All", count: tasks.length },
            { id: "my", label: "My Tasks", count: myTasks.length },
            { id: "pending", label: "Pending", count: tasks.filter((t) => t.status === "pending").length },
            { id: "completed", label: "Completed", count: completedTasks },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2.5 rounded-xl text-base font-medium transition-all ${
                filter === f.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredTasks.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-14 text-center">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-lg">No tasks found</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTask(task);
                  setTaskModalOpen(true);
                }}
                className={`bg-white border rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all ${
                  task.status === "completed" ? "border-slate-100 bg-slate-50/80" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3
                    className={`font-semibold text-lg flex-1 leading-snug ${
                      task.status === "completed" ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {task.title}
                  </h3>
                  <div className="flex gap-1 shrink-0">
                    {canEditDelete(task) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                          className="p-2 hover:bg-slate-100 rounded-lg"
                          aria-label="Edit task"
                        >
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                          disabled={deletingId === task.id}
                          className="p-2 hover:bg-red-50 rounded-lg"
                          aria-label="Delete task"
                        >
                          {deletingId === task.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-500" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-base text-slate-600 line-clamp-2 mb-4">{task.description}</p>

                {task.notes && (
                  <div className="mb-3 flex items-center gap-1.5 text-sm text-slate-500">
                    <StickyNote className="w-4 h-4" />
                    <span>Has notes</span>
                  </div>
                )}

                <div className="space-y-1.5 text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
                  <p className="flex items-center gap-2">
                    <AtSign className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-slate-700">Assigned:</span>
                    <span className="truncate">{task.assigned_to}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <User className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-slate-700">Created by:</span>
                    <span className="truncate">{task.created_by}</span>
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      task.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {task.status === "completed" ? "Completed" : "Pending"}
                  </span>

                  {canCompleteTask(task) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
                      disabled={completingId === task.id}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      {completingId === task.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {taskModalOpen && selectedTask && (
        <Modal onClose={() => setTaskModalOpen(false)}>
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{selectedTask.title}</h2>
              <p className="text-base text-slate-500 mt-1">
                {selectedTask.status === "completed" ? "Completed" : "In Progress"}
              </p>
            </div>
            <div className="flex gap-2">
              {canEditDelete(selectedTask) && (
                <>
                  <button onClick={() => openEditModal(selectedTask)} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Edit">
                    <Edit2 className="w-5 h-5 text-slate-600" />
                  </button>
                  <button onClick={() => deleteTask(selectedTask.id)} className="p-2 hover:bg-red-50 rounded-lg" aria-label="Delete">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </>
              )}
              <button onClick={() => setTaskModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Close">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[70vh] px-6 py-6 space-y-6">
            <section>
              <p className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">Description</p>
              <div className="bg-slate-50 rounded-xl p-5 text-base text-slate-700 whitespace-pre-wrap">
                {selectedTask.description}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Notes</p>
                {canEditDelete(selectedTask) && (
                  <button
                    onClick={() => { setNotes(selectedTask.notes ?? ""); setNotesModalOpen(true); }}
                    className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    {selectedTask.notes ? "Edit notes" : "Add notes"}
                  </button>
                )}
              </div>
              <div className="bg-slate-50 rounded-xl p-5 min-h-[80px]">
                {selectedTask.notes ? (
                  <p className="text-base text-slate-700 whitespace-pre-wrap">{selectedTask.notes}</p>
                ) : (
                  <p className="text-base text-slate-400 italic">No notes added</p>
                )}
              </div>
            </section>

            <div className="grid sm:grid-cols-2 gap-4">
              <InfoBox label="Assigned To" value={selectedTask.assigned_to} />
              <InfoBox label="Created By" value={selectedTask.created_by ?? "unknown"} />
            </div>

            {canCompleteTask(selectedTask) && (
              <button
                onClick={() => completeTask(selectedTask.id)}
                disabled={completingId === selectedTask.id}
                className={`w-full ${btnPrimary} flex items-center justify-center gap-2`}
              >
                {completingId === selectedTask.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Mark as Complete
              </button>
            )}
          </div>
        </Modal>
      )}

      {editModalOpen && selectedTask && (
        <Modal onClose={() => setEditModalOpen(false)} maxWidth="max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-900">Edit Task</h2>
            <button onClick={() => setEditModalOpen(false)} aria-label="Close">
              <XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className={labelCls}>Task title</label>
              <input
                type="text"
                className={inputCls}
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
              />
            </div>
            <AssigneeField
              label="Assign to"
              mode={editAssignMode}
              onModeChange={setEditAssignMode}
              value={editFormData.assigned_to}
              onChange={(assigned_to) => setEditFormData({ ...editFormData, assigned_to })}
              users={otherUsers}
              inputCls={inputCls}
              labelCls={labelCls}
            />
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                className={inputCls}
                rows={4}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditModalOpen(false)} className={`flex-1 ${btnSecondary}`}>
                Cancel
              </button>
              <button onClick={updateTask} className={`flex-1 ${btnPrimary} flex items-center justify-center gap-2`}>
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {notesModalOpen && selectedTask && (
        <Modal onClose={() => setNotesModalOpen(false)} maxWidth="max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-slate-600" />
              Task Notes
            </h2>
            <button onClick={() => setNotesModalOpen(false)} aria-label="Close">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
          <div className="p-6 space-y-5">
            <textarea
              placeholder="Add your notes here..."
              className={inputCls}
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setNotesModalOpen(false)} className={`flex-1 ${btnSecondary}`}>
                Cancel
              </button>
              <button onClick={updateNotes} className={`flex-1 ${btnPrimary} flex items-center justify-center gap-2`}>
                <Save className="w-5 h-5" />
                Save Notes
              </button>
            </div>
          </div>
        </Modal>
      )}

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-slate-500" />
            <span className="text-base text-slate-500 font-medium"> Task Manager</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            
            <span>(Nihal Kureshi)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AssigneeField({
  label,
  mode,
  onModeChange,
  value,
  onChange,
  users,
  inputCls,
  labelCls,
}: {
  label: string;
  mode: AssignMode;
  onModeChange: (mode: AssignMode) => void;
  value: string;
  onChange: (email: string) => void;
  users: DbUser[];
  inputCls: string;
  labelCls: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex rounded-xl bg-slate-100 p-1 mb-3">
        <button
          type="button"
          onClick={() => { onModeChange("member"); onChange(""); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "member" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <Users className="w-4 h-4" />
          Team member
        </button>
        <button
          type="button"
          onClick={() => { onModeChange("email"); onChange(""); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "email" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <AtSign className="w-4 h-4" />
          Email address
        </button>
      </div>

      {mode === "member" ? (
        <select
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select a team member...</option>
          {users.map((u) => (
            <option key={u.id} value={u.email}>
              {u.name} — {u.email}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="email"
          placeholder="assignee@example.com"
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      <p className="text-sm text-slate-400 mt-2">
        {mode === "member"
          ? "Pick someone who has signed up. Their full email is shown."
          : "Enter any valid email — they will receive a notification."}
      </p>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-base text-slate-800 break-all">{value}</p>
    </div>
  );
}

function Modal({
  children,
  onClose,
  maxWidth = "max-w-2xl",
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${maxWidth} rounded-2xl max-h-[90vh] overflow-hidden shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Toast({ toast }: { toast: { message: string; type: "success" | "error" } }) {
  return (
    <div className="fixed top-20 right-4 z-[60] max-w-sm">
      <div
        className={`rounded-xl shadow-xl px-5 py-4 text-white text-base ${
          toast.type === "error" ? "bg-red-600" : "bg-slate-900"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}
