import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/auth_provider.dart';
import 'attendance/attendance_screen.dart';
import 'chat/chat_screen.dart';
import 'daily_updates/daily_updates_screen.dart';
import 'module_screen.dart';
import 'settings/permissions_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final items = <_MoreItem>[
      _MoreItem('Projects', 'Projects, clients and delivery', Icons.folder_open_rounded, const OpDeskModuleScreen(title: 'Projects', subtitle: 'Projects & delivery', endpoint: '/api/projects', listKey: 'projects', icon: Icons.folder_open_rounded)),
      _MoreItem('Daily Updates', 'Submit and review daily work', Icons.edit_note_rounded, const DailyUpdatesScreen()),
      _MoreItem('Timesheets', 'Worked time and overtime', Icons.timer_rounded, const OpDeskModuleScreen(title: 'Timesheets', subtitle: 'Worked hours', endpoint: '/api/timesheets', listKey: 'records', icon: Icons.timer_rounded)),
      _MoreItem('Meetings', 'Upcoming meetings and calendar', Icons.calendar_month_rounded, const OpDeskModuleScreen(title: 'Meetings', subtitle: 'Meetings & calendar', endpoint: '/api/meetings?upcoming=true', listKey: 'meetings', icon: Icons.calendar_month_rounded)),
      _MoreItem('Notifications', 'Alerts, approvals and reminders', Icons.notifications_rounded, const OpDeskModuleScreen(title: 'Notifications', subtitle: 'Alerts & reminders', endpoint: '/api/notifications', listKey: 'notifications', icon: Icons.notifications_rounded)),
      _MoreItem('People', 'Employees and organization members', Icons.people_alt_rounded, const OpDeskModuleScreen(title: 'People', subtitle: 'Organization people', endpoint: '/api/people', listKey: 'people', icon: Icons.people_alt_rounded)),
      _MoreItem('Teams', 'Teams and team members', Icons.groups_rounded, const OpDeskModuleScreen(title: 'Teams', subtitle: 'Teams & members', endpoint: '/api/teams', listKey: 'teams', icon: Icons.groups_rounded)),
      _MoreItem('Warnings', 'Accountability and warning workflow', Icons.warning_amber_rounded, const OpDeskModuleScreen(title: 'Warnings', subtitle: 'Warnings & approvals', endpoint: '/api/warnings', listKey: 'warnings', icon: Icons.warning_amber_rounded)),
      _MoreItem('Quality & Performance', 'Scores and performance reviews', Icons.insights_rounded, const OpDeskModuleScreen(title: 'Quality & Performance', subtitle: 'Quality scores', endpoint: '/api/quality', listKey: 'scores', icon: Icons.insights_rounded)),
      _MoreItem('Leave', 'Requests and approvals', Icons.event_available_rounded, const OpDeskModuleScreen(title: 'Leave', subtitle: 'Leave requests', endpoint: '/api/leave', listKey: 'requests', icon: Icons.event_available_rounded)),
      _MoreItem('Settings', 'Account and organization configuration', Icons.settings_rounded, const OpDeskModuleScreen(title: 'Settings', subtitle: 'Settings', endpoint: '/api/auth/me', listKey: 'user', icon: Icons.settings_rounded)),
    ];
    if (user?.isSuperAdmin == true) items.add(_MoreItem('Access & Permissions', 'Control role permissions', Icons.admin_panel_settings_rounded, const PermissionsScreen()));

    return Scaffold(
      appBar: AppBar(title: const Text('More', style: TextStyle(fontWeight: FontWeight.w900))),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 10, 16, 30), children: [
        _ProfileCard(), const SizedBox(height: 18),
        const Text('WORKSPACE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.2)), const SizedBox(height: 9),
        ...items.map((m) => Card(elevation: 0, margin: const EdgeInsets.only(bottom: 9), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17), side: BorderSide(color: Colors.grey.shade200)), child: ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 5), leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withValues(alpha: .07), borderRadius: BorderRadius.circular(13)), child: Icon(m.icon, color: Theme.of(context).colorScheme.primary)), title: Text(m.title, style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text(m.subtitle), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => m.screen))))),
      ]),
    );
  }
}
class _MoreItem { const _MoreItem(this.title, this.subtitle, this.icon, this.screen); final String title, subtitle; final IconData icon; final Widget screen; }
class _ProfileCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final u = context.watch<AuthProvider>().user!;
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(17),
        child: Row(
          children: [
            CircleAvatar(
              radius: 28,
              child: Text(
                u.name.isEmpty ? '?' : u.name[0].toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(u.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(u.email, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                  const SizedBox(height: 6),
                  Text(
                    u.role.replaceAll('_', ' '),
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: .6),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
