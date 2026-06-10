"use client";

import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle, LogOut, Plus, User, Mail, ClipboardList,
  Loader2, Menu, X, Heart,
  Edit2, Trash2, StickyNote, Save, XCircle
} from "lucide-react";
// @ts-ignore: prop-types has no bundled type declarations in this project
import PropTypes from "prop-types";

export default function Home() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
  });
  const [notes, setNotes] = useState("");
  const [formData, setFormData] = useState({ title: "", description: "", assigned_to: "" });

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:5000/tasks/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:5000/tasks");
      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const checkUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const loggedUser = {
          name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User",
          email: session.user.email ?? "",
          avatar: session.user.user_metadata?.avatar_url ?? null,
        };
        await axios.post("http://localhost:5000/auth/save-user", loggedUser).catch(console.error);
        setUser(loggedUser);
        await Promise.all([fetchUsers(), fetchTasks()]);
      }
    } catch (error) {
      console.error("Session check failed:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchTasks]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  const loginWithGoogle = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    setGoogleLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTasks([]);
    setUsers([]);
    showToast("Logged out");
  };

  const createTask = async () => {
    if (!formData.title.trim() || !formData.description.trim() || !formData.assigned_to) {
      showToast("Fill all fields", "error");
      return;
    }
    if (formData.assigned_to === user?.email) {
      showToast("Can't assign to yourself", "error");
      return;
    }

    setCreating(true);
    try {
      await axios.post("http://localhost:5000/tasks/create", {
        ...formData,
        created_by: user?.email,
        notes: "",
      });
      setFormData({ title: "", description: "", assigned_to: "" });
      await fetchTasks();
      showToast("Task created!");
    } catch (error) {
      console.error("Create task failed:", error);
      showToast("Failed to create", "error");
    } finally {
      setCreating(false);
    }
  };

  const updateTask = async () => {
    if (!editFormData.title.trim() || !editFormData.description.trim() || !editFormData.assigned_to) {
      showToast("Fill all fields", "error");
      return;
    }
    if (!selectedTask) return;

    try {
      await axios.put(
        `http://localhost:5000/tasks/update/${selectedTask.id}`,
        editFormData,
        { headers: { "X-User-Email": user?.email ?? "" } }
      );
      await fetchTasks();
      setEditModalOpen(false);
      setSelectedTask((prev) => prev ? { ...prev, ...editFormData } : null);
      showToast("Task updated!");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        showToast("You don't have permission to edit this task", "error");
      } else {
        showToast("Failed to update", "error");
      }
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    setDeletingId(id);
    try {
      await axios.delete(`http://localhost:5000/tasks/delete/${id}`, {
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
        `http://localhost:5000/tasks/notes/${selectedTask.id}`,
        { notes },
        { headers: { "X-User-Email": user?.email ?? "" } }
      );
      await fetchTasks();
      setSelectedTask((prev) => prev ? { ...prev, notes } : null);
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

  const completeTask = async (id) => {
    setCompletingId(id);
    try {
      await axios.patch(
        `http://localhost:5000/tasks/complete/${id}`,
        {},
        { headers: { "X-User-Email": user?.email ?? "" } }
      );
      await fetchTasks();
      showToast("Task completed!");
    } catch (error) {
      console.error("Complete task failed:", error);
      showToast("Failed to complete", "error");
    } finally {
      setCompletingId(null);
    }
  };

  const canEditDelete = useCallback(
    (task) => task.created_by === user?.email && task.status !== "completed",
    [user?.email]
  );

  const canCompleteTask = useCallback(
    (task) => task.assigned_to === user?.email && task.status !== "completed",
    [user?.email]
  );

  const getFilteredTasks = useCallback(() => {
    switch (filter) {
      case "my":        return tasks.filter((t) => t.assigned_to === user?.email);
      case "completed": return tasks.filter((t) => t.status === "completed");
      case "pending":   return tasks.filter((t) => t.status === "pending");
      default:          return tasks;
    }
  }, [filter, tasks, user?.email]);

  const filteredTasks  = getFilteredTasks();
  const myTasks        = tasks.filter((t) => t.assigned_to === user?.email);
  const myPendingTasks = myTasks.filter((t) => t.status === "pending").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  // ─── shared input class ──────────────────────────────────────────────────────
  const inputCls =
    "border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-900 rounded-xl mb-5">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-light text-gray-900 mb-2">TaskFlow</h1>
            <p className="text-gray-500 text-sm">Simple task management</p>
          </div>
          <button
            onClick={loginWithGoogle}
            disabled={googleLoading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white transition-all rounded-md px-5 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2">
          <div
            className={`rounded-md shadow-lg p-3 ${
              toast.type === "error" ? "bg-red-600" : "bg-gray-900"
            } text-white min-w-[180px]`}
          >
            <p className="text-sm">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gray-900 p-1.5 rounded-md">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium text-gray-900">TaskFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full" />
              ) : (
                <User className="w-4 h-4 text-gray-600" />
              )}
              <span className="text-sm text-gray-700">{user.name}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full" />
            ) : (
              <User className="w-4 h-4 text-gray-600" />
            )}
            <span className="text-sm text-gray-700">{user.name}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard title="Total"     value={tasks.length} />
          <StatCard title="My Tasks"  value={myTasks.length} />
          <StatCard title="Pending"   value={myPendingTasks} />
          <StatCard title="Completed" value={completedTasks} />
        </div>

        {/* Create Task */}
        <div className="bg-white rounded-md border border-gray-100 mb-6 p-5">
          <h2 className="text-sm font-medium mb-4 flex items-center gap-2 text-gray-700">
            <Plus className="w-4 h-4 text-gray-600" />
            New Task
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Task title"
              className={inputCls}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <select
              className={inputCls}
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            >
              <option value="">Assign to…</option>
              {users
                .filter((u) => u.email !== user.email)
                .map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          <textarea
            placeholder="Description…"
            className={`w-full mt-3 ${inputCls}`}
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <button
            onClick={createTask}
            disabled={creating}
            className="mt-3 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm transition-all disabled:opacity-50"
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating…
              </span>
            ) : (
              "Create Task"
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { id: "all",       label: "All",       count: tasks.length },
            { id: "my",        label: "My Tasks",  count: myTasks.length },
            { id: "pending",   label: "Pending",   count: tasks.filter((t) => t.status === "pending").length },
            { id: "completed", label: "Completed", count: completedTasks },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                filter === f.id
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Tasks Grid — 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredTasks.length === 0 ? (
            <div className="col-span-full bg-white rounded-md border border-gray-100 p-10 text-center">
              <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No tasks</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTask(task);
                  setTaskModalOpen(true);
                }}
                className={`bg-white border rounded-md p-4 cursor-pointer hover:shadow-sm transition-all ${
                  task.status === "completed" ? "border-gray-100 bg-gray-50" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3
                    className={`font-medium text-sm flex-1 ${
                      task.status === "completed" ? "text-gray-400 line-through" : "text-gray-800"
                    }`}
                  >
                    {task.title}
                  </h3>
                  <div className="flex gap-1 shrink-0">
                    {canEditDelete(task) && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                            setEditFormData({
                              title: task.title,
                              description: task.description,
                              assigned_to: task.assigned_to,
                            });
                            setEditModalOpen(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                          aria-label="Edit task"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task.id);
                          }}
                          disabled={deletingId === task.id}
                          className="p-1 hover:bg-gray-100 rounded"
                          aria-label="Delete task"
                        >
                          {deletingId === task.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                {task.notes && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <StickyNote className="w-3 h-3" />
                    <span>Has notes</span>
                  </div>
                )}
                <div className="mt-3 text-xs space-y-1 text-gray-400">
                  <p>To: {task.assigned_to.split("@")[0]}</p>
                  <p>By: {task.created_by?.split("@")[0] ?? "unknown"}</p>
                </div>
                {canCompleteTask(task) && (
                  <div className="mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        completeTask(task.id);
                      }}
                      disabled={completingId === task.id}
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {completingId === task.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Completing…
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Complete
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* ── Task Details Modal ─────────────────────────────────────────────── */}
      {taskModalOpen && selectedTask && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setTaskModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-lg max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-medium text-gray-900">{selectedTask.title}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedTask.status === "completed" ? "Completed" : "In Progress"}
                </p>
              </div>
              <div className="flex gap-2">
                {canEditDelete(selectedTask) && (
                  <>
                    <button
                      onClick={() => {
                        setEditFormData({
                          title: selectedTask.title,
                          description: selectedTask.description,
                          assigned_to: selectedTask.assigned_to,
                        });
                        setEditModalOpen(true);
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded"
                      aria-label="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => deleteTask(selectedTask.id)}
                      className="p-1.5 hover:bg-gray-100 rounded"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-gray-600" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setTaskModalOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[70vh] px-6 py-5">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Description</p>
                  <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {selectedTask.description}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Notes</p>
                    {canEditDelete(selectedTask) && (
                      <button
                        onClick={() => {
                          setNotes(selectedTask.notes ?? "");
                          setNotesModalOpen(true);
                        }}
                        className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        {selectedTask.notes ? "Edit" : "Add"}
                      </button>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-md p-4 min-h-[80px]">
                    {selectedTask.notes ? (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTask.notes}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No notes</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Assigned To</p>
                    <p className="text-sm text-gray-700">{selectedTask.assigned_to}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Created By</p>
                    <p className="text-sm text-gray-700">{selectedTask.created_by ?? "unknown"}</p>
                  </div>
                </div>

                {canCompleteTask(selectedTask) && (
                  <button
                    onClick={() => completeTask(selectedTask.id)}
                    disabled={completingId === selectedTask.id}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-md text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {completingId === selectedTask.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal ─────────────────────────────────────────────────── */}
      {editModalOpen && selectedTask && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setEditModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-medium text-gray-900">Edit Task</h2>
              <button onClick={() => setEditModalOpen(false)} aria-label="Close">
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="text"
                placeholder="Task title"
                className={`w-full ${inputCls}`}
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
              />
              <select
                className={`w-full ${inputCls}`}
                value={editFormData.assigned_to}
                onChange={(e) => setEditFormData({ ...editFormData, assigned_to: e.target.value })}
              >
                <option value="">Assign to…</option>
                {users
                  .filter((u) => u.email !== user.email)
                  .map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name}
                    </option>
                  ))}
              </select>
              <textarea
                placeholder="Description…"
                className={`w-full ${inputCls}`}
                rows={4}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={updateTask}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Notes Modal ─────────────────────────────────────────────────────── */}
      {notesModalOpen && selectedTask && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setNotesModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-gray-600" />
                Task Notes
              </h2>
              <button onClick={() => setNotesModalOpen(false)} aria-label="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                placeholder="Add your notes here…"
                className={`w-full ${inputCls}`}
                rows={8}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setNotesModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={updateNotes}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-12">
        <div className="max-w-5xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-gray-600" />
            <span className="text-xs text-gray-500">TaskFlow</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Heart className="w-3 h-3 text-gray-400" />
            <span>Minimal task management</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded-md p-4 border border-gray-100">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-light text-gray-900 mt-1">{value}</p>
    </div>
  );
}

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
};