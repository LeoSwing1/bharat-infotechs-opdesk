"use client";

import { useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    try {
      setLoading(true);

      const [notificationResponse, unreadResponse] =
        await Promise.all([
          fetch("/api/notifications?limit=30", {
            cache: "no-store",
          }),
          fetch("/api/notifications/unread", {
            cache: "no-store",
          }),
        ]);

      if (!notificationResponse.ok || !unreadResponse.ok) {
        return;
      }

      const notificationData =
        await notificationResponse.json();

      const unreadData = await unreadResponse.json();

      setNotifications(
        notificationData.notifications || []
      );

      setUnreadCount(unreadData.count || 0);
    } catch (error) {
      console.error(
        "[OPDesk] Failed to load notifications:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(
      loadNotifications,
      30000
    );

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener(
        "mousedown",
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [open]);

  async function markAsRead(id: string) {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationId: id,
        }),
      });

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                readAt: new Date().toISOString(),
              }
            : notification
        )
      );

      setUnreadCount((count) =>
        Math.max(0, count - 1)
      );
    } catch (error) {
      console.error(
        "[OPDesk] Failed to mark notification:",
        error
      );
    }
  }

  async function markAllAsRead() {
    try {
      await fetch(
        "/api/notifications/read-all",
        {
          method: "POST",
        }
      );

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error(
        "[OPDesk] Failed to mark notifications:",
        error
      );
    }
  }

  function handleNotificationClick(
    notification: Notification
  ) {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }

    if (notification.link) {
      window.location.href =
        notification.link;
    }
  }

  return (
    <div
      ref={panelRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);

          if (!open) {
            loadNotifications();
          }
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
        aria-label="Notifications"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[380px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Notifications
              </h3>

              <p className="mt-0.5 text-xs text-gray-500">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-semibold text-gray-700 hover:text-black"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[430px] overflow-y-auto">
            {loading ? (
              <div className="px-5 py-10 text-center text-sm text-gray-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>

                <p className="text-sm font-semibold text-gray-900">
                  No notifications
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  New activity will appear here.
                </p>
              </div>
            ) : (
              notifications.map(
                (notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() =>
                      handleNotificationClick(
                        notification
                      )
                    }
                    className={`flex w-full gap-3 border-b border-gray-100 px-5 py-4 text-left transition hover:bg-gray-50 ${
                      !notification.readAt
                        ? "bg-gray-50/80"
                        : "bg-white"
                    }`}
                  >
                    <div
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        notification.readAt
                          ? "bg-gray-200"
                          : "bg-blue-500"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            notification.readAt
                              ? "font-medium text-gray-700"
                              : "font-bold text-gray-900"
                          }`}
                        >
                          {notification.title}
                        </p>

                        {!notification.readAt && (
                          <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-blue-600">
                            New
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {notification.message}
                      </p>

                      <p className="mt-2 text-[10px] text-gray-400">
                        {formatNotificationDate(
                          notification.createdAt
                        )}
                      </p>
                    </div>
                  </button>
                )
              )
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.location.href =
                  "/notifications";
              }}
              className="w-full text-center text-xs font-semibold text-gray-700 hover:text-black"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNotificationDate(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = Date.now();
  const diff =
    Math.max(0, now - date.getTime()) / 1000;

  if (diff < 60) {
    return "Just now";
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)} min ago`;
  }

  if (diff < 86400) {
    return `${Math.floor(diff / 3600)} hr ago`;
  }

  if (diff < 604800) {
    return `${Math.floor(diff / 86400)} days ago`;
  }

  return date.toLocaleDateString();
}