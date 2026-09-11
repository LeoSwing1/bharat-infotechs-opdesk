
import 'package:flutter/material.dart';
import 'dashboard/dashboard_screen.dart';
import 'attendance/attendance_screen.dart';
import 'chat/chat_screen.dart';
import 'more_screen.dart';
import 'module_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    const screens = [
      DashboardScreen(),
      _TasksHome(),
      AttendanceScreen(),
      ChatScreen(),
      MoreScreen(),
    ];
    final safeIndex = _index.clamp(0, screens.length - 1);
    return Scaffold(
      body: IndexedStack(index: safeIndex, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded), label: 'Home'),
                    NavigationDestination(icon: Icon(Icons.task_alt_outlined), selectedIcon: Icon(Icons.task_alt_rounded), label: 'Tasks'),
          NavigationDestination(icon: Icon(Icons.fingerprint_outlined), selectedIcon: Icon(Icons.fingerprint_rounded), label: 'Attendance'),
          NavigationDestination(icon: Icon(Icons.forum_outlined), selectedIcon: Icon(Icons.forum_rounded), label: 'Chats'),
          NavigationDestination(icon: Icon(Icons.menu_rounded), selectedIcon: Icon(Icons.menu_open_rounded), label: 'More'),
        ],
      ),
    );
  }
}

class _TasksHome extends StatelessWidget {
  const _TasksHome();
  @override
  Widget build(BuildContext context) => const OpDeskModuleScreen(
    title: 'Tasks',
    subtitle: 'Assignments & work',
    endpoint: '/api/tasks',
    listKey: 'tasks',
    icon: Icons.task_alt_rounded,
  );
}

// ignore: unused_element
class _NotificationsHome extends StatelessWidget {
  const _NotificationsHome();
  @override
  Widget build(BuildContext context) => const OpDeskModuleScreen(
    title: 'Notifications',
    subtitle: 'Alerts & reminders',
    endpoint: '/api/notifications',
    listKey: 'notifications',
    icon: Icons.notifications_rounded,
  );
}
