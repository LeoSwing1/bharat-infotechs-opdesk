"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Person = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

type Team = {
  id: string;
  name: string;
  code?: string;
};

type Task = {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  assigneeId?: string;
  teamId?: string;
  deadline?: string;
  assignee?: string;
};

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [deadline, setDeadline] = useState("");

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTasks() {
    try {
      const response = await fetch("/api/tasks", {
        cache: "no-store",
      });

      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
      }
    } catch {
      setError("Unable to load tasks.");
    }
  }

  async function loadPeople() {
    try {
      const response = await fetch("/api/people", {
        cache: "no-store",
      });

      const data = await response.json();

      if (response.ok) {
        setPeople(
          data.people ||
            data.users ||
            data.rows ||
            []
        );
      }
    } catch {
      console.error("Unable to load people.");
    }
  }

  async function loadTeams() {
    try {
      const response = await fetch("/api/teams", {
        cache: "no-store",
      });

      const data = await response.json();

      if (response.ok) {
        setTeams(
          data.teams ||
            data.rows ||
            []
        );
      }
    } catch {
      console.error("Unable to load teams.");
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);

      await Promise.all([
        loadTasks(),
        loadPeople(),
        loadTeams(),
      ]);

      setLoading(false);
    }

    load();
  }, []);

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setAssigneeId("");
    setTeamId("");
    setDeadline("");
  }

  async function createTask() {
    setError("");
    setMessage("");

    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assigneeId: assigneeId || undefined,
          teamId: teamId || undefined,
          deadline: deadline
            ? new Date(deadline).toISOString()
            : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Unable to create task."
        );
        return;
      }

      /*
       * IMPORTANT:
       * Do not immediately call loadTasks() here.
       *
       * In DEMO_MODE the API returns the static
       * demo task list, which would overwrite the
       * newly-created task.
       */
      if (data.task) {
        setTasks((current) => [
          data.task,
          ...current,
        ]);
      }

      setMessage("Task created successfully.");
      resetForm();
    } catch {
      setError(
        "Something went wrong while creating the task."
      );
    } finally {
      setBusy(false);
    }
  }

  function getAssigneeName(task: Task) {
    if (task.assignee) {
      return task.assignee;
    }

    const person = people.find(
      (p) => p.id === task.assigneeId
    );

    return person?.name || "Unassigned";
  }

  function priorityClass(value?: string) {
    switch (value) {
      case "URGENT":
        return "bg-red-100 text-red-700";
      case "HIGH":
        return "bg-orange-100 text-orange-700";
      case "LOW":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-blue-100 text-blue-700";
    }
  }

  function statusClass(value?: string) {
    switch (value) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "OVERDUE":
        return "bg-red-100 text-red-700";
      case "STARTED":
        return "bg-blue-100 text-blue-700";
      case "SUBMITTED":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Tasks
        </h1>

        <p className="mt-1 text-gray-500">
          Assign, monitor, review and close work.
        </p>
      </div>

      {/* Create Task */}
      <div className="card p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold">
            Create task
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Assign work to a person or team and set
            its priority and deadline.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold">
              Task title
            </label>

            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="e.g. Prepare internship task board"
              className="w-full rounded-xl border border-gray-300 bg-white p-3 outline-none transition focus:border-gray-900"
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Add instructions, requirements or context..."
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-300 bg-white p-3 outline-none transition focus:border-gray-900"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Priority
            </label>

            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value)
              }
              className="w-full rounded-xl border border-gray-300 bg-white p-3 outline-none"
            >
              {priorityOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Assign to
            </label>

            <select
              value={assigneeId}
              onChange={(e) =>
                setAssigneeId(e.target.value)
              }
              className="w-full rounded-xl border border-gray-300 bg-white p-3 outline-none"
            >
              <option value="">
                Unassigned
              </option>

              {people.map((person) => (
                <option
                  key={person.id}
                  value={person.id}
                >
                  {person.name}
                  {person.role
                    ? ` — ${person.role}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Team */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Team
            </label>

            <select
              value={teamId}
              onChange={(e) =>
                setTeamId(e.target.value)
              }
              className="w-full rounded-xl border border-gray-300 bg-white p-3 outline-none"
            >
              <option value="">
                No team
              </option>

              {teams.map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                >
                  {team.name}
                  {team.code
                    ? ` — ${team.code}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Deadline */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Deadline
            </label>

            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) =>
                setDeadline(e.target.value)
              }
              className="w-full rounded-xl border border-gray-300 bg-white p-3 outline-none"
            />
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={createTask}
            disabled={busy}
            className="rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? "Creating..."
              : "Create task"}
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="card p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold">
              Task list
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {tasks.length} task
              {tasks.length === 1
                ? ""
                : "s"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No tasks yet.
          </div>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="font-semibold text-gray-900 hover:underline"
                  >
                    {task.title}
                  </Link>

                  <div className="mt-1 text-sm text-gray-500">
                    {task.description ||
                      "No description"}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Assigned to:{" "}
                    <span className="font-medium text-gray-700">
                      {getAssigneeName(task)}
                    </span>
                  </div>

                  {task.deadline && (
                    <div className="mt-1 text-xs text-gray-500">
                      Deadline:{" "}
                      {new Date(
                        task.deadline
                      ).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${priorityClass(
                      task.priority
                    )}`}
                  >
                    {task.priority ||
                      "MEDIUM"}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                      task.status
                    )}`}
                  >
                    {task.status ||
                      "ASSIGNED"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}