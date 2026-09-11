import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/opdesk_repository.dart';
import '../../models/dashboard_summary.dart';
import '../../widgets/states.dart';
import '../../widgets/sign_out_action.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<DashboardSummary> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = context.read<OpDeskRepository>().dashboardSummary();
  }

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final firstName = user?.name.split(' ').first;
    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');

    return Scaffold(
      appBar: AppBar(title: const Text('OPDesk'), actions: const [SignOutAction()]),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              firstName != null ? '$greeting, $firstName.' : '$greeting.',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              "Here's what needs attention across OPDesk.",
              style: TextStyle(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 20),
            FutureBuilder<DashboardSummary>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snapshot.hasError) {
                  final message = snapshot.error is ApiException
                      ? (snapshot.error as ApiException).message
                      : 'Could not load dashboard stats.';
                  return ErrorState(message: message, onRetry: _refresh);
                }
                final summary = snapshot.data!;
                if (!summary.available) {
                  return const EmptyState(
                    title: 'Live stats need a database',
                    description: 'The backend is running in demo mode — connect PostgreSQL to see real numbers here.',
                  );
                }
                return _SummaryBody(summary: summary);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryBody extends StatelessWidget {
  const _SummaryBody({required this.summary});
  final DashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    switch (summary.scope) {
      case 'organization':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StatGrid(items: [
              _Stat('Total People', summary.totalPeople ?? 0),
              _Stat('Active People', summary.activePeople ?? 0),
              _Stat('Active Teams', summary.activeTeams ?? 0),
              _Stat('Overdue Tasks', summary.overdueTasks ?? 0),
            ]),
            const SizedBox(height: 20),
            _SectionCard(
              title: 'Tasks by Status',
              child: _StatusBreakdown(tasksByStatus: summary.tasksByStatus),
            ),
          ],
        );
      case 'team':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StatGrid(items: [
              _Stat('Team Members', summary.teamMembers ?? 0),
              _Stat('Total Tasks', summary.totalTasks ?? 0),
              _Stat('Overdue Tasks', summary.overdueTasks ?? 0),
            ]),
            const SizedBox(height: 20),
            _SectionCard(
              title: 'Tasks by Status',
              child: _StatusBreakdown(tasksByStatus: summary.tasksByStatus),
            ),
          ],
        );
      case 'personal':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StatGrid(items: [
              _Stat('My Tasks', summary.myTasks ?? 0),
              _Stat('My Overdue Tasks', summary.myOverdueTasks ?? 0),
            ]),
            const SizedBox(height: 20),
            _SectionCard(
              title: 'My Tasks by Status',
              child: _StatusBreakdown(tasksByStatus: summary.tasksByStatus),
            ),
          ],
        );
      default:
        return const EmptyState(title: 'Nothing to show yet');
    }
  }
}

class _Stat {
  final String label;
  final int value;
  _Stat(this.label, this.value);
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.items});
  final List<_Stat> items;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: items.map((s) {
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(s.label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
              const SizedBox(height: 6),
              Text('${s.value}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _StatusBreakdown extends StatelessWidget {
  const _StatusBreakdown({required this.tasksByStatus});
  final Map<String, int> tasksByStatus;

  @override
  Widget build(BuildContext context) {
    if (tasksByStatus.isEmpty) {
      return Text('No tasks yet.', style: TextStyle(color: Colors.grey.shade600));
    }
    return Column(
      children: tasksByStatus.entries.map((e) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(e.key.replaceAll('_', ' '), style: TextStyle(color: Colors.grey.shade700)),
              Text('${e.value}', style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        );
      }).toList(),
    );
  }
}
