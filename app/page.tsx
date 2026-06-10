"use client";

import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";

export default function Home() {

  const [user, setUser] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);

  const [tasks, setTasks] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
  });


  useEffect(() => {

    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      setUser(JSON.parse(storedUser));

      fetchUsers();
      fetchTasks();
    }

  }, []);


  const fetchUsers = async () => {

    const response = await axios.get(
      "http://localhost:5000/tasks/users"
    );

    setUsers(response.data);
  };


  const fetchTasks = async () => {

    const response = await axios.get(
      "http://localhost:5000/tasks"
    );

    setTasks(response.data);
  };


  const handleGoogleLogin = async (credentialResponse: any) => {

    try {

      const response = await axios.post(
        "http://localhost:5000/auth/google",
        {
          token: credentialResponse.credential,
        }
      );

      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      setUser(response.data.user);

      fetchUsers();
      fetchTasks();

    } catch (error) {
      console.log(error);
    }
  };


  const createTask = async () => {

    if (
      !formData.title ||
      !formData.description ||
      !formData.assigned_to
    ) {
      alert("Please fill all fields");
      return;
    }

    await axios.post(
      "http://localhost:5000/tasks/create",
      {
        ...formData,
        created_by: user.email,
      }
    );

    alert("Task Created");

    setFormData({
      title: "",
      description: "",
      assigned_to: "",
    });

    fetchTasks();
  };


  const completeTask = async (id: number) => {

    await axios.patch(
      `http://localhost:5000/tasks/complete/${id}`
    );

    fetchTasks();
  };


  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <GoogleLogin
          onSuccess={handleGoogleLogin}
          onError={() => console.log("Login Failed")}
        />
      </div>
    );
  }


  return (
    <div className="p-10">

      <div className="flex justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold">
            Task Dashboard
          </h1>

          <p>{user.name}</p>
          <p>{user.email}</p>
        </div>

        <button
          className="bg-red-500 text-white px-4 py-2 rounded"
          onClick={() => {
            localStorage.removeItem("user");
            location.reload();
          }}
        >
          Logout
        </button>
      </div>


      <div className="border p-5 rounded mb-10">

        <h2 className="text-xl font-bold mb-4">
          Create Task
        </h2>

        <input
          type="text"
          placeholder="Title"
          className="border p-2 w-full mb-3"
          value={formData.title}
          onChange={(e) =>
            setFormData({
              ...formData,
              title: e.target.value,
            })
          }
        />

        <textarea
          placeholder="Description"
          className="border p-2 w-full mb-3"
          value={formData.description}
          onChange={(e) =>
            setFormData({
              ...formData,
              description: e.target.value,
            })
          }
        />

        <select
          className="border p-2 w-full mb-3"
          value={formData.assigned_to}
          onChange={(e) =>
            setFormData({
              ...formData,
              assigned_to: e.target.value,
            })
          }
        >
          <option value="">Select User</option>

          {users.map((u) => (
            <option
              key={u.id}
              value={u.email}
            >
              {u.name}
            </option>
          ))}
        </select>

        <button
          className="bg-black text-white px-5 py-2 rounded"
          onClick={createTask}
        >
          Create Task
        </button>
      </div>


      <div>

        <h2 className="text-2xl font-bold mb-5">
          Tasks
        </h2>

        <div className="grid gap-5">

          {tasks.map((task) => (

            <div
              key={task.id}
              className="border p-5 rounded"
            >

              <h3 className="text-xl font-bold">
                {task.title}
              </h3>

              <p>{task.description}</p>

              <p className="mt-2">
                Assigned To:
                {" "}
                {task.assigned_to}
              </p>

              <p>
                Status:
                {" "}
                {task.status}
              </p>

              {
                task.status !== "completed" && (
                  <button
                    className="bg-green-500 text-white px-4 py-2 mt-3 rounded"
                    onClick={() => completeTask(task.id)}
                  >
                    Mark Complete
                  </button>
                )
              }

            </div>

          ))}

        </div>

      </div>

    </div>
  );
}